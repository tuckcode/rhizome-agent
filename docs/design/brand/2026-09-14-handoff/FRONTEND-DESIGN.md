# Frontend direction: quiet Chat, distinct Rhizome

**Status:** design recommendations and acceptance criteria. This is not a completed visual audit.
**Decision:** a focused polish pass fits this window. A broad frontend redesign belongs to a later session.
The favorite organic artwork supplies identity. Reading, writing, and recovery supply the everyday experience.

## Visual hierarchy

Chat remains the center canvas. Sessions remain left. Notes remain a separate right column.
Preserve the 46px Show Notes restore strip and the Notes inner divider. Preserve the green Chat working strip.
Keep Chat visually primary when Notes opens. Keep the Notes split toggle in the Notes header.
Use existing foreground, muted, border, surface, and accent tokens. Do not apply the artwork's forest palette over every theme.

Proposed spacing rhythm: 4 / 8 / 12 / 16 / 24 pixels, using the nearest existing component token.
Use 8 pixels between related compact controls and 16 pixels between groups where space permits.
These are design targets, not a command to normalize every existing measurement.
Retain the current user-selected reading font and scale. Use mono for the wordmark, code, and compact metadata where already established.

## High-value changes to inspect

| Surface | Proposed improvement | Source entry point | Acceptance |
|---|---|---|---|
| Chat composer | Separate typing, model controls, and secondary hints through spacing and contrast | `src/components/ChatComposerDeck.tsx`, `ChatComposerFoot.tsx` | Send/Stop stays discoverable. Controls wrap without hiding the input or Notes seam. |
| Runtime notices | Use readable text, a state label, and one supported recovery action | `ChatPreflightBanner.tsx`, current W4-owned status components | A failed request cannot look complete. Unknown health cannot look connected. |
| Model controls | Give provider labels enough contrast and space for long names | Locate the current model picker from `ChatComposerDeck.tsx` | Selection, provider, and reasoning level remain readable during scrolling. |
| Message actions | Keep a consistent icon family, size, hover tooltip, and focus treatment | Locate the current action row from `AiPanel` | Copy/save/regenerate/fork labels remain accessible. Existing meanings remain unchanged. |
| Notes and Sessions | Align rows and make long names readable without new navigation | `ChatHome.tsx`, `Sidebar.tsx`, current Notes panel | Active selection, Notes restore, and keyboard navigation remain obvious. |
| Settings About | Use the selected artwork as an illustration above utility links | `AboutSettingsSection.tsx` | Full image copy remains visible. Contribute and Docs remain usable. |

Source inspection found 10px composer-foot text and 11px preflight text. These are inspection candidates, not proven visual failures.
If the consequential text is difficult to read at normal scale, try 12–13px before changing the whole app's typography.
Keep text size adjustable through existing preferences. Do not override the editor font through a broad stylesheet rule.

## Runtime states: visual treatment follows evidence

| Existing evidence | Suggested wording/treatment | Guardrail |
|---|---|---|
| Prime explicitly accepts a queued follow-up | `Queued` plus its visible message | Keep it visible through the queue lifecycle. Do not equate local draft storage with Prime acceptance. |
| Prime reports active execution | `Working` with supported activity detail | A pulse reinforces the label. It does not create the state. |
| Stop or interruption is confirmed | `Stopped` or the established interrupted label | A requested stop is not a confirmed stop. |
| A provider or transport error occurs | Brief error plus the available recovery action | Preserve the draft. Do not auto-resend a potentially executed request. |
| Connection cannot be determined | `Connection unknown`, where the current contract supports it | Configured credentials do not prove connection health. |
| A reply finishes normally | Existing completed-response presentation | Do not invent a success badge for an empty or failed turn. |

Use text and icon shape with color. Reserve the error treatment for errors. Keep optional diagnostics expandable.
Use an existing action for retry, reconnect, or settings navigation only when that action is safe and implemented.
Keep Enter to send and Shift+Enter for newline. Escape keeps its existing Chat-close behavior. Stop remains click-only.

## Accessibility and rendering targets

- Aim for 4.5:1 contrast for ordinary text and 3:1 for large text and meaningful control boundaries.
- Give compact icon controls a usable hit area, targeting at least 32×32px where the current layout permits it.
- Keep visible focus and accessible names. Hover tooltips must not be the only labels available to assistive technology.
- Preserve the reading position while streaming. Avoid new image loads that move the composer.
- Respect reduced motion. Retain status information when animation is reduced.
- Verify long text and supported narrow windows. Do not set a new app minimum width to hide overflow.

These are design and QA targets. They are not a claim of accessibility compliance.

## What makes the app distinctive

Use the organic image on About and marketing surfaces. Let the roots mean durable connection across work.
Use dither for a developer-document header or a restrained onboarding illustration if an existing slot is appropriate.
Keep the main Chat transcript, editor, controls, and status free of texture.
Use the six-node mark at small scale. Detailed roots and baked-in banner copy cannot function as a 24px icon.
Preserve the existing Phosphor/shadcn component family. New decorative controls do not improve a working control.

## Security-related presentation

Keep secret inputs masked by default. Preserve deliberate reveal controls if they already exist.
A configured key is different from a successful connection. Label only the state actually known.
Keep tokens, passwords, raw ENV contents, and private vault content out of shared screenshots and error examples.
Do not describe Prime's Limited tools mode as a sandbox or enforced vault boundary.
Known W7 fixes remain required. Broader credential-storage audits remain reserve work under the original plan.

## Later work

Defer a full theme redesign, a new layout system, a new navigation rail, animated roots, and a changed Dock identity.
Design inspectable memory as a separate feature with real provenance and correction semantics.
The five-hour pass improves daily use. It does not establish daily-driver readiness without the separate live reliability and security evidence.
