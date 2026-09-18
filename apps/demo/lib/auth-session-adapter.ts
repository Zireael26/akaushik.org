/**
 * Hash-at-rest session-token adapter (product).
 *
 * Wraps any better-auth adapter or adapter factory. For model "session" the
 * bearer `token` is SHA-256-hashed (WebCrypto subtle) at the persistence
 * boundary in both directions; raw bearers are restored onto returned rows
 * ONLY for rows matched by a token-equality where in the same call, so core
 * flows (refresh, revoke) keep working with raw bearers end to end.
 * Qualification: the private auth qualification report (see README.md) (19/19
 * local HTTP round-trip + deployed D1 proof, better-auth 1.7.3).
 */
/** Minimal structural view of the better-auth adapter contract (1.7.3).
 *  Kept local (not imported) so the wrapper does not couple to internal
 *  type-module paths; verified against @better-auth/core db/adapter types. */
interface Where {
  field: string;
  value: string | number | boolean | string[] | number[] | Date | null;
  operator?: string;
  connector?: "AND" | "OR";
  mode?: "sensitive" | "insensitive";
}
interface Adapter {
  create: (args: { model: string; data: Record<string, unknown>; select?: string[] }) => Promise<unknown>;
  update: (args: { model: string; where: Where[]; update: Record<string, unknown> }) => Promise<unknown>;
  updateMany: (args: { model: string; where: Where[]; update: Record<string, unknown> }) => Promise<number>;
  findOne: (args: { model: string; where: Where[]; select?: string[]; join?: unknown }) => Promise<unknown>;
  findMany: (args: { model: string; where?: Where[]; select?: string[]; join?: unknown }) => Promise<unknown[]>;
  delete: (args: { model: string; where: Where[] }) => Promise<unknown>;
  deleteMany: (args: { model: string; where: Where[] }) => Promise<unknown>;
  count: (args: { model: string; where?: Where[] }) => Promise<number>;
}

const enc = new TextEncoder();
const ABSOLUTE_SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function isSessionValid(createdAt: unknown): boolean {
  if (!createdAt) return false;
  const createdAtMs = new Date(createdAt as string | Date).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  const now = Date.now();
  // Reject future creation timestamps (allowing max 60s clock skew)
  if (createdAtMs > now + 60_000) return false;
  // Reject sessions older than 7 days
  if (now - createdAtMs > ABSOLUTE_SESSION_MAX_MS) return false;
  return true;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type WhereLike = Where & { value?: unknown };

async function mapTokenValue(v: unknown): Promise<unknown> {
  if (typeof v === "string") return sha256Hex(v);
  if (Array.isArray(v)) {
    return Promise.all(v.map((x) => (typeof x === "string" ? sha256Hex(x) : x)));
  }
  return v;
}

async function mapWhere(where: Where[] | undefined): Promise<Where[] | undefined> {
  if (!where) return where;
  return Promise.all(
    where.map(async (c) => {
      const cc = c as WhereLike;
      if (cc && cc.field === "token" && "value" in cc) {
        return { ...cc, value: await mapTokenValue(cc.value) } as Where;
      }
      return c;
    }),
  );
}

async function rawTokenFrom(args: { data?: unknown; where?: Where[] }): Promise<string | null> {
  const d = args.data as Record<string, unknown> | undefined;
  if (d && typeof d.token === "string") return d.token;
  for (const c of args.where ?? []) {
    const cc = c as WhereLike;
    if (cc?.field === "token" && typeof cc.value === "string") return cc.value;
  }
  return null;
}

function restore<T>(row: T, raw: string | null): T {
  if (raw && row && typeof row === "object" && "token" in (row as object)) {
    return { ...(row as object), token: raw } as T;
  }
  return row;
}

async function rawsFromWhere(where: Where[] | undefined): Promise<string[]> {
  const out: string[] = [];
  for (const c of where ?? []) {
    const cc = c as WhereLike;
    if (cc?.field !== "token" || !("value" in cc)) continue;
    if (typeof cc.value === "string") out.push(cc.value);
    else if (Array.isArray(cc.value)) {
      for (const x of cc.value) if (typeof x === "string") out.push(x);
    }
  }
  return out;
}

async function restoreRows<T>(rows: T, raws: string[]): Promise<T> {
  if (raws.length === 0 || rows == null) return rows;
  const pairs = await Promise.all(raws.map(async (r) => [r, await sha256Hex(r)] as const));
  const restoreOne = (row: unknown) => {
    if (!row || typeof row !== "object" || !("token" in row)) return row;
    const hit = pairs.find(([, h]) => h === (row as Record<string, unknown>).token);
    return hit ? { ...(row as object), token: hit[0] } : row;
  };
  return (Array.isArray(rows) ? (rows as unknown[]).map(restoreOne) : restoreOne(rows)) as T;
}

function wrapAdapter(inner: Adapter): Adapter {
  const wrap = {
    create: async (args: { model: string; data: Record<string, unknown>; select?: string[] }) => {
      if (args?.model !== "session") return (inner as Adapter).create(args as never);
      const raw = await rawTokenFrom({ data: args.data });
      const created = await (inner as Adapter).create({
        ...args,
        data: { ...args.data, token: await sha256Hex(args.data.token as string) },
      } as never);
      return restore(created, raw);
    },
    update: async (args: { model: string; where: Where[]; update: Record<string, unknown> }) => {
      if (args?.model !== "session") return (inner as Adapter).update(args as never);
      const raw = await rawTokenFrom(args);
      const upd = { ...args.update };
      if (typeof upd.token === "string") upd.token = await sha256Hex(upd.token);
      const out = await (inner as Adapter).update({
        ...args,
        where: (await mapWhere(args.where)) as never,
        update: upd,
      } as never);
      return restore(out, raw);
    },
    updateMany: async (args: { model: string; where: Where[]; update: Record<string, unknown> }) => {
      if (args?.model !== "session") return (inner as Adapter).updateMany(args as never);
      const upd = { ...args.update };
      if (typeof upd.token === "string") upd.token = await sha256Hex(upd.token);
      return (inner as Adapter).updateMany({
        ...args,
        where: (await mapWhere(args.where)) as never,
        update: upd,
      } as never);
    },
    findOne: async (args: { model: string; where: Where[] }) => {
      if (args?.model !== "session") return (inner as Adapter).findOne(args as never);
      const raws = await rawsFromWhere(args.where);
      const out = await (inner as Adapter).findOne({
        ...args,
        where: (await mapWhere(args.where)) as never,
      } as never);
      const restored = (await restoreRows(out, raws)) as Record<string, unknown> | null;
      if (!restored || !isSessionValid(restored.createdAt)) {
        return null;
      }
      return restored;
    },
    findMany: async (args: { model: string; where?: Where[] }) => {
      if (args?.model !== "session") return (inner as Adapter).findMany(args as never);
      const raws = await rawsFromWhere(args.where);
      const out = await (inner as Adapter).findMany({
        ...args,
        where: await mapWhere(args.where),
      } as never);
      const restored = (await restoreRows(out, raws)) as Record<string, unknown>[];
      return (restored || []).filter((row) => row && isSessionValid(row.createdAt));
    },
    delete: async (args: { model: string; where: Where[] }) => {
      if (args?.model !== "session") return (inner as Adapter).delete(args as never);
      return (inner as Adapter).delete({
        ...args,
        where: (await mapWhere(args.where)) as never,
      } as never);
    },
    deleteMany: async (args: { model: string; where: Where[] }) => {
      if (args?.model !== "session") return (inner as Adapter).deleteMany(args as never);
      return (inner as Adapter).deleteMany({
        ...args,
        where: (await mapWhere(args.where)) as never,
      } as never);
    },
    count: async (args: { model: string; where?: Where[] }) => {
      if (args?.model !== "session") return (inner as Adapter).count(args as never);
      return (inner as Adapter).count({ ...args, where: await mapWhere(args.where) } as never);
    },
  };
  return new Proxy(inner as object, {
    get(t, p, r) {
      if (p in wrap) return (wrap as Record<PropertyKey, unknown>)[p];
      if (p === "transaction") {
        const v = Reflect.get(t as object, p, r);
        if (typeof v !== "function") return v;
        // Transactional clones would otherwise bypass the wrapper entirely.
        return (cb: (trx: Adapter) => Promise<unknown>) =>
          (v as (cb: (trx: Adapter) => Promise<unknown>) => Promise<unknown>).call(
            t,
            (trx: Adapter) => cb(wrapAdapter(trx)),
          );
      }
      const v = Reflect.get(t as object, p, r);
      return typeof v === "function"
        ? (...a: never[]) => (v as (...a: never[]) => unknown).apply(t, a)
        : v;
    },
  }) as unknown as Adapter;
}

/** Runtime shape guard: reject malformed adapter inputs loudly instead of
 *  failing obscurely later (a bad wrap could silently disable hashing). */
function assertAdapterLike(inner: unknown, what: string): void {
  if ((typeof inner === "object" && inner !== null) || typeof inner === "function") return;
  throw new TypeError(`withHashedSessionTokens: expected adapter or factory, got ${what}`);
}

/** Accept an adapter instance or an adapter factory; wrap the produced adapter. */
export function withHashedSessionTokens<T extends object>(inner: T): T {
  assertAdapterLike(inner, typeof inner);
  if (typeof inner === "function") {
    return new Proxy(inner, {
      apply(t, thisArg, args) {
        return wrapAdapter(
          Reflect.apply(t as (...a: never[]) => Adapter, thisArg, args) as Adapter,
        ) as unknown as T;
      },
    }) as T;
  }
  return wrapAdapter(inner as unknown as Adapter) as unknown as T;
}
