# Onboarding Walkthrough — "Tour Rhizome" (design spec)

**Status:** design spec, not built. **Scope:** a re-launchable, spotlight-style product tour. Zero code in this doc — it is the input for a future implementation session.

**Primary goal (user's own framing, verbatim intent):** teach the user how to navigate and use Rhizome as a whole, *and* build an accurate plain-language mental model of what happens when an AI agent saves text or memories: *"I talk to an agent → it writes a note → here's where that note lives and how to find it again."* Not an architecture lesson.

**Secondary goal:** a brief overview of the Wiki Graph's node-selected sub-options (docked preview panel, links·backlinks toggle, arrow-key navigation, ghost-node Create note).

**Hard constraints (from the request):**
- Not forced on launch. Opt-in only, launched from Settings and/or the menu bar.
- A visible **"Skip tour"** control on **every** step, equally weighted with "Next." Exiting early is a first-class path.
- Distinct from the existing one-time `AiAgentsOnboardingPrompt` gate — but reuses its re-launch precedent (the `onReopenAiOnboarding` → "Set Up External AI Tools…" command pattern, Wave 2.2).

---

## 1. Step sequence

Ten steps. The order is deliberate: **space → things → the agent loop → where saves land → how to see it all → wrap**. Each step names the spotlit element, gives final copy (title + body, written to match the existing `en.json` voice — short declarative sentences, no exclamation marks, "you" not "the user"), and states the takeaway.

Every step shows the same footer: **`Back`** (except step 1) · step dots `● ○ ○ …` · **`Skip tour`** · **`Next`** (last step: **`Done`**).

---

### Step 1 — Welcome
**Spotlights:** nothing dimmed-out yet has a cutout; the card floats centered over a full-screen scrim, with the brand mark (the 5-satellite node mark from `BrandMark.tsx`) rendered at the top of the card. This frames the whole app as "the thing we're about to walk through."

> **Welcome to Rhizome**
> This short tour shows you how to move around, and what actually happens when an AI agent saves something to your wiki. About two minutes, ten steps. You can leave at any point — nothing here changes your notes or settings.

**Takeaway:** the tour is safe, short, and skippable. Sets the two promises the tour will keep: navigation + the AI-save mental model.

---

### Step 2 — Your vault is just files
**Spotlights:** the sidebar as a whole (the `--surface-sidebar` column), with the vault name in the sidebar title bar inside the cutout.

> **Everything lives in one folder**
> Your vault is a normal folder of Markdown files on this computer. Rhizome reads and writes those files — it never locks them away. Anything you (or an AI agent) create here, you can open in any other app, back up, or put in git.

**Takeaway:** the single most load-bearing fact for the AI mental model later — *a "note" is a plain file the user owns.* Establishing it here means step 6 can say "the agent writes a note" and it already means something concrete.

---

### Step 3 — Types organize your notes
**Spotlights:** the sidebar **TYPES** section (`sidebar.group.types`).

> **Notes have types**
> Every note has a type — Project, Task, Person, Topic, and so on. Types get their own color and icon, and each one shows up here as its own section. Click a type to see everything of that kind. You can rename types, recolor them, or add your own.

**Takeaway:** the sidebar isn't folders-first, it's types-first; type = color = badge, which pays off again in the graph step. (The Portent seven — Responsibility, Operation, Project, Task, Event, Topic, Person — plus Rhizome's own Note are the defaults, but the copy deliberately names only familiar ones and says "and so on" so it stays true for customized vaults.)

---

### Step 4 — Creating and linking notes
**Spotlights:** the new-note affordance (the sidebar/toolbar create-note control). If the vault has an open note, the editor pane is included in the cutout.

> **Write, and link as you go**
> Create a note, and type [[ to link it to another note — even one that doesn't exist yet. Links are how your vault becomes a wiki instead of a pile of files. A link to a note that isn't written yet is remembered, and you'll see it again in the graph later.

**Takeaway:** wikilinks are the connective tissue; plants the "ghost node" seed that step 9 harvests. Mentions `[[` because it's the one keystroke worth teaching.

---

### Step 5 — Inbox: where new things land
**Spotlights:** the sidebar **Inbox** entry (`sidebar.nav.inbox`) in the PROJECTS tree.

> **New captures land in the Inbox**
> When something arrives without a home — an import, a quick capture, a note an agent saved without a project — it lands in the Inbox. Check it now and then, file what matters into a project, and archive the rest.

**Takeaway:** answers "where do I look when I don't know where something went" *before* the AI steps, so the agent-save story has a default landing zone.

---

### Step 6 — Talking to an AI agent
**Spotlights:** the floating AI bubble (the agent-icon button), and the opened AI panel if it's visible.

> **Meet your AI panel**
> This button opens a chat with your AI agent — the one shown in Settings under AI Agents. Ask it questions about your notes, or ask it to remember something. Rhizome works fine without it, but the next two steps show what makes it worth setting up.

**Takeaway:** locates the AI surface and its identity (the icon = the configured agent), and softens for users with no agent installed — the tour must not read as broken when AI is unconfigured (see Open questions).

---

### Step 7 — What happens when an agent saves *(the core step)*
**Spotlights:** the Research panel's **Distill** tab (`research.tab.distill`), with the paste area and the Distill button inside the cutout.

> **What "saving to your wiki" really means**
> When you ask an agent to remember something — or paste text here and press Distill — the agent reads it, picks out what's worth keeping, and writes it as a new Markdown note in your vault. That's the whole trick. No hidden database: the memory *is* the note. It gets a title, a type, and links to related notes, and from then on it behaves like anything you wrote yourself — you can open it, edit it, or delete it.

**Takeaway:** the requested mental model, complete: *talk to agent → agent writes a note → the note is a plain file in the vault.* Deliberately says nothing about stream events, parsing, or the distill pipeline — "reads it, picks out what's worth keeping, and writes it" is the entire permitted depth.

---

### Step 8 — Finding what an agent just wrote
**Spotlights:** the Research panel's **History** tab (`research.tab.history` — the "Vault Activity" list).

> **Every save leaves a trail**
> Each time an agent writes to your vault, it's logged here — what was saved, where it went, and when. If you ever wonder "what did the agent just do?", this is the answer. And because saves are just notes, you'll also find them in search, in their type's section, and in the graph.

**Takeaway:** closes the loop on the mental model — *"…and here's how to find it again."* Three retrieval paths (activity log, sidebar/search, graph), with the graph as the handoff to the next step.

---

### Step 9 — The Wiki Graph
**Spotlights:** first the **status-bar Wiki Graph button**, then (after the tour navigates to the graph view) the graph canvas. This is a two-beat step: the card text stays the same while the spotlight moves from button to canvas once the view opens.

> **See your wiki as a graph**
> This button opens the Wiki Graph: every note is a node, colored by its type, and every link is an edge. It's the fastest way to see how your knowledge — and everything your agents have saved — hangs together. Click it again anytime to jump back to where you were.

**Takeaway:** where the graph lives (status bar, and it *toggles* back — worth saying because it's unusual), and how to read it: node = note, color = type, edge = link.

---

### Step 10 — Exploring a selected note *(node sub-options, brief by design)*
**Spotlights:** the docked node preview panel, with a node pre-selected by the tour (the vault's most-connected node; see Open questions for the empty-vault case).

> **Click a node to look closer**
> Selecting a note opens this panel: its type badge, a snippet, and its link counts. The links · backlinks control narrows the graph to just this note's neighborhood — press it again for the full graph. Arrow keys hop between connected notes, and Enter opens one. Faded nodes are notes that are linked but not written yet — the Create note button writes them into existence.
>
> That's the tour. You can run it again from Settings whenever you like.

**Takeaway:** the four sub-options that matter — badge/snippet, links·backlinks ego view (`graph.localGraph` / `graph.exitLocalGraph`), arrow-key navigation, ghost node + `graph.createNote` — and nothing else. Escape/other controls are intentionally untaught. Footer button reads **Done** instead of Next; **Skip tour** is still present but at this point identical to Done.

---

### Steps 11–12 — reserved, not yet written (tour v2)

**Decided 2026-07-24** (`shell-final-direction.md` §9.6): the agent activity feed and the mini graph dock each earn a step, taking the walkthrough from 10 to 12. Neither surface exists yet — the feed lands with wave 5.4c, the dock with 5.4e — so the copy is deliberately unwritten.

- **Step 11 — the agent activity feed.** Spotlights the feed at the research dock's base (and/or the agents status pill, which shares the component). Its job is to make "an agent wrote something" an ambient fact rather than something you go looking for. Note this partly overlaps step 8's "finding what an agent just wrote" — when it is written, step 8 should shrink rather than repeat.
- **Step 12 — the mini graph dock.** Spotlights the dock at the sidebar's base, ideally right after an agent write so the pulse ring is visible. Caveat from §9.4: the dock shows ~25 nodes, so the copy must not imply it is the whole vault.

**Sequencing:** do steps 11–12 together with the **step 9 rewrite** the command rail forces (§6 of the shell spec — the Wiki Graph spotlight moves from the status bar to the rail, and the "click it again to jump back" line needs re-verifying against rail toggle semantics). That is one tour pass after 5.4e, not three separate edits.

---

### Ordering rationale (one paragraph)

Steps 2–5 build the noun vocabulary (vault, note, type, link, inbox) with zero AI content, so that step 7 — the whole point — can be one short paragraph instead of a lecture: every word in "writes it as a new Markdown note in your vault" was defined three steps earlier. Step 8 answers the anxiety the mental model creates ("so where did it go?"), and steps 9–10 end on the payoff view where agent-written and human-written notes are visibly the same kind of thing.

---

## 2. Visual spec

Grounded in the current default themes — **ledger** (light) and **mycelium** (dark) — as specced in `docs/design/rhizome-default-themes.md` and landed in `src/index.css`. All values below are token references, never hardcoded hex, so the tour follows every one of the 15 themes automatically.

### Backdrop and cutout

- **Scrim:** a full-viewport layer filled with `var(--surface-overlay)` (ledger: `rgba(26, 30, 22, 0.3)`; mycelium: `rgba(4, 6, 3, 0.6)`). Reusing the app's own overlay token means the tour dims exactly like the app's dialogs do — nothing new to learn visually.
- **Cutout:** the spotlit element shows through a rectangular hole in the scrim (mask/cutout, **not** blur — blur is off-brand and expensive in WKWebView). The hole is the element's bounding box **+ 8px padding** on all sides, with corner radius `calc(var(--radius) + 4px)` (radius is `0.5rem` in both defaults).
- **Ring:** the cutout is framed by a **2px** ring of `var(--state-focus-ring)` (ledger: forest green `#2E6B4F`; mycelium: phosphor mint `#6FE3A0`). This is the app's existing focus-ring token: the tour literally "focuses" elements the way keyboard focus does. No glow, no pulse — one subtle entrance transition (~200ms ease-out) when the spotlight moves between steps, matching the app's restrained motion language.
- **Interaction:** the scrim swallows all pointer events (the app underneath is inert during the tour, including the spotlit element — the tour describes controls, it doesn't require operating them). Scroll is locked.

### Step card

The card that carries the copy and controls is styled as an elevated popover, same family as command palette / dropdowns:

- Background `var(--surface-popover)`, border `1px solid var(--border-default)`, radius `var(--radius)`, shadow `var(--shadow-dialog)`.
- Width: fixed **360px** (matches the docked graph panel's default 340 ± feel; wide enough that step 7's paragraph doesn't tower).
- Title: `var(--text-primary)`, the app's standard card-title size. Body: `var(--text-secondary)`, small text with relaxed leading — same treatment as `AiAgentsOnboardingPrompt`'s description text.
- Step dots: current dot `var(--accent-blue)` (which *is* the brand green/mint in the defaults, and the user's accent under the accent picker), inactive dots `var(--text-faint)`.
- A hairline connector (2px stub of the ring color) points from the card edge toward the cutout, so the pairing is unambiguous even when they're far apart.

### Card placement relative to the spotlight

Placement is computed per step from the cutout's position, preferring positions in this order, with 16px gap from the ring:

| Spotlit element region | Card position |
|---|---|
| Sidebar / left column (steps 2, 3, 4, 5) | To the **right** of the cutout, vertically centered on it (clamped to viewport) |
| Right-docked panels — AI panel, Research panel, graph preview panel (steps 6, 7, 8, 10) | To the **left** of the cutout, vertically centered |
| Status bar / bottom edge (step 9, beat one) | **Above** the cutout, horizontally centered on it |
| Center / large area — editor, graph canvas (step 4 fallback, step 9 beat two) | **Bottom-center of the viewport**, floating over the dimmed area below the content's visual center |
| No spotlight (step 1) | Viewport center |

If the preferred position doesn't fit (small window), fall back through: opposite side → above → below → viewport center. The card must never overlap its own cutout; if overlap is unavoidable (tiny window + huge element), shrink the cutout's padding to 4px before moving the card.

### Brand notes

The tour is chrome, not content: no illustrations per step, no screenshots-in-screenshots. The only decorative element is the brand node-mark on step 1. The spotlight ring in brand green/mint against dimmed paper/loam *is* the visual identity — a lit node in a dimmed network, which is exactly the product's own metaphor.

---

## 3. Skip control spec

**Presence and weight.** Every step's footer contains `Skip tour` as a real button — shadcn `Button` with `variant="outline"`, the same height and type size as the primary `Next` button beside it. It is never a bare text link, never icon-only, never moved into a corner "×". (A corner close "×" may *additionally* exist on the card for muscle-memory, but it is a duplicate of Skip, not a replacement.) `Esc` triggers Skip from any step.

**Behavior — identical at every step:**

1. The overlay, scrim, and card unmount immediately. No confirmation dialog, no "are you sure," no exit survey.
2. The app returns to **exactly the view state the user was in before the tour started.** This matters because steps 6–10 may navigate (open the Research panel, switch to the graph view): the tour records the pre-tour view once at launch and restores it on skip *and* on finish. Skipping at step 9 must not strand the user in the graph view they didn't choose.
3. Nothing else changes. The tour never mutates notes, settings, panel widths, or the vault — so skip has nothing to roll back beyond view state.
4. The tour remains available from its entry points forever. No "tour dismissed" flag gates re-launch; skipping at step 3 and relaunching later starts from step 1. (A `lastSeen` marker may be stored for analytics/entry-point badging, but it must never suppress or alter the entry points.)

**Skip vs. Done:** on the final step they are behaviorally identical; both restore the pre-tour view. The distinction is purely which PostHog event fires (see Open questions).

---

## 4. Re-launch entry points

The precedent to copy is Wave 2.2's re-launchable AI onboarding: `AiAgentsOnboardingPrompt` is one-time on launch, but the **"Set Up External AI Tools…"** command re-opens it on demand via an `onReopenAiOnboarding` callback threaded through `useAppCommands` into the command registry. The tour gets the same treatment with its own callback (e.g. `onStartWalkthrough`):

1. **Command palette** — a new command in the existing `command.settings` group, alongside "Set Up External AI Tools…":
   > `Take the Rhizome Tour…` (keywords: tour, walkthrough, onboarding, help, guide, learn)
2. **Settings** — a row in **Settings → General** (top-level, not buried under AI Agents — the tour is mostly not about AI): label "Product tour", description "A two-minute walkthrough of navigation, AI saving, and the Wiki Graph.", button "Take the tour". Clicking closes Settings first, then starts the tour — the tour spotlights the main window, so Settings can't stay open over it.
3. **Menu bar** — macOS **Help** menu: "Take the Rhizome Tour…" item. (Tauri gotcha from `AGENTS.md` applies: `app.set_menu()` replaces the whole menu bar — the item must be added within the full menu build, not as a patch.)

No launch-time trigger of any kind. Not on first run, not after updates, no "new here? take the tour" toast. If a first-run affordance is ever wanted, that's a separate decision (see Open questions).

**Implementation caution to carry into the build session:** Wave 2's native QA found that `useAppCommands.ts`'s `createCommandRegistryAiConfig` silently dropped `onReopenAiOnboarding` on the passthrough, hiding the command — and unit tests that called `buildSettingsCommands` directly missed it. The tour's callback takes the same route; the regression test must exercise the `useAppCommands` passthrough layer, not just the command builder.

All copy above (step titles, bodies, buttons, command labels, Settings row) lands in `src/lib/locales/en.json` under a `walkthrough.*` namespace per the localization rule. Note the known repo-wide gap: `pnpm l10n:translate` is blocked on missing LARA keys, so the tour ships English-only until that's resolved (pre-existing condition, not a new one).

---

## 5. Explicitly out of scope

Reaffirming the user's framing — the tour **must not** contain:

- **Any architecture or implementation content.** No agent stream events, no distill/parse/write pipeline, no Rust/Tauri/MCP anything, no "how the sausage is made." The maximum permitted depth on AI saving is step 7's sentence: *reads it, picks out what's worth keeping, writes it as a Markdown note.*
- **Exhaustive control documentation.** The graph step covers four sub-options and deliberately skips the rest (Escape semantics, resize handle, project/kind chips, timestamps). The tour is a mental model, not a manual.
- **Forced or automatic launch.** No first-run trigger, no post-update trigger, no nudges.
- **Interactive "do it yourself" tasks.** The app is inert under the scrim; the tour points and explains. A hands-on variant is a possible future iteration, not this one.
- **Setup flows.** Agent install/auth stays in the existing `AiAgentsOnboardingPrompt` / "Set Up External AI Tools…" surface; the tour may *mention* Settings → AI Agents (step 6) but never embeds setup.
- Also out of scope for this doc: component API, state management, and test plan — implementation-session concerns.

---

## 6. Open questions for review

1. **No-agent vaults at step 6–8.** If AI features are disabled (`settings.aiFeatures.enable` off) or no agent/model is configured, do steps 6–8 (a) show as written — the copy already hedges ("Rhizome works fine without it"), (b) swap to a single condensed "here's what AI *would* do" step, or (c) get skipped entirely? Recommendation: (a) — the mental model is the tour's whole point and is worth teaching before setup, but this is a product call.
2. **Empty/near-empty vaults at steps 9–10.** The graph step needs a node to select. Options: pre-seed nothing and show the `graph.empty` state with adjusted copy; or skip step 10 when the graph has no nodes. Recommendation: keep step 9, auto-skip step 10 below 2 nodes.
3. **Live navigation vs. static.** This spec assumes the tour really navigates (opens Research panel, switches to graph view) and restores state on exit. Confirm that's acceptable vs. a fully static overlay that only ever points at currently-visible chrome (weaker, but simpler and zero state-restore risk).
4. **Step count tolerance.** Ten steps at ~2 minutes. If that's too long, the candidates to cut are step 5 (Inbox — foldable into step 3) and the second beat of step 9. Steps 2, 7, and 8 are load-bearing and must survive any trim.
5. **PostHog events.** Proposed: `walkthrough_started` (with entry point: palette/settings/menu), `walkthrough_completed`, `walkthrough_skipped` (with step number). Skip-at-step is the single most valuable signal for iterating on the sequence. Confirm event names and that step-number metadata is acceptable (it's not PII or note content).
6. **Naming.** "Take the Rhizome Tour…" vs "Product tour" vs "Walkthrough" — pick one term and use it in all three entry points. This doc uses "tour" in user-facing copy and "walkthrough" internally.
7. **First-run affordance (future).** Deliberately excluded now; if adoption of the tour is near-zero in PostHog, revisit a one-time, dismissible *pointer to* the tour (never an auto-start).
8. **Menu-bar reach on non-macOS.** The Help-menu item is specced for macOS; confirm whether the Linux titlebar build gets an equivalent or relies on palette + Settings only.
