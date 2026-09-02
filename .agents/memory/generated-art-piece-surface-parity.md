# Generated art-piece surface parity

The original PHP implementation is present locally at `../augment-humankind`.
For generated art-piece parity work, use `../augment-humankind/docs/piece-surface-parity.md`
as the maintained contract and inspect the corresponding runtime/admin source
before inventing behavior from screenshots or the live site.

The reference separates regular, regular-embed, immersive, and downloaded
surfaces but keeps their capability behavior aligned. Its stage controls are
overlaid on the artwork: screenshot, download menu, immersive/VR entry, sound,
Piece controls, hand guide, and icon-only fullscreen. Capability availability is
per engine/version; camera and microphone remain opt-in after a user gesture.

The current project's generated-art flow (`frontend/src/pages/ArtPieceStudio.tsx`)
is only a prompt → sandboxed iframe → ZIP flow. It is not the structured
Project/Project3D domain and must not execute generated source in Django or the
parent application. Cross-frame controls therefore require a validated,
origin-checked, versioned `postMessage` bridge (or an equally safe sandbox
protocol), with explicit privacy boundaries for public/draft content, prompts,
camera frames, and exports.

The reference's immersive route is a walkable presentation, not automatically
headset WebXR. Preserve that distinction unless a separate product decision
adds headset support. Treat the local PHP source as read-only reference input;
do not modify it as part of the generated-art implementation.

Linked backlog: #313 epic; #314 lifecycle/data/thumbnails; #315 management and
#316 stage controls; #317 capture/export; #318 immersive viewer; #319 browser
reconciliation.
