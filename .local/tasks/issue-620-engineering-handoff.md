## Engineering handoff: explicit 3D editor mode

Commit `18c9e79` derives the art-piece editor mode from the stable persisted
engine capability: Three.js/A-Frame are labeled `3D AI editor`, while the
2D engines are labeled `2D AI editor`. The existing revise/save/version flow
continues to pass the persisted engine ID into the matching sandbox adapter.

Post-change frontend full suite: 2,724 passed; typecheck passed; lint is
warning-only with existing warnings. Browser evidence is pending because
Docker and the local health endpoint are unavailable.
