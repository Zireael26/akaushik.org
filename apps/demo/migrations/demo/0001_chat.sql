-- Apply to DEMO_DB (chat database), separately from AUTH_DB migrations.
-- Sliding-window chat budget: 20 messages per rolling 5 minutes per account,
-- enforced by lib/chat-limit.ts. Timestamps are Unix epoch milliseconds.
CREATE TABLE IF NOT EXISTS chat_rate (
  account_id TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_rate_account_ts ON chat_rate (account_id, ts);
