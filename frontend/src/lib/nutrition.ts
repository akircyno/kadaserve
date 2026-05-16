type NutritionUnit = "ml" | "g" | "serving";

export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  servingSizeMl: number;
};

export type NutritionResult = NutritionFacts & {
  sourceLabel: string;
  confidence: "recipe_calculated" | "estimated";
  reviewNotes: string[];
};

type NutrientValues = Omit<NutritionFacts, "servingSizeMl">;

type IngredientFact = {
  label: string;
  baseAmount: number;
  unit: NutritionUnit;
  nutrients: NutrientValues;
  liquidMlPerUnit?: number;
  scalesWithSugar?: boolean;
  reviewNote?: string;
};

type RecipeIngredient = {
  ingredient: keyof typeof ingredientFacts;
  amount: number;
  unit: NutritionUnit;
};

type Recipe = {
  itemNames: string[];
  ingredients: RecipeIngredient[];
  reviewNotes?: string[];
};

type NutritionOptions = {
  sugarLevel?: number;
  size?: string;
  addons?: string[];
  quantity?: number;
};

const emptyNutrients: NutrientValues = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugar: 0,
  sodium: 0,
};

const nutritionMetricLabels = [
  { key: "calories", label: "Cal", unit: "" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
] as const;

export { nutritionMetricLabels };

const ingredientFacts = {
  french_vanilla: {
    label: "French vanilla syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 260,
      protein: 0,
      carbs: 65,
      fat: 0,
      sugar: 62,
      sodium: 20,
    },
    reviewNote: "Confirm French vanilla syrup brand nutrition label.",
  },
  hazelnut: {
    label: "Hazelnut syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 260,
      protein: 0,
      carbs: 65,
      fat: 0,
      sugar: 62,
      sodium: 20,
    },
    reviewNote: "Confirm hazelnut syrup brand nutrition label.",
  },
  brown_sugar: {
    label: "Brown sugar syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 270,
      protein: 0,
      carbs: 67,
      fat: 0,
      sugar: 64,
      sodium: 15,
    },
    reviewNote: "Confirm brown sugar syrup brand nutrition label.",
  },
  strawberry: {
    label: "Strawberry syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 250,
      protein: 0,
      carbs: 62,
      fat: 0,
      sugar: 58,
      sodium: 25,
    },
    reviewNote: "Confirm strawberry syrup brand nutrition label.",
  },
  caramel: {
    label: "Caramel syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 270,
      protein: 0,
      carbs: 67,
      fat: 0,
      sugar: 62,
      sodium: 60,
    },
    reviewNote: "Confirm caramel syrup brand nutrition label.",
  },
  chocolate: {
    label: "Chocolate syrup",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 280,
      protein: 1.8,
      carbs: 62,
      fat: 1.2,
      sugar: 50,
      sodium: 150,
    },
    reviewNote: "Confirm chocolate syrup brand nutrition label.",
  },
  condensed_milk: {
    label: "Condensed milk",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    scalesWithSugar: true,
    nutrients: {
      calories: 321,
      protein: 8,
      carbs: 54,
      fat: 8.7,
      sugar: 54,
      sodium: 127,
    },
    reviewNote: "Confirm condensed milk brand nutrition label.",
  },
  whipped_milk: {
    label: "Whipped milk",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    nutrients: {
      calories: 61,
      protein: 3.2,
      carbs: 4.8,
      fat: 3.3,
      sugar: 4.8,
      sodium: 44,
    },
    reviewNote: "Whipped milk currently uses full cream milk estimate.",
  },
  full_cream_milk: {
    label: "Full cream milk",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    nutrients: {
      calories: 61,
      protein: 3.2,
      carbs: 4.8,
      fat: 3.3,
      sugar: 4.8,
      sodium: 44,
    },
    reviewNote: "Confirm full cream milk brand nutrition label.",
  },
  coffee_shot: {
    label: "Brewed coffee shot",
    baseAmount: 1,
    unit: "serving",
    liquidMlPerUnit: 60,
    nutrients: {
      calories: 2,
      protein: 0.2,
      carbs: 0,
      fat: 0,
      sugar: 0,
      sodium: 2,
    },
    reviewNote: "Coffee is counted as brewed beverage contribution, not dry grounds.",
  },
  matcha_mix: {
    label: "Matcha mix",
    baseAmount: 100,
    unit: "g",
    nutrients: {
      calories: 380,
      protein: 6,
      carbs: 80,
      fat: 2,
      sugar: 55,
      sodium: 90,
    },
    reviewNote: "Confirm whether staff recipe uses pure matcha or sweetened matcha mix.",
  },
  water: {
    label: "Water",
    baseAmount: 100,
    unit: "ml",
    liquidMlPerUnit: 1,
    nutrients: emptyNutrients,
  },
  ice: {
    label: "Ice",
    baseAmount: 1,
    unit: "serving",
    nutrients: emptyNutrients,
  },
} satisfies Record<string, IngredientFact>;

const recipes: Recipe[] = [
  {
    itemNames: ["French Vanilla Latte"],
    ingredients: [
      { ingredient: "french_vanilla", amount: 25, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Matcha Latte"],
    ingredients: [
      { ingredient: "french_vanilla", amount: 15, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "matcha_mix", amount: 40, unit: "g" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
    reviewNotes: ["Matcha amount needs brand/type confirmation."],
  },
  {
    itemNames: ["Spanish Latte"],
    ingredients: [
      { ingredient: "condensed_milk", amount: 30, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Hazelnut Latte"],
    ingredients: [
      { ingredient: "hazelnut", amount: 25, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Brown Sugar Latte"],
    ingredients: [
      { ingredient: "brown_sugar", amount: 30, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Americano"],
    ingredients: [
      { ingredient: "coffee_shot", amount: 2, unit: "serving" },
      { ingredient: "water", amount: 120, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Strawberry Matcha"],
    ingredients: [
      { ingredient: "strawberry", amount: 40, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "matcha_mix", amount: 40, unit: "g" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
    reviewNotes: ["Matcha amount needs brand/type confirmation."],
  },
  {
    itemNames: ["Macchiato"],
    ingredients: [
      { ingredient: "caramel", amount: 20, unit: "ml" },
      { ingredient: "french_vanilla", amount: 15, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Mocha"],
    ingredients: [
      { ingredient: "chocolate", amount: 40, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Signature Blend"],
    ingredients: [
      { ingredient: "brown_sugar", amount: 15, unit: "ml" },
      { ingredient: "chocolate", amount: 40, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "coffee_shot", amount: 1, unit: "serving" },
      { ingredient: "water", amount: 60, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Choco Milk"],
    ingredients: [
      { ingredient: "chocolate", amount: 40, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
  {
    itemNames: ["Strawberry Latte"],
    ingredients: [
      { ingredient: "strawberry", amount: 40, unit: "ml" },
      { ingredient: "whipped_milk", amount: 20, unit: "ml" },
      { ingredient: "full_cream_milk", amount: 100, unit: "ml" },
      { ingredient: "ice", amount: 1, unit: "serving" },
    ],
  },
];

const addonIngredients: Record<string, RecipeIngredient> = {
  extra_sugar: { ingredient: "brown_sugar", amount: 15, unit: "ml" },
  extra_coffee: { ingredient: "coffee_shot", amount: 1, unit: "serving" },
  extra_milk: { ingredient: "full_cream_milk", amount: 30, unit: "ml" },
  vanilla_syrup: { ingredient: "french_vanilla", amount: 15, unit: "ml" },
  caramel_syrup: { ingredient: "caramel", amount: 15, unit: "ml" },
  hazelnut_syrup: { ingredient: "hazelnut", amount: 15, unit: "ml" },
  chocolate_syrup: { ingredient: "chocolate", amount: 15, unit: "ml" },
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findRecipe(itemName: string) {
  const normalizedItemName = normalizeName(itemName);

  return recipes.find((recipe) =>
    recipe.itemNames.some((name) => normalizeName(name) === normalizedItemName)
  );
}

function addNutrients(first: NutrientValues, second: NutrientValues) {
  return {
    calories: first.calories + second.calories,
    protein: first.protein + second.protein,
    carbs: first.carbs + second.carbs,
    fat: first.fat + second.fat,
    sugar: first.sugar + second.sugar,
    sodium: first.sodium + second.sodium,
  };
}

function scaleNutrients(nutrients: NutrientValues, multiplier: number) {
  return {
    calories: nutrients.calories * multiplier,
    protein: nutrients.protein * multiplier,
    carbs: nutrients.carbs * multiplier,
    fat: nutrients.fat * multiplier,
    sugar: nutrients.sugar * multiplier,
    sodium: nutrients.sodium * multiplier,
  };
}

function getSizeMultiplier(size?: string) {
  if (size === "small") return 0.85;
  if (size === "large") return 1.2;
  return 1;
}

function getIngredientContribution(
  recipeIngredient: RecipeIngredient,
  sugarLevel: number
) {
  const fact: IngredientFact = ingredientFacts[recipeIngredient.ingredient];
  const sugarMultiplier = fact.scalesWithSugar ? sugarLevel / 100 : 1;
  const amount = recipeIngredient.amount * sugarMultiplier;
  const multiplier =
    recipeIngredient.unit === fact.unit ? amount / fact.baseAmount : 0;
  const nutrients = scaleNutrients(fact.nutrients, multiplier);
  const servingSizeMl =
    fact.liquidMlPerUnit && recipeIngredient.unit === fact.unit
      ? amount * fact.liquidMlPerUnit
      : fact.liquidMlPerUnit && fact.unit === "serving"
      ? amount * fact.liquidMlPerUnit
      : 0;

  return {
    nutrients,
    servingSizeMl,
    reviewNote: fact.reviewNote,
  };
}

function roundFacts(facts: NutritionFacts): NutritionFacts {
  return {
    calories: Math.round(facts.calories),
    protein: Math.round(facts.protein * 10) / 10,
    carbs: Math.round(facts.carbs * 10) / 10,
    fat: Math.round(facts.fat * 10) / 10,
    sugar: Math.round(facts.sugar * 10) / 10,
    sodium: Math.round(facts.sodium),
    servingSizeMl: Math.round(facts.servingSizeMl),
  };
}

export function getMenuItemNutrition(
  item: { name: string; category?: string | null },
  options: NutritionOptions = {}
): NutritionResult | null {
  if (item.category === "pastries") {
    return null;
  }

  const recipe = findRecipe(item.name);

  if (!recipe) {
    return null;
  }

  const sugarLevel = Math.max(0, Math.min(100, options.sugarLevel ?? 100));
  const sizeMultiplier = getSizeMultiplier(options.size);
  const quantity = Math.max(1, options.quantity ?? 1);
  const reviewNotes = new Set(recipe.reviewNotes ?? []);

  let baseNutrients = { ...emptyNutrients };
  let baseServingSizeMl = 0;

  recipe.ingredients.forEach((ingredient) => {
    const contribution = getIngredientContribution(ingredient, sugarLevel);
    baseNutrients = addNutrients(baseNutrients, contribution.nutrients);
    baseServingSizeMl += contribution.servingSizeMl;

    if (contribution.reviewNote) {
      reviewNotes.add(contribution.reviewNote);
    }
  });

  let nutrients = scaleNutrients(baseNutrients, sizeMultiplier);
  let servingSizeMl = baseServingSizeMl * sizeMultiplier;

  (options.addons ?? []).forEach((addon) => {
    const addonIngredient = addonIngredients[addon];

    if (!addonIngredient) {
      return;
    }

    const contribution = getIngredientContribution(addonIngredient, 100);
    nutrients = addNutrients(nutrients, contribution.nutrients);
    servingSizeMl += contribution.servingSizeMl;

    if (contribution.reviewNote) {
      reviewNotes.add(contribution.reviewNote);
    }
  });

  const scaledNutrients = scaleNutrients(nutrients, quantity);

  return {
    ...roundFacts({
      ...scaledNutrients,
      servingSizeMl: servingSizeMl * quantity,
    }),
    sourceLabel: "Estimated from KadaServe staff recipe",
    confidence: "recipe_calculated",
    reviewNotes: Array.from(reviewNotes),
  };
}

export function getCartNutritionSummary(
  items: Array<{
    name: string;
    category?: string | null;
    sugar_level: number;
    size: string;
    addons: string[];
    quantity: number;
  }>
): NutritionResult | null {
  const itemFacts = items
    .map((item) =>
      getMenuItemNutrition(item, {
        sugarLevel: item.sugar_level,
        size: item.size,
        addons: item.addons,
        quantity: item.quantity,
      })
    )
    .filter((item): item is NutritionResult => Boolean(item));

  if (itemFacts.length === 0) {
    return null;
  }

  const totals = itemFacts.reduce<NutritionFacts>(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
      sugar: sum.sugar + item.sugar,
      sodium: sum.sodium + item.sodium,
      servingSizeMl: sum.servingSizeMl + item.servingSizeMl,
    }),
    {
      ...emptyNutrients,
      servingSizeMl: 0,
    }
  );

  return {
    ...roundFacts(totals),
    sourceLabel: "Estimated from KadaServe staff recipe",
    confidence: "recipe_calculated",
    reviewNotes: Array.from(
      new Set(itemFacts.flatMap((item) => item.reviewNotes))
    ),
  };
}

export function formatNutritionMetric(
  key: (typeof nutritionMetricLabels)[number]["key"],
  value: number
) {
  if (key === "calories" || key === "sodium") {
    return `${Math.round(value)}`;
  }

  return `${Math.round(value * 10) / 10}`;
}
