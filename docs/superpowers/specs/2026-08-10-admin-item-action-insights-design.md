# Actionable Item Insights (Admin Dashboard) — Design

Status: Implemented (2026-08-10)
Origin: Follow-up polish requested during live testing of Revision #1 (AI Analytics) — the
owner asked for the dashboard to suggest concrete actions, not just flag problems.

## Context

This is a small follow-up to the already-merged Admin AI Analytics work (PR #10, merged
2026-08-10), not one of the 5 numbered thesis revisions. It was raised while the user was
live-testing the Demand Forecast panel on `localhost:3000` as an admin.

### What already exists

`frontend/src/features/admin/components/admin-overview-view.tsx` currently renders two
separate panels side by side in the dashboard's third column:

- **Insights** (`visibleInsights`, capped at 3) — general FYI cards: Peak Hour, Weekly
  Growth, Top Favorite. Shape: `{label, value, detail, icon}`.
- **Needs Attention** (`needsAttentionItems`, built ~line 1555-1572, capped at 3) —
  rule-based warning/info cards: no orders yet, top item's rating dropped below 3.5,
  peak-demand staffing prep, week-over-week decline below -20%, satisfaction below
  threshold. Shape: `{icon, title, description, type: "info" | "warning"}`.

Neither panel currently does **per-item** diagnosis of underperforming menu items with a
specific suggested action (e.g. "run a promo," "bundle with a bestseller"). The only
per-item signal today is `topItem.rating < 3.5`, which only ever looks at the single
highest-ranked item, not items that are struggling.

`itemRanking` (the data both panels' item-level logic draws from) has a real landmine,
confirmed by reading `admin-dashboard.tsx:706-749`: there are two sources feeding the same
shape, `{item, orders, revenue, rating}`:

- `analyticsItemRanking` — real per-item ratings from actual customer feedback
  (`avg_rating ?? 0`).
- `itemRanking` (fallback) — used only when `analyticsItemRanking` is completely empty
  (zero feedback anywhere). Its `rating` field is **not a real rating** — it's fabricated as
  `Math.min(4.8, 3.8 + orders / 20)`, a formula derived directly from the item's own order
  count.

`displayItemRanking = analyticsItemRanking.length > 0 ? analyticsItemRanking : itemRanking`
picks whichever is non-empty. Any new logic that buckets items by rating must not trust the
fallback's rating values, or it will "explain" low demand using a number that is itself
just a restatement of order count — circular reasoning that would not hold up under
scrutiny.

## Goals

1. Merge "Needs Attention" into "Insights" — one panel, not two. Every insight (existing
   and new) uses the same card shape and the same list.
2. Add per-item actionable suggestions: when a specific menu item has low demand, suggest a
   concrete next step (not just "review it"), differentiated by *why* it's likely
   underperforming (rating-based diagnosis).
3. Also flag items with unusually **high** demand — a different, operational suggestion
   (stock/prep up), not a diagnosis. High demand isn't a problem to explain, it's a
   heads-up to act on before running low on cups/ingredients.
4. Guard against noisy suggestions on thin data (both at the "should we run item analysis
   at all" level, and at the "do we trust this item's rating" level).

## Non-goals

- Not changing the existing Needs Attention *conditions* (no orders yet, top-item rating
  drop, peak-demand prep, order decline, satisfaction warning) — they're relocated into the
  merged Insights list as-is, same trigger logic, same card content.
- Not adding true week-over-week per-item trend comparison (would require fetching and
  diffing a prior period's item ranking — real future work, not this pass). "Low demand" is
  defined relative to other items in the *current* period only.
- Not adding an LLM or any generated free text. Suggestions are a small, fixed set of
  template strings picked by rule-based logic — consistent with how Demand Forecast and
  Recommendations were built elsewhere in this project.
- Not adding new npm dependencies.

## Architecture

One new pure function in a new file, following the flat `frontend/src/lib/*.ts` convention:

`frontend/src/lib/item-action-insights.ts` —
`buildItemActionInsights(itemRanking, hasRealRatingData, totalOrders): InsightCard[]`

- `itemRanking: Array<{item: string; orders: number; rating: number}>` — same shape already
  used elsewhere in this component.
- `hasRealRatingData: boolean` — passed in as `analyticsItemRanking.length > 0` from the
  caller, so the function never has to guess whether a given `rating` value is real or the
  fabricated fallback.
- `totalOrders: number` — the same total already computed for the KPI cards.
- Returns `InsightCard[]`, using the existing Needs-Attention shape
  `{icon, title, description, type: "info" | "warning"}` so it merges into the same list
  with no adapter code needed.

Trigger logic inside the function:

1. **Data guard:** if `totalOrders < 20`, return `[]`. Thin-data periods don't get item
   suggestions at all (same spirit as `MIN_HISTORY_DAYS` in `demand-forecast.ts` — don't
   draw conclusions from too little data).
2. **Demand deviation detection:** compute `averageOrders` across all items in
   `itemRanking`. Flag two kinds of outliers, symmetric on a ratio scale around the average:
   - **Low demand:** `orders < 0.5 * averageOrders`.
   - **High demand:** `orders > 2 * averageOrders`.
3. **Suggestion per flagged item:**
   - Low demand, `!hasRealRatingData` → *"Not enough feedback to diagnose — a short promo
     could help surface why it's not selling."* (type: `"info"`)
   - Low demand, `hasRealRatingData && rating >= 4.0` → *"Customers who try [item] like
     it — feature it more, bundle it with a bestseller, or add it to recommendations."*
     (type: `"info"`)
   - Low demand, `hasRealRatingData && rating < 4.0` → *"[item] has low demand and low
     ratings — consider reviewing the recipe or quality before promoting it further."*
     (type: `"warning"`)
   - High demand → *"[item] is selling much more than usual — make sure you have enough
     cups, ingredients, and stock to keep up with demand."* (type: `"info"`; no rating
     branching needed, this is an operational heads-up, not a diagnosis)
4. **Cap:** at most 2 item-level cards total (low- and high-demand candidates share the same
   cap). Rank all flagged items by how far they deviate from the average
   (`abs(orders - averageOrders)`, descending) and take the top 2, so the most extreme
   outliers — whichever direction — surface first.

## Data flow

`admin-dashboard.tsx` already computes `displayItemRanking`, `analyticsItemRanking`, and
`totalOrders` (or an equivalent) upstream of `admin-overview-view.tsx`. The new call site
passes `analyticsItemRanking.length > 0` as `hasRealRatingData` directly — no new fetching,
no new API routes. Output merges into the existing `visibleInsights` array before the
`.slice()` cap is applied.

## UI change

Remove the "Needs Attention" `<Panel>` block entirely (`admin-overview-view.tsx` ~line
1943 onward, and its `showNeedsAttention` visibility flag). `needsAttentionItems` and the
new `buildItemActionInsights` output both feed into the single `visibleInsights` array,
ahead of the existing general FYI cards (Peak Hour, Weekly Growth, Top Favorite):

`needsAttentionItems`'s existing cap drops from 3 to 2 (down at its definition site,
`.slice(0, 2)`), so it can never crowd out the new item-action cards — the two categories
together are hard-capped at 4 (2 + 2) before FYI cards are even considered:

`visibleInsights = [...needsAttentionItems, ...itemActionInsights, ...existingFyiInsights].slice(0, 4)`

Cap raised from 3 to 4 (from two panels' worth of content now living in one). The "Insights"
panel keeps its existing title, styling, and position in the layout — only its content
source and internal ordering change.

## Error handling

Pure function over already-validated dashboard data (same guarantee as the rest of this
component's derived state) — no new failure modes. The `totalOrders < 20` and
`hasRealRatingData` guards are the only conditional paths; both simply return fewer cards,
never throw.

## Testing

`frontend/scripts/verify-item-action-insights.mjs`, following the established
standalone-script convention (no Jest/Vitest), with content-presence assertions. Covers:

- Data guard: `totalOrders < 20` → empty result.
- Low-demand boundary: item at exactly 50% of average is not flagged (strict `<`), item
  below is flagged.
- High-demand boundary: item at exactly 200% of average is not flagged (strict `>`), item
  above is flagged.
- All three low-demand suggestion buckets (no real rating data, rating ≥ 4.0, rating < 4.0)
  plus the high-demand suggestion.
- The fallback-rating edge case specifically: `hasRealRatingData: false` with a `rating`
  value in the fabricated 3.8-4.8 range must still produce the "not enough feedback" message,
  not a false "customers like it" message — this is the regression test for the circular-
  reasoning bug this design exists to avoid.
- Cap and priority: more than 2 flagged items (mixing low- and high-demand outliers) returns
  only the 2 with the largest deviation from average, regardless of direction.

## References

None beyond this project's own established patterns — same rule-based-logic and
standalone-script-testing conventions as every other sub-project.
