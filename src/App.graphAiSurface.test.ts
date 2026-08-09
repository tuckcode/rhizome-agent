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
    const start = source.indexOf("effectiveSelection.filter === 'graph' ? (")
    expect(start, 'graph branch not found in App.tsx').toBeGreaterThan(-1)
    // End at the ternary's alternative arm. Deliberately not `indexOf('<Editor')`
    // — the branch's own explanatory comment mentions <Editor> and would
    // truncate the slice before the assertion ever sees the real markup.
    const end = source.indexOf(') : (', start)
    expect(end, 'graph branch has no alternative arm').toBeGreaterThan(start)
    return source.slice(start, end)
  }

  it('renders aiWorkspaceSurface inside the graph branch, not only inside Editor', () => {
    expect(graphBranch()).toContain('aiWorkspaceSurface')
  })

  it('gates that surface on the same flag that hides the floating button', () => {
    // The button renders on `!effectiveShowAIChat`; if the panel used a
    // different condition the two could disagree and strand the user again.
    expect(graphBranch()).toContain('effectiveShowAIChat && aiWorkspaceSurface')
    expect(source).toContain('aiFeaturesEnabled && !effectiveShowAIChat')
  })
})
