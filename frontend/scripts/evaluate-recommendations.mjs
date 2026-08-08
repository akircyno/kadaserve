// frontend/scripts/evaluate-recommendations.mjs
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function loadEnvLocal() {
  const envPath = new URL("../.env.local", import.meta.url);
  const contents = await readFile(envPath, "utf8");
  const env = {};

  contents.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    env[key] = value;
  });

  return env;
}

async function fetchSupabase(baseUrl, serviceKey, urlPath) {
  const response = await fetch(`${baseUrl}/rest/v1/${urlPath}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase fetch failed for ${urlPath}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function loadRecommendationEvaluationModule() {
  const files = {
    "item-similarity.ts": "../src/lib/item-similarity.ts",
    "recommendation-weights.ts": "../src/lib/recommendation-weights.ts",
    "recommendations.ts": "../src/lib/recommendations.ts",
    "recommendation-evaluation.ts": "../src/lib/recommendation-evaluation.ts",
  };
  const tempDir = await mkdtemp(path.join(tmpdir(), "kadaserve-evaluate-reco-"));

  const sources = {};
  for (const [name, rel] of Object.entries(files)) {
    sources[name] = await readFile(new URL(rel, import.meta.url), "utf8");
  }

  const outPaths = {};
  for (const name of Object.keys(files)) {
    outPaths[name] = path.join(tempDir, name.replace(".ts", ".mjs"));
  }

  await writeFile(outPaths["item-similarity.ts"], transpile(sources["item-similarity.ts"]), "utf8");
  await writeFile(outPaths["recommendation-weights.ts"], transpile(sources["recommendation-weights.ts"]), "utf8");
  await writeFile(
    outPaths["recommendations.ts"],
    transpile(sources["recommendations.ts"])
      .replace('"./recommendation-weights"', '"./recommendation-weights.mjs"')
      .replace('"./item-similarity"', '"./item-similarity.mjs"'),
    "utf8"
  );
  await writeFile(
    outPaths["recommendation-evaluation.ts"],
    transpile(sources["recommendation-evaluation.ts"]).replace('"./recommendations"', '"./recommendations.mjs"'),
    "utf8"
  );

  const evaluationModule = await import(pathToFileURL(outPaths["recommendation-evaluation.ts"]).href);
  return { evaluationModule, tempDir };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printMetricsTable(title, metrics) {
  console.log(`\n${title}`);
  console.log("strategy".padEnd(12), "k".padEnd(4), "n".padEnd(4), "precision".padEnd(12), "recall".padEnd(10), "ceiling");
  metrics.forEach((m) => {
    console.log(
      m.strategy.padEnd(12),
      String(m.k).padEnd(4),
      String(m.n).padEnd(4),
      formatPercent(m.meanPrecision).padEnd(12),
      formatPercent(m.meanRecall).padEnd(10),
      formatPercent(m.precisionCeiling)
    );
  });
}

async function main() {
  const env = await loadEnvLocal();
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in frontend/.env.local");
  }

  const [rawOrders, rawMenuItems, rawFeedback, rawGlobalRanking] = await Promise.all([
    fetchSupabase(
      baseUrl,
      serviceKey,
      "orders?select=id,customer_id,status,ordered_at,order_items(menu_item_id,quantity,menu_items(name))&status=in.(completed,delivered)&limit=2000"
    ),
    fetchSupabase(baseUrl, serviceKey, "menu_items?select=id,name,category,base_price,is_available"),
    fetchSupabase(baseUrl, serviceKey, "feedback?select=customer_id,menu_item_id,taste_rating,strength_rating,overall_rating&limit=2000"),
    fetchSupabase(baseUrl, serviceKey, "analytics_items?select=item_id,item_name,order_count,sales_rank"),
  ]);

  const menuItems = rawMenuItems.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    price: Number(m.base_price ?? 0),
    isAvailable: Boolean(m.is_available),
  }));

  const orders = rawOrders
    .filter((o) => o.customer_id)
    .map((o) => ({
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_id,
      status: o.status,
      orderedAt: o.ordered_at,
      items: (o.order_items ?? []).map((oi) => ({
        menuItemId: oi.menu_item_id,
        name: oi.menu_items?.name ?? "",
        quantity: Number(oi.quantity ?? 1),
      })),
    }));

  const feedback = rawFeedback.map((f) => ({
    customerId: f.customer_id,
    menuItemId: f.menu_item_id,
    tasteRating: f.taste_rating,
    strengthRating: f.strength_rating,
    overallRating: f.overall_rating,
  }));

  const globalRanking = rawGlobalRanking.map((r) => ({
    id: r.item_id,
    name: r.item_name,
    orderCount: Number(r.order_count ?? 0),
    rank: Number(r.sales_rank ?? 0),
  }));

  console.log(
    `Loaded ${orders.length} completed/delivered orders, ${menuItems.length} menu items, ${feedback.length} feedback rows.`
  );

  const { evaluationModule, tempDir } = await loadRecommendationEvaluationModule();

  try {
    const { runEvaluation, runLambdaSweep } = evaluationModule;

    console.log("\n=== Protocol A: Next-Order Prediction (fair three-way headline) ===");
    const protocolA = runEvaluation("A", orders, menuItems, feedback, globalRanking, [1, 3, 5], 3);
    printMetricsTable("Protocol A results", protocolA);

    console.log("\n=== Protocol B: Novel-Item Discovery (isolates CF's contribution vs. the existing popularity fallback) ===");
    const protocolB = runEvaluation("B", orders, menuItems, feedback, globalRanking, [1, 3, 5], 3);
    printMetricsTable("Protocol B results", protocolB);
    console.log("\nNote: 'ahp_only' here is the pre-CF production system (personal preference scoring plus");
    console.log("the existing popularity fallback) with only the new CF discovery slot disabled — it is NOT");
    console.log("restricted to previously-ordered items, since the popularity fallback can already surface");
    console.log("novel items non-personally. The meaningful comparison is whether 'hybrid' (CF's personalized");
    console.log("discovery) outperforms 'ahp_only' (blind popularity discovery) at recommending genuinely new items.");

    console.log("\n=== Lambda sensitivity sweep (Protocol B, hybrid strategy, k=3) ===");
    const sweep = runLambdaSweep(orders, menuItems, feedback, globalRanking, [1, 2, 3, 5], 3);
    console.log("lambda".padEnd(8), "n".padEnd(4), "precision".padEnd(12), "recall");
    sweep.forEach((s) => {
      console.log(
        String(s.lambda).padEnd(8),
        String(s.n).padEnd(4),
        formatPercent(s.meanPrecision).padEnd(12),
        formatPercent(s.meanRecall)
      );
    });

    console.log("\nSample sizes are small (see n columns above) — report alongside every metric, per the design spec.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
