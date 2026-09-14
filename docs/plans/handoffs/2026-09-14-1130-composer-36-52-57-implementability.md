---
session: 2026-09-14T11:30-05:00
model: Composer (Cursor)
description: >-
  Paper-only implementability for #36 timezone, #52 menu-bar done leftover,
  and #57 ghost-compat. All three blocked for morning coding; #52 doc-only at best.
commits: none
---

# Implementability — #36, #52, #57

**Origin:** Composer (Cursor) · 2026-09-14 · paper-only; no product code

Specs read: [`issue-36-timezone-setting.md`](../issue-36-timezone-setting.md), [`issue-52-menu-bar-done.md`](../issue-52-menu-bar-done.md), [`issue-57-ghost-compat.md`](../issue-57-ghost-compat.md).

---

## #36 — Timezone setting

| Field | Verdict |
|---|---|
| **Size** | **Large.** Rust `Settings.timezone`, preference hook, `dateDisplay.ts` refactor away from `getHours()`/`getDate()`, IANA picker UI, tests across zones, PostHog event. Touches every on-screen clock path. |
| **Missing decision** | Spec locks display-only, one global setting, IANA storage, sheets excluded, no `en.json` (C18). **No owner sign-off to start the slice** — plan says "Do not build tonight. Not small." |
| **Safe to code this morning?** | **NO.** Multi-surface display refactor; explicit deferral in spec. |

**Notes:** Default `None` = machine zone is decided. The blocker is scope and timing, not ambiguity. Do not implement timezone in a morning slot.

---

## #52 — Menu bar "agent is done"

| Field | Verdict |
|---|---|
| **Size** | **Small code** for leftover job 1 only (pure helper + done-row in `menu_bar_companion.rs` + tests). Jobs 2–3 are out of scope; running list already shipped. |
| **Missing decision** | **Done-row TTL.** Spec requires a "short TTL" for the **Done: {title}** row and tooltip text, but does not pick a number. Issue names menu UX, not a system notification. Do not invent the TTL. |
| **Safe to code this morning?** | **NO for code.** **Leftover-doc-only: yes** — record that TTL must come from Atticus before TDD on the helper. |

**Notes:** Finish signal = id drops off 15s poll roster → ephemeral done row with same click path. Native QA only after helper is green. Keep GitHub #52 open until done-row ships or owner accepts vanishing rows.

---

## #57 — Delete code for users who do not exist

| Field | Verdict |
|---|---|
| **Size** | **Medium–large, staged.** Not one commit. Safe-delete bucket (env aliases, test-only names, shape migrations) is separable; live paths (`~/.laputa/cache`, `com.tolaria.app` / `com.laputa.app` lookup, `@@TOLARIA_*` tokens) must stay until renamed. `migrate_is_a_to_type` delete is a three-step vault gate. |
| **Missing decision** | **Disk truth on this machine:** (1) Do `com.tolaria.app` / `com.laputa.app` folders still hold settings? (2) Which shape migrations does Atticus's `settings.json` still need? (3) Run Repair / convert the one live vault file with `is_a:` before dropping `vault/migration.rs`. AGENTS.md compatibility line ships with the first real deletion, not before. |
| **Safe to code this morning?** | **NO.** Requires human disk + vault checks first. Do not mass-delete `~/.laputa` or knip-sweep legacy names. |

**Notes:** Some items already landed (PR #62, `view_migration.rs` trim, repair leaves legacy files). Close #57 only with a comment listing deleted vs still-live paths.

---

## Summary

| Issue | Size | Safe this morning? |
|---|---|---|
| #36 timezone | Large | **NO** |
| #52 menu-bar done | Small (code) / doc-only OK | **NO** (doc-only for TTL gap) |
| #57 ghost-compat | Medium–large, staged | **NO** |

**Next unblockers:** Atticus picks menu-bar done-row TTL (#52). Atticus approves timezone slice start (#36). Atticus (or Repair Vault) confirms disk + vault state for #57 deletions.
