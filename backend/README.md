# Summer Vibes Backend

This Express API powers:

- Stripe Checkout ticket payments
- Contact and accessibility forms
- Newsletter subscriptions
- PostgreSQL storage for form submissions and paid ticket orders
- Resend email notifications to the festival team

## Local Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Copy `.env.example` to `.env` and fill in the real values.

3. Start the API:

```bash
npm run dev
```

4. Serve the static website from the project root:

```bash
cd ..
python -m http.server 8080
```

5. Visit `http://localhost:8080`.

## Required Environment Variables

- `DATABASE_URL`
- `DATABASE_SSL`
- `RUN_MIGRATIONS`
- `FRONTEND_ORIGIN`
- `ORG_NOTIFICATION_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

`FRONTEND_ORIGIN` can contain multiple comma-separated origins, for example:

```text
https://summer-vibes-web.onrender.com,https://owusubs.github.io,http://localhost:8080,http://127.0.0.1:8080
```

The backend also allows the current Summer Vibes Render Static Site and GitHub Pages origins in code so both published frontends can submit forms. Keep `FRONTEND_ORIGIN` set to the frontend you want Stripe to use as its fallback return site.

## Stripe Webhook

After deploying the API, create a Stripe webhook endpoint:

```text
https://summer-vibes-api.onrender.com/api/stripe/webhook
```

Subscribe it to:

```text
checkout.session.completed
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## API Endpoints

- `GET /api/health`
- `POST /api/contact`
- `POST /api/newsletter`
- `POST /api/tickets/create-checkout-session`
- `POST /api/stripe/webhook`

## Notes

Ticket prices are fixed on the server, not trusted from the browser:

- Weekend Pass: GBP 120
- Day Ticket: GBP 70
- VIP Upgrade: GBP 180

The browser sends only the ticket type and quantity. The backend creates the Stripe Checkout session and records the order when Stripe confirms payment through the webhook.
