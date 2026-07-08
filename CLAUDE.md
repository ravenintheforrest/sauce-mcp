# Sauce MCP — project map

MCP server that lets Claude author a fully structured recipe and **push it straight into the Sauce app's Supabase database** — no scraping, no copy-paste. Also does APNs push ("🍳 New recipe"), auto-image fetch, and grocery-list building. Talks to Supabase over PostgREST with the **service key** (trusted, bypasses RLS by design). No `@supabase/supabase-js` — just `fetch` + `zod`.

> Auto-loads when Claude opens in `~/dev/sauce-mcp`. Read this first, then use the routing table. Pairs with the **Sauce_Recipes** MCP connector and the sauce monorepo at `~/dev/sauce` (which contains a byte-identical copy at `recipe-mcp/` — see TASKS.md, reconcile).

## Where things live
- **Runs on ravelab** (🐧) next to Postgres, behind the Cloudflare tunnel. Two entrypoints: stdio (`index.ts`, local Claude subprocess) and hosted HTTP (`http.ts`, the cloud connector). Dockerfile serves the HTTP one on `:8788`.
- **Secrets:** `.env` (gitignored, **never commit it**) — Supabase URL + **service** key, `SAUCE_OWNER_ID` (auth.users id stamped on MCP-created rows so RLS clients see them, ADR-0006), `SAUCE_MCP_TOKEN` (shared secret protecting the HTTP endpoint), plus optional `UNSPLASH_ACCESS_KEY`, `SAUCE_PUBLIC_BASE`, and APNs keys. Template: `.env.example`.
- **Contract:** the canonical Recipe JSON + tool contracts live in `~/dev/sauce/docs/CONTRACT.md`. Design principles referenced as P1/P2/P4/P6.

## Folder map
- `src/index.ts` — stdio entrypoint (local subprocess).
- `src/http.ts` — HTTP/Streamable entrypoint for the hosted cloud connector; token auth + per-session transports.
- `src/server.ts` — `buildServer()`: registers all 8 tools. Shared by both entrypoints.
- `src/supabase.ts` — tiny typed PostgREST client (`get`/`post`/`patch`, service-key auth, `OWNER_ID`).
- `src/tools.ts` — the 5 recipe tools (`create_recipe`, `update_recipe`, `get_recipe`, `list_recipes`, `add_to_meal_plan`) + zod schemas. `create_recipe` is the hot path.
- `src/grocery.ts` — grocery tools (`add_grocery_item`, `add_recipe_to_grocery`, `list_grocery`) + aisle `categorize()` (mirrored in iOS).
- `src/image.ts` — fire-and-forget auto-image: Unsplash → Wikipedia fallback, close-or-nothing, upload to Storage.
- `src/apns.ts` — APNs push sender (ES256 JWT, HTTP/2) to the owner's device tokens.

## Naming / never-commit
- **Never commit:** `.env`, the Supabase service key, `SAUCE_MCP_TOKEN`, APNs `.p8` key. `dist/`, `build/`, `node_modules/`, `*.log`.
- Package/id stays `@sauce/recipe-mcp` / `sauce-recipe-mcp` — internal ids don't rename.

## Routing table
| Working on… | Read | Skip |
|---|---|---|
| A recipe/meal-plan tool or its schema | `src/tools.ts`, `src/server.ts` | `grocery.ts`, `image.ts`, `apns.ts` |
| Grocery list / aisle sorting | `src/grocery.ts` | `tools.ts`, `image.ts`, `apns.ts` |
| Auto-image not attaching / wrong photo | `src/image.ts` | tools/grocery/apns |
| Push notifications | `src/apns.ts` | image/grocery |
| DB calls / PostgREST / owner stamping | `src/supabase.ts` | image/apns |
| Hosted endpoint / auth / sessions | `src/http.ts`, `Dockerfile` | tool internals |
| Tool registration / descriptions | `src/server.ts` | `supabase.ts` |
| Env / secrets / connector config | `.env.example`, `README.md` | `src/` |

## Commands
`npm run build` (tsc → `dist/`) · `npm run dev` (tsx watch, stdio) · `npm start` (stdio) · `npm run start:http` (HTTP `:8788`) · `curl localhost:8788/health` (smoke test).

## Files that ARE the memory
`TASKS.md` (current focus — top item: reconcile the duplicate). Read at session start; run `end-session` to update. No SESSIONS.md yet.
