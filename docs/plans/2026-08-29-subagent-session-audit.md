# Audit: parallel sub-agent session (2026-08-29 ~01:56–02:21 CDT)

**Origin:** Composer/Grok audit · 2026-08-29 · snapshot `0d5103a`

This is a reconciliation of what landed, not a pickup list. Frozen at
**2026-08-29 02:21:26 CDT** (`0d5103a`, 26 ahead). Three seconds later
`6476c99` added the #44 session handoff (27 ahead). `origin/main` is still
`db33c46`. The working tree was still changing while this was written.

Do **not** push. The tree is not yet a single consistent story.

---

## Executive summary

- **27 unpushed commits** on `main` (26 at freeze, plus `6476c99`), almost all from this ~25-minute window.
  Product work that actually exists: C55 (Rust catalog fallback), C30 (frontend-ready flag rename), C34 (menu-bar locale wiring), three localization batches plus a locale-prop pass, #37 delete-custom-format UI, #44 Notes/Mycelium resize, Vault Safe → Limited tools (Prime always Power User).
- **Messages lie in several places.** `fbf2a12` says C34 but is the #37 delete UI. `77b6e9e` says it fixes C55 but only edits `HANDOFF.md`. A later Vault Safe commit (`39f7603`) deleted four still-used `en.json` keys; `0d5103a` put them back.
- **`HANDOFF.md` State is stale.** It still says `HEAD` is `2fc2570` and the branch is 12 ahead. Actual HEAD is `0d5103a`, 26 ahead. It also still says the inverted Dock icon is `stash@{0}`; that stash was pushed down by three new session stashes.
- **GitHub #44 was closed at 02:02 CDT** on the two Chat surfaces only. Notes + Mycelium resize landed **15 minutes later** (`47c36dc`). `NEXT.md` claimed those remaining surfaces at close time, before the code existed.
- **Vault Safe / Limited tools is committed** (`39f7603`) after the localization work, which is why the `en.json` collision happened. C57 and #50 still need Atticus. During the freeze, a **staged `src/App.tsx` hunk** would have undone `cbbc6c0`; by commit time that hunk was gone and Search/Conflict still receive `locale={appLocale}`.

---

## Task table

Times are local (CDT). “Composer 2.5” / “Grok 4.6” from commit trailers.

| Task | Agent/model | Commit(s) | Status |
|---|---|---|---|
| **C55** — text-only warning when daemon omits `input` | Composer 2.5 | **`c423445`** (Rust catalog fallback — real fix). `77b6e9e` (HANDOFF only, mislabeled `fix:`). `743d50b` (HANDOFF resolved). `1541020` (NEXT strikethrough). | **Committed.** Product code matches HANDOFF C55-RESOLVED. Extra docs commits are noise, not a second fix. |
| **C54** — documented Rust coverage command missing `--ignore-filename-regex` | Composer 2.5 | **`e3af3dd`** (`AGENTS.md`, `GETTING-STARTED.md`, `CROSS-MODEL-HANDOFF.md`, HANDOFF). | **Committed.** Matches HANDOFF C54-RESOLVED. Docs only; no product change. |
| **C30** — `__tolariaFrontendReady` → `__rhizomeFrontendReady` | Composer 2.5 | **`61860a2`**. | **Committed.** Matches HANDOFF C30-RESOLVED. `NEXT.md` §3 still lists C30 as an open branding residue. |
| **C21 docs** — Desktop/Tolaria residue in live docs | Composer 2.5 | **`574771d`** (HANDOFF, GETTING-STARTED, ABSTRACTIONS, harness-vision). | **Committed (docs).** HANDOFF still titles C21 as OPEN; the eight 2026-08-02 residues were already “found and fixed.” This pass is more naming cleanup, not a new C21 close. |
| **C34** — menu-bar roster labels use the user’s locale | Composer 2.5 | **`be85f80`** (real: `MenuBarCompanionApp` + test + HANDOFF). `77e923e` (NEXT §3). **`fbf2a12` is not C34** (see conflicts). | **Committed.** HANDOFF C34-RESOLVED matches `be85f80`. Copy refactor `1509f9f` was already on origin. |
| **Localization batches** — hardcoded UI → `en.json` | Composer 2.5 | `832ace9` (close-button / overlay copy). `c7970cc` (SearchPanel / Mermaid keys). `97713b6` (TypeSelector, ConflictResolverModal, Mermaid). `cbbc6c0` (pass `locale={appLocale}` into Search + Conflict). `0d5103a` (restore four keys). | **Committed, then damaged, then restored.** See conflicts. **Staged `App.tsx` would undo `cbbc6c0`.** |
| **#37 delete custom research formats** | Composer 2.5 | **`94d6efa`** (correct message). `fbf2a12` (same tree, C34 message). `0ccd9aa` (revert of `fbf2a12`). `f7281e6` (NEXT: mark #37 closed for *Save as custom* / `1b469fc`). | **Committed.** Delete UI is in `94d6efa`. GitHub #37 was already CLOSED at 22:06 CDT 28 Aug for Save-as-custom, not this delete slice. `0ccd9aa` has **no** `Co-Authored-By`. |
| **#44 remaining resize** (Notes panel + Mycelium list) | Grok 4.6 | **`47c36dc`**. Handoff `6476c99` (after freeze). Chat surfaces `a26eb40` / `fe97f99` were already on origin. | **Committed locally.** GitHub issue **CLOSED 02:02 CDT** before `47c36dc` (02:17). Close comment only names the two Chat surfaces. `NEXT.md` (`b52d24e`, 02:02) already said “Notes + Mycelium list resizable.” |
| **Vault Safe / Limited tools** (Prime always Power User) | Grok 4.6 | **`39f7603`** (code + 02:05 handoff). `f88a3ab` (site + agent-docs mirrors). `0d5103a` (en.json repair). Orphan **`935025c`** (same title, not on `HEAD`). | **Committed.** HANDOFF Recent sessions + C57-OPEN match the code. HANDOFF State line does **not** (still `2fc2570`). |
| **#50 live app view** | Grok 4.6 | **`821e8e5`** (plan). `2fc2570` (restore index pointers later docs commits had dropped). | **Committed, not built.** GitHub #50 still **OPEN**. Matches HANDOFF. Awaiting Atticus. |
| **GitHub close / NEXT sync** | Composer 2.5 | `b97240a`, `b52d24e`, `f7281e6`, `70704d3`. GitHub closed #44 #38 #9 #35 #21 at ~02:02 CDT. | **Committed docs.** #44 close is early relative to `47c36dc`. |
| **This audit** | Grok 4.6 | *(this file)* | **This commit only.** |

---

## Mislabel / conflict

### 1. `fbf2a12` / `0ccd9aa` / `94d6efa` — C34 message on #37 code

Verified with `git show --name-only`:

| Commit | Message | Actual files |
|---|---|---|
| `fbf2a12` (02:11) | `fix: menu-bar session roster labels (C34)` | `RhizomeFormatModal`, `SearchPanel`, `MermaidDiagram`, `en.json` |
| `be85f80` (02:12) | same C34 title | **Actual C34:** `MenuBarCompanionApp`, tests, HANDOFF, C34 handoff file |
| `0ccd9aa` (02:13) | Revert of `fbf2a12` | Unwinds the #37 files |
| `94d6efa` (02:14) | `feat: delete custom research formats` | Same files as `fbf2a12` |

Net: C34 is `be85f80`. #37 delete UI is `94d6efa`. Nothing is missing; git history contains a false C34 commit, a revert, and a correctly labeled recommit. Cause: two Composer tasks committing overlapping `en.json` / modal files with the wrong message on the first.

### 2. `77b6e9e` — `fix:` on a docs-only C55 commit

`c423445` is the fallback in `prime_session_host.rs`. `77b6e9e` has the same *intent* in the body but `--stat` is **only** `docs/HANDOFF.md`. Treat `c423445` as the fix.

### 3. Vault Safe vs localization on `en.json` and `App.tsx`

Order that actually happened:

1. `97713b6` added `conflict.title` / `conflict.description` / `conflict.keepMine` / `inspector.properties.type`.
2. `cbbc6c0` passed `locale={appLocale}` into SearchPanel and ConflictResolverModal.
3. `935025c` (02:19:07) committed Vault Safe **and** dropped those four keys **and** reverted the locale props. Then it was **replaced** — `935025c` is **not** an ancestor of `HEAD` (dangling).
4. `39f7603` (02:19:38) is the Vault Safe that stayed: kept `App.tsx` locale props, still **deleted the four keys**.
5. `0d5103a` (02:21:05) restored the four keys.

`ConflictResolverModal` and `TypeSelector` still call `translate(..., 'conflict.*' / 'inspector.properties.type')`. The restore is required, not cosmetic.

**Index hazard during freeze:** `src/App.tsx` was staged with the exact reverse of `cbbc6c0`. Locale is optional and defaults to `'en'`, so it would typecheck. By the time this audit was committed, that hunk was no longer staged and HEAD still passes `locale={appLocale}`. Do not re-stage that reverse.

### 4. #44 closed on GitHub vs local remaining work

- GitHub #44 closed **2026-08-29 07:02:29Z = 02:02 CDT**.
- Close comment: shipped `a26eb40` (sessions) and `fe97f99` (note beside chat) only.
- An earlier comment on the same issue said Notes (right) and Mycelium’s session list were **still open** pending the compact-layout question.
- `47c36dc` (02:17) is that remaining work (compact layout stays window-width-only so a drag cannot fight `useShellCompactLayout`).
- `b52d24e` (02:02) wrote NEXT as if Notes + Mycelium were already resizable.

So: GitHub is closed; local has the extra surfaces; the close comment does not describe `47c36dc`.

### 5. HANDOFF “shipped” vs tree (during the window)

The 02:05 Limited-tools handoff and C57-OPEN claimed “code shipped” while the permission-mode files were still uncommitted (called out in the #50 handoff’s “stranded in the working tree” note). By this snapshot that code **is** `39f7603`. The remaining HANDOFF lie is the **State** block (`HEAD` / ahead-count / `stash@{0}`), not the C57 product paragraph.

### 6. Duplicate / overlapping docs commits

HANDOFF and NEXT were edited by several agents in the same minutes: `821e8e5` (#50 plan) → `77b6e9e` / `743d50b` (C55) → `b97240a` / `b52d24e` / `1541020` / `2fc2570` (restore #50 pointers that later commits dropped) → `70704d3` (stale State line `2fc2570` / 12 ahead) → `77e923e` (C34 in NEXT). None of these conflict in the git sense; they do make `git log` look like more product work than there is.

### 7. `NEXT.md` vs HANDOFF on C-numbers

- C34 and C55: both mark resolved. Match.
- C30: HANDOFF **RESOLVED**; NEXT §3 still lists **C21 / C30** as open health items.
- C57: in HANDOFF Open threads; **no C57 row in NEXT.md** (`1541020` explicitly skipped it).
- Open-C count in NEXT (“16 open”) was written before C34 was struck; it may still be one high after C34’s NEXT pass.

### 8. Stashes from parallel work

| Stash | Message | Role |
|---|---|---|
| `stash@{0}` | `parallel-wip-before-recommit` | This session. Mix of Vault Safe, #37, localization. |
| `stash@{1}` | `temp-before-fbf2a12-revert-2` | Localization slice parked for the revert. |
| `stash@{2}` | `temp-before-fbf2a12-revert` | Broader mix including #44 and Vault Safe. |
| `stash@{3}` | `wip unrelated to C30` | Includes C34 + #44 + Vault Safe + C30 files. |
| `stash@{4}` | `wip: inverted dock icon (parked 2026-08-26)` | **This** is what HANDOFF still calls `stash@{0}`. |
| `stash@{5}` | `preserve local review notes before navigation guard` | Older, unrelated. |

Do not `stash pop` 0–3 without diffing against `HEAD` — those trees were the parallel WIP that later became commits.

---

## Recommended order before push

Vault Safe is **already committed** (`39f7603`), *after* localization, which is the collision that `0d5103a` repaired. Ideal order would have been Vault Safe first, then localization, then #44, then docs. That ship has sailed.

Before any push:

1. **Do not re-stage a reversal of `cbbc6c0`.** Search/Conflict locale props survived; they should stay.
2. **Refresh `HANDOFF.md` State** in its own docs commit: real `HEAD`, real ahead-count, inverted Dock icon is `stash@{4}` not `stash@{0}`. Optional: point NEXT at C57; stop listing C30 as open.
3. **Decide #44 on GitHub** — leave closed (remaining surfaces are in `47c36dc`) or add a comment that Notes + Mycelium landed after close.
4. Run the push gates once on this pile, not per commit. One push after the State-line docs commit.

Do **not** push from this audit.

---

## Open items for Atticus

- **C57** — after Prime always Power User / Limited tools copy: keep CLI agents defaulting to Limited tools (`safe`)? keep the Prime permission toggle hidden? keep “Limited tools” or restore “Vault Safe” with an honest tooltip?
- **#50** — plan at `docs/plans/2026-08-29-live-app-view-plan.md` (`821e8e5`). Proposed: `pnpm live-ui` against the browser app, read + test-bridge steer, developer tooling not an in-app pane. Not built until approved.

---

## Unpushed log (this snapshot)

Newest first. `origin/main` = `db33c46`. `6476c99` landed after the freeze.

```
6476c99 docs: session handoff for Notes and Mycelium resize
0d5103a fix: restore conflict and type labels dropped from en.json
f88a3ab docs: sync agent-docs mirrors for Limited tools / Prime copy
39f7603 feat: Prime sessions default to Power User; relabel Vault Safe as Limited tools
cbbc6c0 fix: pass app locale to SearchPanel and ConflictResolverModal
47c36dc feat: make Notes panel and Mycelium list drag-resizable
97713b6 fix: localize more hardcoded UI strings
77e923e docs: mark C34 resolved in NEXT.md §3
94d6efa feat: delete custom research formats
0ccd9aa Revert "fix: menu-bar session roster labels (C34)"
c7970cc fix: move more hardcoded UI copy to en.json
be85f80 fix: menu-bar session roster labels (C34)
fbf2a12 fix: menu-bar session roster labels (C34)
61860a2 refactor: rename __tolariaFrontendReady to __rhizomeFrontendReady (C30)
70704d3 docs: refresh HANDOFF state and NEXT issue count
2fc2570 docs: restore #50 plan in the handoff index
832ace9 fix: move hardcoded UI copy to en.json
1541020 docs: sync NEXT.md C55/C57 with HANDOFF
574771d docs: remove Desktop/Tolaria naming residue (C21/C30)
b52d24e docs: sync NEXT.md with closed GitHub issues
743d50b docs: mark C55 resolved after catalog fallback (c423445)
b97240a docs: refresh NEXT.md snapshot counts
e3af3dd docs: align Rust coverage command with pre-push gate (C54)
821e8e5 docs: plan for #50 live app view (awaiting approval)
77b6e9e fix: text-only model warning when daemon omits input modalities (C55)
c423445 fix: fall back to model catalog when get_state omits input (C55)
f7281e6 docs: mark #37 closed — Save as custom shipped in 1b469fc
```

Dangling, not on `HEAD`: `935025c` (first Vault Safe commit, same subject as `39f7603`).
