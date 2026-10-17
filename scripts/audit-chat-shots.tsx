import { CaretRight, Terminal } from '@phosphor-icons/react'
import { useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AiMessage } from '../src/components/AiMessage'
import { AiPanelMessageHistory } from '../src/components/AiPanelChrome'
import { CHAT_TOP_BAR_BAND_CLASS, PrimeSessionSubhead } from '../src/components/PrimeSessionSubhead'
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
  | 'approval-empty'
  | 'approval-newline'
  | 'approval-write'
  | 'approval-bidi-path'
  | 'topbar-loading'
  | 'topbar-native'
  | 'header-title'
  | 'header-long'
  | 'header-long-hover'
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
  'approval-empty',
  'approval-newline',
  'approval-write',
  'approval-bidi-path',
  'topbar-loading',
  'topbar-native',
  'header-title',
  'header-long',
  'header-long-hover',
  'empty-before',
  'empty',
]

const LONG_HEADER_TITLE = [
  'Plan the launch of a very long session title that should not fill the header',
  'beside Command Palette and must keep going until this bar clips it with an ellipsis',
].join(' ')

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
      && state !== 'approval-empty'
      && state !== 'approval-newline'
      && state !== 'approval-write'
      && state !== 'approval-bidi-path'
    ) return
    document.querySelector<HTMLButtonElement>('[data-testid="tool-use-toggle"]')?.click()
    if (state !== 'approval-allow-focus') return
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="approval-allow_once"]')?.focus()
    })
  }, [])

  useEffect(() => {
    if (state !== 'topbar-loading') return
    const placeholder = document.querySelector<HTMLElement>('[data-testid="topbar-before"] [data-chat-top-bar="placeholder"]')
    const ready = document.querySelector<HTMLElement>('[data-testid="topbar-after"] [data-chat-top-bar="ready"]')
    const narrow = document.querySelector<HTMLElement>('[data-testid="topbar-narrow"] [data-chat-top-bar="ready"]')
    const placeholderHeight = placeholder?.getBoundingClientRect().height ?? Number.NaN
    const readyHeight = ready?.getBoundingClientRect().height ?? Number.NaN
    const narrowHeight = narrow?.getBoundingClientRect().height ?? Number.NaN
    console.log(`placeholder height: ${placeholderHeight}`)
    console.log(`ready height: ${readyHeight}`)
    console.log(`narrow height: ${narrowHeight}`)
    if (Math.abs(placeholderHeight - readyHeight) > 0.5) {
      throw new Error(`top bar heights differ: placeholder ${placeholderHeight} vs ready ${readyHeight}`)
    }
    if (Math.abs(readyHeight - narrowHeight) > 0.5) {
      throw new Error(`narrow top bar height differs: ${narrowHeight} vs ready ${readyHeight}`)
    }
    if (ready && ready.scrollHeight > ready.clientHeight + 0.5) {
      throw new Error(`ready bar clipped: scroll ${ready.scrollHeight} client ${ready.clientHeight}`)
    }
    if (narrow && narrow.scrollHeight > narrow.clientHeight + 0.5) {
      throw new Error(`narrow bar clipped: scroll ${narrow.scrollHeight} client ${narrow.clientHeight}`)
    }
    const root = document.querySelector('[data-testid="audit-chat-shot"]')
    root?.setAttribute('data-placeholder-height', String(placeholderHeight))
    root?.setAttribute('data-ready-height', String(readyHeight))
    const caption = document.querySelector('[data-testid="topbar-height-caption"]')
    if (caption) {
      caption.textContent = `Same height · ${placeholderHeight.toFixed(1)}px / ${readyHeight.toFixed(1)}px`
    }
  }, [])

  const nativeBar = (
    <PrimeSessionSubhead
      live={false}
      showSessionStatus={false}
      sessionTitle={
        state === 'header-long' || state === 'header-long-hover'
          ? LONG_HEADER_TITLE
          : state === 'header-title'
            ? 'Plan the launch'
            : null
      }
      onNewChat={() => {}}
      onOpenCommandPalette={() => {}}
    />
  )

  const loadingBar = (
    <div
      aria-hidden="true"
      className={CHAT_TOP_BAR_BAND_CLASS}
      data-chat-top-bar="placeholder"
      data-testid="chat-top-bar"
    >
      <span className="h-[13px] w-24 max-w-[40%] rounded-sm bg-muted-foreground/20" />
    </div>
  )

  let body: ReactNode
  let title = 'Chat'
  let header: ReactNode = state === 'header-long-hover' ? (
    <div className="relative">
      {nativeBar}
      <div
        className="absolute left-3 top-[34px] z-10 max-w-[28rem] rounded-md border border-border bg-popover px-2 py-1.5 text-[12px] leading-snug text-popover-foreground shadow-md"
        data-testid="header-title-tooltip"
      >
        {LONG_HEADER_TITLE}
      </div>
    </div>
  ) : state === 'topbar-loading' ? loadingBar : nativeBar

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
  } else if (state === 'approval-empty') {
    title = 'Collapsed empty bash approval'
    body = (
      <AiMessage
        userMessage="Run a command"
        actions={[pendingAction('bash', { args: '' })]}
      />
    )
  } else if (state === 'approval-newline') {
    title = 'Collapsed command with a newline'
    body = (
      <AiMessage
        userMessage="Run two lines"
        actions={[pendingBash('ls\nrm -rf ~')]}
      />
    )
  } else if (state === 'approval-write') {
    title = 'Collapsed write approval'
    body = (
      <AiMessage
        userMessage="Write the note"
        actions={[pendingAction('write_file', { path: 'notes/fresh.md' })]}
      />
    )
  } else if (state === 'approval-bidi-path') {
    title = 'Collapsed edit path with a hidden character'
    body = (
      <AiMessage
        userMessage="Edit the invoice"
        actions={[pendingAction('edit_file', {
          path: 'notes/invoice\u202Edm.exe',
          preview: '@@\n-a\n+b',
        })]}
      />
    )
  } else if (state === 'topbar-native') {
    title = 'Native engine top bar'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        Rhizome native engine · header stays
      </div>
    )
  } else if (state === 'header-title' || state === 'header-long' || state === 'header-long-hover') {
    title = state === 'header-title'
      ? 'Header after first message'
      : state === 'header-long-hover'
        ? 'Long session title, hover shows the full title'
        : 'Long session title next to Command Palette'
    body = (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        {state === 'header-title'
          ? 'First turn titled the session'
          : 'Title truncates beside Command Palette'}
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

  if (state === 'topbar-loading') {
    const pane = (label: string, bar: ReactNode, caption: string, testId: string, captionTestId?: string) => (
      <div
        className="overflow-hidden rounded-xl border border-border shadow-sm"
        data-testid={testId}
        style={{ background: 'var(--surface-app)' }}
      >
        {bar}
        <div className="px-3 py-2">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {themeLabel()}
            {' · '}
            {label}
          </p>
          <div
            className="flex h-36 items-center justify-center text-[13px] text-muted-foreground"
            data-testid={captionTestId}
          >
            {caption}
          </div>
        </div>
      </div>
    )
    return (
      <TooltipProvider>
        <div
          data-testid="audit-chat-shot"
          data-theme={theme}
          data-state={state}
          className="relative flex min-h-screen items-start justify-center p-8"
          style={{ background: 'var(--surface-app)' }}
        >
          <div
            className="pointer-events-none absolute left-[-999px] w-[280px]"
            data-testid="topbar-narrow"
            aria-hidden="true"
          >
            <PrimeSessionSubhead
              live={false}
              showSessionStatus={false}
              sessionTitle={LONG_HEADER_TITLE}
              onNewChat={() => {}}
              onOpenCommandPalette={() => {}}
            />
          </div>
          <div className="flex w-[720px] flex-col gap-6" data-testid="topbar-frames">
            {pane('Before settle', loadingBar, 'Settings still loading · New chat hidden', 'topbar-before')}
            {pane('After settle', nativeBar, 'Same height · measuring', 'topbar-after', 'topbar-height-caption')}
          </div>
        </div>
      </TooltipProvider>
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
