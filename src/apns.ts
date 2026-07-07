/**
 * APNs push — sends a "new recipe" alert to the owner's devices when a recipe is
 * created. Token-based auth (ES256 JWT from the .p8 key); HTTP/2 to Apple.
 *
 * Env:
 *   APNS_KEY_BASE64  base64 of the .p8 auth key (multi-line PEM, base64'd for env)
 *   APNS_KEY_ID      the key's Key ID
 *   APNS_TEAM_ID     Apple Developer Team ID
 *   APNS_BUNDLE_ID   the app bundle id = apns-topic (default org.ravenhoward.sauce)
 *
 * Device tokens (and whether each is sandbox or production) live in the
 * device_tokens table; a debug build registers a SANDBOX token.
 */

import http2 from "node:http2";
import jwt from "jsonwebtoken";

const KEY_ID = process.env.APNS_KEY_ID;
const TEAM_ID = process.env.APNS_TEAM_ID;
const BUNDLE = process.env.APNS_BUNDLE_ID ?? "org.ravenhoward.sauce";
const KEY_PEM = process.env.APNS_KEY_BASE64
  ? Buffer.from(process.env.APNS_KEY_BASE64, "base64").toString("utf8")
  : undefined;

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

export function apnsConfigured(): boolean {
  return Boolean(KEY_PEM && KEY_ID && TEAM_ID);
}

// Provider token is valid ~1h and reusable; refresh well before expiry.
let cached: { token: string; iat: number } | null = null;
function providerToken(): string | null {
  if (!apnsConfigured()) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - cached.iat < 3000) return cached.token;
  const token = jwt.sign({ iss: TEAM_ID, iat: now }, KEY_PEM as string, {
    algorithm: "ES256",
    header: { alg: "ES256", kid: KEY_ID as string },
  });
  cached = { token, iat: now };
  return token;
}

interface ApnsPayload {
  aps: { alert: { title: string; body: string }; sound: string };
  recipe_id: string;
}

/** Send to one device token on the given APNs host. Returns the HTTP status. */
function sendOne(host: string, deviceToken: string, payload: ApnsPayload): Promise<number> {
  return new Promise((resolve) => {
    const auth = providerToken();
    if (!auth) return resolve(0);
    let settled = false;
    const done = (s: number) => { if (!settled) { settled = true; resolve(s); } };

    const client = http2.connect(`https://${host}`);
    client.on("error", () => done(0));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${auth}`,
      "apns-topic": BUNDLE,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", () => {});
    req.on("end", () => { client.close(); done(status); });
    req.on("error", () => { client.close(); done(0); });
    req.setTimeout(8000, () => { req.close(); client.close(); done(0); });
    req.end(JSON.stringify(payload));
  });
}

/** Push a "new recipe" alert to every device the owner has registered. */
export async function pushRecipe(ownerId: string, recipeId: string, title: string): Promise<void> {
  try {
    if (!apnsConfigured()) return;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/device_tokens?select=token,environment&owner_id=eq.${ownerId}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return;
    const rows = (await res.json()) as { token: string; environment: string }[];

    const payload: ApnsPayload = {
      aps: { alert: { title: "🍳 New recipe", body: title }, sound: "default" },
      recipe_id: recipeId,
    };

    for (const row of rows) {
      const host = row.environment === "production"
        ? "api.push.apple.com"
        : "api.sandbox.push.apple.com";
      const status = await sendOne(host, row.token, payload);
      // 410 Gone = token no longer valid; prune it.
      if (status === 410) {
        await fetch(`${SUPABASE_URL}/rest/v1/device_tokens?token=eq.${row.token}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        }).catch(() => undefined);
      }
    }
  } catch {
    /* best-effort: never throw */
  }
}
