---
session: 2026-09-14T12:55-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra S1+S2. MCP frontmatter is data-only. Search/context/config/AGENTS
  stay inside the vault. Synthetic fixtures only. No commit.
commits: none
---

# Astra S1+S2 — MCP boundary — 2026-09-14 12:55

**Origin:** Cursor Grok 4.6 · Astra security handoff · no commit

**Result: source PASS.** Astra harness S1/S2 rows PASS. `pnpm test:mcp`
**86/86**. `pnpm bundle-mcp` OK. Did not commit. Did not rebuild
`/Applications`. Did not close #46. Did not inspect real secrets.

HEAD at pickup: `4416411`. `vault.js` still matched the audit hash
before this edit.

## Boundary

**S1.** `parseMarkdownNote` no longer calls `gray-matter`. Bare YAML,
`---yaml` / `---yml`, and `---json` are data-only. `javascript` / `js`
and unknown tags are not evaluated. Direct `getNote`, `vaultContext`,
and tool-service `readNote` share that parser.

**S2.** Search, context, `config/agents.md`, and `AGENTS.md` use the
same realpath + regular-file check `getNote` already had. External
file/dir symlinks, broken links, sibling-prefix paths, and `.md`
FIFOs are skipped. In-vault aliases still work. `createNote`
traversal stay rejected. W7 HOME-root refuse is unchanged.

## Checks

- `node --test mcp-server/vault.security.test.js` — 14/14
- `pnpm test:mcp` — 86/86
- Astra `reproduce.mjs` — S1 and S2 PASS (temp fixture only)
- `pnpm bundle-mcp` — OK (generated under `src-tauri/resources/`, gitignored)

## Not done

- Commit / push / Applications rebuild
- Live #46 Chat-without-vault
- Native / packaged MCP (still `476756c`)
- Remove unused `gray-matter` dependency (left for dep triage)
- R2–R4 reserve hardening
