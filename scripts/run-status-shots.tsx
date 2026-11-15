import { createRoot } from 'react-dom/client'
import { PaperPlaneRight, Plus, Stop } from '@phosphor-icons/react'
import { AiMessage } from '../src/components/AiMessage'
import { ChatRunStatusLine } from '../src/components/ChatRunStatusLine'
import { chatRunFailure } from '../src/lib/chatRunStatus'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './run-status-shots.css'

type ShotState = 'idle' | 'thinking' | 'writing' | 'tool' | 'approval' | 'quiet' | 'capped' | 'failed' | 'signin'

const STATES: ShotState[] = ['idle', 'thinking', 'writing', 'tool', 'approval', 'quiet', 'capped', 'failed', 'signin']

const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') === 'earth' ? 'earth' : 'graphite'
const requested = params.get('state') ?? ''
const state = (STATES.includes(requested as ShotState) ? requested : 'thinking') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const TITLES: Record<ShotState, string> = {
  idle: 'Idle. The row keeps its height.',
  thinking: 'Run starts',
  writing: 'Reply text arrives',
  tool: 'A tool runs (7 seconds)',
  approval: 'The run waits for the user',
  quiet: 'No event for 31 seconds',
  capped: 'Paused at the step limit',
  failed: 'The worker did not start',
  signin: 'The ChatGPT sign-in expired',
}

const FAILURES: Partial<Record<ShotState, ReturnType<typeof chatRunFailure>>> = {
  failed: chatRunFailure('The Prime worker exited before it started: rhizome-worker not found.'),
  signin: chatRunFailure('Error: Sign in again', { chatgptTarget: true }),
}

const pendingTool = { tool: 'bash', toolId: 't1', label: 'bash', status: 'pending' as const, input: '{"command":"pnpm test"}' }

function messagesFor(shot: ShotState) {
  if (shot === 'idle') return [{ userMessage: 'Run the tests', actions: [], response: 'All 61 tests pass.' }]
  if (shot === 'thinking') return [{ userMessage: 'Run the tests', actions: [], response: '' }]
  if (shot === 'writing' || shot === 'quiet') {
    return [{ userMessage: 'Run the tests', actions: [], response: 'I will run the test suite and report each failure.' }]
  }
  if (shot === 'tool') return [{ userMessage: 'Run the tests', actions: [pendingTool], response: '' }]
  if (shot === 'approval') {
    return [{
      userMessage: 'Run the tests',
      actions: [{
        ...pendingTool,
        approval: {
          promptId: 'p1',
          args: 'pnpm test',
          options: [{ id: 'allow_once', label: 'Allow once' }, { id: 'deny', label: 'Deny' }],
        },
      }],
      response: '',
    }]
  }
  if (shot === 'capped') {
    return [{ userMessage: 'Refactor the module', actions: [], response: 'I reached the step limit.', capped: { steps: 50, max_steps: 50 } }]
  }
  return []
}

export function Shot() {
  const messages = messagesFor(state)
  const isActive = ['thinking', 'writing', 'tool', 'approval', 'quiet'].includes(state)
  return (
    <div className="p-6" data-testid="run-status-shot">
      <div
        className="flex h-[420px] w-[720px] flex-col overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ background: 'var(--surface-app)' }}
      >
        <p className="px-3 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {theme === 'graphite' ? 'Graphite dark' : 'Earth light'}
          {' · '}
          {TITLES[state]}
        </p>
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
          {messages.map((message, index) => (
            <AiMessage key={index} {...message} isStreaming={isActive && !message.response} />
          ))}
        </div>
        <div className="flex shrink-0 flex-col" style={{ padding: '6px 10px' }}>
          <ChatRunStatusLine
            messages={messages}
            isActive={isActive}
            failure={FAILURES[state] ?? null}
            onStop={() => {}}
            onContinue={() => {}}
            onSignIn={() => {}}
            onRetry={() => {}}
          />
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Plus size={16} className="text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">Ask Rhizome</span>
            {isActive
              ? <Stop size={16} weight="fill" className="text-foreground" />
              : <PaperPlaneRight size={16} className="text-muted-foreground" />}
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
