# AI Recommendations (Collaborative Filtering + Evaluation) — Design

Status: Approved by user (2026-08-07), pending write-up review
Origin: Thesis defense panel revision — "Use of AI for recommendations" (Customer page)

## Context

This is Sub-project B of three derived from the panel's revision list:

- A. AI Analytics + Presentation (Admin) — **implemented**, see
  `2026-08-05-admin-ai-analytics-design.md`
- **B. AI Recommendations (Customer) — this doc**
- C. Reports Generation (Staff + Admin) — separate spec, not started
- (Online Payment — parked, blocked on the manager's PayMongo account)

### What already exists

The current recommendation engine is more sophisticated than a first read suggests.
`frontend/src/lib/recommendation-weights.ts` documents a full **AHP** (Analytic Hierarchy
Process, Saaty 1980) weight derivation — pairwise comparison matrix, normalized priority
vector, and a consistency check (CR ≈ 0.016 < 0.10) — yielding weights of frequency 0.55,
recency 0.21, satisfaction 0.24. `frontend/src/lib/recommendations.ts` adds Bayesian
shrinkage toward a skeptical prior for thin feedback, hyperbolic time decay (Ding et al.,
2010), and time-of-day context boosting (Adomavicius & Tuzhilin, 2011).

This is legitimate multi-criteria decision-making methodology and is **not** being replaced.

### The actual gap

The engine scores only items the customer has **already ordered**, then pads remaining
Top-N slots with global popularity. It has no mechanism for discovering items a customer
has never tried but would likely enjoy — no "customers who ordered X also enjoyed Y."
That is the hole collaborative filtering fills.

### A second gap: the thesis's own unmet commitments

Chapter 1 Objectives #5 and #6 commit to evaluating recommendations with **Precision@K and
Recall@K** and **comparing against a baseline method (popularity-based)**. Chapter 2.6.5–2.6.6
defines both formulas. None of this exists in code, and Chapter 3 (Results) is empty. This
spec covers that evaluation as a first-class deliverable, not an afterthought.

## Data reality check (measured 2026-08-07, live Supabase)

- 108 completed/delivered orders; 17 customers with at least one such order
- 11 customers have tried ≥2 distinct items (the evaluable population for CF)
- Distinct items per customer: `11, 7, 5, 4, 4, 4, 4, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1`
- 81 of 105 possible item pairs co-occur (77%) — but heavily driven by two power users
- 16 orders contain ≥2 distinct items (basket co-occurrence alone is too thin; customer
  history, not basket, is the correct unit of co-occurrence here)

### Prototype finding that drives the design

Raw item-item cosine similarity on this data is **unusable**, and measurably so. Support and
similarity are *inversely* related:

```
Mocha  -> Payment test(s=0.85, n=1)  Red Velvet Cookie(s=0.85, n=1)  Matcha Latte(s=0.79, n=2)
Payment test -> Red Velvet Cookie(s=1.00, n=1)
```

A single customer who bought exactly two items produces a **perfect 1.00 similarity**. The
₱1 "Payment test" item (1 order) contaminated the top-3 neighbors of five real menu items.

Applying significance weighting `sim × n/(n+λ)` with λ=3 corrects this — support and
score become positively correlated, and the surviving neighbors are domain-sensible:

```
Mocha             -> Strawberry Matcha(0.42, n=4)  Matcha Latte(0.32, n=2)  Choco Milk(0.31, n=2)
Iced Americano    -> Signature Blend(0.28, n=2)    (both plain black coffee)
Brown Sugar Latte -> French Vanilla Latte(0.30, n=2) (both sweet flavored lattes)
Matcha Latte      -> Strawberry Matcha(0.29, n=3)  (both matcha)
Choco Milk        -> Macchiato(0.40, n=3)
```

This before/after is itself a reportable Chapter 3 finding: naive cosine similarity fails at
small scale in a specific, diagnosable way, and significance weighting is the documented
remedy (Herlocker et al., 1999).

## Goals

1. Add item-based collaborative filtering so the system can recommend items a customer has
   never ordered, integrated as a discovery slot rather than a replacement for AHP scoring.
2. Make the CF statistically honest at this data scale via significance weighting, with the
   λ parameter empirically justified rather than asserted.
3. Build an offline Precision@K / Recall@K evaluation harness comparing three strategies,
   fulfilling Objectives #5–#6 and producing real numbers for Chapter 3.

## Non-goals

- Not replacing or retuning the AHP engine, its weights, or its consistency analysis.
- Not matrix factorization / SVD. Chapter 1's Scope and Limitations explicitly rejects it at
  this data scale, citing Fahrudin & Wisna (2022); proposing it now would contradict the RRL.
- Not content-based (attribute-derived) item similarity as a second similarity source.
  Considered and cut per YAGNI: the existing popularity fallback already covers the
  thin-support case, and a second similarity system would need independent tuning and defense.
- Not an admin UI for evaluation metrics. The evaluation is a script producing numbers for
  the manuscript; a dashboard view is out of scope for this panel revision.

## Algorithm

**Matrix.** Customer×item, cell = total quantity ordered across completed/delivered orders.
Quantities rather than binary — a customer ordering an item five times is a stronger signal
than ordering it once.

**Similarity.** Cosine similarity between item column vectors, then significance weighting:

```
weightedSim(x, y) = cosine(x, y) × n / (n + λ)
```

where `n` = number of customers who ordered both x and y, and λ = 3 (default; empirically
swept, see Evaluation).

**Prediction.** For a candidate item the customer has not ordered:

```
score(candidate) = Σ over customer's owned items [ weightedSim(candidate, owned) × ahpScore(owned) ]
```

The existing AHP preference score becomes the weight, so the two systems compose rather than
compete. Candidates are restricted to `is_available = true` items the customer has not ordered.

**Minimum threshold.** A candidate qualifies for the discovery slot only if its score exceeds
`CF_MIN_SCORE = 0.05` **and** its best contributing pair has support `n ≥ 2`. The support floor
is the important one: it structurally excludes the spurious single-observation similarities the
prototype exposed, independent of how the weighting is tuned. Candidates failing either test are
discarded and the slot falls through to popularity.

## Integration

The Top-N assembly in `recommendations.ts` currently fills slots 1–2 from top AHP-scored known
items and slot 3+ from global popularity. The change: **slot 3 becomes a CF discovery slot**,
labeled and explained as such ("Customers who ordered <item> also enjoyed this"), falling
through to the existing popularity fallback when no candidate clears the minimum score
threshold.

Slots 1–2 and the cold-start path (no completed orders → pure popularity) are unchanged, so
new-customer experience is byte-identical to today's.

## Evaluation

**Protocol.** Leave-one-out with a **temporal** holdout: for each customer with ≥2 distinct
items, hold out their most recently ordered distinct item, generate Top-K from the remaining
history, and check whether the held-out item appears. Temporal rather than random holdout —
random selection leaks future information and inflates results.

**Metrics.** Precision@K and Recall@K exactly as defined in Chapter 2.6.5–2.6.6, averaged
across evaluable customers, at K = 1, 3, 5. K=3 is the production Top-N size and is the headline
number; K=1 and K=5 bracket it to show how the ranking behaves as the list tightens or widens.
Note that with a single held-out item per customer, Recall@K is either 0 or 1 per customer and
Precision@K is capped at 1/K — both are reported as means across customers, and Chapter 3 should
state this interpretation explicitly rather than letting a low Precision@5 read as poor
performance when 0.2 is its ceiling.

**Strategies compared (all three, same protocol):**

1. CF-hybrid (this spec's implementation)
2. AHP-only (the current production system) — isolates whether CF actually adds value
3. Popularity baseline — the comparison Objective #6 names explicitly

**Sensitivity.** Sweeps λ ∈ {1, 2, 3, 5} and reports metrics for each, so the chosen λ is
justified by measurement.

**Honesty constraint.** Only 11 customers are evaluable. The script prints this n alongside
every metric, and Chapter 3 must state it plainly. A small-sample result reported honestly is
defensible; the same result presented as definitive is not. It is entirely possible the
evaluation shows CF *not* beating the baseline at this data volume — that is a legitimate,
publishable finding and must be reported as-is, not tuned away.

## Files

- Create `frontend/src/lib/item-similarity.ts` — matrix construction, cosine, significance
  weighting. Zero external imports, independently testable.
- Create `frontend/src/lib/recommendation-evaluation.ts` — leave-one-out protocol, P@K/R@K,
  the three strategies. Depends on `item-similarity.ts` and `recommendations.ts`.
- Modify `frontend/src/lib/recommendations.ts` — CF discovery slot in Top-N assembly; new
  `RecommendationBasis`/`RecommendationLabel` variants for the CF case.
- Create `frontend/scripts/verify-recommendations.mjs` — unit tests.
- Create `frontend/scripts/evaluate-recommendations.mjs` — offline evaluation against live
  Supabase data, prints the Chapter 3 results table.
- Modify `frontend/package.json` — add `test:recommendations` and `evaluate:recommendations`.

## Testing

Following the project's standalone-script convention (no Jest/Vitest):

`verify-recommendations.mjs` covers:
- Cosine similarity against hand-computed vectors
- Significance weighting shrinks as expected (including that raw 1.00-at-n=1 case collapses)
- Self-similarity excluded from neighbor lists
- Items the customer already ordered are excluded from candidates
- Unavailable items excluded
- Zero co-occurrence returns empty rather than throwing

`evaluate-recommendations.mjs` is not a pass/fail test — it prints measured results. It must
run deterministically given fixed input data (no wall-clock dependence in the holdout logic).

## Error handling

Insufficient data at any point — no co-occurrence, no candidates clearing threshold, a
customer with a single distinct item — yields an empty CF result, and the existing popularity
fallback fills the slot. The customer UI never breaks, empties, or shows an error state as a
result of CF being unable to produce a recommendation.

## Operational note (outside this spec's code changes)

The live menu contains a "Payment test" item (₱1, category "Best Deals", 1 order) — real test
data in the production menu. It contaminated five items' CF neighbor lists during prototyping
and is also counted in the admin analytics totals. It should be deleted or marked unavailable
before any defense demo. Flagged here rather than fixed in code, since it is a data cleanup,
not a code defect.

## References

- Saaty, T. L. (1980). *The Analytic Hierarchy Process.* McGraw-Hill. (existing AHP weights)
- Sarwar, B. et al. (2001). "Item-based collaborative filtering recommendation algorithms."
  WWW '01.
- Linden, G., Smith, B., & York, J. (2003). "Amazon.com recommendations: item-to-item
  collaborative filtering." IEEE Internet Computing.
- Herlocker, J. et al. (1999). "An algorithmic framework for performing collaborative
  filtering." SIGIR '99. (significance weighting)
- Fahrudin & Wisna (2022) — already cited in thesis Chapter 1 RRL (CF at small scale)
- Shambour, Q. et al. (2023) — already cited in thesis Chapter 1 RRL (multi-criteria CF)
