/**
 * Auto-image for new recipes (the PRD's P2 "image fetch" side effect).
 *
 * Goal: a CLOSE, literal photo of the dish/ingredient — or nothing. A wrong
 * image is worse than none, so every source is gated and we skip when unsure.
 *
 * Sources, in order:
 *   1. Unsplash  — if UNSPLASH_ACCESS_KEY is set. Clean, relevant food photos.
 *   2. Wikipedia — key-less fallback. Literal encyclopedia lead images, with a
 *      relevance gate (article must share a food word with the cleaned title;
 *      "List of…"/disambiguation pages and image-less pages are rejected).
 *
 * The chosen image is downloaded, uploaded to the recipe-images Storage bucket,
 * and patched onto the recipe. Runs fire-and-forget after create_recipe returns.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const PUBLIC_BASE = (process.env.SAUCE_PUBLIC_BASE ?? SUPABASE_URL).replace(/\/+$/, "");
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const BUCKET = "recipe-images";
const UA = "sauce-recipe-app/1.0 (https://ravenhoward.org; personal recipe app)";

// Filler words stripped from a title to get the core dish/ingredient.
const FILLER = new Set(
  ("classic easy best homemade quick simple the a an of recipe with and or in for to " +
   "fluffy creamy crispy healthy high protein gluten free vegan vegetarian one pan bowl " +
   "kids version adult instant pot slow cooker crock baked bake spiced double mexican " +
   "korean inspired thai style better than takeout by tasty bob red mill flour minute " +
   "minutes oil rainbow pillowy fish ").split(" ")
);

function cleanQuery(title: string): string {
  const noParens = title.toLowerCase().replace(/\(.*?\)/g, " ");
  const letters = noParens.replace(/[^a-z\s]/g, " ");
  const words = letters.split(/\s+/).filter((w) => w.length > 2 && !FILLER.has(w));
  return words.join(" ").trim();
}

function stem(w: string): string {
  return w.replace(/(ies|es|s)$/, "").toLowerCase();
}

/** A query word and an article word are "related" if their stems overlap (≥4 chars). */
function related(queryWords: string[], titleWords: string[]): boolean {
  const q = queryWords.map(stem).filter((w) => w.length >= 3);
  const t = titleWords.map(stem).filter((w) => w.length >= 3);
  return q.some((qw) =>
    t.some((tw) => qw === tw || (qw.length >= 4 && tw.length >= 4 && (qw.includes(tw) || tw.includes(qw))))
  );
}

async function unsplashImage(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { urls?: { regular?: string } }[] };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

async function wikipediaImage(query: string): Promise<string | null> {
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    const params: Record<string, string> = {
      action: "query", generator: "search", gsrsearch: query, gsrlimit: "4",
      prop: "pageimages", piprop: "original", format: "json", redirects: "1",
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; index?: number; original?: { source?: string } }> };
    };
    const pages = Object.values(data.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 99) - (b.index ?? 99)
    );
    const qWords = query.split(" ");
    const bad = ["list of", "disambiguation", "episodes"];
    for (const p of pages) {
      const title = (p.title ?? "").toLowerCase();
      if (bad.some((b) => title.includes(b))) continue;
      const img = p.original?.source;
      if (!img) continue;
      if (related(qWords, title.split(/\s+/))) return img;
    }
    return null;
  } catch {
    return null;
  }
}

export async function attachImage(recipeId: string, title: string): Promise<void> {
  try {
    const query = cleanQuery(title) || title.toLowerCase();
    const imageUrl = (await unsplashImage(query)) ?? (await wikipediaImage(query));
    if (!imageUrl) return; // close-or-nothing: skip when unsure

    const dl = await fetch(imageUrl, { headers: { "User-Agent": UA } });
    if (!dl.ok) return;
    const contentType = dl.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return;
    const bytes = Buffer.from(await dl.arrayBuffer());
    if (bytes.length < 1024) return;

    const path = `${recipeId}.jpg`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) return;

    const publicUrl = `${PUBLIC_BASE}/storage/v1/object/public/${BUCKET}/${path}`;
    await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${recipeId}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ image: publicUrl }),
    });
  } catch {
    /* best-effort: never throw */
  }
}
