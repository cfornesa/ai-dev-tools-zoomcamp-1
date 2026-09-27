## QA: BLOCKED / VERIFICATION-BOUNDARY

This is a verification-only issue, not an implementation gap. The fake-provider
coverage for the targeting and asset-layer contracts is reconciled by #923,
#924, and #925. This issue requires a real provider credential supplied by the
owner through the app's provider-credential settings; no credential is
available in this session and the agent must not type, store, or infer one.

| Criterion | Result | Evidence boundary |
|---|---|---|
| Bounded live-run budget and stop-on-limit behavior | BLOCKED | No live run was started; no credential is available. |
| Case A: existing piece, `@Hills` scope preservation | BLOCKED | Requires owner-provided real-provider access in Chrome. |
| Case B: new piece, `@asset` layer renders | BLOCKED | Fake-provider behavior passes in #924; live-model verification remains unavailable. |
| Case C: existing piece, `@asset` layer and version increment | BLOCKED | Fake-provider behavior passes in #925; live-model verification remains unavailable. |
| Scope violation handling and defect issue creation | NOT TRIGGERED | No live run occurred, so no model violation can be classified. |
| Provider/model/run metadata without secrets | BLOCKED | No provider session or run ids exist to record. |

No production URL, production database, secret, or live-model quota was used.
The issue should remain open as a verification boundary until the owner
provides the credential through the product's supported settings flow and
authorizes the bounded Chrome observation.
