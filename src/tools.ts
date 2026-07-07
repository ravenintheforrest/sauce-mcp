/**
 * The five Sauce MCP tool handlers + their zod schemas.
 *
 * Contract: docs/CONTRACT.md §"MCP tool contracts". Confirmation tools return
 * tiny objects, never the echoed full recipe (P6).
 */

import { z } from "zod";
import { get, post, patch, OWNER_ID } from "./supabase.js";
import { attachImage } from "./image.js";
import { pushRecipe } from "./apns.js";

/** Stamp owner_id on a server-side insert when a deployment owner is configured. */
function withOwner<T extends Record<string, unknown>>(row: T): T {
  return OWNER_ID ? { ...row, owner_id: OWNER_ID } : row;
}

// ---------------------------------------------------------------------------
// Schemas — mirror the canonical Recipe JSON (CONTRACT.md), minus the
// server-assigned fields (id, image, created_at, updated_at, updated_by).
// ---------------------------------------------------------------------------

const ingredientSchema = z.object({
  quantity: z.number().optional(),
  unit: z.string().optional(),
  item: z.string(),
  note: z.string().optional(),
  section: z.string().optional(),
});

const stepSchema = z.object({
  text: z.string(),
  duration: z.string().optional(),
  // indexes into ingredients[] for cook-mode tap-through
  ingredient_refs: z.array(z.number().int().nonnegative()).optional(),
});

/** create_recipe input = Recipe JSON minus server-assigned fields. */
export const recipeInputShape = {
  title: z.string().min(1),
  description: z.string().optional(),
  source_url: z.string().optional(),
  servings: z.number().optional(),
  total_time: z.string().optional(),
  active_time: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(ingredientSchema).optional(),
  steps: z.array(stepSchema).optional(),
  notes: z.string().optional(),
} as const;

const recipeInputSchema = z.object(recipeInputShape);
type RecipeInput = z.infer<typeof recipeInputSchema>;

const mealSlot = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const createRecipeShape = { recipe: recipeInputSchema } as const;

export const updateRecipeShape = {
  id: z.string().uuid(),
  patch: z.object(recipeInputShape).partial(),
} as const;

export const getRecipeShape = { id: z.string().uuid() } as const;

export const listRecipesShape = {
  filter: z
    .object({
      query: z.string().optional(),
      tag: z.string().optional(),
    })
    .optional(),
} as const;

export const addToMealPlanShape = {
  recipe_id: z.string().uuid(),
  date: z.string(), // ISO date (YYYY-MM-DD)
  slot: mealSlot,
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Split the recipe input into the `recipes` row vs the loose `tags` list. */
function toRecipeRow(input: RecipeInput) {
  const { tags, ...row } = input;
  return {
    row: { ...row, updated_by: "mcp" as const },
    tags: tags ?? [],
  };
}

/**
 * Resolve tag names to ids (creating any that don't exist) and link them to a
 * recipe via recipe_tags. Run as fire-and-forget AFTER create_recipe has
 * returned its {id,title} — tag linking must NOT delay the perceived latency of
 * the hot path (P1/P6).
 */
async function linkTags(recipeId: string, tagNames: string[]): Promise<void> {
  if (tagNames.length === 0) return;

  const unique = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  // Upsert tag rows by (owner_id, name). on_conflict=name keeps it idempotent;
  // ignore-duplicates means existing tags are left untouched.
  await post(
    "tags",
    unique.map((name) => withOwner({ name })),
    "minimal",
    {
      Prefer: "resolution=ignore-duplicates,return=minimal",
      "on-conflict": "name",
    }
  ).catch(() => undefined);

  // Read back the ids for these names.
  const inList = unique.map((n) => `"${n.replace(/"/g, '""')}"`).join(",");
  const rows = await get<{ id: string }[]>(
    "tags",
    `select=id&name=in.(${encodeURIComponent(inList)})`
  ).catch(() => [] as { id: string }[]);

  if (rows.length === 0) return;

  await post(
    "recipe_tags",
    rows.map((r) => ({ recipe_id: recipeId, tag_id: r.id })),
    "minimal",
    { Prefer: "resolution=ignore-duplicates,return=minimal" }
  ).catch(() => undefined);
}

/** Fetch a recipe's tag names as a flat string[]. */
async function tagsForRecipe(recipeId: string): Promise<string[]> {
  const rows = await get<{ tags: { name: string } | null }[]>(
    "recipe_tags",
    `select=tags(name)&recipe_id=eq.${recipeId}`
  );
  return rows.map((r) => r.tags?.name).filter((n): n is string => Boolean(n));
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/**
 * create_recipe — the hot path. Validate → single INSERT → return {id,title}.
 * Nothing else blocks the return (P1/P6): tag linking is kicked off as
 * fire-and-forget and the {id,title} is returned immediately.
 */
export async function createRecipe(input: { recipe: RecipeInput }): Promise<{
  id: string;
  title: string;
}> {
  const { row, tags } = toRecipeRow(input.recipe);

  // Single insert; ask for the server-assigned id back (only id,title — P6).
  const inserted = await post<{ id: string; title: string }[]>(
    "recipes",
    withOwner(row),
    "representation"
  );
  const created = inserted?.[0];
  if (!created?.id) {
    throw new Error("create_recipe: insert returned no row");
  }

  // Fire-and-forget: link tags AFTER we have the id, off the critical path.
  // Errors here never affect the create_recipe result.
  void linkTags(created.id, tags);

  // Fire-and-forget: fetch a default photo by title (P2). MCP-created recipes
  // never carry an image, so always try; failures are silently ignored.
  void attachImage(created.id, created.title);

  // Fire-and-forget: APNs alert to the owner's devices ("🍳 New recipe …").
  if (OWNER_ID) void pushRecipe(OWNER_ID, created.id, created.title);

  return { id: created.id, title: created.title };
}

/** update_recipe — partial PATCH, returns {id} only (P6). */
export async function updateRecipe(input: {
  id: string;
  patch: Partial<RecipeInput>;
}): Promise<{ id: string }> {
  const { tags, ...rest } = input.patch;
  const body: Record<string, unknown> = { ...rest, updated_by: "mcp" };

  // Only PATCH the recipes row if there are scalar fields to change.
  if (Object.keys(rest).length > 0) {
    await patch("recipes", `id=eq.${input.id}`, body, "minimal");
  } else {
    // tags-only update still touches updated_by for provenance/delta-sync.
    await patch("recipes", `id=eq.${input.id}`, { updated_by: "mcp" }, "minimal");
  }

  // If tags were provided, (re)link them off the critical path.
  if (tags) void linkTags(input.id, tags);

  return { id: input.id };
}

/** get_recipe — full object, tags joined into a string[]. */
export async function getRecipe(input: { id: string }): Promise<unknown> {
  const rows = await get<Record<string, unknown>[]>(
    "recipes",
    `select=*&id=eq.${input.id}`
  );
  const recipe = rows[0];
  if (!recipe) throw new Error(`get_recipe: no recipe ${input.id}`);

  const tags = await tagsForRecipe(input.id);
  return { ...recipe, tags };
}

/** list_recipes — minimal fields only: {id, title, tags} (P6). */
export async function listRecipes(input: {
  filter?: { query?: string; tag?: string };
}): Promise<{ id: string; title: string; tags: string[] }[]> {
  const params = new URLSearchParams();
  // Pull tag names inline via the embedded join so we don't N+1 per recipe.
  params.set("select", "id,title,recipe_tags(tags(name))");
  params.set("order", "updated_at.desc");

  const q = input.filter?.query?.trim();
  if (q) params.set("title", `ilike.*${q}*`);

  // Filter by tag name through the embedded relationship.
  const tag = input.filter?.tag?.trim();
  if (tag) params.set("recipe_tags.tags.name", `eq.${tag}`);

  type Row = {
    id: string;
    title: string;
    recipe_tags: { tags: { name: string } | null }[] | null;
  };
  const rows = await get<Row[]>("recipes", params.toString());

  let mapped = rows.map((r) => ({
    id: r.id,
    title: r.title,
    tags: (r.recipe_tags ?? [])
      .map((rt) => rt.tags?.name)
      .filter((n): n is string => Boolean(n)),
  }));

  // When filtering by tag, drop recipes that ended up with no matching tag
  // (PostgREST keeps the parent row but empties the embedded array).
  if (tag) mapped = mapped.filter((r) => r.tags.includes(tag));

  return mapped;
}

/**
 * add_to_meal_plan — POST a planner entry, return {entry_id}.
 * Calendar sync is explicitly a server-side background job, NOT done here (P2).
 */
export async function addToMealPlan(input: {
  recipe_id: string;
  date: string;
  slot: z.infer<typeof mealSlot>;
}): Promise<{ entry_id: string }> {
  const inserted = await post<{ id: string }[]>(
    "meal_plan_entries",
    withOwner({
      recipe_id: input.recipe_id,
      date: input.date,
      meal_slot: input.slot,
    }),
    "representation"
  );
  const entry = inserted?.[0];
  if (!entry?.id) throw new Error("add_to_meal_plan: insert returned no row");
  return { entry_id: entry.id };
}
