/**
 * Server-only session access for the demo app.
 *
 * Every gated page calls `requireAccount()`. There is no middleware doing this
 * once at the edge: a page that forgets the call would then render private
 * material to an anonymous request and nothing would fail loudly. Making each
 * page ask for the account it is rendering for keeps the check where the
 * content is.
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDemoAuth, getRequestContext, type DemoAuthEnv, type RequestContext } from "./auth";

export interface DemoBindings {
  AUTH_DB?: unknown;
  DEMO_DB?: D1Like;
  BA_SECRET?: string;
  CANONICAL_HOST?: string;
  ENVIRONMENT?: string;
}

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ success: boolean; results?: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
  };
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
}

export interface DemoAccount {
  context: RequestContext;
  accountId: string;
  /** Display name from the account record; falls back to the username. */
  name: string;
  username: string;
}

export function demoEnv(): DemoBindings {
  const { env } = getCloudflareContext() as unknown as { env: DemoBindings };
  return env ?? {};
}

function authEnv(env: DemoBindings): DemoAuthEnv {
  const canonicalHost = (env.CANONICAL_HOST ?? "").toLowerCase();
  if (!canonicalHost) throw new Error("CANONICAL_HOST is not configured");
  if (!env.BA_SECRET) throw new Error("BA_SECRET is not configured");
  return { AUTH_DB: env.AUTH_DB, BA_SECRET: env.BA_SECRET, canonicalHost };
}

/**
 * Resolves the signed-in account, or null. Returns null rather than throwing on
 * a missing binding so the entrance page still renders (and says so) when the
 * auth database is unreachable, instead of showing a 500 to someone whose only
 * possible next action is to type a password.
 */
export async function currentAccount(): Promise<DemoAccount | null> {
  let env: DemoBindings;
  try {
    env = demoEnv();
  } catch {
    return null;
  }
  if (!env.AUTH_DB || !env.BA_SECRET || !env.CANONICAL_HOST) return null;

  const auth = await getDemoAuth(authEnv(env));
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = (h.get("host") ?? "").toLowerCase();
  if (!cookie || !host) return null;

  const context = await getRequestContext(auth, cookie, host);
  if (!context) return null;

  // getSession already validated the session; this second read is only for the
  // display name, and is allowed to fail without denying access.
  let name = "";
  let username = "";
  try {
    const session = (await auth.api.getSession({ headers: new Headers({ cookie }) })) as {
      user?: { name?: string; username?: string; displayUsername?: string };
    } | null;
    username = session?.user?.username ?? "";
    name = session?.user?.name || session?.user?.displayUsername || username;
  } catch {
    /* display name is cosmetic */
  }

  return { context, accountId: context.accountId, name: name || "Guest", username };
}

/** Gate for every page that renders private demo material. */
export async function requireAccount(): Promise<DemoAccount> {
  const account = await currentAccount();
  if (!account) redirect("/");
  return account;
}
