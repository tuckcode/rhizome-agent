# Living-docs audit

**Status:** in progress — 2026-09-14 morning pass recorded below. Not a mass rewrite. Origin tags stay.  
**Origin:** Atticus 2026-09-07 · `NEXT.md` §0. Failure mode: C42 (“first-class Windows app” that never launched).  
**Pickup:** [`BOARD.md`](../BOARD.md) → [`MORNING.md`](../MORNING.md).

**W1 owns** `HANDOFF.md`, `BOARD.md`, `NEXT.md`, `YOU-SHOULD-KNOW.md`. This audit **records** contradictions; it does not restack those files.

---

## Three-SHA discipline (always three numbers)

Measured 2026-09-14 ~11:20 CT:

| Role | SHA | Meaning |
|---|---|---|
| **Origin** | `5c629a0` | `origin/main` — last pushed |
| **Local** | `4416411` | working-tree HEAD — `e64a283` (docs) + `4416411` (W7 HOME/MCP) **not pushed** |
| **App** | `476756c` | `/Applications/Rhizome Agent.app` @ 2026-09-12 22:43 |

Never collapse these. “Git tip” without a qualifier is ambiguous — say **local**, **origin**, or **app**.

**Stamped 15:30:** still three SHAs. Origin `5c629a0`. Local `4416411`.
App `476756c`. D6 commits wait ~15:45. Do not collapse.

**Open issues (live `gh`):** **17** — #5 #13 #23 #26 #32 #36 #39 #40 #41 #45 #46 #48 #50 #51 #52 #56 #57.

---

## Done / now / next

- **Done:** `WINDOWS-DEV.md` lead corrected. `YOU-SHOULD-KNOW.md` §2 shell map corrected 2026-09-08. Area D stale one-shots killed. W1 night pass stamped origin + app. 2026-09-14 morning pass (this section). **Later morning 2026-09-14:** W1 fixed pile #6, MORNING §Docs, NEXT app SHA, ASTRA superseded banners, C72 packaged-app note (`c72-notes-delta.md`).
- **Now:** X-High leftover + docked restamps (14:59). Do not close #46. D6 ~15:45.
- **Next:** D6 named commits ~15:45. No second God plan. Do not restack HANDOFF history. Do not rewrite ASTRA bodies.

**Done when:** a named living doc has no unverified “works on X / shipped / first-class” line, or each remaining claim cites live evidence **and** all three SHAs agree where the doc claims to be current.

---

## Morning pass — 2026-09-14

**Origin:** Cursor Composer · 2026-09-14 · audit-only; no commit.

### Index docs — three-SHA coverage

| Doc | Local `4416411` | Origin `5c629a0` | App `476756c` | Notes |
|---|---|---|---|---|
| [`MORNING.md`](../MORNING.md) | ✅ header | ✅ header | ✅ header | §Docs restamped three SHAs — **FIXED 2026-09-14 later morning** |
| [`BOARD.md`](../BOARD.md) | ✅ Status + True right now | ✅ | ✅ | Origin stamped **2026-09-14**; 12:17 added Astra wait slot |
| [`HANDOFF.md`](../HANDOFF.md) | ✅ State (W1 dirty) | ✅ | ✅ | Recent session 2215 still says “match git tip `5c629a0`” — **historical**, not current |
| [`NEXT.md`](../NEXT.md) | ✅ snapshot | ✅ | ✅ | App SHA `476756c` added — **FIXED 2026-09-14 later morning** |
| [`YOU-SHOULD-KNOW.md`](../YOU-SHOULD-KNOW.md) | ✅ stamp | ✅ | ✅ | W1 dirty |
| [`ASTRA_PACKET.md`](../ASTRA_PACKET.md) | ❌ | ✅ | ✅ | Superseded banner → `MORNING.md` — **FIXED 2026-09-14 later morning** (body frozen) |
| [`ASTRA_GOD_PLAN.md`](../ASTRA_GOD_PLAN.md) | ❌ | ✅ (only) | ✅ | Superseded banner → `MORNING.md` — **FIXED 2026-09-14 later morning** (body frozen) |
| [`PLAN_FOR_A_PLAN.md`](../PLAN_FOR_A_PLAN.md) | ❌ | ✅ | ✅ | Packet-era snapshot; not morning-current |

Committed `e64a283` on disk still reflects pre-W7 docs truth; local-only product work is **`4416411`**.

### Remaining contradictions (index set)

**1. Hide-on-close status — BOARD vs everyone else**

| Source | Claim |
|---|---|
| [`BOARD.md`](../BOARD.md) pile **#6** | “Found, **not built**” |
| [`MORNING.md`](../MORNING.md) Security / Prime | “already on main (`43059e3e`)”; W7 adds defense-in-depth |
| [`hide-on-close-helpers.md`](hide-on-close-helpers.md) | Code shipped; remainder = **native live-check** |
| [`ASTRA_PACKET.md`](../ASTRA_PACKET.md) | “In tree `43059e3e`; live-check leftover” |
| [`BOARD.md`](../BOARD.md) Found | “Helpers **should** stop after hide” (reads like missing) |

**Verdict:** pile #6 and Found wording contradict MORNING / packet / plan file. Fix: restamp card #6 to “**on main; live-check**” (W1 on BOARD).

**FIXED 2026-09-14 later morning:** BOARD pile #6 now “On main `43059e3e`; native leftover”.

**2. MORNING internal — night §Docs vs morning header**

- Header (2026-09-14): local **`4416411`**, origin **`5c629a0`**, app **`476756c`**.
- §Docs (~line 65): “`BOARD` / `HANDOFF` / `NEXT` / `YOU-SHOULD-KNOW` **match origin `5c629a0`**” — ignores two unpushed commits and W7.

**Verdict:** strike or restamp §Docs block; header wins.

**FIXED 2026-09-14 later morning:** §Docs restamped with local `4416411`, origin `5c629a0`, app `476756c`.

**3. ASTRA frozen snapshots vs git reality**

- [`ASTRA_GOD_PLAN.md`](../ASTRA_GOD_PLAN.md) Repository table: local = origin = `5c629a0`, no ahead.
- [`ASTRA_PACKET.md`](../ASTRA_PACKET.md) §1 git snapshot + §6 lane table (“Docs DONE … match `5c629a0`”; Security “uncommitted”) — all pre-push / pre-W7-commit.

**Verdict:** not W1 index docs; need a pointed ASTRA restamp or a visible “superseded by MORNING 2026-09-14” line. Do not silently edit Codex source files.

**FIXED 2026-09-14 later morning:** superseded banners on both ASTRA files point at `MORNING.md`; Codex bodies untouched.

**4. BOARD “Finished here, not in `/Applications` yet”**

- Lists `5c629a0` only. Omits local **`4416411`** / **`e64a283`**.

**Verdict:** W1 should add local SHAs to that section.

**FIXED 2026-09-14 later morning:** BOARD “Finished here” names origin `5c629a0` and local `4416411`.

**5. NEXT snapshot omits app SHA**

- HANDOFF / YOU-SHOULD-KNOW / BOARD / MORNING carry all three; NEXT snapshot has local + origin only.

**Verdict:** minor; add `476756c` when W1 touches NEXT.

**FIXED 2026-09-14 later morning:** NEXT snapshot includes app `476756c`.

**6. BOARD origin tag date**

- Header: “stamped **2026-09-13**”; Status body is **2026-09-14** morning.

**Verdict:** cosmetic; update Origin line when W1 commits BOARD.

**FIXED 2026-09-14 later morning:** Origin line stamped **2026-09-14**.

**7. MORNING §Issues/PRs — “dirty on HANDOFF + BOARD”**

- Written last night. W1 is actively stamping those files this morning.

**Verdict:** stale once W1 lands; not a product contradiction.

**FIXED 2026-09-14 12:17:** leftover now says W1 stamped those files this morning.

**8. C72 leftover scope — tree vs packaged app**

| Source | Claim |
|---|---|
| Various index / parked rows | Implied tree work still needed for Notes rail / ⌘2 |
| [`c72-notes-delta.md`](c72-notes-delta.md) | Leftover is **`476756c` packaged app**, not working tree |

**Verdict:** stamp delta doc; stop blaming tree for packaged-only gaps.

**FIXED 2026-09-14 later morning:** `c72-notes-delta.md` names packaged app as the leftover.

**FIXED 2026-09-14 13:18:** W8 stub still said the tree was `Chat + Inbox`. Restamped — leftover is `476756c` only.

### Later-morning pass — 2026-09-14 12:17

**Origin:** Cursor Grok 4.6 · paper audit vs origin `5c629a0` / local `4416411` / app `476756c`. Cheap sentences only. Astra/Codex bodies untouched.

| Stale claim | Where | Fix |
|---|---|---|
| C72 leftover = “⌘2 label in tree” / Inbox rename | HANDOFF State + C72 thread; BOARD pile #4; NEXT parked + §1 C72 | Leftover is packaged **`476756c`**. Tree already labeled. Inbox stays the folder. |
| Grokbot leftover review still parked | HANDOFF State; NEXT §0 item 7 + parked list | Reviewed [1155](handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md); 0 Accept; CodexGPT stays out. |
| ⌘3 still Chat + Notes | NEXT §1 shortcut row (risk of old name) | Tree labels: ⌘3 **Notes, Browse open**. Not present as current claim in BOARD/MORNING/YOU-SHOULD-KNOW. |
| W7 “uncommitted” | MORNING Security | Local **`4416411`**, not pushed. |
| MORNING leftover “dirty on HANDOFF + BOARD” | item 7 | W1 stamped those this morning. |
| Audit Now line still listed 4 / 6 / 7 | this file | Those three already FIXED earlier. |

Astra design docs **received** — [`../design/brand/2026-09-14-handoff/START-HERE.md`](../design/brand/2026-09-14-handoff/START-HERE.md). 1210 wait slot is historical. No second God plan.

### Later-day pass — 2026-09-14 13:58

**Origin:** Cursor Grok 4.6 · leftover YOU-SHOULD-KNOW vs live `gh`.

| Stale claim | Where | Fix |
|---|---|---|
| “GitHub #43 still open” | YOU-SHOULD-KNOW §3 hardening | Closed 2026-09-13; `gh` confirmed 2026-09-14. Same file §4 already listed it closed. |
| #41 “steer UX still the gap” | YOU-SHOULD-KNOW §4 table | Source `onSteer` wired. Leftover is native + `mutate_queued_message`. |
| #46 “HOME vault / wide MCP” as if unfixed | YOU-SHOULD-KNOW §4 table | Source refuse in `4416411`. Leftover is live Chat-without-vault. |
| #55 in the still-open table | YOU-SHOULD-KNOW §4 table | Already in the closed list. Dropped from the open table. |

### No contradiction found (this pass)

- **Open issue count:** 17 everywhere that claims to be live (`gh` verified 2026-09-14).
- **PR #66:** CONFLICTING / do not merge — consistent across MORNING, BOARD, HANDOFF.
- **Daily-driver:** not declared — consistent.
- **Import list-rows:** blocked until Atticus `1` — consistent.
- **W4 native cases:** NOT RUN — consistent.
- **`WINDOWS-DEV.md`:** lead no longer claims “first-class Windows app” (C42).

---

## Living set (audit these, not the whole `docs/plans/` pile)

| File | Job | Stale-risk |
|---|---|---|
| `AGENTS.md` | always-loaded product rules | ~560 lines; Cursor tax; learned bullets vs vault |
| `docs/HANDOFF.md` | what is true right now | session sediment |
| `docs/NEXT.md` | unclaimed work | counts; “open” that shipped |
| `docs/BOARD.md` | tonight’s picture | date vs git tip; pile cards vs reality |
| `docs/MORNING.md` | last-hours pickup | stacked night sections vs morning header |
| `docs/ARCHITECTURE.md` | structure | Desktop inheritance; Tolaria names |
| `docs/ABSTRACTIONS.md` | same | same |
| `docs/YOU-SHOULD-KNOW.md` | multi-day briefing | **check its own date first** |
| `docs/WINDOWS-DEV.md` | Windows path | C42 — never launched |
| `docs/IDENTITY.md` | which product | wrong-tree push |
| `docs/ASTRA_PACKET.md` / `ASTRA_GOD_PLAN.md` | God-plan inventory | frozen at pre-push snapshot |
| `CONTEXT.md` | glossary | “Agent” noun |
| ADRs named from BOARD/NEXT | decisions | open questions already settled in NEXT |

Do not audit every handoff file. Newest by filename + BOARD/MORNING pointers is enough.

---

## Rules

1. A document written by a previous agent is **not** a primary source for Prime, macOS, or Windows.
2. Strike false claims in place. Keep **Origin:** lines.
3. Do not rewrite voice. Do not merge HANDOFF back into a 2000-line log.
4. If a claim is about the packaged app, say the **commit + `/Applications` stamp**, or say it is tree-only.
5. **Three SHAs:** origin `5c629a0` · local `4416411` · app `476756c` — always distinguish; update all three when any moves.

---

## First pass (cheap)

1. `rg -n 'first-class|always works|shipped on origin' docs/HANDOFF.md docs/NEXT.md docs/YOU-SHOULD-KNOW.md docs/WINDOWS-DEV.md AGENTS.md`
2. For each hit: live-check or downgrade to “targets / unverified.”
3. `rg -n '5c629a0|4416411|476756c|git tip|origin/main' docs/{BOARD,MORNING,HANDOFF,NEXT,YOU-SHOULD-KNOW,ASTRA_PACKET,ASTRA_GOD_PLAN}.md` — three-SHA drift.
4. Completion: W1 commits index stamp; one line in HANDOFF Recent sessions; this file’s contradiction table shrinks.
