---
target: Settings panel
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 2
timestamp: 2026-08-30T02-50-42Z
slug: src-components-settingspanel-tsx
---
Method: dual-agent (A: design review · B: detector + deterministic evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `SettingsBodyNav.tsx:33-43` all 8 nav items permanently muted, no active state, no `aria-current`, no scroll-spy. `handleSave` closes instantly (`SettingsPanel.tsx:492`) so a save is confirmed only by disappearance. |
| 2 | Match System / Real World | 2 | "Inactive-app grace period (seconds)" is engineer units in a note app. Two different things both titled "Model providers" (`PrimeProviderStatusSection.tsx:90` and the API tab editor). |
| 3 | User Control and Freedom | 1 | Cancel (`SettingsFooter.tsx:22`) only calls `onClose` — reverts nothing. Escape (`:497`) and backdrop (`:518`) discard the draft with no dirty check. |
| 4 | Consistency and Standards | 1 | Three save models in one form; three type scales; raw `<input>`/`<button>` where shadcn is mandatory; `text-emerald-700` hardcoded 3x instead of `--accent-green`; hand-rolled modal while `ResearchPanel.tsx:1096` uses shadcn Dialog. |
| 5 | Error Prevention | 2 | Good: `canSave` gate, real "Test model" round-trip, disabled AutoGit fields with explanation. Bad: no confirm on credential deletion, no dirty guard, `min={1}` with no max. |
| 6 | Recognition Rather Than Recall | 2 | Footer prints "⌘, to open settings" inside the already-open panel; the actual Cmd+Enter save shortcut is documented nowhere. |
| 7 | Flexibility and Efficiency | 2 | No settings search across ~35 controls. Nav is `hidden md:block` with no small-width fallback. Both radiogroups lack roving tabindex — 16 theme tiles are 16 tab stops. |
| 8 | Aesthetic and Minimalist Design | 2 | Row rhythm clean, but Agents tab stacks 5 unlike blocks with no hierarchy; Content group runs 8 undivided rows. |
| 9 | Error Recovery | 2 | Raw exception text with no `role="alert"` (`AiProviderSettings.tsx:339`). A failed `onSave` surfaces nothing; panel closes regardless. |
| 10 | Help and Documentation | 3 | The panel's genuine strength — nearly every control carries real written guidance. Docked for nine section explanations rendered nowhere. |
| **Total** | | **19/40** | **Poor — major UX work required** |

No heuristics scored n/a.

## Design Specificity Verdict

**LLM assessment:** Specific in substance, anonymous in form. The content is unmistakably Rhizome — AutoGit thresholds, Prime provider status, the 501-model allow-list, bridge token, session auto-distill. No other app has these rows. But the shell (centered modal, 8-item left nav, card groups, Cancel+Save footer) is stock and would lift into any Electron app unchanged.

The genericness lands in the two worst places: the theme picker offers Rhizome's own sage/moss palette as tile 1 of 16 beside Dracula and Monokai Pro, at identical visual weight; and the panel ignores the product's own type system (`theme.json`), inventing 14px/14px-500/12px/11px/10px scales inside one surface.

**Deterministic scan:** `detect.mjs` exit 0, `[]`, zero findings on `SettingsPanel.tsx` and all 9 sibling settings components. Sanity-checked against all of `src/components` → 1 finding (`UpdateBanner.tsx:134`, layout-transition), confirming the engine does scan .tsx. The clean result is real but narrow: the detector's rules are CSS-value shaped, and this file styles through Tailwind classes and `var(--token)`, giving those regexes almost nothing to match. Zero findings is evidence of no CSS-literal anti-patterns, not of a well-designed panel.

Lizard complexity (via codacy-cli): NLOC 1413, 122 functions, avg CCN 1.3, max CCN 9, longest function 43 NLOC, 0 warnings. Headline: 1503 lines with essentially no branching complexity — the size is breadth (38 components in one file), not tangle. Lizard's per-function attribution is unreliable on TSX and was discarded.

Deterministic greps: 0 hardcoded colors in the settings tree (all via tokens); 0 escape hatches (`as any`, `eslint-disable`, `@ts-ignore`); 10 raw interactive elements (2 `<button>`, 8 `<label>`); 12 aria attributes but **zero** `role="dialog"`, `aria-modal`, or `<h1>`-`<h6>` anywhere; 0 responsive breakpoints in `SettingsPanel.tsx`; 26 settings rows in 9 groups across 8 sections; 6 levels of prop drilling to reach a row; `SettingsBodyProps` is 66 props.

**Where they agree (high confidence):** no dialog semantics, no headings, raw `<button>` at `SettingsPanel.tsx:1046`, radiogroups without arrow-key navigation, nav disappearing below `md`.

**Where A caught what B missed:** the raw `<input>` at `PrimeModelAllowListSection.tsx:133` with a focus class Tailwind never generates — B did not scan that file.

**Where B corrected the brief:** two of the supplied greps were faulty (trailing-space patterns missing multi-line JSX; a focus grep that missed the imported hook and the `useEffect` listener). B reran with corrected patterns.

**Visual overlays:** not attempted. Tauri desktop app; the settings panel does not render meaningfully in a bare browser and a dev server would be misleading evidence. No server started.

## Overall Impression

The substance is strong and the shell is failing it. Someone thought hard about what these settings mean — the explanatory copy is better than most shipped products manage. But the panel's save model is incoherent (three different models interleaved in identical-looking rows), its exits are untrustworthy, and its accessibility layer is largely absent. The single biggest opportunity is deciding what "Save" and "Cancel" mean on this surface; almost half the findings collapse into that one decision.

## What's Working

1. **The written guidance is load-bearing and honest.** `GitSettingsSection.tsx:66-68` explains *why* a control is disabled rather than just greying it. `settings.aiAgents.sessionAutoDistillDescription` states default, recommendation, and exclusions. `settings.modelAllowList.description` pre-empts the fear ("nothing is removed"). This is documentation doing work most panels leave to support tickets.

2. **Progressive disclosure that solves a real problem.** The allow-list inverts its own default — opens on the shortlist you keep, reaches the 501-model catalog only by typing (`PrimeModelAllowListSection.tsx:106-111`). The correct answer to "the editor must not be the same wall it is fixing," and the one place the interaction model was designed rather than assembled.

3. **Full-row click targets on every switch.** `SettingsControls.tsx:273-286` wraps label + description + Switch in one `<label>`, turning a 20x36px control into a several-hundred-pixel target, applied uniformly to all ~15 switches.

## Priority Issues

### [P0] Any instant-apply control silently destroys every pending draft edit
- **Why it matters:** Silent data loss triggered by the panel's most-clicked control. `SettingsPanel.tsx:435-437` rebuilds the entire draft whenever the `settings` prop identity changes; `saveSettings` produces a new object (`hooks/useSettings.ts:156`); instant-apply handlers at `:459, :465, :471, :477, :483` all call `onSave`. Set pull interval to 30, click a theme tile, pull interval reverts to 5 with no message. Same for release channel, update checks, AutoGit thresholds, workflow toggles, telemetry, language, date format, note width, AI target. Invisible in tests because each control is exercised alone.
- **Fix:** Guard the reset on panel identity rather than settings identity — capture `settings` in a ref and rebuild the draft only when `open` transitions false→true, or key `SettingsPanelInner` on open.
- **Suggested command:** /impeccable harden

### [P0] Cancel does not cancel; Escape and backdrop discard without warning
- **Why it matters:** "Cancel" is a contract. Already written to disk by the time Cancel is clicked: theme mode (`:471`), color theme (`:477`), accent (`:483`), hide-gitignored (`:459`), All-Notes visibility (`:465`), auto-distill (`:1250`), the Prime allow-list, and every provider added or deleted. Meanwhile Escape (`:497`) and backdrop (`:518`) throw away the draft half with no dirty check. Two opposite betrayals from one button.
- **Fix:** Pick one model per surface — either make Appearance/allow-list/providers a declared instant-apply zone with visible "Applied" affordance and relabel the footer `Done`, or route them through the draft. Gate Escape/backdrop/Cancel behind a dirty check.
- **Suggested command:** /impeccable harden

### [P0] The modal has no dialog semantics, and three controls have no focus indicator
- **Why it matters:** A screen-reader user cannot tell they are in a dialog, cannot read any control's explanation, and a keyboard user loses the caret entirely on the model search field. `SettingsPanel.tsx:533-537` has no `role="dialog"`, no `aria-modal`, no `aria-labelledby`; the title at `:581` is a `<span>` and there is no heading element anywhere in the panel. Zero `aria-describedby` in the entire settings tree — every switch sets `aria-label` (`SettingsControls.tsx:191`) which suppresses the `<label>` content, so all ~15 descriptions are announced to nobody. `PrimeModelAllowListSection.tsx:133-145` uses `focus:outline-none` plus `focus:border-border-strong`, a class Tailwind never generates because `--color-border-strong` is absent from the `@theme inline` block (`index.css:407-452`).
- **Fix:** Wrap in shadcn `Dialog`/`DialogContent` as `ResearchPanel.tsx:1096` already does — gets role, aria-modal, focus trap and Escape for free and deletes `useSettingsPanelFocus.ts` (74 lines). Add `aria-describedby` in `SettingsRow`/`SettingsSwitchRow`. Replace raw input/buttons with `ui/input` / `ui/button`. Register `--color-border-strong` in `index.css:443`.
- **Suggested command:** /impeccable audit

### [P1] Removing a provider deletes its API key with no confirmation, no undo, ghost styling
- **Why it matters:** The single most expensive mistake available in the panel, one stray click away, styled quieter than "Test model" beside it. `AiProviderSettings.tsx:265-267` renders `variant="ghost"` "Remove"; `:316-319` fires `deleteAiModelProviderApiKey(providerId)` as fire-and-forget `void`, so a failed delete leaves the key on disk while the UI says it is gone. The user must reissue a key from the provider's console.
- **Fix:** `variant="destructive"`, a shadcn `AlertDialog` naming the provider and stating the key will be deleted, and `await` the delete so failure surfaces.
- **Suggested command:** /impeccable harden

### [P1] 8-item nav with no current-section state, no search, and it disappears below `md`
- **Why it matters:** In an 8-section scroll the nav is the entire orientation mechanism, and it never says where you are or where you've been. `SettingsBodyNav.tsx:30-43` — every item permanently `variant="ghost" text-muted-foreground`, no `aria-current`, no scroll-spy. No settings search across ~35 controls. `sticky top-0` at `:31` is inert because the scroll container is the sibling at `SettingsPanel.tsx:708`. `hidden md:block` removes the nav entirely on a narrow window. Compounding: the nav gives all 8 sections an icon but only 2 of 8 section headings carry one, so arrival is never confirmed.
- **Fix:** IntersectionObserver over `SETTINGS_SECTION_IDS` → `aria-current="true"` + active styling; pass `icon` to all 8 `SectionHeading` calls; add a filter input above the nav; render the nav as a horizontal scroll strip below `md` rather than hiding it.
- **Suggested command:** /impeccable layout

### [P2] Nine section-level explanations, including the privacy promise, are written and rendered nowhere
- **Why it matters:** `SectionHeading` declares `description?: string` (`SettingsControls.tsx:43`) and never renders it (`:45-58`). Nine strings exist in `en.json`, are maintained, and reach no screen. The most costly is `settings.privacy.description` — "Anonymous data helps us fix bugs and improve Rhizome. No vault content, note titles, or file paths are ever sent." — missing from the one screen where a user decides whether to trust the product with their data. Because the description slot doesn't exist, every explanation was pushed into per-row copy, which is why the Content group is 8 rows of similar-weight text with no framing. `SettingsSection` also declares `showDivider` (`:28`), never uses it, and `SettingsPanel.tsx:752` passes `showDivider={false}` into the void.
- **Fix:** Render `description` in `SectionHeading` as `text-xs text-muted-foreground` under the title, then pass the nine existing strings at their call sites. Delete `showDivider`. Roughly a 15-line change that recovers copy already written and reviewed.
- **Suggested command:** /impeccable clarify

## Persona Red Flags

**Alex (Power User):** Cmd+Enter saves but nothing says so — the footer instead prints "⌘, to open settings" (`SettingsFooter.tsx:20`) inside the open panel, the one shortcut useless at that moment. No settings search across ~35 controls in 8 sections. 16 theme tiles are 16 tab stops (`SettingsPanel.tsx:1038` declares `role="radiogroup"` with no roving tabindex, promising grouped keyboard behaviour that does not exist). The nav costs 8 tab stops before any setting. He is the user most likely to lose work to P0 #1: changes six things, clicks a theme to compare, five of six silently revert. The default-target select flattens 8 agents + N models into one list with hand-built string prefixes (`:1188-1202`) instead of SelectGroup/SelectLabel.

**Sam (Accessibility-Dependent):** Not announced as a dialog (`:533`) — no role, no aria-modal, no heading element, so heading navigation returns nothing. Every switch description is inaudible: `SettingsControls.tsx:191` sets `aria-label` on the Switch, overriding the wrapping `<label>`, and no `aria-describedby` exists anywhere — the auto-distill warning is invisible to her. No focus indicator on the model search field (`PrimeModelAllowListSection.tsx:143`). Selected accent color is unannounceable (`AccentColorPicker.tsx:42-73` — 8 buttons, no radiogroup, no aria-checked; selection conveyed only by `scale-110` and an unlabelled Check icon). Status text fails contrast in dark themes: `text-emerald-700` (#047857) at 12px on `--surface-card` #151A12 is ~2.9:1 against a 4.5:1 requirement (`SettingsPanel.tsx:1377`, `AiProviderSettings.tsx:338`, `PrimeProviderStatusSection.tsx:137` — that last file uses the correct `var(--accent-green)` for the dot on `:120` and hardcoded emerald for the word on `:137`, inside the same element). A second full-viewport control named "Close settings" (`:566-572`, an invisible `absolute inset-0` button) duplicates the header X. Switch is 20x36px, under the 24x24 minimum.

**Riley (Stress Tester):** The threshold fields cannot be retyped — `SettingsControls.tsx:171` runs `sanitizePositiveInteger(Number(event.target.value), value)`; clearing yields `Number('') === 0`, which is `< 1`, so it snaps back. Select-all-and-type is impossible. No upper bound (`min={1}`, no `max`) — 99999999 seconds is accepted and effectively disables AutoGit while the switch still reads "on". Provider IDs collide: `AiProviderSettings.tsx:292` uses `${draft.kind}-${Date.now().toString(36)}`; two adds inside one millisecond produce duplicate IDs, and removing one then deletes the other's key. Rapid theme clicking writes three localStorage keys plus an async onSave per click, undebounced. Any background settings write while the panel is open wipes the draft — same root cause as P0 #1, hit without touching the panel.

## Minor Observations

- Deep-link and autofocus race at the same 50ms timer: `SettingsPanel.tsx:444` scrolls to `initialSectionId` while `useSettingsPanelFocus.ts:57` focuses the Pull-interval select. You arrive at Privacy with focus eight sections above; pressing Space opens a dropdown you cannot see.
- AI tab state is not deep-linkable — `Tabs defaultValue="agents"` (`:1309`) always lands on Agents regardless of caller intent.
- Accent picker vanishes rather than explains: choosing a non-Rhizome theme disables the mode toggle *with* an explanation (`:1008`) but removes the accent row entirely (`:1013`) with none.
- `text-emerald-700` should be `--accent-green`, already defined and theme-aware for all 16 themes (`index.css:78`). Three occurrences.
- Test IDs double as DOM IDs (`SettingsControls.tsx:270`, `:164`), coupling accessibility wiring to test naming and risking duplicate IDs.
- Inline `style` beside Tailwind in 17 places. A house habit (`AiPanelChrome.tsx` has 20) rather than a panel defect — but the newer `ResearchPanel.tsx` has 1, so the direction of travel is away from it.
- `SettingsBodyProps` is 66 props (`:157-222`) threaded through three layers, with four workspace callbacks collapsed onto single lines to hide the width. This is why sections are hard to reorder, regroup, or search over.
- `SettingsGroupItem` is used only by `PrivacySettingsSection` — telemetry rows are checkboxes while every comparable on/off elsewhere is a Switch. Two visual grammars for the same decision, and the checkbox one is the consent screen.
- Two declared-but-unused props: `showDivider` (`SettingsControls.tsx:28`) and `description` on `SectionHeading` (`:43`).

## Questions to Consider

1. If a user changes the theme and then presses Cancel, what did they just cancel? Right now the answer is "the pull-interval edit you forgot you made, and nothing else." Until instant-apply and draft are separated visually — or one of them is deleted — every exit from this panel is a guess. Which one goes?
2. Rhizome ships a distinctive sage-and-moss palette and then offers it as tile 1 of 16 next to Dracula and Monokai Pro. Is the theme picker expressing confidence in the product's visual identity, or hedging against it? What would this section look like if "Rhizome" were the design and the other 15 lived behind a "More themes" disclosure?
3. Nine section descriptions were written, reviewed, and translated — and `SectionHeading` never rendered any of them. Nobody noticed. What does it say about the review loop that the telemetry privacy promise could go missing from the consent screen and every gate stayed green?
4. The panel documents ⌘, (how to get here) and hides ⌘↵ (how to leave successfully). If the footer had one line of space and the honest options were "⌘↵ to save" or "3 unsaved changes" — which does this panel need more, and why is it showing neither?
