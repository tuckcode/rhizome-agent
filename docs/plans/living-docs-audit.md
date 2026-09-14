# Living-docs audit

**Status:** parked. Not a mass rewrite. Origin tags stay.  
**Origin:** Atticus 2026-09-07 · `NEXT.md` §0. Failure mode: C42 (“first-class Windows app” that never launched).  
**Pickup:** [`BOARD.md`](../BOARD.md).

---

## Done / now / next

- **Done:** `WINDOWS-DEV.md` lead sentence corrected. `YOU-SHOULD-KNOW.md` §2 shell map corrected 2026-09-08. Area D killed a pile of stale one-shots.
- **Now:** this is the checklist. Claim one living doc per session.
- **Next:** mark stale claims in place (strike + origin), do not restack HANDOFF.

**Done when:** a named living doc has no unverified “works on X / shipped / first-class” line, or each remaining claim cites live evidence.

---

## Living set (audit these, not the whole `docs/plans/` pile)

| File | Job | Stale-risk |
|---|---|---|
| `AGENTS.md` | always-loaded product rules | ~560 lines; Cursor tax; learned bullets vs vault |
| `docs/HANDOFF.md` | what is true right now | session sediment |
| `docs/NEXT.md` | unclaimed work | counts; “open” that shipped |
| `docs/BOARD.md` | tonight’s picture | date vs git tip |
| `docs/ARCHITECTURE.md` | structure | Desktop inheritance; Tolaria names |
| `docs/ABSTRACTIONS.md` | same | same |
| `docs/YOU-SHOULD-KNOW.md` | multi-day briefing | **check its own date first** |
| `docs/WINDOWS-DEV.md` | Windows path | C42 — never launched |
| `docs/IDENTITY.md` | which product | wrong-tree push |
| `CONTEXT.md` | glossary | “Agent” noun |
| ADRs named from BOARD/NEXT | decisions | open questions already settled in NEXT |

Do not audit every handoff file. Newest by filename + BOARD pointers is enough.

---

## Rules

1. A document written by a previous agent is **not** a primary source for Prime, macOS, or Windows.
2. Strike false claims in place. Keep **Origin:** lines.
3. Do not rewrite voice. Do not merge HANDOFF back into a 2000-line log.
4. If a claim is about the packaged app, say the **commit + `/Applications` stamp**, or say it is tree-only.

---

## First pass (cheap)

1. `rg -n 'first-class|always works|shipped on origin' docs/HANDOFF.md docs/NEXT.md docs/YOU-SHOULD-KNOW.md docs/WINDOWS-DEV.md AGENTS.md`
2. For each hit: live-check or downgrade to “targets / unverified.”
3. Completion: a one-line HANDOFF Recent session + BOARD living-docs row updated.
