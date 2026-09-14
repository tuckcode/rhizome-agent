# PR #66 supersession map

**Origin:** Cursor Grok 4.6 · 2026-09-14 · W3 (Astra God plan).
**Disposition:** Hold. Do not merge PR #66. Unique daily-drive chrome and pitfall
prose is recovered below for later W1 cherry-picks.
**Stamped 16:08:** KEEP prose is already in living docs. Still do not merge. Do not take either conflict
side of `HANDOFF.md`, `ARCHITECTURE.md`, or `CROSS-MODEL-HANDOFF.md`.

---

## Snapshot

| Item | Value |
|---|---|
| PR | [#66](https://github.com/tuckcode/rhizome-agent/pull/66) `docs: catch living pages up to the daily-drive batch` |
| State | OPEN, draft, **CONFLICTING** |
| Head | historically **`11a0090`** (`cursor/engineering-documentation-updates-bdf2`) |
| Base | `main` |
| Local HEAD when mapped | **`4416411`** (W7, unpushed). Origin still **`5c629a0`**. App still **`476756c`**. |
| Compared living docs | `HANDOFF.md`, `ARCHITECTURE.md`, `CROSS-MODEL-HANDOFF.md`, `BOARD.md`, `ASTRA_GOD_PLAN.md`, `MORNING.md` |
| Also checked (PR files, not edited) | `GETTING-STARTED.md`, `YOU-SHOULD-KNOW.md`, `ABSTRACTIONS.md` |

PR body (2026-09-13): living pages last refreshed 2026-09-08; this catch-up is
docs-only against the 2026-09-12 daily-drive batch. No product changes.

Conflict files vs current `main` (also stated in `MORNING.md` / `BOARD.md`):
`docs/ARCHITECTURE.md`, `docs/CROSS-MODEL-HANDOFF.md`, `docs/HANDOFF.md`.

W1 already restamped the living index after this PR was opened. Merging or
rebasing the draft would clobber those stamps and the Inbox-is-a-folder row.

---

## How to use this file

W1 (or a later docs owner) copies only the **KEEP** quotes into the destination
named here. Do not apply the PR branch. Do not replace a whole living page.

`BOARD.md` already lists the *product* facts. The gap is the architecture /
pitfall / briefing pages still describing the 2026-09-08 shell.

---

## Map — each unique PR section

| # | Unique PR section | Verdict | Destination if kept |
|---|---|---|---|
| 1 | `ARCHITECTURE` “Open-note split, Copy, and the latest-reply marker” | **KEEP** | After the `useChatCenteredShellLayout` paragraph in Chat-Centered Layout |
| 2 | `ARCHITECTURE` session-switch “clears the transcript in the same click” | **KEEP** | `usePrimeSessionSwitcher` bullet (main still only says skip-ensure) |
| 3 | `ARCHITECTURE` “Reply pills and Tab ghost-text (#51 Case 1)” | **KEEP** | After “Mid-turn send and message actions” |
| 4 | `ARCHITECTURE` Packages extras (daemon has no install, 180s, `npm:`, lazy catalog) | **KEEP** (partial) | Expand the existing Packages subsection — do not replace Nous Portal origin below it |
| 5 | `ARCHITECTURE` “Hide-on-close and Settings catalog cost” | **KEEP** | New subsection after Packages / before “What Rhizome does not own” |
| 6 | `ARCHITECTURE` IPC rows `list_prime_packages` / `install_prime_package` / `get_prime_provider_status` / `settle_prime_session` | **KEEP** | AI & MCP command table |
| 7 | `ARCHITECTURE` keyboard: Cmd+1/2/3 + Tab completion; drop stale Cmd+1–9 | **KEEP** | Keyboard Shortcuts table (main still has “Switch to tab N” + duplicate Cmd+[) |
| 8 | `CROSS-MODEL` §20 session switch + Settings catalog | **KEEP** | Append after §19 (file still ends there) |
| 9 | `CROSS-MODEL` §21 hide-on-close helpers | **KEEP** | Append after §20. Point at `plans/hide-on-close-helpers.md` for live-check remainder |
| 10 | `GETTING-STARTED` key-file rows | **KEEP** | Key files table after `usePrimeSessionSwitcher` |
| 11 | `GETTING-STARTED` pitfalls (32px, Beside, clear-on-click, lazy catalog, hide helpers, CLI install, Tab Case 1) | **KEEP** | Developer pitfalls (stamp date 2026-09-08 → 2026-09-13 or later) |
| 12 | `ABSTRACTIONS` Reply / Packages / Hide vs quit | **KEEP** | Prime Session, before Settings |
| 13 | `YOU-SHOULD-KNOW` §2 table rows (On top/Beside, latest reply, session click, Settings cost, hide vs quit) | **KEEP** (rows only) | §2 table. Do not take the PR’s “Rail Inbox toggles” wording |
| 14 | `YOU-SHOULD-KNOW` composer “#51 Case 1 shipped” + Packages hub subsection | **KEEP** | §3 Composer strip / new Packages hub. Case 1 is already a one-liner in §4 |
| 15 | `YOU-SHOULD-KNOW` still-open list “#51 Case 2” | **Already on main** | §4 table already: “#51 Case 1 shipped; Case 2 deferred” |
| 16 | `YOU-SHOULD-KNOW` “Corrected 2026-09-13” header + “daily-drive chrome restated” | **Stale / discard** | W1 already holds the later stamp. Date-only churn |
| 17 | `HANDOFF` State tip `968e194` / app `6908554` | **Discard** | Current tip is local `4416411`, origin `5c629a0`, app `476756c` |
| 18 | `HANDOFF` Recent sessions line for `2026-09-13-0301-…` | **Discard** as an index insert | Newer W1/W4/morning sessions already sit above it. Optional: add *this* map instead |
| 19 | New session file `plans/handoffs/2026-09-13-0301-cursor-grok-4-6-docs-refresh.md` | **Already recovered here** | Do not land the file unless W1 wants a dated provenance note that points at this map |
| 20 | PR body / knowledge-gaps list | **Already on main** (as product facts) | `BOARD.md` Finished + session handoffs `0018`, `0048`, `1725`, `2018` |
| 21 | Origin-line tweak on Chat-Centered Layout (“Daily-drive chrome verified 2026-09-13”) | **Stale / discard** | Keep the 2026-09-08 Origin; add a new Origin under any inserted subsection |

---

## KEEP — quotes to recover without merging

Copy these blocks. They are the unique sentences that current living
architecture / pitfall pages still lack.

### 1. Open-note split, Copy, latest-reply marker

Missing from `ARCHITECTURE.md` Chat-Centered Layout. `BOARD.md` has the short
facts (32px Show Notes, no hover-collapse, green marker, Copy). Architecture
still only names “compact/Beside fold” and a 46px rail.

```markdown
#### Open-note split, Copy, and the latest-reply marker

An open note can sit **On top** of Chat (`stacked`) or **Beside** it
(`side-by-side`). The toggle is on the Notes header (`ChatNoteSplitToggle`),
never by the traffic lights. The pick lives in localStorage
(`APP_STORAGE_KEYS.chatNoteSplit`). Beside forces the compact shell
(`shouldForceChatShellCompact`) so Sessions/Notes fold and Chat keeps a
usable column. Hover must not collapse that note pane.

The Show Notes restore strip is a **32px** hit target (`VaultPanelRestoreButton`);
the visible rail stays 46px. Open Notes keeps an inner `--sidebar-border`
against Chat. Do not cover Chat’s pulsing green working strip
(`ai-border-pulse` on the panel’s left edge) with a stronger Sessions border.

Highlight in Chat or in the open note, then right-click **Copy**. Chat text
uses the native WebKit menu via `NATIVE_CONTEXT_MENU_ALLOWLIST`
(`[data-testid="ai-message"]` and the composer). An open-note highlight also
offers **Ask Chat about this** (`AskChatExcerptMenu`): it fills the current
composer with `formatAskChatExcerpt` and does not start a new thread.

The newest assistant turn shows a green start marker
(`latestAssistantMessageIndex` / `latest-assistant-reply-marker`) left of
its first line. Compact/local system markers are not replies. The marker
moves when a newer assistant turn starts streaming or lands.
```

### 2. Session switch clears the transcript on the same click

Main `ARCHITECTURE.md` still says the beachball was a redundant
`ensure_prime_session_host`. The later cut is the lingering transcript.
Evidence already lives in `plans/handoffs/2026-09-13-0048-cursor-grok-4-6-lag-audit-evidence.md`.

Append to the `usePrimeSessionSwitcher` bullet:

```text
A row click highlights immediately and **clears the transcript in the
same click** so the old conversation does not linger during the host
round-trip; a refused mid-turn switch restores the previous messages.
```

### 3. Reply pills and Tab ghost-text (#51 Case 1)

Not in `ARCHITECTURE.md` today. `BOARD.md` and `YOU-SHOULD-KNOW.md` §4 only
say Case 1 shipped.

```markdown
#### Reply pills and Tab ghost-text (#51 Case 1)

`suggestReply` (`src/lib/replySuggestions.ts`) reads the last assistant
message and offers **at most one** of:

- **`options`** — 2–4 pills when the agent asked a closed question
  (numbered, bullets, “X or Y”, or an action yes/no). Labels must name
  the action. Pills win when both shapes could apply.
- **`completion`** — one obvious continuation, accepted with Tab
  (`composer-reply-completion` in `AiPanelChrome`). Rules-first only:
  “ready”, “want me to” / “shall I”, or a last-sentence “next I will…”
  echo. Never a bare “yes”. Most turns offer nothing.

Case 2 (model-backed or app-state suggestions) is **not** built. Do not
fire both mechanisms on the same turn.
```

### 4. Packages extras (expand; do not replace)

Main already has the hub + CLI install + reload + full-system-access confirm
(`ARCHITECTURE.md` Prime packages). Unique PR sentences still missing:

```text
Settings → **Packages** is the Pi catalog hub (`PrimeExtensionsSection`).
Kind tabs (extension / skill / prompt / theme) add a second keyword.
Search hits the public npm registry from the renderer (`catalogSearchUrl`).

Prime's **daemon has no install command**. Install runs
`prime-agent package install <source>` in a 180s background process
(`prime_packages.rs` / `install_prime_package`), then reloads the
attached session. Bare names become `npm:{name}`. Sources that start
with `-` or contain whitespace are refused.
If the CLI is missing, Settings copies the command or asks Chat to run it
(`primePackageAskAgentPrompt`). Opening Settings does **not** search
the catalog until Packages is visited or that section scrolls into view.
```

Do not drop the Nous Portal Origin block that now follows this subsection.

### 5. Hide-on-close and Settings catalog cost

Product hide-stop is on main (`43059e3e`) and in
`plans/hide-on-close-helpers.md` + `MORNING.md`. `ARCHITECTURE.md` Prime
section still omits it. Settings lazy-load is in the 0048 handoff, not here.

```markdown
#### Hide-on-close and Settings catalog cost

The red traffic light **hides** the main window (C22); Cmd+Q quits.
Idle hide settles the owned session as **Stop**, then
`release_helpers_for_hidden_window` stops the spawned Prime supervisor,
the MCP WebSocket bridge, and the Mindwalk sidecar so they do not leave
a Dock “running” mark. A Keep-working (`resident`) session is the
exception — that daemon stays. Rhizome never sends Prime’s `shutdown`
RPC (other clients share the machine). Active hide asks first
(`prime-active-close-requested`); `settle_prime_session` also releases
helpers because `window.hide()` does not raise `CloseRequested` again.

Settings and Chat share one Prime model catalog (`loadPrimeModelCatalog`).
A failed “host is not running” answer is **not** cached. Settings must
not fetch that catalog — or `get_prime_provider_status` — until the
Agents section is opened or scrolled into view. Fetching 501 models on
every Settings open was the pinwheel.
```

W4 night note: leftover Prime-spawned `mcp-server/index.js` is not the
ws-bridge. Do not mass-kill (ADR-0163). Native live-check still **NOT RUN**.

### 6. IPC rows

Add under AI & MCP, after `sync_mcp_bridge_vault`:

```text
| `list_prime_packages` | Installed Prime packages from `~/.prime/agent/settings.json` |
| `install_prime_package` | Run `prime-agent package install`, then reload the attached session |
| `get_prime_provider_status` | Read-only connection status per provider (no keys). Settings waits until Agents is visible |
| `settle_prime_session` | Settle the owned session on hide, then release helpers this process started |
```

### 7. Keyboard shortcuts

Replace the stale pair on main:

```text
| Cmd+1–9 | Switch to tab N |
| Cmd+[ / Cmd+] | Navigate back / forward |
```

with:

```text
| Cmd+1 | Chat only (`editor-only`) |
| Cmd+2 | Notes open, Browse collapsed (`editor-list`) |
| Cmd+3 | Notes open, Browse expanded (`all`) |
| Tab (composer, idle) | Accept the ghost-text completion when `suggestReply` offers one |
```

Keep the earlier `Cmd+[ / Cmd+]` row (navigate back/forward). Do not re-add
the duplicate.

### 8–9. CROSS-MODEL §20 and §21

`CROSS-MODEL-HANDOFF.md` still ends at §19. These append cleanly if W1/W3
only add after the close-note X paragraph. Do not rewrite §19.

```markdown
## 20. Session switch and Settings catalog look “stuck” for different reasons

Verified 2026-09-12 against `usePrimeSessionSwitcher.ts` and
`SettingsPanel.tsx`.

**Session click.** The old transcript used to stay on screen for the
whole `switch_prime_session` + `read_prime_session_transcript` round
trip. That is the session-switch beachball. The click now highlights
the row and `replaceMessages([])` in the same turn. If the host refuses
(mid-turn), the previous messages come back. Do not “restore” the old
chat until the new one arrives — that is the bug.

**Settings pinwheel.** `get_available_prime_models` is hundreds of
models. Opening Settings used to fetch it immediately, plus
`get_prime_provider_status`. Both wait until Agents is visible
(`loadModelCatalog`). Packages search waits until Packages
(`loadExtensionCatalog`). Chat and Settings share
`loadPrimeModelCatalog`; a failed “host is not running” answer is not
cached.

## 21. Hide-on-close must stop helpers this process started

C22 hides the main window; it does not quit. Leaving the spawned Prime
supervisor, MCP WebSocket bridge, and Mindwalk sidecar running after
hide kept a Dock indicator. `release_helpers_for_hidden_window`
(`lib.rs`) stops those unless Keep working left a resident session.
`settle_prime_session` does the same, because `window.hide()` does not
raise `CloseRequested` again. Never send Prime `shutdown` — other
clients share the daemon. Cmd+Q is the quit path.

Remainder: native live-check. See `docs/plans/hide-on-close-helpers.md`.
Do not recode the helper stop.
```

### 10. GETTING-STARTED key files

After the `usePrimeSessionSwitcher` row, add:

```text
| `src/components/usePrimeSessionSwitcher.ts` | Session list switch / fork / branch. Skips `ensure_prime_session_host` when the host is already running. Clears the transcript on the same click as the row highlight. |
| `src/lib/replySuggestions.ts` | Rules-first reply pills and Tab ghost-text (#51 Case 1). Options win over completion. Model-backed suggestions are not built. |
| `src/components/chatNoteSplit.ts` | On top / Beside for an open note over Chat. Beside forces compact Sessions/Notes. |
| `src/components/PrimeExtensionsSection.tsx` | Settings → Packages hub. Catalog is npm `pi-package`; install is the Prime CLI, not a daemon command. |
| `src/lib/primePackages.ts` | Catalog search URL, install spec (`npm:` prefix), and Ask-Chat fallback prompt. |
```

(The first row replaces the current skip-ensure-only sentence.)

### 11. GETTING-STARTED pitfalls

Stamp “Verified against source 2026-09-08” forward when these land.

```text
- **Notes default open.** … `VaultPanelRestoreButton` (46px rail, 32px hit target).
  Inbox toggles; it does not mount Graph. Beside an open note folds Sessions/Notes
  — do not restore hover-collapse on that pane.
- **Session switch skip-ensure.** … The click must clear the transcript immediately;
  leaving the old messages up is the beachball.
- **Settings catalog is lazy.** Do not fetch `get_available_prime_models` or
  `get_prime_provider_status` until Agents is visible. Do not search the
  Packages catalog until that section is opened. Do not cache a failed
  “host is not running” catalog.
- **Hide stops helpers.** Red-button close hides (C22) and
  `release_helpers_for_hidden_window` stops the spawned Prime supervisor,
  MCP bridge, and Mindwalk sidecar unless Keep working left a resident
  session. Never send Prime `shutdown`. Cmd+Q is the real quit.
- **Packages install is CLI, not the daemon.** `install_prime_package` runs
  `prime-agent package install` (180s). Confirm full system access once.
- **Tab completion is rules-first.** `suggestReply` only. Do not add
  model-backed ghost text (#51 Case 2) without a separate decision.
```

### 12. ABSTRACTIONS Prime Session

Insert before `## Settings`:

```markdown
**Origin:** Prime Session body is older; reply / packages / hide notes
added 2026-09-13 against `replySuggestions.ts`, `prime_packages.rs`,
and `lib.rs::release_helpers_for_hidden_window`.

### Reply suggestions

`suggestReply` is a pure read of the last assistant string. It returns
pills, one Tab completion, or `null`. Pills and completion never ship
together. Nothing here talks to Prime.

### Packages

Installed packages are Prime settings (`list_prime_packages`). The
catalog is the public npm `pi-package` index. Install is a CLI spawn
(`install_prime_package`), then `reload` on the attached session. The
daemon has no package-install verb.

### Hide vs quit

Main-window close hides (C22) and `release_helpers_for_hidden_window`
stops helpers this process started, unless Keep working left a resident
session. Quit is Cmd+Q / `ExitRequested`. Never Prime `shutdown`.
```

### 13–14. YOU-SHOULD-KNOW rows (not the surrounding PR text)

Add these **rows only** to the §2 table. Current main already corrected
“Rail control is **Notes** (Inbox is a folder in the list).” The PR still
says “Rail **Inbox** toggles it” — that would regress W1.

```text
| Open note vs Chat | **Shipped 2026-09-12.** Notes header **On top / Beside**. Beside folds Sessions/Notes. Hover must not collapse the note. Highlight → Copy, or **Ask Chat about this** (same thread). |
| Latest reply | Green start marker on the newest assistant turn. Moves when a newer reply starts. |
| Session click | Transcript **clears on the click**, then rehydrates. Leaving the old chat up is the switch beachball. |
| Settings cost | Model catalog and provider status wait until **Agents** is visible. Packages catalog waits until **Packages**. |
| Hide vs quit | Red button hides (C22) and stops helpers this process started, unless Keep working. Cmd+Q quits. Never Prime `shutdown`. |
```

Composer strip (after thinking-levels, before icon actions):

```text
- **#51 Case 1 shipped:** Tab ghost-text and reply pills are rules-first
  (`suggestReply`). Options win over completion. Case 2 (model-backed) is
  not built.
```

New subsection after the composer strip:

```markdown
### Packages hub (2026-09-12)

Settings → **Packages** (nav label, not “Extensions”) is the Pi catalog.
Install is `prime-agent package install`, then reload. The daemon has no
install command. Confirm full system access once. Chat is the fallback
when the CLI is missing.
```

Do **not** take the PR’s “Implemented on main; GitHub still open until a live
Prime demo” lead-in for #14/#17/#18. W1 already closed those on GitHub.

---

## Already on main (do not re-litigate)

These PR claims are true and already indexed. Recover from the named page,
not from the PR branch.

| Claim | Where it already lives |
|---|---|
| Notes 240 / shut 46; Show Notes 32px hit | `BOARD.md` Finished; ASTRA packet |
| No hover-collapse beside Chat | `BOARD.md`; handoff `2026-09-12-1725` |
| Green latest-reply marker | `BOARD.md`; handoff `1725` |
| Copy on Chat + note highlight; Ask Chat | `BOARD.md`; handoff `2026-09-12-0018` |
| #51 Case 1 rules-first Tab | `BOARD.md`; `YOU-SHOULD-KNOW.md` §4; handoff `2153` |
| Session transcript clears on row click | `BOARD.md`; handoff `0048` |
| Packages Install = Prime CLI + reload + confirm | `BOARD.md`; `ARCHITECTURE.md` Packages (short form); handoff `2018` |
| Settings provider status waits until Agents | `BOARD.md` “Also on origin”; handoff `0048` |
| Hide helpers already in tree `43059e3e` | `MORNING.md`; `ASTRA_GOD_PLAN.md` facts table; `plans/hide-on-close-helpers.md` |
| Do not merge #66 | `HANDOFF.md` State; `BOARD.md`; `MORNING.md`; God plan W3 stop |

---

## Stale / discard

| PR text | Why discard |
|---|---|
| `HANDOFF` “`main` on origin is **`968e194`** (session board). Last **app** is still **`6908554`** at **2026-09-12 20:31**.” | Tip moved twice. Current: origin `5c629a0`, local `4416411`, app `476756c` at 2026-09-12 22:43. |
| Recent-sessions insert for `2026-09-13-0301-…` as the newest row | Would sit above later W1/W4/morning files and look current. This map is the disposition. |
| `YOU-SHOULD-KNOW` “Rail **Inbox** toggles it” (PR base of the §2 table) | W1: Inbox is a folder; Notes rail control. |
| `YOU-SHOULD-KNOW` “#43 still open” / “GitHub still open until a live Prime demo” for #14/#17/#18 | Closed 2026-09-13 on live-check. |
| Taking all of `ARCHITECTURE.md` or `CROSS-MODEL-HANDOFF.md` from either side | God-plan stop. Main gained Nous Portal, thinking-level clamp, and later Origin lines the PR never saw. |
| Rebase / merge / force-push of the draft | Explicit W3 stop. Overlap with W1 living files persists. |

---

## Unresolved overlap (why hold is the disposition)

1. `HANDOFF.md` State is W1-owned and newer than `11a0090`. Any PR tip line is wrong.
2. `ARCHITECTURE.md` Packages subsection now has a 2026-09-12 Nous Portal Origin
   immediately after the hub. The PR rewrite of that subsection does not include it.
3. `YOU-SHOULD-KNOW.md` §2 / §3 / §4 were restamped by W1 (closed-issue list,
   Inbox-as-folder, #51 table). The PR is a 2026-09-08-era briefing plus inserts.
4. Hide-helper *code* is on main; *architecture wording* is not. Landing the
   wording is a W1/docs cherry-pick, not a merge of #66.

A documented hold is valid (God plan W3). Useful content survives in this file.

---

## W1 integration payload

**Landed 2026-09-14** in the dirty tree (morning wave 2). Origin tags say
`PR #66 KEEP · 2026-09-14 · not a merge`. Do not merge the draft.

PR #66 stays draft. Close it only if Atticus wants the historical PR gone.
