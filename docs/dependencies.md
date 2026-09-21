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
