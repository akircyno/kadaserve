---
name: awesome-claude-skills
description: Use this project skill when choosing Claude-style workflow skills for KadaServe, especially complex logic, testing, debugging, architecture, analytics, data analysis, or thesis-oriented intelligent-system planning. This wraps karanb192/awesome-claude-skills as a local KadaServe reference; it is a catalogue, not a direct bundle of installed runnable skills.
---

# Awesome Claude Skills Reference for KadaServe

This skill is a local KadaServe wrapper around:

- Source: `https://github.com/karanb192/awesome-claude-skills`
- Fetched commit: `18f038311f1041c92158357692bf8ddfa8c5da4d`
- Source type: catalogue/reference list

The upstream repository is not itself a runnable skill package. It does not contain a root `SKILL.md` for direct installation. Use this project skill as a decision aid for selecting workflow skills and patterns, then inspect and install the actual source skill repository only when needed.

## When To Use

Use this skill when the task needs one of these:

- Complex logic planning for KadaServe intelligent features.
- Algorithm or analytics design for Computer Science thesis framing.
- TDD, debugging, validation, or code review workflow selection.
- Choosing whether Huashu Design should be paired with a logic, testing, architecture, or data-analysis workflow.
- Turning admin dashboards from plain IT records into decision-support modules.

## KadaServe Skill Pairing

Use this together with `huashu-design` when the task has both logic and UI:

1. Use `awesome-claude-skills` first to frame the thinking workflow:
   - What algorithm, metric, rule, classifier, or prediction method should exist?
   - What should be computed by the system instead of manually managed?
   - What validation or testing workflow is needed?
2. Use `huashu-design` second for visual hierarchy and UI presentation:
   - How should insights, scores, warnings, and recommendations appear?
   - How should the admin panel be grouped and made responsive?
3. Implement only after the logic and UI direction are clear.

## Useful Skill Categories From The Catalogue

Prioritize these catalogue categories for KadaServe:

- Testing and Quality: TDD, web app testing, verification before completion.
- Debugging and Troubleshooting: systematic debugging, root-cause tracing.
- Development and Architecture: architecture review, API design, refactoring strategy.
- Data and Analysis: analytics interpretation, scoring models, forecasting, chart reasoning.
- Documentation and Automation: thesis docs, demo guides, reproducible workflows.
- Meta Skills: skill creation and subagent-driven planning, when appropriate.

## KadaServe Intelligent Admin Ideas

When asked how to make KadaServe more Computer Science-based, prefer features that compute, classify, predict, or recommend:

- Menu performance scoring.
- Item classification such as `Star Item`, `Growing Item`, `Needs Review`, and `Low Performer`.
- Peak-hour prediction or busy-period forecasting.
- Customer preference grouping.
- Feedback categorization and satisfaction signals.
- Decision-support recommendations for admin actions.

Avoid making the admin panel feel like a plain IT CRUD system. Inventory-only workflows, static tables, and manual monitoring should be de-emphasized unless they directly support analytics or decision support.

## Installation Rule

Do not assume a catalogue entry is installed. Before installing a listed skill:

1. Fetch or inspect the target source repository.
2. Confirm it has a valid `SKILL.md`.
3. Check license and safety.
4. Install only the specific useful skill, not the whole catalogue by default.

## Current Note

This wrapper makes the catalogue usable inside the KadaServe project workflow. It does not make Claude-only tools magically available in Codex. For this project, treat it as a structured research and planning reference.
