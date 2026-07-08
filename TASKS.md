# Sauce MCP — TASKS

## Now
- [ ] **Reconcile with `~/dev/sauce/recipe-mcp` — pick ONE source of truth.** The two are currently byte-identical (`src/**`, `package.json`, `Dockerfile`, `.env.example`, `tsconfig.json` all match). The monorepo copy has the real git history (9 commits: HTTP server, APNs, auto-image, grocery); this standalone repo has a single `Init` commit. Decide: either (a) delete the standalone and keep `recipe-mcp/` in the monorepo, or (b) make the standalone canonical and reduce the monorepo copy to a submodule/pointer. Until then, edits to one silently drift from the other. Mirror the decision in `~/dev/sauce/CLAUDE.md` + `TASKS.md` (both already flag this).

## Next
- [ ] Confirm which entrypoint the ravelab deployment actually runs (Docker/HTTP `:8788` vs stdio) and document the run command + tunnel host here.
- [ ] Verify `SAUCE_MCP_TOKEN` is set in the live `.env` — `http.ts` logs a warning and serves **unauthenticated** if it's unset.
- [ ] Nail down APNs env on the deployment (`APNS_KEY_BASE64` / `KEY_ID` / `TEAM_ID` / `BUNDLE_ID`); pushes silently no-op if unconfigured.

## Someday
- [ ] Generate `SESSIONS.md` from transcripts (topic-grep, include ravelab root) once there's history worth distilling.
- [ ] Revisit the grocery `categorize()` rules as real ingredients expose gaps; keep in sync with the iOS mirror.
- [ ] Consider a health/readiness check that verifies Supabase reachability, not just process liveness.
