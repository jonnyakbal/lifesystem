# Orion Health Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, auditable personal-health capability to LifeSystem MCP and UI without modifying Hermes or Arco CRM.

**Architecture:** A health-specific, single-file ledger stores observations, versions, proposals, approvals and receipts atomically. Scoped MCP tools and authenticated UI routes call the same domain service. Existing task and managed-calendar flows remain the only supported action destinations.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod 4, MCP SDK, JSON storage, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-orion-health-integration-design.md`

## Global Constraints

- Never put briefing values, credentials, real health records or conversation text in public fixtures or logs.
- No Hermes, Arco CRM, production config, cron or external calendar writes in this task.
- Legacy wildcard MCP key cannot access health data.

## Review Focus

- A repeated intention returns the same receipt; a reused key with different data conflicts.
- Corrections preserve history and reject stale revisions.
- Undated weight and incomplete sleep never gain inferred time or duration.
- Missing observations are unknown, not zero, and calendar failure does not invent availability.
- An agent cannot approve its own proposal or use a general-purpose MCP tool through a health-only key.

## Phase 1 — private ledger and observation contract

- [x] Add failing domain tests for create/retry/conflict, correction, partial/cross-midnight sleep, absent dates and empty summary.
- [x] Implement `src/lib/health/schemas.ts`, `store.ts`, and `service.ts` with one-file transactions and cross-process lock.
- [x] Rerun domain tests and typecheck.

## Phase 2 — MCP and approval

- [x] Add failing tests for scoped discovery, no legacy access, proposals, unauthenticated/agent approval denial, apply and receipts.
- [x] Implement health tool registration and authorization rules; add authenticated approval route.
- [x] Rerun MCP and route tests.

## Phase 3 — human experience

- [x] Add failing UI/API test for observations and pending proposals from same ledger.
- [x] Build Cultivar > Corpo & saúde with history, summary, correction/proposal approval and clear empty states.
- [x] Verify desktop/mobile, lint, typecheck and Webpack build.

## Phase 4 — action bridge (after Phase 1–3 validation)

- [x] Add versioned context, real pillar bindings and a read-only daily brief with unavailable Calendar state.
- [x] Specify and test deduplicated task proposal/apply through the existing task domain.
- [x] Specify and test managed calendar block proposal/apply through `plan_task_block` with partial-failure recovery (mock Google; no live write).
- [ ] Run full regression suite; publish only verified slices and report precise production evidence.
