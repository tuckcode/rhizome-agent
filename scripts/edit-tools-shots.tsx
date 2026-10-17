import { createRoot } from 'react-dom/client'
import { ToolApprovalCard } from '../src/components/ToolApprovalCard'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './edit-tools-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotState = 'edit' | 'new' | 'long'

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = (['edit', 'new', 'long'].includes(params.get('state') ?? '')
  ? params.get('state')
  : 'edit') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const LONG_OLD = Array.from({ length: 36 }, (_, index) => `keep line ${index + 1} of the weekly review`).join('\n')
const LONG_NEW = LONG_OLD.replace('keep line 12 of the weekly review', 'rewrite line 12 with the shipping note')
  .replace('keep line 24 of the weekly review', 'rewrite line 24 after the critique pass')

const PREVIEW: Record<ShotState, { tool: string; path: string; preview: string }> = {
  edit: {
    tool: 'edit_file',
    path: 'notes/plan.md',
    preview: [
      '--- notes/plan.md',
      '+++ notes/plan.md',
      '@@ -3,3 +3,3 @@',
      '-Ship the read tools first.',
      '+Ship the edit tools after the read tools.',
    ].join('\n'),
  },
  new: {
    tool: 'write_file',
    path: 'notes/fresh.md',
    preview: [
      '--- /dev/null',
      '+++ notes/fresh.md',
      '@@ -0,0 +1,4 @@',
      '+# Fresh note',
      '+',
      '+The agent wants to create this file in the vault.',
      '+Keep the parent folders inside the workspace root.',
    ].join('\n'),
  },
  long: {
    tool: 'edit_file',
    path: 'notes/weekly-review.md',
    preview: [
      '--- notes/weekly-review.md',
      '+++ notes/weekly-review.md',
      '@@ -12,20 +12,20 @@',
      '-keep line 12 of the weekly review',
      '+rewrite line 12 with the shipping note',
      '-keep line 13 of the weekly review',
      '+rewrite line 13 after the first pass',
      '-keep line 14 of the weekly review',
      '+rewrite line 14 with the vault path',
      '-keep line 15 of the weekly review',
      '+rewrite line 15 so the card scrolls',
      '-keep line 24 of the weekly review',
      '+rewrite line 24 after the critique pass',
      '-keep line 25 of the weekly review',
      '+rewrite line 25 with the approval copy',
      ' keep line 26 of the weekly review',
      '… 40 more lines',
    ].join('\n'),
  },
}

function Shot() {
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
          {state === 'edit' ? 'edit with a diff' : state === 'new' ? 'new file' : 'long diff'}
        </p>
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--state-selected)' }}>
          Please update the note.
        </div>
        <ToolApprovalCard
          tool={card.tool}
          path={card.path}
          preview={card.preview}
          options={OPTIONS}
          onReply={() => {}}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
