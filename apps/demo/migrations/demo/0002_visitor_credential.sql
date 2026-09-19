-- Apply to DEMO_DB after 0001_chat.sql.
-- One upstream visitor credential per demo account, shared by every Worker
-- isolate. The upstream binds each conversation to the visitor id that opened
-- it, so a follow-up minted under a fresh visitor id would be refused; keeping
-- the credential here (rather than in isolate memory) keeps follow-ups working
-- across isolate recycling. expires_at is Unix epoch milliseconds.
CREATE TABLE IF NOT EXISTS visitor_credential (
  account_id TEXT PRIMARY KEY,
  credential TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
