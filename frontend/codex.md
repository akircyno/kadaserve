# KadaServe Frontend Codex Guide

This file is the working guide for future Codex sessions in the KadaServe frontend. Follow it before planning, editing, testing, or redesigning frontend work.

## Project Identity

KadaServe is a Computer Science-focused cafe ordering and analytics system. The frontend should present the system as an intelligent ordering, fulfillment, recommendation, and analytics platform, not only as an IT management tool.

The admin experience should move toward decision support:

- Demand pattern analysis.
- Peak-hour detection.
- Menu performance scoring.
- Customer preference scoring.
- Top-N recommendation support.
- Feedback-driven personalization.

## Stack

- Framework: Next.js App Router.
- Language: TypeScript.
- UI: React.
- Styling: Tailwind CSS utility classes.
- Icons: `lucide-react`.
- Auth and database: Supabase.
- Email: Nodemailer where configured.
- Payments: PayMongo foundation, feature-flagged until account readiness.
- Maps/delivery: coordinate-based delivery fee computation using store/customer coordinates.
- State patterns: local React state, `useMemo`, `useCallback`, focused component state.
- Main frontend areas:
  - Customer ordering dashboard.
  - Customer cart and checkout.
  - Staff order queue.
  - Staff encode order.
  - Staff order history.
  - Admin analytics dashboard.

## KadaServe Colors

Use the existing cafe palette unless there is a strong design reason to extend it.

- Deep green: `#0D2E18`
- Rich green: `#0F441D`
- Warm cream: `#FFF0DA`
- Soft cream: `#FFF8EF`
- Near-white cream: `#FFFCF7`
- Coffee brown: `#684B35`
- Muted brown text: `#7D6B55`
- Secondary muted text: `#8C7A64`
- Border tan: `#DCCFB8`
- Soft border: `#D6C6AC`
- Pale line: `#EFE3CF`
- Success tint: `#E6F2E8`
- Warning tint: `#FFF0DA`
- Error tint: `#FFF1EC`
- Error text: `#9C543D` or `#C55432`

Use accent colors sparingly. Analytics highlights may use muted teal/green only when it improves chart readability.

## UI Rules

- Build the actual usable app view, not a landing page.
- Keep the cafe identity warm, but make operational screens dense, calm, and scannable.
- Avoid cluttered sidebars. Prefer fewer modules with tabs inside.
- Avoid boxy button edges. Use rounded pills or soft rounded controls where appropriate.
- Do not use giant decorative cards inside cards.
- Do not add decorative gradient orbs or irrelevant background effects.
- Use `lucide-react` icons for controls and actions.
- Keep text inside buttons and chips from overflowing on laptop and mobile widths.
- For laptop layouts, especially around `1366x768` and `1440x900`, prevent header controls from colliding with titles.
- For staff/admin tools, prioritize scan speed, clear status labels, and stable dimensions.
- For customer UI, prioritize clarity, ordering confidence, and feedback prompts that do not feel intrusive.

## Engineering Rules

- Read the surrounding component before editing.
- Follow existing component and styling patterns before inventing new abstractions.
- Keep changes scoped to one feature at a time.
- Do not revert user changes unless explicitly asked.
- Use `apply_patch` for manual file edits.
- Prefer `rg` for search.
- Do not add new libraries unless they clearly reduce risk or match the existing stack.
- Update `backend/docs` for every meaningful progress/change.
- Run verification after implementation:
  - `npm run lint`
  - `npm run build`
  - Smoke-check the affected local route when possible.

## Task Loop

Use this loop for every feature:

```text
Build -> Test -> Approve -> Next Feature
```

Rules:

- One feature at a time.
- Do not start the next feature until the current one is built, tested, and approved.
- If the user says pause, undo, or do not code, stop implementation work.
- If a visual change is involved, test at desktop, laptop, and mobile widths when possible.
- If the user reports a screenshot issue, fix that exact issue first before broad redesign.

## Current Product Direction

The intended admin redesign direction is:

- Dashboard
- Demand 
- Customer Intelligence
- Menu

Stock-management workflows should stay out of the thesis-facing admin panel because they make the system feel more like a generic IT/business management system.

Model evaluation should not be a main sidebar module. If needed, expose it as a small `System Metrics` section inside Customer Intelligence or Dashboard for defense/demo use.

## Design Skill Workflow

When the user asks for design exploration:

1. Use logic/planning first for the intelligent-system feature definition.
2. Use Huashu Design for UI direction, hierarchy, and prototype-quality visual thinking.
3. Implement only after the module structure and behavior are clear.

For admin intelligence work, define first:

- What the system computes.
- What the admin learns.
- What action the admin should take.
- What metric or algorithm supports the output.

Then design the screen.

Do not put in the docs the changes from the original or what we removed. Just put the exact system
Do not ask any permission, i set it to Fully Access