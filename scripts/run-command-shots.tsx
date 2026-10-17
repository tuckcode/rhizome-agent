import { createRoot } from 'react-dom/client'
import { BashResultCard } from '../src/components/BashResultCard'
import { ToolApprovalCard } from '../src/components/ToolApprovalCard'
import { BASH_RESULT_KIND } from '../src/lib/bashToolResult'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './run-command-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotState =
  | 'approval-short'
  | 'approval-long'
  | 'approval-multiline'
  | 'approval-focus'
  | 'result-ok'
  | 'result-expanded'
  | 'result-failed'
  | 'result-timed-out'
  | 'result-truncated'
  | 'result-focus'

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

const LONG_COMMAND = 'rg -n TODO wiki/ notes/ inbox/ journal/ archive/ projects/ --glob !node_modules --glob !archive --glob *.md | sort | head -n 50'

const MULTILINE_COMMAND = [
  'rg -n "TODO"',
  '  wiki/',
  '  notes/',
  '  --glob \'!archive/**\'',
].join('\n')

const STATES: ShotState[] = [
  'approval-short',
  'approval-long',
  'approval-multiline',
  'approval-focus',
  'result-ok',
  'result-expanded',
  'result-failed',
  'result-timed-out',
  'result-truncated',
  'result-focus',
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const requested = params.get('state') ?? ''
const state = (STATES.includes(requested as ShotState) ? requested : 'approval-short') as ShotState

document.documentElement.classList.toggle('dark', theme === 'graphite')
document.documentElement.dataset.theme = theme === 'graphite' ? 'dark' : 'light'
document.documentElement.removeAttribute('data-color-theme')
document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const LABELS: Record<ShotState, string> = {
  'approval-short': 'short command',
  'approval-long': 'long wrapping command',
  'approval-multiline': 'multi-line command',
  'approval-focus': 'Allow once focused',
  'result-ok': 'exit 0',
  'result-expanded': 'stdout and stderr',
  'result-failed': 'failed exit',
  'result-timed-out': 'timed out',
  'result-truncated': 'trimmed output',
  'result-focus': 'row toggle focused',
}

function bashOutput(over: Record<string, unknown>) {
  return JSON.stringify({
    kind: BASH_RESULT_KIND,
    timed_out: false,
    stopped: false,
    stdout: '',
    stderr: '',
    stdout_truncated: false,
    stderr_truncated: false,
    ...over,
  })
}

function ApprovalShot({ command, timeoutSecs }: { command: string; timeoutSecs?: number }) {
  return (
    <ToolApprovalCard
      tool="bash"
      command={command}
      timeoutSecs={timeoutSecs}
      options={OPTIONS}
      onReply={() => {}}
    />
  )
}

function ResultShot({
  command,
  expanded,
  output,
  status,
}: {
  command: string
  expanded: boolean
  output: string
  status: 'done' | 'error'
}) {
  return (
    <BashResultCard
      command={command}
      output={output}
      status={status}
      expanded={expanded}
      onToggle={() => {}}
    />
  )
}

function ShotBody() {
  if (state === 'approval-short' || state === 'approval-focus') {
    return <ApprovalShot command="ls notes" />
  }
  if (state === 'approval-long') {
    return <ApprovalShot command={LONG_COMMAND} timeoutSecs={30} />
  }
  if (state === 'approval-multiline') {
    return <ApprovalShot command={MULTILINE_COMMAND} timeoutSecs={30} />
  }
  if (state === 'result-ok' || state === 'result-focus') {
    return (
      <ResultShot
        command="ls notes"
        expanded={false}
        status="done"
        output={bashOutput({ stdout: 'plan.md\nweekly-review.md\n', exit_code: 0 })}
      />
    )
  }
  if (state === 'result-expanded') {
    return (
      <ResultShot
        command="pnpm test"
        expanded
        status="done"
        output={bashOutput({
          stdout: 'Test Files  5 passed (5)\n      Tests  86 passed (86)\n',
          stderr: 'warning: 2 tests skipped\n',
          exit_code: 0,
        })}
      />
    )
  }
  if (state === 'result-failed') {
    return (
      <ResultShot
        command="rg missing wiki/"
        expanded={false}
        status="error"
        output={bashOutput({ stdout: '', stderr: 'No files found\n', exit_code: 2 })}
      />
    )
  }
  if (state === 'result-timed-out') {
    return (
      <ResultShot
        command="sleep 120"
        expanded={false}
        status="error"
        output={bashOutput({ stdout: '', stderr: '', timed_out: true, exit_code: 124 })}
      />
    )
  }
  return (
    <ResultShot
      command="cat big.log"
      expanded
      status="done"
      output={bashOutput({
        stdout: 'start of log\nline 2\n…\nline 9998\nend of log\n',
        stderr: '',
        exit_code: 0,
        stdout_truncated: true,
        stdout_lines_hidden: 9994,
      })}
    />
  )
}

export function Shot() {
  return (
    <div
      data-testid="run-command-shot"
      data-theme={theme}
      data-state={state}
      className="flex min-h-screen items-start justify-center p-8"
      style={{ background: 'var(--surface-app)' }}
    >
      <div className="w-[440px] rounded-xl border border-border bg-background p-4 shadow-sm">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {theme === 'graphite' ? 'Graphite' : 'Earth light'}
          {' · '}
          {LABELS[state]}
        </p>
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--state-selected)' }}>
          Please run that in the vault.
        </div>
        <ShotBody />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Shot />)
