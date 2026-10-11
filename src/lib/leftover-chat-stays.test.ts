import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover chat stays', () => {
  const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
  const rail = readFileSync(
    `${process.cwd()}/src/components/CommandRail.tsx`,
    'utf8',
  )

  it('keeps ChatHome in App', () => {
    expect(app).toContain('<ChatHome')
  })

  it('does not put Notes on the command rail', () => {
    expect(rail).not.toContain('command-rail-inbox')
    expect(rail).not.toContain('active={notesOpen}')
  })

  it('keeps Changes next to Notes in the sidebar, not on the rail', () => {
    const views = readFileSync(`${process.cwd()}/src/lib/railViews.ts`, 'utf8')
    const sidebar = readFileSync(
      `${process.cwd()}/src/components/sidebar/SidebarTopNav.tsx`,
      'utf8',
    )
    expect(views).not.toContain("testId: 'command-rail-changes'")
    expect(rail).toContain('testId={view.testId}')
    expect(rail).toContain('command-rail-views')
    expect(rail).not.toContain('onSelectChanges')
    expect(sidebar).toContain("filter: 'changes'")
    expect(sidebar).toContain('sidebar.nav.allNotes')
  })

  it('does not hide Chat just because Notes is open', () => {
    expect(app).toContain('hideChatForNotesFocus ? null : chatHomeSurface')
    expect(app).not.toMatch(/notesOpen \? null[\s\S]{0,80}chatHomeSurface/)
  })
})
