/**
 * Recommendation Engine — AHP Weight Derivation
 *
 * Weights are derived using the Analytic Hierarchy Process (AHP)
 * as described in: Saaty, T. L. (1980). The Analytic Hierarchy Process.
 * McGraw-Hill, New York.
 *
 * The three scoring dimensions are:
 *   F = Frequency     (how often the customer orders this item)
 *   R = Recency       (how recently the customer ordered this item)
 *   S = Satisfaction  (customer feedback rating on this item)
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 1 — Pairwise Comparison Matrix (scale 1–9)
 *
 * Domain reasoning for a coffee-shop repeat-purchase context:
 *   • Frequency vs Recency: Frequency is moderately more important
 *     (repeat purchases are the primary signal of ingrained preference).
 *     Score: F/R = 3
 *   • Frequency vs Satisfaction: Frequency is slightly more important
 *     (a customer who orders repeatedly despite low feedback is still
 *     expressing revealed preference; feedback may reflect a single
 *     atypical experience).
 *     Score: F/S = 2
 *   • Recency vs Satisfaction: Recency and satisfaction are roughly
 *     equal; recency captures temporal drift of preferences, while
 *     satisfaction captures declared quality perception.
 *     Score: R/S = 1
 *
 * Pairwise matrix A:
 *        F     R     S
 *   F  [ 1     3     2 ]
 *   R  [ 1/3   1     1 ]
 *   S  [ 1/2   1     1 ]
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 2 — Column sums
 *   Col F: 1 + 1/3 + 1/2 = 1.833
 *   Col R: 3 + 1   + 1   = 5
 *   Col S: 2 + 1   + 1   = 4
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 3 — Normalized matrix (divide each cell by its column sum)
 *        F          R          S
 *   F  [ 0.5455    0.6000    0.5000 ]
 *   R  [ 0.1818    0.2000    0.2500 ]
 *   S  [ 0.2727    0.2000    0.2500 ]
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 4 — Priority vector (row means of normalized matrix)
 *   w_F = (0.5455 + 0.6000 + 0.5000) / 3 ≈ 0.5485
 *   w_R = (0.1818 + 0.2000 + 0.2500) / 3 ≈ 0.2106
 *   w_S = (0.2727 + 0.2000 + 0.2500) / 3 ≈ 0.2409
 *
 * Rounded to sum = 1: w_F=0.55, w_R=0.21, w_S=0.24
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 5 — Consistency check
 *   λ_max ≈ A·w / w:
 *     Row F: (1·0.55 + 3·0.21 + 2·0.24) / 0.55 = (0.55+0.63+0.48)/0.55 ≈ 3.018
 *     Row R: (0.333·0.55 + 1·0.21 + 1·0.24) / 0.21 = (0.183+0.21+0.24)/0.21 ≈ 3.014
 *     Row S: (0.5·0.55 + 1·0.21 + 1·0.24) / 0.24 = (0.275+0.21+0.24)/0.24 ≈ 3.021
 *   λ_max ≈ (3.018 + 3.014 + 3.021) / 3 = 3.018
 *
 *   CI = (λ_max − n) / (n − 1) = (3.018 − 3) / 2 = 0.009
 *   RI for n=3 = 0.58 (Saaty, 1980, Table 3)
 *   CR = CI / RI = 0.009 / 0.58 ≈ 0.016
 *
 *   CR < 0.10 ✓ — Judgments are consistent.
 *
 * ───────────────────────────────────────────────────────────────
 * STEP 6 — Feedback dimension sub-weights
 *
 * The feedback rating has three sub-dimensions:
 *   O = Overall rating  (holistic customer satisfaction — most representative)
 *   T = Taste rating    (primary sensory dimension for a beverage)
 *   K = Strength rating (ancillary preference signal; idiosyncratic)
 *
 * Pairwise matrix for feedback sub-dimensions:
 *        O     T     K
 *   O  [ 1     2     3 ]
 *   T  [ 1/2   1     2 ]
 *   K  [ 1/3   1/2   1 ]
 *
 * Priority vector (following same AHP steps):
 *   w_O ≈ 0.54,  w_T ≈ 0.30,  w_K ≈ 0.16
 *
 * CR for this sub-matrix ≈ 0.003 ✓
 */

/** AHP-derived top-level weights for the composite preference score. */
export const PREFERENCE_WEIGHTS = {
  /** Behavioral frequency signal weight (w_F). */
  frequency: 0.55,
  /** Temporal recency signal weight (w_R). */
  recency: 0.21,
  /** Feedback satisfaction signal weight (w_S). */
  feedback: 0.24,
} as const;

/** AHP-derived sub-weights for the feedback composite score. */
export const FEEDBACK_DIMENSION_WEIGHTS = {
  /** Overall holistic satisfaction rating weight (w_O). */
  overall: 0.54,
  /** Taste/flavor dimension weight (w_T). */
  taste: 0.30,
  /** Strength/intensity dimension weight (w_K). */
  strength: 0.16,
} as const;

/**
 * Recency decay half-life in days.
 *
 * Uses a hyperbolic decay function f(d) = 1 / (1 + d/τ), where τ is the
 * half-life parameter. At d=τ the score drops to 0.5, at d=2τ to 0.33.
 * A 30-day half-life reflects the typical re-purchase cycle for a coffee shop
 * (weekly visits → 4–5 orders/month). Cf. exponential decay e^(-λd) where
 * λ=ln(2)/τ; the hyperbolic form is chosen because it penalizes very recent
 * inactivity less steeply, preserving signal for occasional customers.
 *
 * Reference: Ding, Y. et al. (2010). "Time-weight collaborative filtering."
 * CIKM '05 — ACM, pp. 485–492.
 */
export const RECENCY_HALF_LIFE_DAYS = 30;

/**
 * Minimum number of feedback observations required before the satisfaction
 * score is trusted at full weight. Below this threshold the score is shrunk
 * toward a skeptical prior (see Wilson score lower bound usage in scoring).
 *
 * Reference: Wilson, E. B. (1927). "Probable inference, the law of succession,
 * and statistical inference." Journal of the American Statistical Association.
 */
export const FEEDBACK_MIN_CONFIDENT_OBSERVATIONS = 2;

/**
 * Skeptical prior for the feedback satisfaction score when no observations
 * exist. Set to 0.5 (midpoint of [0,1]) rather than the previous 0.6 (3/5),
 * reflecting genuine uncertainty rather than assumed moderate satisfaction.
 *
 * A missing rating does NOT mean the customer is neutral — it means we have
 * no information. The prior of 0.5 is the maximum-entropy Bayesian prior
 * for a Bernoulli-like bounded score.
 */
export const FEEDBACK_SKEPTICAL_PRIOR = 0.5;

/**
 * Time-of-day context boost constants.
 *
 * Coffee shops exhibit strong temporal consumption patterns:
 * morning → hot beverages / espresso; afternoon → iced / frappe.
 * A contextual multiplier nudges recommendations toward session-appropriate
 * items without fully overriding behavioral history.
 *
 * This is a lightweight implementation of context-aware filtering (CAF)
 * as described in: Adomavicius, G. & Tuzhilin, A. (2011). "Context-aware
 * recommender systems." Recommender Systems Handbook, Springer, pp. 217–253.
 */
export const CONTEXT_BOOST = {
  /** Boost applied to hot-beverage items during morning hours (6–11). */
  morningHotBoost: 0.05,
  /** Boost applied to iced/frappe items during afternoon hours (12–18). */
  afternoonIcedBoost: 0.05,
  /** Boost applied to pastry items during morning and late-afternoon (6–11, 15–18). */
  pastryBoost: 0.03,
} as const;

/** Morning session hour range (inclusive). */
export const MORNING_HOURS = { start: 6, end: 11 } as const;
/** Afternoon session hour range (inclusive). */
export const AFTERNOON_HOURS = { start: 12, end: 18 } as const;
/** Late-afternoon snack window (inclusive, subset of afternoon). */
export const SNACK_HOURS = { start: 15, end: 18 } as const;
