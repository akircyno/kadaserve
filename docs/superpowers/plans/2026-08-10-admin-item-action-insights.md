# Actionable Item Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Admin dashboard's separate "Needs Attention" panel into "Insights", and add per-item, rating-aware suggestions (promo/feature/bundle for low-demand-but-liked items, quality review for low-demand-and-low-rated items, stock-up for high-demand items) for menu items that deviate significantly from average demand.

**Architecture:** One new pure function in a new file (`frontend/src/lib/item-action-insights.ts`) that takes the existing item ranking data plus a real-vs-fabricated rating flag and returns rule-based suggestion cards. The dashboard component (`admin-overview-view.tsx`) merges this output with its existing rule-based alerts into a single "Insights" panel, replacing the old two-panel layout.

**Tech Stack:** TypeScript, React (Next.js client component), no new npm dependencies.

## Global Constraints

- No new npm dependencies.
- No Jest/Vitest — tests are a standalone script run via `node`, following the existing `scripts/verify-analytics.mjs` / `scripts/verify-dashboard-range.mjs` convention.
- `item-action-insights.ts` must have **zero imports** (not even type-only) — this keeps it testable via the simple `importDataUrlModule` data-URL trick (see `verify-dashboard-range.mjs`), no temp-file module resolution needed.
- `item-action-insights.ts` must not import React or any icon library — it returns icon *names* (a string union), not component references. `admin-overview-view.tsx` (which already imports icons) maps those names to real `lucide-react` components. This keeps the lib file consistent with this project's other pure `/lib` modules (`demand-forecast.ts`, `peak-hour-intensity.ts`), which have no UI dependencies.
- Match the existing rule-based (not LLM-generated) approach used everywhere else in this project's AI features.

---

### Task 1: `item-action-insights.ts` module + verification script

**Files:**
- Create: `frontend/src/lib/item-action-insights.ts`
- Create: `frontend/scripts/verify-item-action-insights.mjs`
- Modify: `frontend/package.json` (add `test:item-action-insights` script)

**Interfaces:**
- Produces: `type ItemRankingRow = { item: string; orders: number; rating: number }`, `type ItemActionInsight = { icon: "TrendingDown" | "Flame"; title: string; description: string; type: "info" | "warning" }`, `buildItemActionInsights(itemRanking: ItemRankingRow[], hasRealRatingData: boolean, totalOrders: number): ItemActionInsight[]`. Consumed by Task 2's `admin-overview-view.tsx`.

- [ ] **Step 1: Write `item-action-insights.ts`**

```typescript
// frontend/src/lib/item-action-insights.ts

export type ItemActionInsightIcon = "TrendingDown" | "Flame";
export type ItemActionInsightType = "info" | "warning";

export type ItemActionInsight = {
  icon: ItemActionInsightIcon;
  title: string;
  description: string;
  type: ItemActionInsightType;
};

export type ItemRankingRow = {
  item: string;
  orders: number;
  rating: number;
};

// Below this, item-level suggestions are too noisy to be meaningful (a slow
// day makes almost everything look "underperforming"). Matches the spirit of
// MIN_HISTORY_DAYS in demand-forecast.ts: don't draw conclusions from too
// little data.
const MIN_TOTAL_ORDERS = 20;
const LOW_DEMAND_RATIO = 0.5;
const HIGH_DEMAND_RATIO = 2;
const GOOD_RATING_THRESHOLD = 4;
const MAX_ITEM_ACTION_INSIGHTS = 2;

type FlaggedItem = {
  row: ItemRankingRow;
  direction: "low" | "high";
  deviation: number;
};

export function buildItemActionInsights(
  itemRanking: ItemRankingRow[],
  hasRealRatingData: boolean,
  totalOrders: number
): ItemActionInsight[] {
  if (totalOrders < MIN_TOTAL_ORDERS || itemRanking.length === 0) {
    return [];
  }

  const averageOrders =
    itemRanking.reduce((sum, row) => sum + row.orders, 0) / itemRanking.length;

  if (averageOrders <= 0) {
    return [];
  }

  const flagged: FlaggedItem[] = [];

  for (const row of itemRanking) {
    if (row.orders < LOW_DEMAND_RATIO * averageOrders) {
      flagged.push({ row, direction: "low", deviation: averageOrders - row.orders });
    } else if (row.orders > HIGH_DEMAND_RATIO * averageOrders) {
      flagged.push({ row, direction: "high", deviation: row.orders - averageOrders });
    }
  }

  flagged.sort((a, b) => b.deviation - a.deviation);

  return flagged.slice(0, MAX_ITEM_ACTION_INSIGHTS).map(({ row, direction }): ItemActionInsight => {
    if (direction === "high") {
      return {
        icon: "Flame",
        title: `${row.item} is in high demand`,
        description: `${row.item} is selling much more than usual — make sure you have enough cups, ingredients, and stock to keep up with demand.`,
        type: "info",
      };
    }

    if (!hasRealRatingData) {
      return {
        icon: "TrendingDown",
        title: `${row.item} has low demand`,
        description:
          "Not enough feedback to diagnose — a short promo could help surface why it's not selling.",
        type: "info",
      };
    }

    if (row.rating >= GOOD_RATING_THRESHOLD) {
      return {
        icon: "TrendingDown",
        title: `${row.item} has low demand`,
        description: `Customers who try ${row.item} like it — feature it more, bundle it with a bestseller, or add it to recommendations.`,
        type: "info",
      };
    }

    return {
      icon: "TrendingDown",
      title: `${row.item} has low demand`,
      description: `${row.item} has low demand and low ratings — consider reviewing the recipe or quality before promoting it further.`,
      type: "warning",
    };
  });
}
```

- [ ] **Step 2: Write the verification script**

```javascript
// frontend/scripts/verify-item-action-insights.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function importDataUrlModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const transpiled = transpile(source);
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`;
  return import(moduleUrl);
}

console.log("Testing item-action-insights.ts...");

const { buildItemActionInsights } = await importDataUrlModule(
  "../src/lib/item-action-insights.ts"
);

// Data guard: below MIN_TOTAL_ORDERS (20) returns nothing, even with a
// clearly struggling item.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 1, rating: 4.5 },
    ],
    true,
    19
  );
  assert.deepEqual(result, []);
  console.log("  PASS: totalOrders below the minimum returns no insights");
}

// Low-demand boundary: item at exactly 50% of average (avg=10, item=5) is
// NOT flagged (strict <).
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Boundary", orders: 5, rating: 4.5 },
    ],
    true,
    20
  );
  assert.deepEqual(result, []);
  console.log("  PASS: item at exactly 50% of average is not flagged (strict boundary)");
}

// Low-demand, just below boundary: avg=9.5, Struggler=4 (ratio ~0.421) IS
// flagged. Rating 4.5 >= 4.0 -> the "customers who try it like it" bucket.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 4, rating: 4.5 },
    ],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].icon, "TrendingDown");
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Struggler"));
  assert.ok(result[0].description.includes("bundle it with a bestseller"));
  console.log("  PASS: low demand + good real rating suggests feature/bundle/recommend");
}

// Low-demand + low rating (< 4.0) -> quality-review warning bucket.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 4, rating: 3.2 },
    ],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "warning");
  assert.ok(result[0].description.includes("reviewing the recipe or quality"));
  console.log("  PASS: low demand + low real rating suggests a quality review (warning)");
}

// Low-demand + no real rating data at all -> "not enough feedback" bucket,
// regardless of whatever placeholder rating value is passed in.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 0 },
      { item: "Struggler", orders: 4, rating: 0 },
    ],
    false,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Not enough feedback to diagnose"));
  console.log("  PASS: no real rating data suggests a promo to gather feedback");
}

// Regression test: the fabricated fallback rating formula in
// admin-dashboard.tsx produces values in the 3.8-4.8 range purely from order
// count (Math.min(4.8, 3.8 + orders / 20)) -- NOT real customer sentiment.
// With hasRealRatingData: false, a rating in that exact range must still
// produce the "not enough feedback" message, never the "customers like it"
// message -- otherwise the suggestion would be circular (explaining low
// demand using a number that is itself derived from order count).
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.6 },
      { item: "Struggler", orders: 4, rating: 4.4 },
    ],
    false,
    20
  );
  assert.equal(result.length, 1);
  assert.ok(
    result[0].description.includes("Not enough feedback to diagnose"),
    `expected the fallback-rating case to say "not enough feedback", got: ${result[0].description}`
  );
  assert.ok(!result[0].description.includes("like it"));
  console.log("  PASS: fabricated fallback rating never produces a false 'customers like it' message");
}

// High-demand boundary: 5 base items at 20 (diluting their own ratio so they
// stay safely inside the normal band) + one item at exactly 2x the average
// (avg=25, item=50) is NOT flagged (strict >).
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [...baseItems, { item: "Popular", orders: 50, rating: 4.2 }],
    true,
    20
  );
  assert.deepEqual(result, []);
  console.log("  PASS: item at exactly 200% of average is not flagged (strict boundary)");
}

// High-demand, just above boundary: same base items, Popular=51 (ratio
// ~2.026) IS flagged, with a stock-up suggestion.
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [...baseItems, { item: "Popular", orders: 51, rating: 4.2 }],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].icon, "Flame");
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Popular"));
  assert.ok(result[0].description.includes("cups"));
  console.log("  PASS: item just above 200% of average is flagged with a stock-up suggestion");
}

// Cap and priority: 5 base items at 20 (dilution) + Struggler(1), MildLow(9),
// Popular(60). avg=21.25. Deviations: Popular=38.75, Struggler=20.25,
// MildLow=12.25. Only the top 2 by deviation should be returned, regardless
// of direction, and MildLow (the smallest deviation) must be excluded.
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [
      ...baseItems,
      { item: "Struggler", orders: 1, rating: 4.2 },
      { item: "MildLow", orders: 9, rating: 4.2 },
      { item: "Popular", orders: 60, rating: 4.2 },
    ],
    true,
    20
  );
  assert.equal(result.length, 2);
  assert.ok(result[0].description.includes("Popular"), "largest deviation (Popular) should be first");
  assert.ok(result[1].description.includes("Struggler"), "second-largest deviation (Struggler) should be second");
  assert.ok(
    !result.some((insight) => insight.description.includes("MildLow")),
    "MildLow has the smallest deviation and should be excluded by the cap"
  );
  console.log("  PASS: cap keeps only the 2 largest deviations, mixing low and high demand");
}

console.log("\nAll item-action-insights.ts checks passed.");
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && node scripts/verify-item-action-insights.mjs`
Expected: FAIL — `Cannot find module` or similar, since `item-action-insights.ts` doesn't exist yet (if run before Step 1 is applied; since both steps are given together above, confirm failure by temporarily renaming the file, then restore it).

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && node scripts/verify-item-action-insights.mjs`
Expected: exits 0, prints all 9 PASS lines, ending in `All item-action-insights.ts checks passed.`

- [ ] **Step 5: Add the `test:item-action-insights` script to `frontend/package.json`**

In the `"scripts"` block, add a new line after the existing `"test:recommendations"` line:

```json
    "test:recommendations": "node scripts/verify-recommendations.mjs",
    "test:item-action-insights": "node scripts/verify-item-action-insights.mjs",
```

- [ ] **Step 6: Run via npm to confirm the script wiring works**

Run: `cd frontend && npm run test:item-action-insights`
Expected: same pass output as Step 4, invoked through npm.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/item-action-insights.ts frontend/scripts/verify-item-action-insights.mjs frontend/package.json
git commit -m "feat: add rule-based item action insights module"
```

---

### Task 2: Merge "Needs Attention" into "Insights" and wire item-action-insights

**Files:**
- Modify: `frontend/src/features/admin/components/admin-dashboard.tsx:1806` (pass new prop)
- Modify: `frontend/src/features/admin/components/admin-overview-view.tsx` (multiple sections — see steps)

**Interfaces:**
- Consumes: `buildItemActionInsights`, `ItemActionInsight` from `@/lib/item-action-insights` (Task 1).
- Produces: new required prop `hasRealRatingData: boolean` on `DashboardView`. Removes the `NeedsAttentionItem`-only "Needs Attention" panel and the now-unused `InsightCard` component.

- [ ] **Step 1: Pass `hasRealRatingData` from `admin-dashboard.tsx`**

In `frontend/src/features/admin/components/admin-dashboard.tsx`, in the `<DashboardView ... />` call, add the new prop immediately after `itemRanking={displayItemRanking}` (currently line 1806):

```typescript
                itemRanking={displayItemRanking}
                hasRealRatingData={analyticsItemRanking.length > 0}
```

- [ ] **Step 2: Add the `TrendingDown` icon import**

In `frontend/src/features/admin/components/admin-overview-view.tsx`, update the `lucide-react` import (currently lines 5-17):

```typescript
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Flame,
  Info,
  Coffee,
  PhilippinePeso,
  Package,
  Smile,
  Star,
  X,
} from "lucide-react";
```

to:

```typescript
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Flame,
  Info,
  Coffee,
  PhilippinePeso,
  Package,
  Smile,
  Star,
  X,
} from "lucide-react";
```

- [ ] **Step 3: Import `buildItemActionInsights`**

Add this import near the top of `frontend/src/features/admin/components/admin-overview-view.tsx`, after the `lucide-react` import block (after the line that closes with `} from "lucide-react";`):

```typescript
import { buildItemActionInsights, type ItemActionInsightIcon } from "@/lib/item-action-insights";
```

- [ ] **Step 4: Add `hasRealRatingData` to `DashboardView`'s props**

In the `DashboardView` function signature (currently starting at line 1393), add `hasRealRatingData` to both the destructured parameter list and its type. In the destructure block, add it immediately after `itemRanking,` (currently line 1400):

```typescript
  itemRanking,
  hasRealRatingData,
```

In the type block, add it immediately after the `itemRanking:` line (currently line 1420):

```typescript
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  hasRealRatingData: boolean;
```

- [ ] **Step 5: Delete the now-unused `InsightCard` component**

`InsightCard` (currently lines 245-271) will have no remaining call sites after this task — its only usage is replaced in Step 8. Delete the entire function:

```typescript
function InsightCard({
  detail,
  label,
  value,
  icon: Icon,
}: {
  detail: string
  label: string
  value: string
  icon: OverviewIcon
}) {
  return (
    <article className="flex min-w-0 items-start gap-3 rounded-[10px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2.5 transition hover:border-[#D8C8AA] hover:bg-[#FFF0DA]/45">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#EFE3CF] bg-[#FFFCF7] text-[#0D2E18]">
        <Icon size={14} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-xs font-black text-[#0D2E18]">
          {label}: <span className="font-black">{value}</span>
        </p>
        <p className="mt-1 line-clamp-2 font-sans text-[0.7rem] font-medium leading-relaxed text-[#7D6B55]">
          {detail}
        </p>
      </div>
    </article>
  );
}
```

Leave `NeedsAttentionItem` (the function immediately after it) untouched — it's reused for the merged panel.

- [ ] **Step 6: Cap `needsAttentionItems` at 2 instead of 3**

In `needsAttentionItems`'s definition (currently ending at line 1572), change:

```typescript
  ].slice(0, 3);
```

to:

```typescript
  ].slice(0, 2);
```

- [ ] **Step 7: Replace `visibleInsights` with the merged, unified-shape list**

Replace the entire `visibleInsights` block (currently lines 1574-1616 — from `const visibleInsights = [` through the closing `);` of its `.filter(...)` call) with:

```typescript
  const generalInsights = [
    {
      icon: Clock,
      title: `Peak Hour: ${busiestHour.orders > 0 ? busiestHour.label : "No data"}`,
      description:
        busiestHour.orders > 0
          ? `${busiestHour.orders} orders at peak. Busiest day: ${busiestDay.day}.`
          : "Wait for more order data.",
      type: "info" as const,
    },
    {
      icon: TrendingUp,
      title: `Weekly Growth: ${trendLabel}`,
      description:
        weeklyTrendCounts.length < 2
          ? "Need more data for comparison."
          : `${latestWeek} orders vs ${previousWeek} last week.`,
      type: "info" as const,
    },
    {
      icon: Star,
      title: `Top Favorite: ${topItem?.item ?? "-"}`,
      description: topItem
        ? `${topItem.orders} orders. Good item to recommend.`
        : "Collect order data first.",
      type: "info" as const,
    },
    {
      icon: Smile,
      title: `Satisfaction: ${satisfactionLabel}`,
      description:
        feedbackCount > 0
          ? `${averageRating.toFixed(1)}/5 from ${feedbackCount} ratings.`
          : "Encourage customer feedback.",
      type: "info" as const,
    },
  ];

  const ITEM_ACTION_ICONS: Record<ItemActionInsightIcon, OverviewIcon> = {
    TrendingDown,
    Flame,
  };

  const itemActionInsights = buildItemActionInsights(
    itemRanking,
    hasRealRatingData,
    totalOrders
  ).map((insight) => ({
    icon: ITEM_ACTION_ICONS[insight.icon],
    title: insight.title,
    description: insight.description,
    type: insight.type,
  }));

  const visibleInsights = [
    ...needsAttentionItems,
    ...itemActionInsights,
    ...generalInsights,
  ].filter(
    (insight) =>
      !keyword ||
      matchesSearch(insight.title, keyword) ||
      matchesSearch(insight.description, keyword)
  );
```

- [ ] **Step 8: Remove `showNeedsAttention`, adjust its call sites**

Replace (currently line 1622-1623):

```typescript
  const showInsights = !keyword || visibleInsights.length > 0;
  const showNeedsAttention = needsAttentionItems.length > 0 && (!keyword || matchesSearch("attention", keyword) || matchesSearch("alert", keyword));
```

with:

```typescript
  const showInsights = !keyword || visibleInsights.length > 0;
```

Then update `hasDashboardResults` (currently lines 1650-1660) — remove the `showNeedsAttention ||` line:

```typescript
  const hasDashboardResults =
    showKpi ||
    showInsights ||
    showOrdersWeek ||
    showOrderTypeDistribution ||
    showTopItems ||
    showSatisfaction ||
    showHourly ||
    showWeekly ||
    showDemandForecast;
```

Then update the outer section wrapper condition (currently line 1862):

```typescript
      {showTopItems || showSatisfaction || showInsights || showNeedsAttention ? (
```

to:

```typescript
      {showTopItems || showSatisfaction || showInsights ? (
```

- [ ] **Step 9: Replace the two-panel render block with one merged panel**

Replace the entire block (currently lines 1913-1959 — from `{showInsights || showNeedsAttention ? (` through its matching `) : null}`) with:

```tsx
          {showInsights ? (
            <div className="grid gap-3 xl:min-h-[310px]">
              <Panel
                id="admin-decision-support"
                className="scroll-mt-28"
                title="Insights"
              >
                {visibleInsights.length > 0 ? (
                  <div className="space-y-2">
                    {visibleInsights.slice(0, 4).map((insight, idx) => (
                      <NeedsAttentionItem
                        key={idx}
                        icon={insight.icon}
                        title={insight.title}
                        description={insight.description}
                        type={insight.type}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No insights match this search" />
                )}
              </Panel>
            </div>
          ) : null}
```

- [ ] **Step 10: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If there's an error about `hasRealRatingData` missing on the `DashboardView` call in `admin-dashboard.tsx`, confirm Step 1 was applied correctly. If there's an error about `ItemActionInsightIcon` not found, confirm Task 1's export exists.

- [ ] **Step 11: Run all analytics-family verification scripts**

Run: `cd frontend && npm run test:analytics && npm run test:dashboard-range && npm run test:item-action-insights`
Expected: all three print their full PASS lists and exit 0. This confirms the refactor didn't disturb the unrelated demand-forecast/peak-hour logic living in the same file.

- [ ] **Step 12: Lint the touched files**

Run: `cd frontend && npx eslint src/lib/item-action-insights.ts src/features/admin/components/admin-overview-view.tsx src/features/admin/components/admin-dashboard.tsx`
Expected: no errors (in particular, no "unused variable" warning for the deleted `InsightCard` or the old `showNeedsAttention`).

- [ ] **Step 13: Manually verify in the browser**

Start the dev server, log in as admin (`admin@kadaserve.ph`), open the Dashboard tab. Expected:
- Only one panel titled "Insights" appears in the third column (no separate "Needs Attention" panel below it).
- It shows up to 4 cards, generic ones (Peak Hour, Weekly Growth, Top Favorite, Satisfaction) styled the same way the old "Needs Attention" warning/info cards were (colored left-to-right by type), not the old flat-cream `InsightCard` style.
- If the current period's item data has enough orders (≥20) and a clear outlier item, an item-specific card appears with a promo/feature/quality-review/stock-up suggestion, prioritized ahead of the generic cards.
- No console errors.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/features/admin/components/admin-dashboard.tsx frontend/src/features/admin/components/admin-overview-view.tsx
git commit -m "feat: merge Needs Attention into Insights with item-level suggestions"
```

---

### Task 3: Final full verification pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1-2 together.

- [ ] **Step 1: Full verification script suite**

Run: `cd frontend && npm run test:analytics && npm run test:dashboard-range && npm run test:recommendations && npm run test:item-action-insights`
Expected: all four scripts print their full PASS lists, all exit 0.

- [ ] **Step 2: Full project typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full project lint on touched files**

Run: `cd frontend && npx eslint src/lib/item-action-insights.ts src/features/admin/components/admin-overview-view.tsx src/features/admin/components/admin-dashboard.tsx`
Expected: no errors.

- [ ] **Step 4: End-to-end browser walkthrough**

Start the dev server, log in as admin. Confirm:
1. Dashboard tab's "Insights" panel is a single merged panel (Task 2, Step 13's checks).
2. Search box: typing a keyword that matches an insight's title or description (e.g. part of an item name flagged in a suggestion) still filters the panel correctly; typing a keyword that matches nothing shows "No insights match this search".
3. No console errors anywhere in this walkthrough.

- [ ] **Step 5: Update the spec doc status line**

In `docs/superpowers/specs/2026-08-10-admin-item-action-insights-design.md`, change the `Status:` line from "Approved by user (2026-08-10), pending write-up review" to "Implemented (2026-08-10)".

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-08-10-admin-item-action-insights-design.md
git commit -m "docs: mark item action insights spec as implemented"
```
