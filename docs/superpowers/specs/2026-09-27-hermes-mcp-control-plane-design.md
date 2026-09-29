# Hermes MCP Control Plane

## Intent

Make the LIFESYSTEM MCP a safe control plane for Hermes: the agent may inspect context, prepare a concrete action and execute bounded domain operations. The LIFESYSTEM remains the source of truth; Google Calendar is a managed mirror for scheduled work.

## Product rules

1. Hermes has a distinct identity and least-privilege credentials. A model-inference credential must not automatically grant data mutation rights.
2. The agent uses domain actions, never broad record deletion, for personal operations. Generic CRUD stays available only to explicitly scoped trusted clients for backwards compatibility.
3. A capture is triage material and can be converted idempotently into a note, task, content item, financial entry, calendar event, project or edital.
4. A task has one date: its planned day is also its `dueDate`; its focus-time block is optional. A Google event created for a task is owned, linked and conflict-protected by the task-planning engine.
5. Read tools are paginated and bounded. Write tools accept a caller-provided idempotency key where a retry could produce duplicate external or financial effects.
6. The audit records the client identity, request correlation, timing, outcome and safe target metadata. It never stores secrets or arbitrary input bodies.
7. The Hermes panel only calls a connection healthy after a signed heartbeat or a recent real tool call from a named credential.

## Architecture

`/api/ai/v1/*` authenticates a dedicated agent-inference credential with the `ai:invoke` capability. `/api/mcp` continues to authenticate domain-scoped MCP credentials. A Hermes installation receives two credentials: one for reasoning and one for tools.

MCP mutations are arranged as domain operations. `convert_capture` calls the existing conversion engine. `plan_task_block`, `remove_task_block` and `adopt_task_calendar_event` call the existing task-planning engine. Calendar reads use the existing Google Calendar reader; simple events are created with an idempotency receipt and can be updated or cancelled only when LIFESYSTEM created and recorded them.

The heartbeat endpoint is authenticated with an MCP credential that has `agent:heartbeat`. It stores a small, bounded status record keyed by the credential ID. It does not accept commands or model prompts.

## Scope model

Existing `domain:read` and `domain:write` scopes remain compatible. New action scopes are additive:

- `ai:invoke` — invoke the OpenAI-compatible inference endpoint.
- `captures:convert` — convert a capture.
- `tasks:plan` — reserve, synchronize or remove a task focus block.
- `calendar:read` — read calendar availability/events.
- `calendar:write` — create, update or cancel LIFESYSTEM-managed simple calendar events.
- `agent:heartbeat` — publish Hermes runtime status.

The deployment should create `hermes-ai` with only `ai:invoke`, and `hermes-mcp` with the minimal list of task, capture, calendar and financial scopes that Hermes needs. `MCP_API_KEY` remains a temporary compatibility credential but is documented as migration-only.

## Error and recovery rules

The write receipt maps a client idempotency key to a created result. Replaying the same key and operation returns that result; reusing it for another operation fails. Calendar task blocks retain their existing Google conflict behavior. A failed external call preserves the local task planning state with its retry information.

## Verification

Protocol tests must prove capability separation, paginated output, capture conversion, planning delegation and calendar ownership. Unit tests must prove receipt idempotency and heartbeat storage. The existing full Playwright suite, lint and production build remain release gates.
