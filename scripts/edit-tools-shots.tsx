import { createRoot } from 'react-dom/client'
import { ToolApprovalCard } from '../src/components/ToolApprovalCard'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './edit-tools-shots.css'
import editPreview from './edit-tools-previews/edit.diff?raw'
import newPreview from './edit-tools-previews/new.diff?raw'
import overwritePreview from './edit-tools-previews/overwrite.diff?raw'
import longPreview from './edit-tools-previews/long.diff?raw'

type ShotTheme = 'graphite' | 'earth'
type ShotState = 'edit' | 'new' | 'overwrite' | 'long' | 'long-scrolled'

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = (['edit', 'new', 'overwrite', 'long', 'long-scrolled'].includes(params.get('state') ?? '')
  ? params.get('state')
  : 'edit') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const PREVIEW: Record<
  ShotState,
  {
    tool: string
    path: string
    preview: string
    notes?: string[]
    capped?: boolean
    created?: boolean
    overwrite?: boolean
    label: string
  }
> = {
  edit: {
    tool: 'edit_file',
    path: 'notes/plan.md via link.md',
    preview: editPreview,
    label: 'edit with a diff',
  },
  new: {
    tool: 'write_file',
    path: 'notes/fresh.md',
    preview: newPreview,
    created: true,
    label: 'new file',
  },
  overwrite: {
    tool: 'write_file',
    path: 'notes/weekly-review.md',
    preview: overwritePreview,
    overwrite: true,
    label: 'replaces the whole file',
  },
  long: {
    tool: 'edit_file',
    path: 'notes/weekly-review.md',
    preview: longPreview,
    notes: ['… 1 more hunks / 4 more lines not shown'],
    capped: true,
    label: 'long diff',
  },
  'long-scrolled': {
    tool: 'edit_file',
    path: 'notes/weekly-review.md',
    preview: longPreview,
    notes: ['… 1 more hunks / 4 more lines not shown'],
    capped: true,
    label: 'long diff, scrolled',
  },
}

export function Shot() {
  const card = PREVIEW[state]
  return (
    <div
      data-testid="edit-tools-shot"
      data-theme={theme}
      data-state={state}
      className="flex min-h-screen items-start justify-center p-8"
      style={{ background: 'var(--surface-app)' }}
    >
      <div className="w-[440px] rounded-xl border border-border bg-background p-4 shadow-sm">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {theme === 'graphite' ? 'Graphite' : 'Earth light'}
          {' · '}
          {card.label}
        </p>
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--state-selected)' }}>
          Please update the note.
        </div>
        <ToolApprovalCard
          tool={card.tool}
          path={card.path}
          preview={card.preview}
          notes={card.notes}
          capped={card.capped}
          created={card.created}
          overwrite={card.overwrite}
          options={OPTIONS}
          onReply={() => {}}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
