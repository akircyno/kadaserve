import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import ts from "typescript";

const source = await readFile(new URL("../src/lib/nutrition.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(
  transpiled.outputText
)}`;
const { getMenuItemNutrition } = await import(moduleUrl);

const expectedFacts = [
  {
    name: "French Vanilla Latte",
    facts: {
      calories: 153,
      protein: 4,
      carbs: 24.8,
      fat: 3.8,
      sugar: 24.6,
      sodium: 38,
      servingSizeMl: 265,
    },
  },
  {
    name: "Hazelnut Latte",
    facts: {
      calories: 248,
      protein: 4,
      carbs: 48.6,
      fat: 3.8,
      sugar: 48.3,
      sodium: 38,
      servingSizeMl: 265,
    },
  },
  {
    name: "Brown Sugar Latte",
    facts: {
      calories: 165,
      protein: 4,
      carbs: 43.3,
      fat: 3.8,
      sugar: 39.3,
      sodium: 38,
      servingSizeMl: 270,
    },
  },
  {
    name: "Americano",
    facts: {
      calories: 4,
      protein: 0.4,
      carbs: 0,
      fat: 0,
      sugar: 0,
      sodium: 4,
      servingSizeMl: 240,
    },
  },
  {
    name: "Strawberry Latte",
    facts: {
      calories: 206,
      protein: 3.8,
      carbs: 39.9,
      fat: 3.8,
      sugar: 37.3,
      sodium: 47,
      servingSizeMl: 160,
    },
  },
];

for (const expected of expectedFacts) {
  const actual = getMenuItemNutrition(
    { name: expected.name, category: "drinks" },
    { sugarLevel: 100, size: "medium" }
  );

  assert.ok(actual, `${expected.name} should have nutrition facts`);
  assert.deepEqual(
    {
      calories: actual.calories,
      protein: actual.protein,
      carbs: actual.carbs,
      fat: actual.fat,
      sugar: actual.sugar,
      sodium: actual.sodium,
      servingSizeMl: actual.servingSizeMl,
    },
    expected.facts,
    `${expected.name} nutrition facts changed`
  );
  assert.equal(
    actual.sourceLabel,
    "Recipe-calculated from KadaServe recipes and supplier labels"
  );
}

console.log(`Verified ${expectedFacts.length} label-based nutrition calculations.`);
