/**
 * Builds the Sauce MCP server with all tools registered. Shared by the stdio
 * entrypoint (index.ts) and the HTTP entrypoint (http.ts).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  createRecipe,
  updateRecipe,
  getRecipe,
  listRecipes,
  addToMealPlan,
  createRecipeShape,
  updateRecipeShape,
  getRecipeShape,
  listRecipesShape,
  addToMealPlanShape,
} from "./tools.js";
import {
  addGroceryItem,
  addRecipeToGrocery,
  listGrocery,
  addGroceryItemShape,
  addRecipeToGroceryShape,
  listGroceryShape,
} from "./grocery.js";

/**
 * Wrap a handler's JSON result as MCP tool output. The text content always
 * carries the JSON; structuredContent is only attached for objects, since the
 * MCP schema requires it to be a record (list_recipes returns an array).
 */
function ok(data: unknown) {
  const result: {
    content: { type: "text"; text: string }[];
    structuredContent?: Record<string, unknown>;
  } = {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
  if (data && typeof data === "object" && !Array.isArray(data)) {
    result.structuredContent = data as Record<string, unknown>;
  }
  return result;
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "sauce-recipe-mcp", version: "0.1.0" });

  server.registerTool(
    "create_recipe",
    {
      title: "Create recipe",
      description:
        "Validate and insert a new recipe into Sauce. Returns only {id, title}. " +
        "Tags (string[]) are resolved/linked after return; image fetch and other " +
        "side effects run server-side afterward.",
      inputSchema: createRecipeShape,
    },
    async (args) => ok(await createRecipe(args))
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update recipe",
      description:
        "Partially update an existing recipe by id. Returns {id}. Patch shape is " +
        "the recipe fields you want to change (tags accepted as string[]).",
      inputSchema: updateRecipeShape,
    },
    async (args) => ok(await updateRecipe(args))
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description:
        "Fetch the full recipe object by id, with tags joined into a string[].",
      inputSchema: getRecipeShape,
    },
    async (args) => ok(await getRecipe(args))
  );

  server.registerTool(
    "list_recipes",
    {
      title: "List recipes",
      description:
        "List recipes as minimal {id, title, tags}. Optional filter: " +
        "{ query?: title substring, tag?: exact tag name }.",
      inputSchema: listRecipesShape,
    },
    async (args) => ok(await listRecipes(args))
  );

  server.registerTool(
    "add_to_meal_plan",
    {
      title: "Add to meal plan",
      description:
        "Add a recipe to the planner for a date and slot " +
        "(breakfast|lunch|dinner|snack). Returns {entry_id}. Calendar sync runs " +
        "as a server-side background job.",
      inputSchema: addToMealPlanShape,
    },
    async (args) => ok(await addToMealPlan(args))
  );

  server.registerTool(
    "add_grocery_item",
    {
      title: "Add grocery item",
      description:
        "Add a single item to the grocery list. It's auto-sorted into a store " +
        "aisle by name. Returns {id, name, category}.",
      inputSchema: addGroceryItemShape,
    },
    async (args) => ok(await addGroceryItem(args))
  );

  server.registerTool(
    "add_recipe_to_grocery",
    {
      title: "Add recipe to grocery list",
      description:
        "Add all of a recipe's ingredients to the grocery list (each aisle-sorted). " +
        "Returns {added}.",
      inputSchema: addRecipeToGroceryShape,
    },
    async (args) => ok(await addRecipeToGrocery(args))
  );

  server.registerTool(
    "list_grocery",
    {
      title: "List grocery items",
      description:
        "List grocery items with their aisle category. Optional filter " +
        "{ unchecked_only }. Returns { count, items }.",
      inputSchema: listGroceryShape,
    },
    async (args) => ok(await listGrocery(args))
  );

  return server;
}
