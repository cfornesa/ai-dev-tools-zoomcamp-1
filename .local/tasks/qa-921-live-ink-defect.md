## QA UPDATE — authenticated Chrome confirms `@ink` changes source instead of ink data

After correcting the disposable fixture source to include the fake-provider
token `teal`, the active authenticated Chrome flow was retried with normal
clicks. The `Ink layer · ink` target was selected, the prompt was
`Change the ink color`, and `Refine piece` completed with status
`Refinement saved as version 1881` (local fixture).

The resulting editable source was:

`<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e76f51"/></svg>`

The source changed from `fill="teal"` to `fill="#e76f51"` while the selected
target was `@ink`. This fails #921's ink isolation criterion: an ink-targeted
run must change only `generation_metadata.ink`, not the source. The earlier
exact-match error was a fixture mismatch and was corrected locally; this
remaining result is a concrete implementation defect, not a logout or
Playwright-availability issue. #921 remains open and needs an implementation
follow-up before the browser criteria can close.
