# Summers Vibes Website

Summers Vibes is now set up as a deployable static website with a secure backend API.

## What Is Included

- Static festival website pages
- Stripe Checkout for ticket payments
- Newsletter signup endpoint
- Contact and accessibility form endpoint
- PostgreSQL schema for submissions and ticket orders
- Render deployment blueprint

## Deployment

This project is prepared for Render using `render.yaml`.

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint from the repository.
3. Render will create:
   - `summers-vibes-site`
   - `summers-vibes-api`
   - `summers-vibes-db`
4. Add the secret environment variables when Render asks for them.
5. Set `FRONTEND_ORIGIN` to the live website origin, for example:

```text
https://summers-vibes-site.onrender.com
```

6. In Stripe, add the webhook:

```text
https://summers-vibes-api.onrender.com/api/stripe/webhook
```

Subscribe the webhook to `checkout.session.completed`, then copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Local Development

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Serve the static site:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

For local testing, include `http://localhost:8080` in `FRONTEND_ORIGIN`.
