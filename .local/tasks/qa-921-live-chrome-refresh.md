## QA UPDATE — live authenticated Chrome is available; ink criterion now has a concrete failure

On 2026-09-27, the existing Chrome tab at
`http://127.0.0.1:5000/users/@e2e_owner/edit/e2e-manual-ink-921` was inspected
directly. The accessibility tree showed `Logout`, the `Revise this piece`
panel, the `@ink` target option, and an enabled `Refine piece` control.

Using the normal browser click on `Refine piece` produced a refinement plan,
but the run ended with the visible alert:

`Edit search must match exactly once: 'teal'.`

Version history remained at version 1, so no version was created. This is
new evidence against the ink criterion on this disposable fixture. It is not
evidence of logout and not a Playwright launch result. Keep #921 open and
reconcile the fixture/scenario source color before attempting closure; the
exact Playwright runner remains separately blocked by the macOS MachPort
permission failure.
