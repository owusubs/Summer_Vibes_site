CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  source_page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  source_page TEXT,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_checkout_sessions (
  stripe_session_id TEXT PRIMARY KEY,
  stripe_checkout_url TEXT,
  ticket_type TEXT NOT NULL,
  ticket_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  buyer_name TEXT,
  buyer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source_page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_orders (
  id BIGSERIAL PRIMARY KEY,
  stripe_session_id TEXT NOT NULL UNIQUE REFERENCES ticket_checkout_sessions(stripe_session_id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  ticket_type TEXT NOT NULL,
  ticket_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  buyer_name TEXT,
  buyer_email TEXT,
  status TEXT NOT NULL,
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
