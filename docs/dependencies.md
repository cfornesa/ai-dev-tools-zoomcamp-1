# Dependency and asset licenses

## Self-hosted presentation fonts (#643)

The frontend serves these font files from its own origin; no runtime font CDN
or external font service is used:

- `frontend/public/assets/fonts/pinyon-script-latin.woff2` — Pinyon Script,
  Sorkin Type Co; SIL Open Font License 1.1.
- `frontend/public/assets/fonts/lora-normal-latin.woff2` — Lora,
  Cyreal; SIL Open Font License 1.1.
- `frontend/public/assets/fonts/lora-italic-latin.woff2` — Lora,
  Cyreal; SIL Open Font License 1.1.

These files are the self-hosted assets already used by the authoritative
`augment-humankind-react-node` reference. The font files are bundled with the
application and are not sent to a third-party service at runtime. The SIL OFL
1.1 license permits embedding and redistribution with the application; the
font files retain their original family names and are not sold separately.

## `@radix-ui/react-alert-dialog` (#1006 pilot)

Added 2026-09-28 as an owner-authorized pilot for replacing the native
`window.confirm()` dialog (see `docs/conventions/design-ux.md`'s "Heuristics
#5/#6" and "mixed-system option" sections). It is a client-side, unstyled
interaction-behavior library bundled into the frontend build — it sends no
data to any external service at runtime, so the AGENTS.md §8 question ("what
breaks if the service changes/shuts down") reduces to ordinary
package-maintenance risk, not a live-service dependency:

- **What breaks if abandoned or a breaking release lands:** only the one
  confirm-replacement dialog component; no other surface depends on it yet
  (this pilot is deliberately scoped to that single pattern, not `useMenuButton`
  or `useRovingRadioGroup`).
- **Self-hosting/rollback alternative:** fork/vendor the small primitive's
  source directly, or revert to the existing hand-rolled `useAlertDialogFocus`
  hook, which remains in the codebase and is not being removed by this pilot.
- **Scope:** evaluated and approved per-pattern, not as a general component-
  library adoption. Adopting Radix UI (or React Aria) for the other two
  hand-rolled patterns is a separate future decision.
