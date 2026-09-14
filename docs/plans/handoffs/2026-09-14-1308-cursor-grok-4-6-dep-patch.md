---
session: 2026-09-14T13:08-05:00
model: Grok 4.6 (Cursor)
description: >-
  Bounded js-yaml 3.15.2 and fast-uri 3.1.6 pins. Dropped unused
  MCP gray-matter. Lockfile +2/−2. No Tiptap bump. No commit.
commits: none
---

# Astra dep patch — js-yaml / fast-uri — 2026-09-14 13:08

**Origin:** Cursor Grok 4.6 · Astra `DEPENDENCIES.md` candidates · no commit

Pins only. Tiptap / BlockNote still parked
([1310](2026-09-14-1310-cursor-grok-4-6-tiptap-reachability.md)).

| Pin | Was | Now |
|---|---|---|
| `js-yaml@3` | 3.15.1 | **3.15.2** |
| `fast-uri` | 3.1.5 | **3.1.6** |

Changed: `pnpm-workspace.yaml`, `mcp-server/package.json`,
`pnpm-lock.yaml`. `pnpm install` reported **+2 / −2**. Lockfile no
longer names 3.15.1 or 3.1.5.

`mcp-server` no longer lists `gray-matter`. Root `package.json` still
does (Vite). S1 already stopped calling it from `vault.js`.

## Checks

- `pnpm test:mcp` — **86/86**
- Did not bump Hono, qs, or Tiptap
- Trivy after the pin: [1316](2026-09-14-1316-cursor-grok-4-6-trivy-rescan.md) — live High is Tiptap only
- Did not claim Rhizome is an exposed HTTP server because `fast-uri`
  is transitive
