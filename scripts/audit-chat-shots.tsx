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
  | 'approval-bash'
  | 'approval-allow-focus'
  | 'approval-two'
  | 'approval-edit'
  | 'approval-overflow'
  | 'topbar-native'
  | 'header-title'
  | 'header-long'
  | 'empty-before'
  | 'empty'

const STATES: ShotState[] = [
  'approval-collapsed-before',
  'approval-collapsed',
  'approval-bash',
  'approval-allow-focus',
  'approval-two',
  'approval-edit',
  'approval-overflow',
  'topbar-native',
  'header-title',
  'header-long',
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

function pendingAction(
  tool: string,
  extra: Record<string, unknown> = {},
  toolId = `${tool}-1`,
) {
  return {
    tool,
    toolId,
    label: tool,
    status: 'pending' as const,
    approval: {
      promptId: `${toolId}-prompt`,
      callId: toolId,
      options: OPTIONS,
      onReply: () => {},
      ...extra,
    },
  }
}

function pendingBash(args = 'pnpm test', toolId = 'bash-1') {
  return {
    ...pendingAction('bash', { args }, toolId),
    input: `{"command":${JSON.stringify(args)},"timeout_secs":30}`,
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
    if (
      state !== 'approval-collapsed'
      && state !== 'approval-allow-focus'
      && state !== 'approval-two'
      && state !== 'approval-edit'
      && state !== 'approval-overflow'
    ) return
    document.querySelector<HTMLButtonElement>('[data-testid="tool-use-toggle"]')?.click()
    if (state !== 'approval-allow-focus') return
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="approval-allow_once"]')?.focus()
    })
  }, [])

  const nativeBar = (
    <PrimeSessionSubhead
      live={false}
      showSessionStatus={false}
      sessionTitle={
        state === 'header-long'
          ? 'Plan the launch of a very long session title that should not fill the header'
          : state === 'header-title'
            ? 'Plan the launch'
            : null
      }
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
  } else if (state === 'approval-bash') {
    title = 'Pending bash approval, auto-expanded'
    body = (
      <AiMessage
        userMessage="Run the tests"
        actions={[pendingBash()]}
      />
    )
  } else if (state === 'approval-collapsed' || state === 'approval-allow-focus') {
    title = state === 'approval-allow-focus'
      ? 'Pending bash approval, Allow focused'
      : 'Pending bash approval, collapsed (after)'
    body = (
      <AiMessage
        userMessage="Run the tests"
        actions={[pendingBash()]}
      />
    )
  } else if (state === 'approval-two') {
    title = 'Two pending approvals, collapsed'
    body = (
      <AiMessage
        userMessage="Run two"
        actions={[pendingBash('echo SAFE', 'safe'), pendingBash('rm -rf ~/EVIL', 'evil')]}
      />
    )
  } else if (state === 'approval-edit') {
    title = 'Collapsed edit approval'
    body = (
      <AiMessage
        userMessage="Edit the plan"
        actions={[pendingAction('edit_file', { path: 'notes/plan.md', preview: '@@\n-a\n+b' })]}
      />
    )
  } else if (state === 'approval-overflow') {
    title = 'Collapsed overflowing command'
    body = (
      <AiMessage
        userMessage="Run a long command"
        actions={[pendingBash(`echo ${'A'.repeat(48)}`)]}
      />
    )
  } else if (state === 'topbar-native') {
    title = 'Native engine top bar'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        Rhizome native engine · header stays
      </div>
    )
  } else if (state === 'header-title' || state === 'header-long') {
    title = state === 'header-long'
      ? 'Long session title next to Command Palette'
      : 'Header after first message'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        {state === 'header-long' ? 'Title truncates beside Command Palette' : 'First turn titled the session'}
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
