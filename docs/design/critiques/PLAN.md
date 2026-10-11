# UI/UX plan (Critiquito, 2026-10-10)

Source: the critiques in this folder. Each area folder has a dated critique and a fix-list.md with ids, severity, and the exact fix. Severity is blocker, worth fixing, or minor.

Note: the vault, knowledge-graph, tool-log and navigation critiques came from screenshots of an older build. Re-check those against the current build before coding; agent-window, website and palette are current.

## Order of work

1. **Accessibility and contrast blockers** (agent-window/fix-list.md, B1-B5)
   - Live region for run status: tool started/finished, reply done, stopped.
   - Muted and faint text colors fail contrast in both themes; the earth theme tokens fix this.
   - Text-safe ok/warn/danger colors in light theme.
   - Model chip "xai / grok-4.5" must be a real keyboard-reachable button.
   - Composer stays focusable while busy (don't disable the textarea); 2px accent focus ring on it.

2. **Earth theme** (palette-earth/, design-docs in earth-theme/ once written)
   - Subtle Earth dark = default, warm paper Earth light, "loam" as optional extra theme.
   - Drop-in token file: palette-earth/earth-tokens.css. Adds --border-input (>= 3:1).
   - Update DESIGN.md (still says the harness is Prime Agent).

3. **Knowledge graph / node map** (knowledge-graph/fix-list.md, G-B1-B5)
   - Arrow keys do nothing until a node is clicked: select the origin note on open.
   - Selected node isn't drawn differently: accent ring, dim the rest.
   - Each arrow move swings the camera: fixed orientation, arrows only pan/select.
   - Key listener is window-wide: listen only when the canvas has focus.
   - Bottom panels overlap and cover 20-40% of the map: merge Key + Filters into one toolbar above the canvas.
   - Direction: 2D local-first, labelled neighbours, docked reading preview with Linked from / Links to.

4. **Navigation: scattered tool buttons** (app-navigation/fix-list.md, A-B1)
   - Research, Graph, Mycelium, Changes, History open from 2-6 places each under different names, none has a shortcut.
   - One "Views" group in the left rail in that fixed order, Option+Cmd+1-5, Cmd+K and the Go menu as the second path.
   - One name per tool; status bar shows status only; composer + menu holds message inputs only.

5. **Agent window design** (agent-window/2026-10-10-design.md, D-B1, D-B2, D-W*)
   - Session list shows the empty state instead of the selected session's transcript.
   - Save toast names the wrong note; Save button should become a disabled "Saved".
   - Mint used 13 times on one screen (rule: 2 max).
   - Note split 50/50 (rule: conversation >= 55%).

6. **Tool-log note and vault inbox** (tool-log/, vault-inbox-editor/)
   - Agent-written notes are a raw terminal dump: answer at top, run log collapsed.
   - Empty AI Chat panel takes ~30% width: collapse by default.

7. **Website** (website/fix-list.md, WS-B1-B3)
   - Page still describes the old Prime/Hermes architecture.
   - Unapproved slogan "Your work. Your memory." baked into the hero image.
   - 3D molecule hero pushes the headline below the fold.
   - Lead with Mycelium and the vault; hero mock in website/hero-mock/. Rename to "Rhizome" pending knispo.

## Suggested owners (Dank.bot to confirm)
- G-baby: 1, 2 (app tokens), 3, 4, 5, 6.
- Ricky: review the graph and navigation PRs.
- Bubs: keyboard-only and screen reader click-through after each merge, using the fix lists as the checklist.
- Website: whoever owns the gh-pages site.
- Critiquito: re-check each screen from screenshots after merge and mark fix lists cleared.
