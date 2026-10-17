import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ResearchPanel } from '../src/components/ResearchPanel'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './research-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotState = 'empty' | 'depth-open' | 'error' | 'error-details' | 'retry-focus' | 'disabled-generate'

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = ([
  'empty',
  'depth-open',
  'error',
  'error-details',
  'retry-focus',
  'disabled-generate',
].includes(params.get('state') ?? '')
  ? params.get('state')
  : 'empty') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const labels: Record<ShotState, string> = {
  empty: 'empty state',
  'depth-open': 'depth menu',
  error: 'scan error',
  'error-details': 'scan error details',
  'retry-focus': 'retry focus',
  'disabled-generate': 'disabled Generate hint',
}

const failScan = state === 'error' || state === 'error-details' || state === 'retry-focus'
if (failScan) {
  const existing = window.__mockHandlers ?? {}
  window.__mockHandlers = {
    ...existing,
    call_rhizome_tool: (args: { name?: string }) => {
      if (args.name === 'rhizome_scan_library') {
        throw new Error('ENOENT: library root is missing')
      }
      const previous = existing.call_rhizome_tool
      return previous ? previous(args) : '[]'
    },
  }
}

export function Shot() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      [data-state="retry-focus"] [data-testid="research-library-scan-retry"]:focus {
        box-shadow: 0 0 0 2px var(--state-focus-ring) !important;
        border-color: var(--ring) !important;
      }
    `
    document.head.appendChild(style)
    if (state !== 'retry-focus') return () => style.remove()
    const id = window.setInterval(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="research-library-scan-retry"]')
      if (!button) return
      button.focus({ focusVisible: true })
      window.clearInterval(id)
    }, 50)
    return () => {
      window.clearInterval(id)
      style.remove()
    }
  }, [])

  return (
    <div
      data-testid="research-shot"
      data-theme={theme}
      data-state={state}
      className="flex min-h-screen items-start justify-center p-6"
      style={{ background: 'var(--surface-app)' }}
    >
      <div
        className="flex h-[720px] w-[960px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm"
      >
        <p className="shrink-0 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {theme === 'graphite' ? 'Graphite' : 'Earth light'}
          {' · '}
          {labels[state]}
        </p>
        <div className="flex min-h-0 flex-1 flex-col">
          <ResearchPanel
            open
            onClose={() => {}}
            vaultPath="/mock/vault"
            onOpenNote={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
