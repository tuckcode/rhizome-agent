import { createRoot } from 'react-dom/client'
import '../src/mock-tauri'
import { PulseView } from '../src/components/PulseView'
import { GitHistoryPanel } from '../src/components/inspector/GitHistoryPanel'
import { TooltipProvider } from '../src/components/ui/tooltip'
import type { GitCommit } from '../src/types'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './history-commit-title-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotSurface = 'history' | 'inspector'

const LONG_SUBJECT =
  'Update project notes and add a very long experiment title that must stay readable'

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const surface = (params.get('surface') === 'inspector' ? 'inspector' : 'history') as ShotSurface

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const inspectorCommits: GitCommit[] = [
  {
    hash: 'a1b2c3d4e5f6',
    shortHash: 'a1b2c3d',
    message: `${LONG_SUBJECT}\n\nBody that belongs below the subject.`,
    author: 'atticus',
    date: Math.floor(Date.now() / 1000) - 3600,
  },
]

if (typeof window !== 'undefined' && window.__mockHandlers) {
  window.__mockHandlers.get_vault_pulse = () => [
    {
      hash: 'a1b2c3d4e5f6',
      shortHash: 'a1b2c3d',
      message: `${LONG_SUBJECT}\n\nBody that belongs below the subject.`,
      date: Math.floor(Date.now() / 1000) - 3600,
      githubUrl: 'https://github.com/mock/rhizome-vault/commit/a1b2c3d4e5f6',
      files: [
        { path: 'project/my-project.md', status: 'modified', title: 'my project' },
        { path: 'note/new-note.md', status: 'added', title: 'new note' },
      ],
      added: 1,
      modified: 1,
      deleted: 0,
    },
  ]
}

export function Shot() {
  return (
    <TooltipProvider delayDuration={0}>
      <div
        data-testid="history-commit-title-shot"
        data-theme={theme}
        data-surface={surface}
        className="flex h-screen items-start justify-center"
        style={{
          background: 'var(--surface-app)',
          padding: 24,
        }}
      >
        <div
          className="overflow-hidden rounded-md border border-border bg-background"
          style={{ width: 280, height: 420 }}
        >
          {surface === 'history' ? (
            <PulseView vaultPath="/mock/vault" />
          ) : (
            <div className="p-4">
              <GitHistoryPanel commits={inspectorCommits} onViewCommitDiff={() => {}} />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<Shot />)
