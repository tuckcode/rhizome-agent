---
session: 2026-09-14T12:55-05:00
model: Grok 4.6 (Cursor)
description: >-
  Cursor implementation index for the Astra security audit.
  Audit files stay in the Codex output folder. No exploit copy.
---

# Astra security audit — Cursor index

**Origin:** Cursor Grok 4.6 · 2026-09-14.
**Audit (read-only):**
`/Users/dtc/Documents/Codex/2026-09-13/you-are-astra-write-the-god/outputs/rhizome-security-audit/START-HERE.md`

Astra planned. Cursor implements. Do not publish a working exploit.
Keep reports private under root `SECURITY.md`.

| ID | Status | Evidence |
|---|---|---|
| S1 executable frontmatter | **Source PASS** | [1255](../../handoffs/2026-09-14-1255-cursor-grok-4-6-s1-s2-mcp-boundary.md) · leftover coffee/cson/search [1430](../../handoffs/2026-09-14-1430-cursor-grok-4-6-s1-coffee-search.md) |
| S2 vault symlink reads | **Source PASS** | same |
| S3 prefix scan | **Source PASS** | [1246](../../handoffs/2026-09-14-1246-cursor-grok-4-6-s3-s4-redaction.md) · leftover `xai-` [1432](../../handoffs/2026-09-14-1432-cursor-grok-4-6-s3-xai.md) · leftover `gsk_`/`github_pat_` [1436](../../handoffs/2026-09-14-1436-cursor-grok-4-6-s3-gsk-pat.md) · leftover rest [1441](../../handoffs/2026-09-14-1441-cursor-grok-4-6-s3-rest.md) · leftover `ghr_`/`ghu_`/`sk_test_` [1443](../../handoffs/2026-09-14-1443-cursor-grok-4-6-s3-ghr.md) · leftover Slack [1445](../../handoffs/2026-09-14-1445-cursor-grok-4-6-s3-slack.md) |
| S4 diagnostic keys | **Source PASS** | same |
| Dep triage | **Pins landed** | [1308](../../handoffs/2026-09-14-1308-cursor-grok-4-6-dep-patch.md) — `js-yaml` 3.15.2, `fast-uri` 3.1.6. Tiptap parked ([1310](../../handoffs/2026-09-14-1310-cursor-grok-4-6-tiptap-reachability.md)) |
| R1 env ignore | **Done in tree** | [1258](../../handoffs/2026-09-14-1258-cursor-grok-4-6-r1-env-ignore.md) |
| R2 settings mode | **Source PASS** | [1305](../../handoffs/2026-09-14-1305-cursor-grok-4-6-r2-r4-secure-fs.md) |
| R3 key-file replace | **Source PASS** | same |
| R4 native Sentry scrub | **Source PASS** | same — fixtures only; no live delivery claim · leftover `gho_`/`ghs_`/`ghu_`/`xoxp-` [1442](../../handoffs/2026-09-14-1442-cursor-grok-4-6-r4-rest.md) · leftover Slack + `hf_`/`npm_`/`glpat-` [1445](../../handoffs/2026-09-14-1445-cursor-grok-4-6-s3-slack.md). `sk_live_` / `sk_test_` / `ghr_` stay JS-only |

Astra harness after the source edits: every S1–S4 application row
**PASS**. Prefix-only vault helper password rows stay
`COVERAGE_LIMITATION` by contract.

## High rows (scanner)

| Package | Installed now | Verdict |
|---|---|---|
| `js-yaml` 3.x | **3.15.2** | Patched ([1308](../../handoffs/2026-09-14-1308-cursor-grok-4-6-dep-patch.md)) |
| `fast-uri` | **3.1.6** | Patched (same) |
| `@tiptap/core` 3.19 / 3.22 | unchanged | Parked — not a first-party call ([1310](../../handoffs/2026-09-14-1310-cursor-grok-4-6-tiptap-reachability.md)). Live Trivy High is **only these two** ([1316](../../handoffs/2026-09-14-1316-cursor-grok-4-6-trivy-rescan.md)) |

Do not close #46 from these fixtures. Do not rebuild Applications.
