# Shell — Final Direction (converged spec)

**Status:** decided design spec, ready to build — **except §2.1 and §2.3, superseded 2026-08-22 by `docs/adr/0166-chat-centered-shell.md`.** The region map below is a note-taking app's map, inherited from Rhizome Desktop at the fork; this product puts Chat in the center with one panel on each side. Everything else in this document still stands. Supersedes the three-variant framing of the 2026-07-18 shell exploration (`rhizome-shell-exploration.html`, scratchpad artifact). This document picks one destination and sequences it. **Scope:** shell layout, status bar, graph-canvas chrome, settings surface, and their integration points. Zero code in this doc.

---

## 1. The decision

**The destination is the network shell. The command rail is not an alternative to it — it is the network shell's first structural increment, and we build toward the full network shell in four flagged phases.** Concretely: rail (46px, wave 5.3 as already planned) → status-bar consolidation into three pills → research converted from modal to right dock with the agent activity feed → mini graph dock at the sidebar's base. Every phase lands independently and the app is shippable after each one.

Why this is now the right call, given what shipped since the exploration was built: the exploration's "today + cheap cosmetic moves" variant is **already exhausted**. Ledger/mycelium themes are real (`f4d8d97d`), the wordmark lockup is real (`7bae29db`, wave 5.1), the canonical mark is real (wave 5.0, ADR-0157). Paint is done — and the app *still* reads as Tolaria, which confirms the exploration's own diagnosis: the four remaining tells are structural (sidebar taxonomy, three-pane proportions, 12-button status strip, note-card skeleton). Only the network shell removes them. Meanwhile the Portent seven (`93f0bd97`) strengthens the case for the network shell's core conceit — type-colored node language everywhere — because a fresh vault now actually *has* seven distinct types worth a legend, colored dots, and graph filtering. And the onboarding walkthrough spec that just landed tells a story ("agent writes a note → here's where it lives → see it in the graph") that the current chrome cannot point at: there is no agent-activity surface and the graph is hidden behind a status-bar button. The network shell is the UI that walkthrough is already narrating.

What we are *not* doing: shipping the network shell as one big-bang layout change. The repo's flag discipline (wave 5.3's `shell_command_rail`) stays; each structural phase gets its own flag and the legacy shell remains reachable until native QA passes on the real vault.

The exploration's "ember" skin is dead — ledger/mycelium shipped as the two first-party themes and nothing in this spec references ember.

---

## 2. Full shell spec

All colors are the **real shipped tokens from `src/index.css`** — never raw hex. The shell must look correct under all 15 themes plus the accent picker, so nothing below hardcodes ledger/mycelium values.

### 2.1 Region map (final state, all phases landed)

> **Superseded — see ADR-0166.** Chat is the center canvas and each side holds
> at most one panel. The map below is kept because §§2.2, 2.4–2.7 reference its
> region names.

```
┌──────────────────────────────────────────────────────────────────────┐
│ titlebar (existing macOS overlay / LinuxTitlebar — unchanged)        │
├────┬───────────┬───────────┬────────────────────────────┬───────────┤
│rail│  sidebar  │ note list │          editor            │ research  │
│46px│ 250–400px │ 220–500px │        min 800px           │  dock     │
│    │           │           │                            │ 280–560px │
│    ├───────────┤           │                            │ (toggle)  │
│    │graph dock │           │                            │           │
├────┴───────────┴───────────┴────────────────────────────┴───────────┤
│ status bar — three pill clusters                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Command rail (46px, fixed)

Behind `shell_command_rail` (flag already reserved by wave 5.3 planning; infra exists in `src/hooks/useFeatureFlag.ts`).

- **Width:** 46px fixed, not resizable. Background `var(--surface-sidebar)` (the recessed plane — the rail is *below* the sidebar in the elevation story, per the themes doc's recessed→canvas→raised logic). Right border `1px solid var(--border-subtle)`.
- **Top group — destinations, in order:** Notes (list glyph), Graph (3-node glyph), Research (magnifier glyph), Changes (git-branch glyph). Buttons are 30×30, radius `var(--radius)`, icon 16px, color `var(--text-muted)`; active state background `var(--accent-blue-bg)`, icon `var(--accent-blue)`; hover `var(--state-hover)`. These are *destinations*, not panels: Notes = the existing three-pane view, Graph = the existing wiki-graph view (same view the status-bar button toggles today), Research = opens/focuses the research dock (§2.4), Changes = the existing git changes surface.
- **Foot group:** the **agent avatar** — the brand mark core rendered from `BrandMark.tsx` geometry at 26px inside a 26px circle, `1px solid var(--accent-blue)` ring, background `var(--accent-blue-bg)`. A 7px status dot sits on its top-right edge: `var(--accent-blue)` when an agent job is running or wrote within the last 10 minutes, `var(--text-faint)` otherwise, with a single pulse animation (respecting `prefers-reduced-motion`) on each agent write event. Clicking it opens the agents pill dropdown (§2.6) anchored to the rail. Below it, a settings gear (same 30×30 button spec) opening Settings.
- **Tooltips** on every rail item (shadcn Tooltip), labels from `en.json` under a `rail.*` namespace.
- **Keyboard:** rail destinations get `Cmd+1..4` accelerators (menu-registered per the `app.set_menu()` gotcha in AGENTS.md — full menu rebuild, not a patch).

### 2.3 Sidebar (250px default, 250–400 resizable — unchanged bounds)

> **Superseded — see ADR-0166.** The sidebar docks *right* whenever the command
> rail is on: the rail holds the left edge and the macOS traffic lights with it,
> so the "rail does not take over brand duty" clause below no longer describes
> the shipped shell. The bounds, the 250px floor, and the node-dot/section-head
> dressing are unchanged.

The 250px floor stays exactly as shipped (`7bae29db` raised it for the wordmark lockup; `useLayoutPanels.ts` `COLUMN_MIN_WIDTHS.sidebar` and `.app__sidebar` in `App.css` stay in sync). The lockup stays in the sidebar header — the rail does **not** take over brand duty.

Contents change only in dressing, not taxonomy (taxonomy churn would break the walkthrough's steps 2–5 and user muscle memory):

- **Node bullets:** every type row's icon is replaced by a 7px round dot in the type's configured color (the same color the graph node uses). Views/folders keep their current icons. Selected row: `var(--state-selected)` background, dot and label `var(--accent-blue)`.
- **Section heads** (VIEWS / TYPES / FOLDERS): keep the mono uppercase micro-label but add a trailing hairline (`::after`, 1px `var(--border-default)`) so they read as ledger rules, not Tolaria's floating labels.
- **Base: the mini graph dock** (§2.5) — last phase.

### 2.4 Research dock (right, 340px default, 280–560 resizable)

Replaces the current `ResearchPanel` centered `Dialog`. Same five tabs (distill / generate / ask / library / history) and same content components — this is a *reframe*, not a rewrite: the Dialog wrapper is swapped for a right-docked panel, `var(--surface-panel)` background, `1px solid var(--border-default)` left border. Width persistence joins `useLayoutPanels` (`researchDock: default 340, min 280, max 560` — mirroring `graphPreview`).

- **Header:** mono label "research", 12px icon in `var(--accent-blue)`, close (×) at right. Tabs as a chip row: active chip `var(--accent-blue-bg)` + `var(--accent-blue)`, inactive `var(--text-muted)`.
- **Agent activity feed:** pinned to the dock's base (and fully visible on the History tab, which already owns "Vault Activity"). Rows: `<agent> <verb> <note title> <meta>` — e.g. "claude wrote **Sponsorship Close Rate** +2 links · 1h". Agent name in mono `var(--accent-orange)`, note title `var(--text-primary)` 600, rest `var(--text-muted)`, dashed `var(--border-subtle)` row separators. Data source is the existing vault-activity log that History already renders — the feed is a 3-row tail of it, click-through to the History tab.
- **Coexistence:** the AI panel and research dock share the right edge; opening one collapses the other (single right dock at a time). Below a ~1200px window width the dock overlays the editor instead of compressing it (editor min 800px is the constraint that forces this).
- The old modal entry points (status bar, command palette) now open the dock. The Dialog code path is deleted at the end of the phase, not kept as a fallback.

### 2.5 Mini graph dock (sidebar base)

The app's namesake, ambient instead of hidden behind a button. Last phase, behind its own flag (`shell_graph_dock`).

- **Placement:** fixed to the sidebar's bottom, above nothing (it is the last element). Height 96px content + 24px header ≈ 120px total. Background `var(--surface-sidebar)` one step recessed via a top border `1px solid var(--border-default)`.
- **Header row:** mono micro-label "vault graph" left, right-aligned live stat in `var(--accent-blue)`: "*N* nodes · *M* wrote today" (M = agent writes today from the same activity log as §2.4; omit the second clause when M = 0).
- **Rendering:** a **static-layout** SVG snapshot of the real graph — top ~25 nodes by degree, positions from a precomputed layout refreshed on vault index change, **no live force simulation** (CPU cost and visual jitter are not acceptable in ambient chrome). Nodes are type-colored dots (same colors as sidebar bullets), edges `var(--border-default)` 1px.
- **Pulse:** on an agent write event, the written note's node (added if absent) emits one expanding ring in `var(--accent-blue)`, ~2.5s ease-out, once — not looping. Suppressed under `prefers-reduced-motion` (the node just brightens for 2.5s instead).
- **Interaction:** the whole dock is one click target → opens the full graph view centered on the last-pulsed node (or zoom-to-fit if none). No per-node hit targets at this size.
- **Collapse:** a disclosure in the header collapses it to the 24px header row; state persisted in `localStorage` alongside panel widths. Auto-collapsed by default when window height < 700px.

### 2.6 Status bar — three pill clusters

The single highest de-Tolaria-per-line-of-code change. The 12+ pipe-separated text buttons collapse into three dropdown pills plus a right-aligned view group, on the existing 28px strip (`var(--surface-sidebar)` background, top border `var(--border-subtle)`, mono 10px type):

1. **Vault·git pill** (left): `● <vault name> · <branch> · <n>△` — dot is `var(--accent-green)` when clean/synced, `var(--accent-orange)` when dirty or behind. Dropdown (shadcn DropdownMenu, existing `VaultMenu.tsx` absorbed here): vault switcher, sync now, commit, history, conflicts. The "synced just now / n changes" text lives inside the pill, not as separate strip items.
2. **Agents pill** (center-right): `<n> agents idle` / `<agent> working…` in `var(--accent-orange)` border+text when active, `var(--text-muted)` when idle. Dropdown: the same activity feed as §2.4 (shared component), plus "Set Up External AI Tools…" when unconfigured. This pill and the rail's agent-avatar dot are two views of one store.
3. **View group** (far right): Graph toggle, Research toggle, gear — icon-only 16px buttons. **When `shell_command_rail` is on, this group is hidden** (the rail owns those destinations); the pills remain. When the rail is off (legacy shell), the group keeps today's graph-button toggle behavior including its return-to-previous-view semantics (`a9e160993`).

Pill anatomy: `border 1px solid var(--border-default)`, radius 999px, padding 2px 9px, caret `var(--text-faint)`; hover `var(--state-hover)`. Existing status-bar test IDs are preserved where the control survives (the graph toggle keeps its test ID whichever container renders it) — smoke selectors updated in the same commit as the consolidation, per the exploration's costing.

### 2.7 Note list

Card anatomy keeps title/snippet/meta but gains the network dressing: a type-colored 6px dot before the title (same language as sidebar/graph), and a **link-count chip** in the meta row (`◦ 4 links`, mono, `var(--accent-blue)` text, `var(--border-default)` outline, from the vault index's wikilink degree — data already exists). Selected card: `var(--surface-panel)` background + 2px `var(--accent-blue)` left edge. No column-width changes.

---

## 3. Graph canvas chrome

The docked node-inspector **already exists** (verified live, per HANDOFF) — it is not re-proposed. It gets only a restyle pass: type dot beside the title, mono metadata line (`Quarter · 4 links · agent-written`), and the link-walk rows using type-colored dots. Everything below is genuinely new:

- **Legend chips** (bottom-left, the headline fix): one chip per type present in the graph — type-colored dot + type name + count, `color-mix`-softened `var(--surface-panel)` background, `var(--border-default)` outline, radius 999px. **Clickable filters:** toggling a chip dims that type's nodes to `var(--text-muted)` at 40% opacity (not removed — the network's shape stays legible); toggled-off chip renders at 60% opacity. Colors come from the vault's type config (the same source as sidebar dots), never from fixed swatches. Wraps to two rows max; beyond ~8 types, an overflow "+n" chip opens a popover with the rest.
- **Control pill** (top-left): a single grouped pill — `2d / 3d / fit / today`. Active segment `var(--accent-blue-bg)` + `var(--accent-blue)`. "fit" is zoom-to-fit (action, not toggle). **"today"** filters to nodes written or edited today, with agent-written nodes ringed in `var(--accent-blue)` — this is the walkthrough's "find what the agent just wrote" story as a one-click view. (Whether 3d ships is an open item — §9; the pill design does not depend on it.)
- **Orphan callout** (bottom-right): when orphan count > 0, a pill in `var(--accent-orange)` text + border: `◦ 14 orphans — connect or archive?`. Clicking selects the orphan set (dims connected nodes). This is the gap-detection story surfaced in chrome; it is display-only in this spec (no bulk actions yet — §9).
- **Background:** kill the flat void — a soft radial gradient from `color-mix(in srgb, var(--surface-panel) 70%, var(--surface-app))` at ~55%/45% out to `var(--surface-app)`, matching the exploration and both shipped themes' elevation logic.

---

## 4. Settings redesign

Two fixes, from exploration §07, both confirmed against the current code (`SettingsPanel.tsx` scrolls one long page via `scrollIntoView` and threads `onSave`):

1. **Real per-section pages.** The left nav (Sync & Updates, Git, Vaults, Appearance, Content, AI Agents, Workflow, Telemetry) becomes a true router: selecting an item renders *only* that section. Nav items get node-dot bullets (`var(--text-muted)` inactive, `var(--accent-blue)` active) with `var(--accent-blue-bg)` active background; nav column `var(--surface-sidebar)`, page `var(--surface-app)`. Sections that today share a scroll region (Sync/Vaults/Git under one heading) are split into their own pages. Deep links that used section anchors now select the page.
2. **Instant apply.** Every toggle/select/slider commits on change (the plumbing largely exists — several handlers already call `onSave` immediately; the remaining draft-state paths are converted). The Save/Cancel footer is removed; `Esc` and the close control just close. Destructive operations (vault removal, history-rewriting git actions) keep their confirm dialogs. Text inputs commit on blur/Enter, not per keystroke. A one-line mono footnote on each page: "changes apply instantly" (localized, `settings.instantApply` key).

Access stays plural and unchanged: `⌘,`, the status-bar gear (legacy shell), the rail-foot gear (rail shell) — all open the same surface. Settings is the last surface still allowed to render as a Dialog; per-section pages live inside it.

---

## 5. Menu-bar companion integration

The companion prototype (`design/menu-bar-companion/index.html`, already reviewed and kept) is a separate deliverable and is **not** redesigned here. Two integration contracts so shell and companion stay one organism:

- **One agent-activity event source.** The tray icon's status dot, the popover's "network activity" rows, the rail's agent-avatar dot, the agents status pill, and the research dock's feed all consume the same vault-activity stream with the same verb vocabulary ("wrote / distilled / edited") and the same recency window. No surface invents its own agent state.
- **Same dot grammar.** Companion tray dot and rail avatar dot use identical semantics (active/recent = accent, idle = faint, single pulse per write). The companion's "Open Rhizome" lands on whatever shell phase is flagged on — no companion change needed per phase.

---

## 6. Onboarding-tour compatibility

Checked against `docs/design/onboarding-walkthrough.md` step by step:

| Step | Target | Under this spec |
|---|---|---|
| 1 Welcome, 2 sidebar, 3 TYPES, 4 create/link, 5 Inbox | sidebar surfaces | **Unchanged** — taxonomy deliberately preserved (§2.3). Step 2's cutout should *include* the rail once flagged on (one bounding-box tweak, no copy change). |
| 6 AI bubble/panel | floating AI button | **Unchanged.** |
| 7 Distill tab, 8 History tab | `research.tab.distill` / `research.tab.history` | **Targets survive** — same tabs, same IDs, new container. The tour's own placement table already classifies the Research panel as a right-docked panel (card to the left), so the dock conversion makes the tour spec *more* true, not less. No copy change. |
| 9 Wiki Graph button → canvas | **status-bar** graph button | **Needs update once the rail ships:** beat one's spotlight moves to the rail's Graph button, and the takeaway line "where the graph lives (status bar…)" plus the body's "Click it again anytime to jump back" must be re-verified against rail toggle semantics. Until `shell_command_rail` is default-on, the status-bar target remains valid (legacy shell keeps the button, §2.6.3). Flag: **tour step 9 copy + target are rail-conditional.** |
| 10 node preview panel | docked inspector | **Unchanged** — inspector persists, restyle only (§3). If the "today" filter or legend chips ever join the tour, that's an addition, not a conflict. |

Net: one conditional update (step 9), zero broken steps. The mini graph dock and agent feed are *not* tour steps in v1 of the tour; they're candidates for a later tour revision.

---

## 7. Wave 5 status mapping

| Wave item | Status under this spec |
|---|---|
| 5.0 canonical mark | Done (shipped). Untouched. |
| 5.1 wordmark lockup | Done (shipped, `7bae29db`). This spec depends on its 250px sidebar floor and keeps the lockup in the sidebar header. |
| 5.2 theme-token drift test | **Not covered here** — still worth doing, independent of shell work. This spec adds surface area (rail, docks, pills) that the drift test should cover once built. |
| 5.3 icon command rail (`shell_command_rail`) | **Completed by this spec** — §2.2 is the buildable definition of 5.3, unchanged in flag name and risk posture. |
| 5.4 broader chrome polish | **Superseded and made concrete** — 5.4's vague "broader chrome polish" becomes: status pills (§2.6), node bullets + link chips (§2.3, §2.7), research dock (§2.4), graph chrome (§3), settings pages (§4), mini graph dock (§2.5). Track them as 5.4a–5.4e per the build sequence below. |

---

## 8. Build sequence

Ordered for independent shippability; each phase ends with native QA on the real vault, smoke selectors updated in the same commit, and PostHog instrumentation per AGENTS.md.

1. **5.4a — Node bullets + link-count chips** (S, no flag). Pure dressing on existing data; zero layout risk. Events: none needed (cosmetic).
2. **5.4b — Status-bar consolidation into three pills** (M). ~~no flag but selector-sensitive~~ — **built 2026-07-24 gated on `shell_command_rail` instead**, matching 5.4a's decision to turn the whole network-shell language on together. The pill *reuses* the `VaultMenu` dropdown (new `pillSummary` + `extraActions` props) rather than absorbing its 801 lines, and the agents pill is wired to `useRhizomeJobs` — the activity log arrives with 5.4c per §2.4. Because the flag is off by default and the pill trigger keeps the `status-vault-trigger` ID, **no `tests/smoke` selector rewrite was required**. Event: `statusbar_pill_opened` (which pill). ✅
3. **5.3 — Command rail** behind `shell_command_rail` (M, flag already reserved). Rail + agent avatar + gear; view-group hiding per §2.6.3; `Cmd+1..4` menu accelerators. Flag off → shell byte-identical, smoke stays green. Event: `rail_destination_clicked`.
4. **5.4c — Research dock** behind `shell_research_dock` (M–L). Dialog → dock reframe, `useLayoutPanels` entry, agent feed component (shared with the agents pill — the pill's dropdown body is a placeholder until this lands, see §2.6). Delete the Dialog path when the flag graduates. Event: `research_dock_opened` (entry point). **Also give the dock `AiWorkspace`'s existing dock/pop-out mechanic** per §9.5 — it answers "editor access while researching" without new geometry.
5. **5.4d — Graph canvas chrome** (M, no flag — the graph view is already flag-free and verified). Legend chips, control pill, orphan callout, background gradient, inspector restyle. Events: `graph_type_filter_toggled`, `graph_today_filter`. **Also wires the pill's `3d` segment** (§9.1 — the renderer already exists in `ForceGraph3DCanvas.tsx`; this is a wiring + perf-check job, not a build, and needs no ADR).
6. **5.4e — Mini graph dock** behind `shell_graph_dock` (L — new renderer, perf-sensitive). Static-layout snapshot, pulse-on-write, collapse behavior. Last because it depends on the activity stream (5.4c) and is the only piece with real perf risk. Event: `graph_dock_clicked`.
7. **Settings redesign** (M, parallel-safe — orthogonal to the shell phases, can interleave anywhere after 2). Pages first, instant-apply second, as separate commits. Event: `settings_section_viewed`.
8. **Tour step-9 update** — lands with whichever commit turns `shell_command_rail` default-on, per §6.

Flag graduation rule: a flag defaults on only after native QA (mouse-first per AGENTS.md, then keyboard) passes on the real ~105-note vault in both default themes; the legacy code path is deleted one phase later, never in the same commit.

---

## 9. Open items

Answered by the user 2026-07-24 unless marked **OPEN**.

1. **3D graph mode — DECIDED: yes. And it is already built.** The user confirmed 3D is wanted; a code check then showed the question was moot. `3d-force-graph@^1.80.0` and `three@^0.185.1` are already dependencies, `src/components/graph/ForceGraph3DCanvas.tsx` is the sole WebGL surface, and `GraphView.tsx:231` already renders it (lazy-loaded from `App.tsx` to keep three.js out of the main bundle). **No new dependency, therefore no ADR** — the spec's framing of this as an unpaid cost was written without checking the codebase. What 5.4d actually owes is smaller: wire the control pill's `3d` segment to the renderer that exists, and confirm its perf on a ~9,000-node graph.
2. **Orphan callout actions — OPEN.** v1 stays select-and-dim. Bulk "archive orphans" / agent-suggested connections is an agent-feature decision, not chrome, and stays parked until someone has looked at a real orphan set.
3. **Rail default-on timing — OPEN, blocked on evidence not opinion.** Native QA on the real vault has still never run (5.3 was browser-only, which is exactly how the §9.7 traffic-light bug got through). The flag graduates when that QA passes, not before.
4. **Mini graph dock — DECIDED: must build.** Stays scheduled as 5.4e. Default state (expanded vs collapsed) is still the user's call after living with it, and remains a one-line change. **Worth flagging at build time:** the spec's design renders the top ~25 nodes by degree, so on a ~9,000-note vault the dock shows ~0.3% of it. That is deliberate — it is an ambient hub map plus a pulse-on-write target, not a vault survey — but *which* 25 (top-by-degree vs. recently-touched vs. current-note-and-neighbors) is a real design choice to make when 5.4e starts.
5. **AI panel vs. research dock merger — REFRAMED, still OPEN.** The user raised bottom-docking (half height) and adjustable side-docking as alternatives, and asked the load-bearing question: *do you need the editor while researching?* Two findings: (a) research content is narrow-line content (chat transcripts, distilled cards, Q&A), which wants a tall thin column — a bottom dock costs the editor the vertical space it can least spare while handing research horizontal space it cannot use; (b) **`AiWorkspace` already solves the editor-access case with pop-out mode** — a dedicated undecorated Tauri window (`ai-workspace` label) with dock/undock controls. Recommendation for 5.4c: build the right dock as specced in §2.4 **and give it the same dock/pop-out mechanic AiWorkspace already has**, rather than inventing a new geometry. That delivers "full editor + research" for free and makes the eventual merge a smaller question, since both surfaces would share one docking behavior.
6. **Tour revision scope — DECIDED: yes, add them.** The agent activity feed and the mini graph dock each earn a step, taking the walkthrough from 10 to 12. Combined with the rail-conditional rewrite of step 9 (§6), tour work should be **one pass after 5.4e**, not dribbled in per phase.
7. **Windows/Linux rail parity — RESOLVED 2026-07-24, and the risk was the other platform.** Linux is fine: `LinuxTitlebar` renders as a sibling above `<RootApp/>` in `main.tsx`, so it displaces the whole app shell rather than overlaying it — no collision is possible. **macOS was broken.** With `titleBarStyle: "Overlay"` and `trafficLightPosition: { x: 18, y: 24 }`, the system buttons float at roughly x 18–72, y 24–38, directly over the rail's first button (x 8–38, y 8–38). The rail is narrower than the lights, so the usual 90px left inset (`MACOS_TRAFFIC_LIGHT_SAFE_PADDING`) cannot apply; it now clears them vertically via `MACOS_TRAFFIC_LIGHT_SAFE_TOP` (44px). Fixed in `5f792a5a`. **Lesson for every later phase: browser QA cannot see native window chrome — a surface that touches a window edge needs native QA before its flag graduates.**
