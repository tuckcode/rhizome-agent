import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { FileText, GitBranch, Tray } from '@phosphor-icons/react'
import { CommandRail } from '../src/components/CommandRail'
import { NotesRail } from '../src/components/NotesRail'
import { VaultPanel } from '../src/components/VaultPanel'
import { TooltipProvider } from '../src/components/ui/tooltip'
import '../src/index.css'
import '../src/themes.css'

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
    noteList={<div className="p-3 text-sm">Recent notes</div>}
    onBrowseToggle={() => {}}
    onCollapse={() => {}}
    mode={state === 'open' ? 'open' : state === 'rail' ? 'rail' : 'auto'}
    onModeChange={() => {}}
  />
)

const narrow = state === 'narrow'
const expanded = state === 'hover' || state === 'open'
const overlaying = state === 'hover' || state === 'narrow'

function Shot() {
  return (
    <TooltipProvider>
      <div
        data-testid="notes-panel-modes-shot"
        data-theme={theme}
        data-state={state}
        className="flex h-screen overflow-hidden"
        style={{ width: narrow ? 640 : 1100, minHeight: 640 }}
      >
        <CommandRail
          locale="en"
          pinned={state === 'open' || state === 'narrow'}
          autoCollapsed={state === 'narrow'}
          drawer={state === 'narrow'}
          onOpenSettings={() => {}}
          onSelectView={() => {}}
        />
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-app)]">
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Chat stays at least 420px
          </div>
        </div>
        {state === 'open' ? (
          <div className="flex h-full" style={{ width: 240 }}>
            {panel}
          </div>
        ) : (
          <NotesRail
            mode={state === 'rail' ? 'rail' : 'auto'}
            onModeChange={() => {}}
            expanded={expanded && state !== 'rail'}
            overlaying={overlaying && state !== 'rail'}
            width={240}
            panelRef={createRef<HTMLDivElement>()}
            items={railItems}
          >
            {panel}
          </NotesRail>
        )}
      </div>
    </TooltipProvider>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<Shot />)
