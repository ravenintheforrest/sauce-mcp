# @sauce/recipe-mcp

**Talk to your recipe box from Claude.** This is an [MCP](https://modelcontextprotocol.io)
server that lets Claude author a fully structured recipe and push it straight
into the Sauce app's database — no copy-paste, no scraping a webpage into a
text blob. You say "save this carbonara, tag it weeknight and pasta," and it
shows up in the Sauce app, structured, scalable, and ready to cook. That round
trip is the differentiator of the whole project.

It speaks to Supabase over its auto-generated PostgREST API using the **service
key**, so it's trusted and bypasses RLS by design — it's meant to run
**co-located with Postgres on the homelab, behind the Cloudflare tunnel** (PRD
P4). No `@supabase/supabase-js`; just `fetch` (built into Node 18+) and `zod`.

## The 5 tools

| Tool | Returns | What it does |
|---|---|---|
| `create_recipe(recipe)` | `{ id, title }` | Validate → single insert → return. The hot path: nothing else blocks the return. Tags (a `string[]`) are resolved/linked **after** return; image fetch and other side effects run server-side afterward (P1/P6). |
| `update_recipe(id, patch)` | `{ id }` | Partial update of an existing recipe. |
| `get_recipe(id)` | `recipe` | The full canonical recipe object, with tags joined into a `string[]`. |
| `list_recipes(filter?)` | `[{ id, title, tags }]` | Minimal fields only (P6). Optional `filter: { query?, tag? }` — `query` is a title substring, `tag` is an exact tag name. |
| `add_to_meal_plan(recipe_id, date, slot)` | `{ entry_id }` | Add a recipe to the planner. `slot ∈ breakfast \| lunch \| dinner \| snack`. Calendar sync is a **server-side background job**, not done here (P2). |

The recipe shape is the canonical Recipe JSON from
[`docs/CONTRACT.md`](../docs/CONTRACT.md) **minus** the server-assigned fields
(`id`, `image`, `created_at`, `updated_at`, `updated_by`). Ingredients and steps
are structured, never free text — that's what enables scaling, grocery
generation, and step→ingredient tap-through.

## Setup

```bash
npm install
npm run build        # tsc → dist/
```

Copy `.env.example` to `.env` and fill in the homelab Supabase URL and the
**service** key (per `CONTRACT.md` env-var names):

```
SUPABASE_URL=https://sauce.<homelab-tunnel>
SUPABASE_SERVICE_KEY=...
```

Run it standalone for a smoke test:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm start
```

## Configure in Claude Code / Desktop

### Quick add (Claude Code CLI)

```bash
claude mcp add sauce-recipe -- \
  env SUPABASE_URL=https://sauce.<homelab-tunnel> SUPABASE_SERVICE_KEY=<service-key> \
  node /Users/ravemac/dev/sauce/recipe-mcp/dist/index.js
```

### Raw JSON config

For Claude Desktop (`claude_desktop_config.json`) or a project
`.mcp.json` — point it at the built `dist/index.js` and pass the env vars:

```json
{
  "mcpServers": {
    "sauce-recipe": {
      "command": "node",
      "args": ["/Users/ravemac/dev/sauce/recipe-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://sauce.<homelab-tunnel>",
        "SUPABASE_SERVICE_KEY": "<service-key>"
      }
    }
  }
}
```

## Scripts

- `npm run build` — compile with `tsc` to `dist/`.
- `npm run dev` — `tsx watch` for local iteration.
- `npm start` — run the built server (`node dist/index.js`).

## Design notes (PRD principles)

- **P1/P6 — `create_recipe` is the hot path.** Validate, one insert, return
  `{id, title}`. Tag resolution/linking is kicked off as fire-and-forget *after*
  the id is in hand, so it never delays the perceived latency.
- **P6 — minimal payloads.** Confirmation tools return tiny objects
  (`{id}`, `{id,title}`, `{entry_id}`), never the echoed full recipe.
- **P2 — side effects are server-side.** Image fetch from `source_url` and
  calendar sync for meal-plan entries are background jobs, not done in-tool.
- **P4 — trusted & co-located.** Uses the service key and bypasses RLS by
  design; it lives next to Postgres behind the Cloudflare tunnel.
