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
      calories: 221,
      protein: 4.2,
      carbs: 38.3,
      fat: 5.2,
      sugar: 38.1,
      sodium: 32,
      servingSizeMl: 205,
    },
  },
  {
    name: "Hazelnut Latte",
    facts: {
      calories: 316,
      protein: 4.2,
      carbs: 62.1,
      fat: 5.2,
      sugar: 61.8,
      sodium: 32,
      servingSizeMl: 205,
    },
  },
  {
    name: "Brown Sugar Latte",
    facts: {
      calories: 233,
      protein: 4.2,
      carbs: 56.8,
      fat: 5.2,
      sugar: 52.8,
      sodium: 32,
      servingSizeMl: 210,
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
      servingSizeMl: 120,
    },
  },
  {
    name: "Strawberry Latte",
    facts: {
      calories: 274,
      protein: 4,
      carbs: 53.5,
      fat: 5.2,
      sugar: 50.8,
      sodium: 42,
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
    "Nutrition estimate from KadaServe recipes and supplier labels"
  );
}

console.log(`Verified ${expectedFacts.length} label-based nutrition calculations.`);
