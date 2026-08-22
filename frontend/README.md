# Frontend

Vite-based React/TypeScript app for the scene editor. This file is
intentionally short — it's a pointer, not a maintained doc target.

For setup, commands, environment variables, the fixed dev server port,
and how the Vite dev server proxies to the Django backend, see the repo
root [README.md](../README.md) and [AGENTS.md](../AGENTS.md).

Quick reference (see AGENTS.md for details):

```bash
npm install
npm run dev        # dev server, fixed at http://localhost:5000
npm test           # vitest
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm run build        # typecheck + production build
```
