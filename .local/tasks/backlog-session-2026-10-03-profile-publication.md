# Profile/publication E2E batch — 2026-10-03

Owner-defined scope from the active goal: #1164, then #1165, then #1173. #1174 is excluded by owner direction and belongs to Goal 5. No issue is to be closed in this transaction. All three issues are in milestone 14, `Batch 14: matching-ref CI stabilization (2026-09-30)`.

## Manifest

| Issue | URL | Milestone | Wave | Dependency | Focused command | State | Commit | Evidence / next action |
|---|---|---:|---:|---|---|---|---|---|
| #1164 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1164 | 14 | 1 | before #1165/#1173/#1174 | five profile/template specs, Chromium | QA FAIL / follow-ups linked | `cdcdefa1` | all six original response bodies classified; runtime case passes, product cases remain under #1230, parity selector cases under #1166 |
| #1165 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1165 | 14 | 1 | after #1164 | `profilePhotoUpload.spec.ts`, Chromium | QA PASS local | issue commit | Linux run #371772 showed fixture `profile_image_url` retained after successful binary-image DELETE; test now clears only that URL before exercising upload/removal; local disposable Compose passes 2/2 |
| #1173 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1173 | 14 | 1 | after #1164 | canonical immersive/slug/collection specs, Chromium | GROOMED | pending | run after #1164; capture visible attribution text/structure and classify |

Stage provenance: grooming inputs are existing criterion-ready issue bodies; no prior-stage owner is inferred here. Stage 2a is Codex / GPT-6 / effort not exposed, substituted for Opencode Go. Stage 3 second opinion: not run. Stage 4 independent QA: pending. Stage 5 is not part of this owner-scoped local E2E goal. `track: mixed` (Codex implementation; local browser evidence; Linux evidence not yet run).

## Impact matrix

| Surface | Kind | Issues | Overlap / resolution | Required verification |
|---|---|---|---|---|
| `frontend/e2e/profileHandles.spec.ts` | Change | #1164; #1230 | Test fixture PATCH now sends only edited handle plus required revision; UI save remains #1230. Contexts must honor `E2E_BASE_URL` to avoid the owner's unrelated/unverified server on :5000. | #1164 focused command on disposable Compose; retain failing UI cases under #1230. |
| `pieceRuntimeErrorTemplate.spec.ts`, `pieceTemplateParity2d.spec.ts`, `pieceTemplateParity3d.spec.ts` | Change | #1164; #1166 | Omit GET-only/null profile fields. The parity cases progress to the duplicate toolbar name owned by #1166; no toolbar assertion changed. | Focused #1164 run; keep #1166 baseline entries. |
| `frontend/e2e/known-failures.json` | Change | #1164; #1165; #1166; #1173; #1230 | Remove only passing entries; retain unresolved failures under their owning issue. | Validate JSON and final ratchet/make check. |
| `frontend/e2e/profilePhotoUpload.spec.ts` | Change | #1165 | The profile-photo fixture also had a URL-based image; clear this independent field before upload so the binary-photo removal assertion starts from the intended state. Product behavior is unchanged. | Both viewports on disposable Compose; preserve upload, reject, render, removal, and public-avatar assertions. |
| canonical structured/immersive profile specs | Verify | #1164; #1173 | Attribution depends on profile identity but assertions remain route/slug/collection-specific. | Run all four #1173 cases after #1164. |
| `docs/tasks.md`, this ledger, `DECISIONS.md` | Change | #1164 plus batch | #1230 discovery recorded; preserve earlier worktree edits and stage only this transaction's blocks. | Review staged blobs against HEAD plus only our own blocks. |
| `backend/scenes/profile_api.py`, Account Settings product contract | Read only | #1164/#1230 | No product changes in this goal. #1230 owns the client/server null-style mismatch. | Link API/docs evidence in issue comments. |

## #1164 evidence

| Failing request | Captured response | Classification |
|---|---|---|
| `pieceRuntimeErrorTemplate.spec.ts` test setup | `{"error":"validation_failed","detail":{"style_key":["This field may not be null."]}}` | Test payload echoed GET's `style_key: null`; corrected payload omits the unset optional field. Local scenario passes 1/1. |
| `pieceTemplateParity2d.spec.ts` test setup | same | Test payload; corrected API call succeeds, then the test reaches #1166's duplicate accessible name. |
| `pieceTemplateParity3d.spec.ts` test setup | same | Test payload; corrected API call succeeds, then the test reaches #1166's duplicate accessible name. |
| `profileHandles.spec.ts`, desktop and mobile setup requests | same for each request | Test payload; corrected `setHandle` requests succeed. Later UI saves fail at the same null-style mismatch tracked by #1230. |
| `publicProfiles.spec.ts` form save | `{"error":"validation_failed","detail":{"style_key":["This field may not be null."]}}` | Product cause: the Account Settings form PATCHes the GET representation unchanged. Tracked by #1230; baseline retained. |

CI evidence is run #1126 (`https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37081997610`). Local run evidence is macOS Chromium against this repository's disposable Compose PostgreSQL stack, frontend `http://localhost:5100`, backend `127.0.0.1:8003`. This is not Linux closure evidence. PID 5701 on 127.0.0.1:8001 is the repo's `backend/manage.py runserver` with unknown DB identity; it was not used or modified. Compose preflight was attempted and rejected the stale exited base-config container; direct health/root/anonymous-identity checks confirmed the alternate-port app.

## Verification and reconciliation

- #1164 focused command: 6 scenarios, 1 passed / 5 failed later in their flows. Three later failure groups are already classified: #1230 (profile UI null-style save; publicProfiles + profileHandles) and #1166 (duplicate Piece controls accessible name; parity 2D/3D). Original request bodies/responses are captured above.
- #1165 Linux first-cause evidence: run [#371772](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37177255209), shard 12, returned 200 for valid image POST, 400 for rejected text upload, and 200 for image DELETE. The failed DOM still showed `profile_image_url=https://example.com/profile-1280-mutbx8l9.svg`, the `Remove photo` control and “Profile photo removed.” The removal endpoint only clears the uploaded binary; the separate URL field remained from the fixture. This is test-data contamination, not a removal API failure.
- #1165 focused command after clearing the fixture URL: 2/2 passed locally at 1280x900 and 375x812 on disposable Compose; both issue-owned baseline entries removed in its commit.
- #1173 focused command: pending.
- `make check`: pending.
- Batch union, impact re-verification, cross-issue review, issue comments, and independent stage-4 QA: pending. Do not close issues or claim the batch gate passed until every required check is complete.
