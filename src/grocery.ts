/**
 * Grocery list — aisle categorization + the MCP tool handlers.
 *
 * Items are auto-sorted by grocery-store section. `categorize()` maps an
 * ingredient name to one of AISLES (in shopping order). The same logic is
 * mirrored in the iOS app so manually-added and MCP-added items match.
 */

import { z } from "zod";
import { get, post, OWNER_ID } from "./supabase.js";

/** Store sections in the order you'd walk them. "Other" is the catch-all. */
export const AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pasta & Grains",
  "Canned & Jarred",
  "Condiments & Sauces",
  "Baking",
  "Spices",
  "Snacks",
  "Frozen",
  "Beverages",
  "Other",
] as const;

// Ordered rules — FIRST match wins, so specific/disambiguating sections lead.
const RULES: { aisle: string; keywords: string[] }[] = [
  { aisle: "Spices", keywords: ["salt", "black pepper", "white pepper", "peppercorn", "cumin", "paprika", "cinnamon", "oregano", "thyme", "rosemary", "bay leaf", "chili powder", "garlic powder", "onion powder", "curry powder", "curry", "turmeric", "nutmeg", "cayenne", "red pepper flake", "italian seasoning", "seasoning", "spice", "ground ginger", "allspice", "clove", "cardamom", "coriander", "dill"] },
  { aisle: "Baking", keywords: ["flour", "sugar", "baking soda", "baking powder", "yeast", "vanilla", "cocoa", "cacao", "chocolate chip", "cornstarch", "molasses", "shortening", "sprinkles", "condensed milk", "evaporated milk", "powdered sugar", "brown sugar"] },
  { aisle: "Condiments & Sauces", keywords: ["ketchup", "mustard", "mayo", "mayonnaise", "soy sauce", "tamari", "sriracha", "hot sauce", "vinegar", "olive oil", "sesame oil", "vegetable oil", "canola oil", "avocado oil", "oil", "honey", "maple syrup", "syrup", "salsa", "dressing", "bbq", "barbecue", "teriyaki", "tahini", "peanut butter", "almond butter", "jam", "jelly", "relish", "worcestershire", "fish sauce", "oyster sauce", "hoisin", "pesto", "marinara"] },
  { aisle: "Dairy & Eggs", keywords: ["milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "egg", "sour cream", "half and half", "mozzarella", "parmesan", "cheddar", "feta", "ricotta", "cottage cheese", "buttermilk", "ghee", "margarine"] },
  { aisle: "Meat & Seafood", keywords: ["chicken", "beef", "pork", "turkey", "bacon", "sausage", "steak", "ground beef", "ground turkey", "ground", "shrimp", "salmon", "fish", "tuna", "cod", "tilapia", "crab", "lobster", "ham", "lamb", "prosciutto", "chorizo"] },
  { aisle: "Bakery", keywords: ["bread", "bun", "tortilla", "bagel", "roll", "baguette", "pita", "naan", "croissant", "english muffin"] },
  { aisle: "Frozen", keywords: ["frozen", "ice cream", "popsicle"] },
  { aisle: "Pasta & Grains", keywords: ["pasta", "spaghetti", "macaroni", "noodle", "ramen", "rice", "quinoa", "couscous", "oats", "oatmeal", "cereal", "lentil", "barley", "penne", "linguine", "tofu"] },
  { aisle: "Canned & Jarred", keywords: ["canned", "broth", "stock", "coconut milk", "tomato sauce", "tomato paste", "diced tomato", "crushed tomato", "olive", "pickle", "chickpea", "black bean", "kidney bean", "refried"] },
  { aisle: "Produce", keywords: ["lettuce", "spinach", "arugula", "kale", "tomato", "onion", "garlic", "bell pepper", "pepper", "cucumber", "carrot", "celery", "potato", "broccoli", "cauliflower", "zucchini", "squash", "avocado", "lemon", "lime", "apple", "banana", "blueberry", "strawberry", "raspberry", "berry", "grape", "cilantro", "parsley", "basil", "mint", "ginger", "scallion", "green onion", "shallot", "mushroom", "corn", "pea", "cabbage", "jalapeno", "sweet potato", "orange", "herb", "greens", "fruit", "vegetable"] },
  { aisle: "Snacks", keywords: ["chips", "cracker", "almond", "peanut", "cashew", "walnut", "pretzel", "granola", "popcorn", "trail mix", "nuts"] },
  { aisle: "Beverages", keywords: ["water", "juice", "soda", "coffee", "tea", "wine", "beer", "sparkling", "kombucha"] },
];

export function categorize(name: string): string {
  const lower = name.toLowerCase();
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  for (const { aisle, keywords } of RULES) {
    for (const kw of keywords) {
      const hit = kw.includes(" ") ? lower.includes(kw) : tokens.includes(kw);
      if (hit) return aisle;
    }
  }
  return "Other";
}

function ownerFields(): Record<string, unknown> {
  return OWNER_ID ? { owner_id: OWNER_ID } : {};
}

// --- Tool shapes ------------------------------------------------------------

export const addGroceryItemShape = {
  name: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
} as const;

export const addRecipeToGroceryShape = { recipe_id: z.string().uuid() } as const;

export const listGroceryShape = {
  filter: z.object({ unchecked_only: z.boolean().optional() }).optional(),
} as const;

// --- Handlers ---------------------------------------------------------------

export async function addGroceryItem(input: {
  name: string;
  quantity?: number;
  unit?: string;
}): Promise<{ id: string; name: string; category: string }> {
  const category = categorize(input.name);
  const rows = await post<{ id: string }[]>(
    "grocery_items",
    { name: input.name, quantity: input.quantity, unit: input.unit, category, ...ownerFields() },
    "representation"
  );
  const row = rows?.[0];
  if (!row?.id) throw new Error("add_grocery_item: insert returned no row");
  return { id: row.id, name: input.name, category };
}

export async function addRecipeToGrocery(input: {
  recipe_id: string;
}): Promise<{ added: number }> {
  const recipes = await get<{ ingredients: { quantity?: number; unit?: string; item: string }[] }[]>(
    "recipes",
    `select=ingredients&id=eq.${input.recipe_id}`
  );
  const ingredients = recipes?.[0]?.ingredients ?? [];
  if (ingredients.length === 0) return { added: 0 };

  const rows = ingredients.map((ing) => ({
    name: ing.item,
    quantity: ing.quantity,
    unit: ing.unit,
    category: categorize(ing.item),
    source_recipe_id: input.recipe_id,
    ...ownerFields(),
  }));
  await post("grocery_items", rows, "minimal");
  return { added: rows.length };
}

export async function listGrocery(input: {
  filter?: { unchecked_only?: boolean };
}): Promise<{ count: number; items: { name: string; quantity?: number; unit?: string; checked: boolean; category: string }[] }> {
  let query = "select=name,quantity,unit,checked,category&order=category,name";
  if (input.filter?.unchecked_only) query += "&checked=eq.false";
  const items = await get<{ name: string; quantity?: number; unit?: string; checked: boolean; category: string }[]>(
    "grocery_items",
    query
  );
  return { count: items.length, items };
}
