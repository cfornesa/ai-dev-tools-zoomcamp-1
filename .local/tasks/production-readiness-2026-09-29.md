# Production readiness — 2026-09-29

## Result

**BLOCKED / NOT PRODUCTION-READY.** The implementation batch is locally
verified, but the project still has open live-provider, source-contract,
CI/publication, browser-verification, and owner-run production work.

## Evidence

- Local deployment: `make compose-preflight` passed and
  `curl -fsS http://127.0.0.1:5000/health/` returned database/cache `ok`.
- Local quality: the exact `make check` for #1056 passed — 1,802 backend
  tests passed / 39 skipped and 3,168 frontend tests passed; lint,
  format-check, typecheck, and action-pin checks passed. Existing warnings
  were non-failing.
- Approved browser: #1055 has rendered Chrome evidence at 1280x900 and
  375x812; the real-provider showcase checks for #926 and #1040–#1046 ran
  against the disposable local stack and recorded failures without publishing
  failed artifacts.
- Production: no production database write, credential transfer, or publish
  was performed.

## Remaining open inventory

The authenticated GitHub search returned exactly these 17 open issues:

`#788 #859 #926 #1040 #1041 #1042 #1043 #1044 #1045 #1046
#1061 #1062 #1063 #1064 #1065 #1066 #1067`.

No open issue was silently omitted or duplicated. #1035 and #1036 were
reconciled and closed after their child/implementation criteria completed.

## Readiness classifications

| Dimension | Result | Next action |
| --- | --- | --- |
| Local deployment and automated checks | PASS | Preserve the green `make check` result. |
| Approved-browser verification | OPEN FOLLOW-UP | Complete #859's six-engine matrix; obtain owner-run live evidence for the implemented #1061–#1066 guards. |
| CI verification | OPEN FOLLOW-UP | Obtain the matching-ref CI/browser evidence required by #859 and any parent release gate. |
| Intended functionality | BLOCKED | Re-run the linked parent transactions after owner-run live evidence for #1061–#1066; deterministic guards and full local checks are complete. |
| Source-contract work | PASS | #1035 and #1036 are closed with child/implementation QA, full checks, migration-backed local save/reload, and exact 1280x900 and 375x812 rendered browser evidence. |
| Replit/publication | BLOCKED / OWNER-RUN | Keep #788 and any production writes on the explicitly authorized owner workflow. |
| Production readiness | BLOCKED | Re-run this gate after the listed open issues reach terminal states. |

### New readiness follow-up

`#1067` is an `OPEN FOLLOW-UP` for the contradictory ambient-audio public
delivery contract discovered during this read-only audit. It owns the
owner-selected policy and updates to `docs/api.md` and the durable memory
topic. Closed #1056 is preserved as historical scoped completion.

The #1068 follow-up is closed on `bf980992`: dirty unpublished-retention edits
are preserved during parent policy refreshes. Its focused suite, typecheck,
and full frontend suite passed. #1060 then passed its follow-up full gate and
is also closed; #1059 remains closed.

The isolated #859 CI retry (job `109299764071`) passed the six-engine embed,
immersive, thumbnail, and ZIP scenarios but failed the six-engine regular
canonical viewer and exposed 13 additional failures/timeouts in already
closed generated-piece contracts. #859 remains open. Per the discovery gate,
the new criterion-ready #1069 owns reproduction and stabilization of that
regression cluster; no closed issue was reopened or edited. Its terminal CI
run #1044 exposed #1070 for the parent-frame Tone/MediaStream microphone
defect and #1071 for the non-microphone browser-matrix/cache failures. #1069
is now closed on `ab28ad58` after 19/19 local affected tests and two final-ref
shard-5 passes. #1071 is now closed on `76abe2b7`: the PostgreSQL cache race is
fixed and its remaining diagnostics were retained under #1069/#859 and the
already-closed feature contracts.

## Routing audit

This gate ran as the owner-authorized Codex/GPT-5 medium-effort substitution
recorded in `DECISIONS.md`; the rostered Claude readiness model was not
available. The processed implementation and QA stages were Codex/GPT-5
substitutions, with independent-family second opinion not run. The issue
comments and transaction ledger record that provenance; no production claim
is inferred from local evidence.

## Exact next actions

1. Run the owner-scoped live-provider/browser evidence for implemented #1061–#1066
   within each issue's bounded contract; do not spend additional quota where
   the issue marks it out of scope.
2. Keep the source-contract implementation under regression coverage; #1035
   and #1036 are already reconciled and closed.
3. Implement and verify #1069, then rerun #859's browser matrix after its
   fixture dependencies and generated showcase follow-ups are resolved.
4. Keep #788 and other production-data actions owner-run; do not use local
   Compose evidence as production evidence.
