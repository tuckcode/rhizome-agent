import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Regression guard for a real user-reported bug: clicking the AI bubble while
 * in the wiki graph made the bubble vanish and opened nothing.
 *
 * Cause: `<Editor>` is what renders `aiWorkspaceSurface`
 * (`Editor.tsx` — `{showAIChat && aiWorkspaceSurface}`), but the graph branch
 * in App.tsx *replaces* `<Editor>` entirely. Opening the chat set
 * `effectiveShowAIChat`, which unmounted the floating button (it renders on
 * `!effectiveShowAIChat`) while nothing mounted the panel — so the bubble
 * disappeared and no AI surface appeared.
 *
 * Asserted against source text rather than a rendered tree because mounting
 * the full App with a graph selection needs the entire vault/Tauri mock
 * surface; this repo already uses that approach for structural invariants
 * (see BreadcrumbBar.visibility.test.tsx and indexBootDiagnostics.test.ts).
 */
describe('graph view mounts the AI workspace surface', () => {
  const source = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

  function graphBranch(): string {
    const start = source.indexOf('isGraphDestination ? (')
    expect(start, 'graph branch not found in App.tsx').toBeGreaterThan(-1)
    // End at the ternary's alternative arm. Deliberately not `indexOf('<Editor')`
    // — the branch's own explanatory comment mentions <Editor> and would
    // truncate the slice before the assertion ever sees the real markup.
    const end = source.indexOf(') : isMyceliumDestination ? (', start)
    expect(end, 'graph branch has no alternative arm').toBeGreaterThan(start)
    return source.slice(start, end)
  }

  it('renders aiWorkspaceSurface inside the graph branch, not only inside Editor', () => {
    expect(graphBranch()).toContain('aiWorkspaceSurface')
  })

  /**
   * The floating bubble this originally paired with was removed 2026-08-15 —
   * it was Desktop leftover, and chat is now a rail destination that owns the
   * window. Only half the original invariant survives: the graph branch must
   * still mount the surface on the same flag that opens it, so the status bar
   * and `OPEN_AI_CHAT_EVENT` (which still open the side panel) cannot set a
   * flag that nothing renders.
   */
  it('mounts the surface on the flag that opens it, so no opener can strand', () => {
    expect(graphBranch()).toContain('effectiveShowAIChat && aiWorkspaceSurface')
  })

  it('no longer renders the removed floating bubble', () => {
    expect(source).not.toContain('AiWorkspaceFloatingButton')
  })
})
