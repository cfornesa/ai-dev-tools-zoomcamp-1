---
name: Multi-vendor AI provider credentials
description: Boundaries for extending the Mistral-only scene provider to additional end-user vendors.
---

Preserve the shared validated 2D/3D scene and patch contracts while keeping
vendor adapters server-side. Provider keys must remain encrypted and
owner-scoped; they must never enter public request/response types, browser
bundles, logs, scenes, or exports. Treat Mistral Vibe as developer tooling
unless the owner explicitly changes product scope. Require deterministic
per-vendor contract tests, with live credentials treated as a separate
verification boundary.

**Why:** The current product uses Mistral for hosted scene generation, while
Mistral Vibe is a developer workflow tool. Gemini and DeepSeek can reuse the
scene contracts, but vendor-specific request formats, model validation, error
mapping, credential isolation, and settings UX must not be conflated.

**How to apply:** Build the vendor-neutral registry and credential foundation
before either adapter; keep Gemini and DeepSeek independently closable after
that foundation; add shared account/model selection only after both adapters
exist; finish with a cross-vendor fake/E2E matrix.