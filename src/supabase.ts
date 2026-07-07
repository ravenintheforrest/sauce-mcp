/**
 * Tiny typed PostgREST client for the Sauce Supabase database.
 *
 * The MCP server is trusted and co-located with Postgres on the homelab behind
 * the Cloudflare tunnel (PRD P4), so it talks to Supabase with the SERVICE key
 * and bypasses RLS by design. No `@supabase/supabase-js` — `fetch` is built into
 * Node 18+ and keeps the dependency surface minimal.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Missing env: set SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env.example / CONTRACT.md)."
  );
}

// Narrowed locals so TS knows these are defined past the guard above.
const baseUrl: string = SUPABASE_URL.replace(/\/+$/, "");
const serviceKey: string = SUPABASE_SERVICE_KEY;
const restBase = `${baseUrl}/rest/v1`;

/**
 * Optional owner to stamp on server-side inserts. Under the service key the DB's
 * `owner_id default auth.uid()` resolves to null, so a single-user/household
 * deployment sets SAUCE_OWNER_ID to the auth.users id that should own MCP-created
 * rows — keeping them visible to the RLS-scoped web/iOS clients (ADR-0006).
 */
export const OWNER_ID = process.env.SAUCE_OWNER_ID;

/** PostgREST `Prefer` representation modes. */
type Representation = "minimal" | "representation";

function authHeaders(): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

async function parseError(res: Response): Promise<never> {
  let detail = "";
  try {
    detail = await res.text();
  } catch {
    /* ignore body read failure */
  }
  throw new Error(
    `Supabase ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`
  );
}

/**
 * GET against a table/view. `query` is a raw PostgREST query string (without the
 * leading `?`), e.g. `select=id,title&id=eq.<uuid>`.
 */
export async function get<T = unknown>(path: string, query = ""): Promise<T> {
  const url = `${restBase}/${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

/**
 * POST a row (or rows). Defaults to `Prefer: return=minimal` so confirmation
 * paths stay lean (P6); pass `representation` only when you need the inserted
 * row back (e.g. to read a server-assigned id).
 */
export async function post<T = unknown>(
  path: string,
  body: unknown,
  prefer: Representation = "minimal",
  extraHeaders: Record<string, string> = {}
): Promise<T | null> {
  const res = await fetch(`${restBase}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      Prefer: `return=${prefer}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  if (prefer === "minimal") return null;
  return (await res.json()) as T;
}

/**
 * PATCH rows matched by `query` (raw PostgREST filter, e.g. `id=eq.<uuid>`).
 */
export async function patch<T = unknown>(
  path: string,
  query: string,
  body: unknown,
  prefer: Representation = "minimal"
): Promise<T | null> {
  const res = await fetch(`${restBase}/${path}?${query}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      Prefer: `return=${prefer}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  if (prefer === "minimal") return null;
  return (await res.json()) as T;
}
