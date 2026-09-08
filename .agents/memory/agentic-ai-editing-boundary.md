# Agentic AI editing boundary

An agentic editor run is an orchestration layer over the existing provider
registry, encrypted owner credentials, scene/patch validators, entitlements
and explicit Accept transaction. It is not permission to execute model-written
code, publish content, use credentials as tool input, or mutate saved versions
during planning.

Use bounded, persisted owner-scoped runs with server-enforced target IDs,
base-version/digest checks, idempotent advance/accept and a cancellation state
that ignores late responses. Keep provider calls outside database transactions;
reuse existing quota rules without charging twice for the same final proposal.
Expose concise plans, validation outcomes and change summaries, never hidden
reasoning traces.

The initial scope is structured 2D and 3D AI editor routes. Raw generated
ArtPiece code stays in its existing sandboxed domain and is not implicitly
agent-enabled. Implement one shared service and separate route consumers;
do not introduce an agent framework, durable queue or native tool-calling
dependency when a bounded adapter-driven loop suffices.

Contracts: #461 shared run service, #462 AI 2D consumer, #463 AI 3D consumer.
Current status/priority belongs in docs/tasks.md and the current manifest,
not in this memory topic.
