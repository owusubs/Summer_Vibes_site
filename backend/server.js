require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const { Resend } = require("resend");
const Stripe = require("stripe");
const { z } = require("zod");

const requiredEnvironment = [
  "DATABASE_URL",
  "FRONTEND_ORIGIN",
  "ORG_NOTIFICATION_EMAIL",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];

const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);

if (missingEnvironment.length) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

const app = express();
const port = Number(process.env.PORT || 10000);
const normalizeOrigin = (origin = "") => origin.trim().replace(/\/$/, "");
const configuredFrontendOrigins = process.env.FRONTEND_ORIGIN.split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const projectFrontendOrigins = [
  "https://summer-vibes-web.onrender.com",
  "https://owusubs.github.io"
];
const frontendOrigins = [...new Set([...configuredFrontendOrigins, ...projectFrontendOrigins])];
const primaryFrontendOrigin = configuredFrontendOrigins[0] || frontendOrigins[0];
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const ticketTypes = ["weekend", "day", "vip"];
const ticketCatalog = {
  weekend: {
    name: "Weekend Pass",
    amountPence: 12000,
    description: "Access to both festival days, main stage, food area and gallery zones."
  },
  day: {
    name: "Day Ticket",
    amountPence: 7000,
    description: "Access for one chosen festival day."
  },
  vip: {
    name: "VIP Upgrade",
    amountPence: 18000,
    description: "Priority entry, viewing area and VIP lounge access."
  }
};

const emailSchema = z.string().trim().email().max(254);
const optionalEmailSchema = z.string().trim().email().max(254).optional().or(z.literal(""));
const textSchema = z.string().trim().min(1).max(2000);
const optionalTextSchema = z.string().trim().max(2000).optional().or(z.literal(""));

const contactSchema = z.object({
  name: textSchema.max(120),
  email: emailSchema,
  topic: optionalTextSchema,
  message: optionalTextSchema,
  question: optionalTextSchema,
  sourcePage: optionalTextSchema,
  website: optionalTextSchema
}).refine((payload) => payload.message || payload.question, {
  message: "Please enter your message."
});

const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.boolean().optional().default(true),
  sourcePage: optionalTextSchema,
  website: optionalTextSchema
});

const ticketSchema = z.object({
  ticketType: z.enum(ticketTypes),
  quantity: z.coerce.number().int().min(1).max(10),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: optionalEmailSchema,
  sourcePage: optionalTextSchema,
  website: optionalTextSchema
});

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isSpam = (payload) => Boolean(payload.website && payload.website.trim());

const getRequestFrontendOrigin = (request) => {
  const origin = normalizeOrigin(request.get("origin") || "");
  return frontendOrigins.includes(origin) ? origin : primaryFrontendOrigin;
};

const sendNotification = async ({ subject, replyTo, rows }) => {
  const htmlRows = rows
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "Not provided")}</p>`)
    .join("");

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "Summer Vibes <onboarding@resend.dev>",
      to: [process.env.ORG_NOTIFICATION_EMAIL],
      replyTo: replyTo || undefined,
      subject,
      html: `<h2>${escapeHtml(subject)}</h2>${htmlRows}`
    });

    if (error) {
      console.error("Resend notification failed", error);
    }
  } catch (error) {
    console.error("Resend notification failed", error);
  }
};

const runMigrations = async () => {
  if (process.env.RUN_MIGRATIONS === "false") {
    return;
  }

  const schemaPath = path.join(__dirname, "schema.sql");
  await pool.query(fs.readFileSync(schemaPath, "utf8"));
};

const validate = (schema, request, response) => {
  const result = schema.safeParse(request.body);

  if (!result.success) {
    response.status(400).json({ error: result.error.issues[0].message });
    return null;
  }

  return result.data;
};

app.set("trust proxy", 1);
app.use(helmet());

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        request.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      response.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const buyerEmail =
          session.customer_details && session.customer_details.email
            ? session.customer_details.email
            : metadata.buyerEmail || null;
        const buyerName =
          session.customer_details && session.customer_details.name
            ? session.customer_details.name
            : metadata.buyerName || null;

        await pool.query(
          `UPDATE ticket_checkout_sessions
             SET status = $1,
                 buyer_name = COALESCE($2, buyer_name),
                 buyer_email = COALESCE($3, buyer_email),
                 updated_at = NOW()
           WHERE stripe_session_id = $4`,
          ["paid", buyerName, buyerEmail, session.id]
        );

        await pool.query(
          `INSERT INTO ticket_orders (
             stripe_session_id,
             stripe_payment_intent_id,
             ticket_type,
             ticket_name,
             quantity,
             amount_pence,
             currency,
             buyer_name,
             buyer_email,
             status,
             raw_event
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (stripe_session_id)
           DO UPDATE SET
             stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
             ticket_type = EXCLUDED.ticket_type,
             ticket_name = EXCLUDED.ticket_name,
             quantity = EXCLUDED.quantity,
             amount_pence = EXCLUDED.amount_pence,
             currency = EXCLUDED.currency,
             buyer_name = EXCLUDED.buyer_name,
             buyer_email = EXCLUDED.buyer_email,
             status = EXCLUDED.status,
             raw_event = EXCLUDED.raw_event`,
          [
            session.id,
            session.payment_intent || null,
            metadata.ticketType || "unknown",
            metadata.ticketName || "Summer Vibes ticket",
            Number(metadata.quantity || 1),
            session.amount_total || 0,
            session.currency || "gbp",
            buyerName,
            buyerEmail,
            session.payment_status || "paid",
            event
          ]
        );

        await sendNotification({
          subject: "New Summer Vibes ticket order",
          replyTo: buyerEmail,
          rows: [
            ["Ticket", metadata.ticketName],
            ["Quantity", metadata.quantity],
            ["Amount", `GBP ${((session.amount_total || 0) / 100).toFixed(2)}`],
            ["Buyer", buyerName],
            ["Email", buyerEmail],
            ["Stripe session", session.id]
          ]
        });
      }

      response.json({ received: true });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "Webhook processing failed." });
    }
  }
);

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin || "");

      if (!origin || frontendOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS."));
    }
  })
);
app.use(express.json({ limit: "20kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 80,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "summer-vibes-api" });
});

app.post("/api/contact", async (request, response, next) => {
  const payload = validate(contactSchema, request, response);

  if (!payload) {
    return;
  }

  if (isSpam(payload)) {
    response.json({ ok: true });
    return;
  }

  const message = payload.message || payload.question;
  const topic = payload.topic || "general";

  try {
    await pool.query(
      `INSERT INTO contact_messages (name, email, topic, message, source_page)
       VALUES ($1, $2, $3, $4, $5)`,
      [payload.name, payload.email, topic, message, payload.sourcePage || null]
    );

    await sendNotification({
      subject: topic === "accessibility" ? "New access question" : "New Summer Vibes message",
      replyTo: payload.email,
      rows: [
        ["Name", payload.name],
        ["Email", payload.email],
        ["Topic", topic],
        ["Message", message],
        ["Source page", payload.sourcePage]
      ]
    });

    response.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/newsletter", async (request, response, next) => {
  const payload = validate(newsletterSchema, request, response);

  if (!payload) {
    return;
  }

  if (!payload.consent) {
    response.status(400).json({ error: "Please confirm newsletter consent." });
    return;
  }

  if (isSpam(payload)) {
    response.json({ ok: true });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO newsletter_subscribers (email, email_normalized, consent, source_page)
       VALUES ($1, LOWER($1), $2, $3)
       ON CONFLICT (email_normalized)
       DO UPDATE SET
         email = EXCLUDED.email,
         consent = EXCLUDED.consent,
         source_page = EXCLUDED.source_page,
         updated_at = NOW()`,
      [payload.email, payload.consent, payload.sourcePage || null]
    );

    await sendNotification({
      subject: "New Summer Vibes newsletter signup",
      replyTo: payload.email,
      rows: [
        ["Email", payload.email],
        ["Source page", payload.sourcePage]
      ]
    });

    response.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tickets/create-checkout-session", async (request, response, next) => {
  const payload = validate(ticketSchema, request, response);

  if (!payload) {
    return;
  }

  if (isSpam(payload)) {
    response.json({ ok: true });
    return;
  }

  try {
    const ticket = ticketCatalog[payload.ticketType];
    const totalPence = ticket.amountPence * payload.quantity;
    const checkoutFrontendOrigin = getRequestFrontendOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      payment_method_types: ["card"],
      customer_email: payload.email || undefined,
      success_url: `${checkoutFrontendOrigin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutFrontendOrigin}/cancel.html`,
      line_items: [
        {
          quantity: payload.quantity,
          price_data: {
            currency: "gbp",
            unit_amount: ticket.amountPence,
            product_data: {
              name: `Summer Vibes - ${ticket.name}`,
              description: ticket.description
            }
          }
        }
      ],
      metadata: {
        ticketType: payload.ticketType,
        ticketName: ticket.name,
        quantity: String(payload.quantity),
        buyerName: payload.name || "",
        buyerEmail: payload.email || "",
        sourcePage: payload.sourcePage || ""
      },
      payment_intent_data: {
        metadata: {
          ticketType: payload.ticketType,
          ticketName: ticket.name,
          quantity: String(payload.quantity),
          buyerName: payload.name || "",
          buyerEmail: payload.email || "",
          sourcePage: payload.sourcePage || ""
        }
      }
    });

    await pool.query(
      `INSERT INTO ticket_checkout_sessions (
         stripe_session_id,
         stripe_checkout_url,
         ticket_type,
         ticket_name,
         quantity,
         amount_pence,
         currency,
         buyer_name,
         buyer_email,
         source_page
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        session.id,
        session.url,
        payload.ticketType,
        ticket.name,
        payload.quantity,
        totalPence,
        "gbp",
        payload.name || null,
        payload.email || null,
        payload.sourcePage || null
      ]
    );

    response.status(201).json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "The server could not complete that request. Please try again later." });
});

runMigrations()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Summer Vibes API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Summer Vibes API", error);
    process.exit(1);
  });
