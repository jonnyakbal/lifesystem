# Hermes MCP Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the LIFESYSTEM MCP into a scoped, observable control plane for Hermes with safe capture, planning and calendar actions.

**Architecture:** Keep the existing Streamable HTTP server and JSON storage. Add capability-aware auth, a focused MCP domain-actions module and small persistent stores for idempotency receipts and agent heartbeats. Delegate planning and conversion to the product engines instead of duplicating them.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, Zod 4, MCP SDK, Playwright, JSON storage.

**Spec:** `docs/superpowers/specs/2026-09-27-hermes-mcp-control-plane-design.md`

## Global Constraints

- Preserve `MCP_API_KEY` as temporary compatibility only; never broaden a scoped credential.
- Do not store secrets or full agent prompts in LIFESYSTEM storage.
- Preserve the existing Google Calendar task conflict and retry semantics.
- Preserve existing untracked user artifacts.

## Review Focus

- A scoped inference key must not call MCP tools, and an MCP key must not invoke inference.
- A duplicate financial or calendar request with one idempotency key must not duplicate an external effect.
- A calendar action must reject an event owned by another LIFESYSTEM resource.
- A task planning action must preserve `dueDate` while creating its focus block.
- Pagination must never return more than the requested bounded page.

### Task 1: Capability credentials and bounded transport

**Files:**
- Modify: `src/lib/mcp/auth.ts`, `src/app/api/ai/v1/chat/completions/route.ts`, `src/app/api/ai/v1/models/route.ts`, `src/app/api/mcp/route.ts`
- Test: `tests/mcp-auth.spec.ts`, `tests/security-api.spec.ts`

- [ ] Add `canInvokeAi()` and authenticate the inference endpoints with a scoped `ai:invoke` credential or the legacy compatibility key.
- [ ] Use the named credential ID for rate-limit partitioning after authorization.
- [ ] Add a failing test proving capability separation, then implement it and re-run the focused tests.

### Task 2: Domain actions and read bounds

**Files:**
- Create: `src/lib/mcp/actions.ts`
- Modify: `src/lib/mcp/tools.ts`, `src/lib/mcp/auth.ts`
- Test: `tests/mcp-protocol.spec.ts`

- [ ] Add `limit` and `cursor` to generated list tools with a maximum page size of 100.
- [ ] Add conversion and planning actions that delegate to `convertCapture` and task-planning functions.
- [ ] Validate a failing MCP protocol test for each action before implementation, then re-run it green.

### Task 3: Managed calendar lifecycle and idempotency receipts

**Files:**
- Create: `src/lib/mcp/receipts.ts`
- Modify: `src/lib/google-calendar.ts`, `src/lib/mcp/tools.ts`, `src/lib/mcp/auth.ts`
- Test: `tests/mcp-protocol.spec.ts`, `tests/google-calendar.spec.ts`

- [ ] Create idempotency receipt helpers with operation and client binding.
- [ ] Add calendar read plus create/update/cancel operations that use LIFESYSTEM-managed event metadata.
- [ ] Prove duplicate create returns the first receipt without a second network request.

### Task 4: Operational audit and Hermes heartbeat

**Files:**
- Create: `src/lib/mcp/heartbeat.ts`, `src/app/api/hermes/heartbeat/route.ts`
- Modify: `src/lib/mcp/audit.ts`, `src/lib/mcp/log.ts`, `src/app/api/hermes/status/route.ts`, `src/app/(dashboard)/hermes/page.tsx`, `src/proxy.ts`
- Test: `tests/mcp-reliability.spec.ts`, `tests/mcp-auth.spec.ts`

- [ ] Add correlation ID and duration to audit data without storing request bodies.
- [ ] Add authenticated heartbeat storage and surface the latest named-agent heartbeat in `/hermes`.
- [ ] Prove an unauthorized heartbeat fails and an authorized heartbeat updates the status record.

### Task 5: Documentation, release validation and deployment

**Files:**
- Modify: `README.md`, `docs/deploy-producao.md`
- Test: full project test, lint and build

- [ ] Document two Hermes credentials, least-privilege scopes, real VPS smoke verification and migration away from legacy access.
- [ ] Run focused tests, then the full suite, lint and build.
- [ ] Commit the implementation and push `main` so Hostinger’s native Git integration deploys it.
