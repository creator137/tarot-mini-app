CREATE TABLE IF NOT EXISTS users (
 id BIGINT PRIMARY KEY, first_name TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wallets (
 user_id BIGINT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= balance)
);
CREATE TABLE IF NOT EXISTS readings (
 id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), request_key UUID NOT NULL,
 question TEXT NOT NULL, count INTEGER NOT NULL CHECK(count IN (1,3)), price INTEGER NOT NULL,
 cards JSONB NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')),
 result JSONB, model TEXT, prompt_version TEXT NOT NULL DEFAULT '1', catalog_version TEXT NOT NULL DEFAULT '1',
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_token UUID, lease_until TIMESTAMPTZ, error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
 UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS reading_jobs ON readings(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS reading_history ON readings(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), request_key UUID NOT NULL,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 5000 AND 1000000), provider_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending', confirmation_url TEXT, test BOOLEAN,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS ledger (
 id UUID PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('topup','hold','release','charge','refund')),
 amount INTEGER NOT NULL CHECK(amount > 0), reading_id UUID REFERENCES readings(id), payment_id UUID REFERENCES payments(id),
 operation_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
