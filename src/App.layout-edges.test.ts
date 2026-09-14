import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')
const appSource = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
const commandRail = readFileSync(`${process.cwd()}/src/components/CommandRail.tsx`, 'utf8')
const noteList = readFileSync(`${process.cwd()}/src/components/NoteList.tsx`, 'utf8')

describe('shell column edges', () => {
  it('keeps a faint Sessions rail so Chat can pulse its working strip', () => {
    expect(commandRail).toContain("borderRight: '1px solid var(--border-subtle)'")
    expect(commandRail).not.toContain("borderRight: '1px solid var(--sidebar-border)'")
  })

  it('keeps a visible inner divider on Notes', () => {
    expect(appCss).toMatch(/\.app__vault-panel\s*\{[^}]*border-left:\s*1px solid var\(--sidebar-border\)/)
    expect(appCss).toMatch(/\.app__notes-rail\s*\{[^}]*border-left:\s*1px solid var\(--sidebar-border\)/)
  })

  it('puts On top / Beside on the notes header, never the traffic-light rail', () => {
    expect(appSource).toMatch(/leadingControl=\{activeTab \? \(\s*<ChatNoteSplitToggle/)
    expect(commandRail).not.toContain('ChatNoteSplitToggle')
    expect(commandRail).not.toContain('On top')
    expect(commandRail).not.toContain('Beside')
  })

  it('wires Ask Chat about a highlight into this thread, not a new chat', () => {
    expect(appSource).toContain('<AskChatExcerptMenu onAsk={handleAskChatAboutExcerpt}>')
    expect(appSource).toContain('prefillAiComposer(formatAskChatExcerpt(title, excerpt))')
    expect(appSource).not.toContain('NEW_AI_CHAT_EVENT')
    expect(appSource).not.toContain('queueAiPrompt')
  })

  it('hides Notes only for Graph, Mycelium, and Research — not Settings', () => {
    expect(appSource).toContain(
      'const hideNotesForCanvas = isGraphDestination || isMyceliumDestination || isResearchDestination',
    )
    expect(appSource).not.toContain('isSettingsDestination')
  })

  it('passes width-folded Sessions into Chat as sessionsAutoCollapsed', () => {
    expect(appSource).toContain('sessionsAutoCollapsed={compactSessions}')
    expect(appSource).toContain("data-compact-sessions={compactSessions ? 'true' : 'false'}")
  })

  it('toasts Getting Started as created, not cloned', () => {
    expect(appSource).toContain('Getting Started vault created and opened at')
    expect(appSource).not.toContain('Getting Started vault cloned and opened')
  })

  it('mounts Graph/Mycelium only on Changes, not Inbox', () => {
    expect(appSource).toContain('chatCentered && isChangesSelection ? (')
    expect(appSource).toContain('<ConnectionsPanel')
    expect(appSource).not.toMatch(/isInboxSelection[\s\S]{0,80}<ConnectionsPanel/)
  })

  it('opens Inbox as a Notes filter, not a Graph host', () => {
    expect(appSource).toContain(
      "handleSetSelection({ kind: 'filter', filter: explicitOrganizationEnabled ? 'inbox' : 'all' })",
    )
  })

  it('does not collapse Notes on hover', () => {
    expect(appSource).not.toContain('onMouseEnter={collapseNotes}')
    expect(appSource).not.toContain('onMouseLeave={collapseNotes}')
    expect(appSource).not.toMatch(/onMouseEnter=\{[^}]*collapseNotes/)
    expect(appSource).not.toMatch(/onMouseLeave=\{[^}]*collapseNotes/)
  })

  it('hides the Chat center for Graph, Mycelium, and Research — not an overlay', () => {
    expect(appSource).toContain(
      "isGraphDestination || isMyceliumDestination || isResearchDestination ? { display: 'none' }",
    )
  })

  it('does not turn off the Chat working pulse when Notes is open', () => {
    const aiPanel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    expect(aiPanel).toContain('aiPanelFrameStyle')
    expect(aiPanel).not.toMatch(/notesOpen[\s\S]{0,120}aiPanelFrameStyle/)
    expect(appSource).not.toMatch(/notesOpen[\s\S]{0,80}ai-border-pulse/)
  })

  it('keeps Chat mounted when Notes is open', () => {
    expect(appSource).toContain('{chatHomeSurface}')
    expect(appSource).not.toMatch(/notesOpen \? null[\s\S]{0,80}chatHomeSurface/)
  })

  it('shows Inbox in the Notes list only when that folder mode is on', () => {
    expect(appSource).toContain('showInbox: explicitOrganizationEnabled')
  })

  it('keeps Inbox as a note list with no Graph chrome', () => {
    expect(noteList).not.toContain('ConnectionsPanel')
    expect(noteList).not.toContain('<GraphView')
    expect(noteList).not.toContain('<MyceliumView')
  })

  it('passes Chat turns through so C70 clocks can ride along', () => {
    const aiPanel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    expect(aiPanel).toContain('messages={agent.messages}')
  })

  it('keeps the packaged MCP bundle generated and gitignored', () => {
    const ignore = readFileSync(`${process.cwd()}/src-tauri/.gitignore`, 'utf8')
    expect(ignore).toContain('/resources/mcp-server/')
  })
})
