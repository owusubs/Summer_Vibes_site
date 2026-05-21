# Summer Vibes Website

Summer Vibes is now set up as a deployable static website with a secure backend API.

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
   - `summer-vibes-site`
   - `summer-vibes-api`
   - `summer-vibes-db`
4. Add the secret environment variables when Render asks for them.
5. Set `FRONTEND_ORIGIN` to the live website origins. Include each published frontend that should submit forms, for example:

```text
https://summer-vibes-web.onrender.com,https://owusubs.github.io
```

6. In Stripe, add the webhook:

```text
https://summer-vibes-api.onrender.com/api/stripe/webhook
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
