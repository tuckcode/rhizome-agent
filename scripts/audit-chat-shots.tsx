import { CaretRight, Terminal } from '@phosphor-icons/react'
import { useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AiMessage } from '../src/components/AiMessage'
import { AiPanelMessageHistory } from '../src/components/AiPanelChrome'
import { PrimeSessionSubhead } from '../src/components/PrimeSessionSubhead'
import { TooltipProvider } from '../src/components/ui/tooltip'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './audit-chat-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotState =
  | 'approval-collapsed-before'
  | 'approval-collapsed'
  | 'approval-allow-focus'
  | 'topbar-native'
  | 'header-title'
  | 'empty-before'
  | 'empty'

const STATES: ShotState[] = [
  'approval-collapsed-before',
  'approval-collapsed',
  'approval-allow-focus',
  'topbar-native',
  'header-title',
  'empty-before',
  'empty',
]

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = (STATES.includes(params.get('state') as ShotState)
  ? params.get('state')
  : 'empty') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function themeLabel() {
  return theme === 'graphite' ? 'Graphite dark' : 'Earth light'
}

function pendingBash() {
  return {
    tool: 'bash',
    toolId: 'bash-1',
    label: 'bash',
    status: 'pending' as const,
    approval: {
      promptId: 'p1',
      options: OPTIONS,
      onReply: () => {},
    },
  }
}

function BeforeCollapsedApproval() {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-muted-foreground"
        style={{ fontSize: 12, padding: '4px 0' }}
        aria-expanded={false}
      >
        <Terminal size={14} />
        <span>Tool use</span>
        <span
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-full animate-pulse"
          style={{
            background: 'var(--state-hover)',
            color: 'var(--muted-foreground)',
            fontSize: 10,
            fontWeight: 600,
            padding: '0 5px',
          }}
        >
          1
        </span>
        <CaretRight size={12} />
      </button>
    </div>
  )
}

function BeforeEmptyState() {
  return (
    <div className="flex flex-col text-muted-foreground">
      <p style={{ fontSize: 13, margin: '0 0 4px' }}>Ask Prime</p>
      <p style={{ fontSize: 11, margin: 0 }}>
        Chat works without a note. Open one to give Prime something to work from.
      </p>
    </div>
  )
}

function ChatFrame({
  title,
  children,
  header,
}: {
  title: string
  children: ReactNode
  header?: ReactNode
}) {
  return (
    <div
      className="flex h-[640px] w-[720px] flex-col overflow-hidden rounded-xl border border-border shadow-sm"
      style={{ background: 'var(--surface-app)' }}
    >
      {header}
      <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {themeLabel()}
          {' · '}
          {title}
        </p>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}

export function Shot() {
  useEffect(() => {
    if (state !== 'approval-collapsed' && state !== 'approval-allow-focus') return
    document.querySelector<HTMLButtonElement>('[data-testid="tool-use-toggle"]')?.click()
    if (state !== 'approval-allow-focus') return
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="approval-allow_once"]')?.focus()
    })
  }, [])

  const nativeBar = (
    <PrimeSessionSubhead
      live={false}
      sessionTitle={state === 'header-title' ? 'Plan the launch' : null}
      onNewChat={() => {}}
      onOpenCommandPalette={() => {}}
    />
  )

  let body: ReactNode
  let title = 'Chat'
  let header: ReactNode = nativeBar

  if (state === 'approval-collapsed-before') {
    title = 'Pending approval, collapsed (before)'
    body = (
      <div>
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--state-selected)' }}>
          Run the tests
        </div>
        <BeforeCollapsedApproval />
      </div>
    )
  } else if (state === 'approval-collapsed' || state === 'approval-allow-focus') {
    title = state === 'approval-allow-focus'
      ? 'Pending approval, Allow focused'
      : 'Pending approval, collapsed (after)'
    body = (
      <AiMessage
        userMessage="Run the tests"
        actions={[pendingBash()]}
      />
    )
  } else if (state === 'topbar-native') {
    title = 'Native engine top bar'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        Rhizome native engine · header stays
      </div>
    )
  } else if (state === 'header-title') {
    title = 'Header after first message'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        First turn titled the session
      </div>
    )
  } else if (state === 'empty-before') {
    title = 'Empty state (before)'
    header = nativeBar
    body = <BeforeEmptyState />
  } else {
    title = 'Empty state (after)'
    body = (
      <AiPanelMessageHistory
        agentLabel="Rhizome"
        agentReadiness="ready"
        messages={[]}
        isActive={false}
        hasContext={false}
      />
    )
  }

  return (
    <TooltipProvider>
      <div
        data-testid="audit-chat-shot"
        data-theme={theme}
        data-state={state}
        className="flex min-h-screen items-start justify-center p-8"
        style={{ background: 'var(--surface-app)' }}
      >
        <ChatFrame title={title} header={header}>
          {body}
        </ChatFrame>
      </div>
    </TooltipProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
