# Rhizome front-end run: plan

**Origin:** Claude Fable 5.2 (Claude Code desktop) · 2026-11-14 · audit of `main` at `8e704704`

This plan answers [`fable-ux-run-brief.md`](fable-ux-run-brief.md). The evidence is the running app (`pnpm dev`, mock Tauri) and the code. The baseline screenshots are in [`docs/review-shots/ux-baseline/`](../review-shots/ux-baseline/). `scripts/capture-ux-baseline.mjs` makes them again.

Three read-only agents checked the critique lists against the code. Where a row says "agent check", I did not open that line myself.

## 1. Decisions for Atticus

I will build these by default. Each one is in its own PR, so you can reject one and keep the rest.

1. **Graph becomes 2D by default.** This reverses ADR-0155 (3D force graph) and adds one dependency (`force-graph`). A new ADR will record it. 3D stays as an option only if it costs little.
2. **Telemetry consent moves behind the welcome screen.** Today the first thing a new user sees is a consent dialog. The product has said nothing yet.
3. **The Language setting leaves Settings.** It offers one choice, "System (English)". The product is English only (C18).
4. **A destructive command cannot be approved from the collapsed row.** The user must open the card and read it first.
5. **The welcome line changes.** It says "Markdown knowledge management for the age of AI". The product is "a coding harness that doesn't forget". The exact words are your call. I will propose them in the PR.
6. **The Notes list stops covering the open note.** Section 2.3 shows it. ADR-0170 and ADR-0173 stay in force. Only the overlay behaviour changes.

## 2. What the audit found

### 2.1 Where the brief is right

- **Approvals carry no risk.** `rm -rf ~/EVIL` and `echo SAFE` get the same primary "Allow once" button, in the card and in the collapsed row. The engine sends no risk data (`src-tauri/src/rhizome_loop/policy.rs`). It knows four classes: read-only (runs with no prompt), edit or write (asks, can grant per file for the session), create note, and shell (asks every time).
- **"Allow for session" hides its scope.** The grant covers one file (`mutate_session_matches`). The label does not say so.
- **Tool calls have no outcome.** A row shows a name and `RUN`, `OK` or `ERR`. It shows no duration and no result. A turn with 30 tool calls is one "Tool use 30" toggle with a flat list under it.
- **Run state is shown in too many places.** The brief says three. The count is at least four visible places and two live regions: the frame pulse, the session dot, the composer-foot spinner, `ChatRunLiveStatus`, and the pulses inside the message.
- **No "stalled" state exists.** A run that gets no event looks the same as a run that thinks.
- **The type scale drifts.** 357 `text-[Npx]` uses across 10 values, 387 inline `style={{}}` blocks, and 146 other arbitrary px utilities. 53 of those 146 are off the 4px grid. `src/index.css` defines no type tokens and no spacing tokens, so the code has no scale to follow. ESLint has no rule for this. Two tests require drift classes (`ChatPreflightBanner.leftover.test.ts`, `parked-organs.test.ts`).
- **First run has no model step.** The flow is consent, welcome, vault, then the shell. Nothing connects a provider. No smoke test goes from a fresh profile to a sent message.

### 2.2 Where the brief is out of date

The agent-window fix list reviewed a prototype. Most of its blockers are already fixed in the app.

| List | Rows | Fixed | Open | Not applicable | Not sure |
|---|---|---|---|---|---|
| Agent window (56) | B, W, M, D | 17 | 18 | 6 | 15 |
| Knowledge graph (19) | G | 4 | 15 | 0 | 0 |
| Tool log (9) | T | 5 | 2 | 0 | 2 |
| Vault inbox (2 held) | V | 1 | 1 | 0 | 0 |
| App navigation (4 rechecked) | A | 2 | 0 | 0 | 2 |
| Oct 4 UI audit (8) | F | 7 | 1 | 0 | 0 |

- All five agent-window accessibility blockers (B1 to B5) are fixed. The live region exists, `scripts/contrast_check.py` reports no failing pair, and the model chip is a real button.
- The composer stays enabled during a run (W1 fixed).
- The splash theme, the font flash and the splash replay (F01 to F03) are fixed in code (agent check). The brief lists them as open.
- The `dark:` variant follows the app theme (`src/index.css:10`).
- Settings has dialog semantics.

Each PR below updates the status column of its fix list. The "not sure" rows get a check in the running app in that PR.

### 2.3 What the brief does not mention

- **The Notes list covers the note you opened.** With a note open, the Notes sheet lies over the right part of the editor and cuts its own rows at the edge. See `graphite-note-open.png`. It also covers the Command Palette button and the Send button when no note is open (`graphite-notes-panel.png`).
- **The right rail shows recent notes as icons with no label.** Five notes of the same type show five look-alike icons.
- **"Notes" shows twice** as a heading in the Notes sheet.
- **The shell has no `<main>` landmark.** The composer has no accessible name.
- **Esc closes Chat.** It does not stop a run, and Stop has no shortcut.
- **The spinner on a running tool does not spin.** `.ai-spin` has no CSS rule (agent check).
- **The empty session shows a sparkle icon.** The vault critique removed that icon in one place (V-W2). It is still in the session empty state.
- **Two smoke specs assert a test id that is not in `src/`:** `claude-onboarding-screen` in `getting-started-template.spec.ts:64` and `offline-onboarding-status.spec.ts:67`. I did not run them. PR 8 will run them and repair them.
- **Settings shows Save and Cancel, but some settings apply at once** (F07, open).

## 3. Design direction

### 3.1 Approvals: weight follows risk

Three tiers. The tier sets the look of the card, the default focus, and what the collapsed row allows.

| Tier | Examples | Card | Collapsed row |
|---|---|---|---|
| Routine | Edit a file in the vault, create a note, a read-only command (`ls`, `git status`, `rg`) | Calm card. Primary "Allow once". | Allow and Deny in the row |
| Caution | Overwrite a whole file, a command that writes, installs, or uses the network | Warning line that names the effect. Primary "Allow once". | Allow and Deny in the row |
| Danger | Delete (`rm`), `sudo`, force push, `git reset --hard`, pipe to a shell, a path outside the vault, hidden characters | Danger border and a plain reason line. "Allow once" is an outline button. Deny has the focus. | Review only |

- A classifier in TypeScript (`src/lib/approvalRisk.ts`) reads the tool and the command. It is display only. The engine still decides what asks.
- The classifier never says "safe". An unknown command is Caution. State-true copy applies: the card says what the command may do.
- The session grant says its scope: "Allow edits to this file for this session".
- Edit and write stay diff-first. The diff is the body of the card.
- A later PR can move the classifier into the engine, so the risk travels with the approval event. That is not in this run unless the UI needs it.

### 3.2 A run you can read

- **One line per turn.** The "Tool use 30" toggle becomes a run summary: "Read 12 files · edited 2 · ran 3 commands · 48s". It opens to the steps.
- **A step shows its outcome.** Verb, target, result and duration: "Read `notes/plan.md` · 120 lines · 0.2s". A failed step stays visible when the group is collapsed.
- **One run status.** One model with these states: thinking, running a tool, waiting for you, no response, finished, failed, stopped, paused at the step limit. One visible status line above the composer shows it. The same model feeds the one live region and the session dot. The frame pulse and the second live region go.
- **"No response for 30 seconds"** is a new state. It shows the time since the last event and offers Stop. It does not claim the run is stuck.
- **Stop gets a shortcut** (`⌘.` on Mac, `Ctrl+.` elsewhere). Esc keeps its current job.
- **Message actions get a new order:** Copy, Save to vault, Fork, then a menu with Regenerate and Read aloud.

### 3.3 One scale

- Type tokens in `src/index.css`: 11 (meta), 12 (small and mono), 13 (control), 14 (body), 16 (title), 20 (display). 9px, 10px and the half-pixel sizes go.
- Spacing uses the Tailwind 4px steps. No new spacing tokens.
- An ESLint rule blocks new `text-[Npx]`, new static inline `fontSize`, and raw colors in components. It is a ratchet, like `tsconfig.test.json`: files with old drift are listed by name, and a file leaves the list when it is clean.
- The sweep goes surface by surface, in the same PR as the redesign of that surface where one exists.

### 3.4 First run

Order: welcome (what Rhizome is), vault, model, first chat. Consent becomes one calm step after the welcome screen.

- The model step recommends one path from what the device has: a detected local model, ChatGPT sign-in, or an API key. It has a "Skip" that leads to the chat with a clear "No model connected" state.
- The provider list in Settings gets the same grouping and one recommended row.
- A smoke test on a fresh profile goes from welcome to a sent message.

## 4. Add, change, cut, merge

| Kind | Item |
|---|---|
| Add | Risk tiers on approvals |
| Add | Run summary line and step outcomes with durations |
| Add | "No response" run state |
| Add | Stop shortcut |
| Add | Model step in first run |
| Add | Type tokens and a lint ratchet |
| Change | Session grant label says "this file" |
| Change | Graph: 2D, selection ring, labels on the selection and its neighbours, selection on open |
| Change | Notes list docks beside the note |
| Change | Message action order |
| Change | Consent moves behind the welcome screen |
| Cut | Language setting |
| Cut | Sparkle icon in the session empty state |
| Cut | Frame pulse and the composer-foot live region |
| Cut | Permanent "No remote" label (T-M2) |
| Cut | Unlabelled recent-note icons on the right rail, unless a label fits |
| Merge | Five run-state displays into one status line |
| Merge | Graph Key and Filters into one toolbar (G-W4, G-W8) |
| Merge | The two "Notes" headings |

## 5. PR sequence

Each PR is one change, with before and after screenshots in both themes and green gates.

| # | Branch | Content |
|---|---|---|
| 0 | `ux/fable-run-plan` | This plan, the baseline screenshots, the capture script |
| 1 | `ux/approval-risk` | Risk classifier, card and collapsed row by tier, grant label, ADR |
| 2 | `ux/run-status` | One run-status model, status line, "no response", Stop shortcut, one live region |
| 3 | `ux/run-timeline` | Run summary line, step outcomes and durations, the spinner fix |
| 4 | `ux/chat-structure` | Landmarks, composer name, message headings, tool list semantics, action order, text under 11px in chat |
| 5 | `ux/type-scale` | Type tokens, the lint ratchet, the two tests that require drift |
| 6 | `ux/scale-sweep-*` | The sweep for the surfaces that no other PR touches (status bar, sidebar, Pulse, search) |
| 7 | `ux/first-run` | Welcome copy, consent order, model step, fresh-profile smoke test |
| 8 | `ux/provider-settings` | Grouped provider list with one recommended row, the stale smoke specs |
| 9 | `ux/settings-structure` | Cut Language, Save and Cancel made true (F07), split `SettingsPanel.tsx` by section |
| 10 | `ux/graph` | 2D, selection, labels, fit, toolbar, names, ADR that replaces ADR-0155 |
| 11 | `ux/notes-dock` | Notes list docks, one heading, right-rail note icons |
| 12 | `ux/fix-list-close` | Final status on every fix-list row, and the handoff |

`App.tsx` gets a split only where one of these PRs needs it. The Prime and Hermes removal (ADR-0189) stays out.

## 6. How I will work

- Test first for logic (the classifier, the run-status model, the lint rule). CSS and layout are the stated exception.
- Component tests change to the new behaviour. I do not delete a test to get green.
- I stage files by name, sign commits, and never use `--no-verify`. Atticus merges.
- One push per finished PR. The full gate takes about 4.5 minutes and must not run twice at once.
