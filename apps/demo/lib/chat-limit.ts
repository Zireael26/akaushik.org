/**
 * Server-only D1 chat rate limit: 20 messages per rolling 5 minutes per
 * demo account. Backed by the DEMO_DB `chat_rate` table (see
 * migrations/demo/0001_chat.sql) so the budget holds across isolates.
 */
import "server-only";
import type { D1Like } from "./session";

export const CHAT_RATE_LIMIT_MAX = 20;
export const CHAT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Sliding-window check-and-record. Returns true when the message is within
 * budget (and records it), false when the account must be throttled.
 */
export async function checkAndRecord(db: D1Like, accountId: string): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - CHAT_RATE_LIMIT_WINDOW_MS;
  await db
    .prepare("DELETE FROM chat_rate WHERE account_id = ?1 AND ts < ?2")
    .bind(accountId, windowStart)
    .run();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM chat_rate WHERE account_id = ?1")
    .bind(accountId)
    .first<{ n: number }>();
  const count = typeof row?.n === "number" ? row.n : 0;
  if (count >= CHAT_RATE_LIMIT_MAX) return false;
  await db
    .prepare("INSERT INTO chat_rate (account_id, ts) VALUES (?1, ?2)")
    .bind(accountId, now)
    .run();
  return true;
}
