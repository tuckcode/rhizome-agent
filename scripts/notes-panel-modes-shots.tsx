import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { FileText, GitBranch, Tray } from '@phosphor-icons/react'
import { CommandRail } from '../src/components/CommandRail'
import { NotesRail } from '../src/components/NotesRail'
import { VaultPanel } from '../src/components/VaultPanel'
import { TooltipProvider } from '../src/components/ui/tooltip'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'

type ShotState = 'rail' | 'hover' | 'open' | 'narrow'
type ShotTheme = 'graphite' | 'earth'

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = (['rail', 'hover', 'open', 'narrow'].includes(params.get('state') ?? '')
  ? params.get('state')
  : 'rail') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
if (theme === 'earth') document.documentElement.dataset.colorTheme = 'rhizome'
else document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const railItems = [
  { id: 'inbox', label: 'Inbox', icon: Tray, onSelect: () => {} },
  { id: 'all', label: 'All Notes', icon: FileText, active: true, onSelect: () => {} },
  { id: 'changes', label: 'Changes', icon: GitBranch, onSelect: () => {} },
  { id: 'note:/vault/draft.md', label: 'Draft', icon: FileText, unsaved: true, onSelect: () => {} },
]

const panel = (
  <VaultPanel
    browseOpen={false}
    locale="en"
    notesWidth={240}
    navigation={<div className="p-3 text-sm text-muted-foreground">Inbox</div>}
    noteList={(
      <div className="flex flex-col gap-1 p-2 text-sm">
        <div className="rounded-md px-2 py-1.5" style={{ background: 'var(--state-selected)' }}>All notes</div>
        <div className="px-2 py-1.5 text-muted-foreground">Draft</div>
        <div className="px-2 py-1.5 text-muted-foreground">Weekly review</div>
      </div>
    )}
    onBrowseToggle={() => {}}
    onCollapse={() => {}}
    mode={state === 'open' ? 'open' : state === 'rail' ? 'rail' : 'auto'}
    onModeChange={() => {}}
  />
)

const narrow = state === 'narrow'
const expanded = state === 'hover'
const overlaying = state === 'hover' || state === 'narrow'

export function Shot() {
  return (
    <TooltipProvider>
      <div
        data-testid="notes-panel-modes-shot"
        data-theme={theme}
        data-state={state}
        className="flex h-screen flex-col overflow-hidden"
        style={{ width: narrow ? 640 : 1100, minHeight: 640 }}
      >
        <div
          className="flex h-8 shrink-0 items-center px-3 text-xs font-medium"
          style={{
            background: 'var(--surface-panel)',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {theme === 'graphite' ? 'Graphite' : 'Earth light'}
          {' · '}
          {state === 'rail' ? 'Rail' : state === 'hover' ? 'Auto hover' : state === 'open' ? 'Open' : 'Narrow Auto'}
        </div>
        <div className="flex min-h-0 flex-1">
          <CommandRail
            locale="en"
            pinned={state === 'open'}
            autoCollapsed={state === 'narrow'}
            drawer={false}
            onOpenSettings={() => {}}
            onSelectView={() => {}}
          />
          <div
            className="flex min-w-0 flex-1 flex-col"
            style={{ background: 'var(--surface-app)' }}
          >
            <div className="flex flex-1 flex-col justify-end p-4">
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  background: 'var(--surface-panel)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Chat keeps at least 420px
              </div>
            </div>
          </div>
          {state === 'open' ? (
            <div className="flex h-full" style={{ width: 240, background: 'var(--surface-sidebar)' }}>
              {panel}
            </div>
          ) : (
            <NotesRail
              mode={state === 'rail' ? 'rail' : 'auto'}
              onModeChange={() => {}}
              expanded={expanded}
              overlaying={overlaying && state !== 'rail'}
              width={240}
              panelRef={createRef<HTMLDivElement>()}
              items={railItems}
            >
              {panel}
            </NotesRail>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<Shot />)
