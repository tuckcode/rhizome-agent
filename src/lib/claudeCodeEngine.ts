import { useEffect, useState, useSyncExternalStore } from 'react'
import { callHost } from './callHost'
import { trackEvent } from './telemetry'

/**
 * ADR-0191: the optional Claude Code engine, as Settings and the picker see it.
 *
 * Rhizome asks `claude --version` and `claude auth status --json`. The host
 * keeps a yes or no and the method name. Sign-in runs `claude auth login`,
 * so Claude Code does the OAuth and Rhizome never holds a Claude token.
 */
export interface ClaudeCodeEngineStatus {
  installed: boolean
  version: string | null
  /** Null when Claude Code did not report a sign-in state Rhizome can read. */
  loggedIn: boolean | null
  authMethod: string | null
}

export type ClaudeCodeEngineState =
  | { kind: 'checking' }
  | { kind: 'ready'; status: ClaudeCodeEngineStatus }
  | { kind: 'missing' }
  | { kind: 'signed_out'; status: ClaudeCodeEngineStatus }

/** The Settings row, stated as what it does (ADR-0191 decision 4.4). */
export const CLAUDE_CODE_SWITCH_LABEL = 'Run chats with your installed Claude Code'
export const CLAUDE_CODE_LABEL = 'Claude Code'
export const CLAUDE_CODE_LOGIN_COMMAND = 'claude auth login'

/** Settings copy required by ADR-0191 decisions 4.4, 5 (known gap), 6.4 and 7. */
export const CLAUDE_CODE_SETTINGS_NOTES: readonly string[] = [
  'Claude Code is Anthropic\'s product. Anthropic does not make or endorse Rhizome.',
  'New chats can run on the claude command already installed on this computer, with the account it is signed in to. Rhizome never asks for or stores your Claude sign-in.',
  'Turns use your own Claude plan or key, and count toward its limits.',
  'Your own Claude Code settings and ~/.claude/CLAUDE.md still apply. An allow rule or hook in your Claude Code settings can let a tool run without asking in Rhizome.',
  'Rhizome\'s own work, such as titles, distill, inbox and jobs, never runs on Claude Code.',
]

export function claudeCodeEngineState(
  status: ClaudeCodeEngineStatus | null | undefined,
): ClaudeCodeEngineState {
  if (!status) return { kind: 'checking' }
  if (!status.installed) return { kind: 'missing' }
  if (status.loggedIn === false) return { kind: 'signed_out', status }
  return { kind: 'ready', status }
}

/** Ready means a chat can start. An unreadable sign-in state is left to Claude Code. */
export function isClaudeCodeEngineReady(state: ClaudeCodeEngineState): boolean {
  return state.kind === 'ready'
}

export function claudeCodeStatusLine(state: ClaudeCodeEngineState): string {
  switch (state.kind) {
    case 'checking':
      return 'Checking for Claude Code…'
    case 'missing':
      return 'Rhizome could not find or run Claude Code on this computer.'
    case 'signed_out':
      return `Claude Code is not signed in. Run ${CLAUDE_CODE_LOGIN_COMMAND} in your terminal, then check again.`
    case 'ready': {
      const version = state.status.version ? ` ${shortVersion(state.status.version)}` : ''
      if (state.status.loggedIn === null) {
        return `Claude Code${version} is installed. Rhizome could not read whether it is signed in.`
      }
      const method = state.status.authMethod ? ` with ${state.status.authMethod}` : ''
      return `Claude Code${version} is signed in${method}.`
    }
  }
}

function shortVersion(version: string): string {
  return version.replace(/\s*\(Claude Code\)\s*$/i, '').trim()
}

function normalizeStatus(raw: Partial<ClaudeCodeEngineStatus> | null | undefined): ClaudeCodeEngineStatus {
  return {
    installed: raw?.installed === true,
    version: typeof raw?.version === 'string' && raw.version.trim() ? raw.version.trim() : null,
    loggedIn: typeof raw?.loggedIn === 'boolean' ? raw.loggedIn : null,
    authMethod: typeof raw?.authMethod === 'string' && raw.authMethod.trim() ? raw.authMethod.trim() : null,
  }
}

/**
 * Runs the unmodified `claude auth login`. Claude Code opens Anthropic's
 * sign-in page in the browser and keeps the token itself. Resolves when
 * Claude Code exits. The caller then asks for the status again.
 */
export function startClaudeCodeLogin(): Promise<void> {
  return callHost<null>('start_claude_code_login').then(() => undefined)
}

let statusRequest: Promise<ClaudeCodeEngineStatus> | null = null

/** Cached for the session. `refresh` asks Claude Code again. */
export function loadClaudeCodeEngineStatus(refresh = false): Promise<ClaudeCodeEngineStatus> {
  if (refresh || !statusRequest) {
    statusRequest = callHost<Partial<ClaudeCodeEngineStatus>>('get_claude_code_engine_status')
      .then(normalizeStatus)
      .catch(() => normalizeStatus(null))
  }
  return statusRequest
}

/** Status for the UI. Only asks Claude Code while `active`. */
export function useClaudeCodeEngineState(active: boolean): {
  state: ClaudeCodeEngineState
  refresh: () => void
} {
  const [token, setToken] = useState(0)
  // A result counts only for the request that made it, so Check again shows checking.
  const [result, setResult] = useState<{ token: number; status: ClaudeCodeEngineStatus } | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void loadClaudeCodeEngineStatus(token > 0).then((status) => {
      if (!cancelled) setResult({ token, status })
    })
    return () => {
      cancelled = true
    }
  }, [active, token])
  return {
    state: claudeCodeEngineState(result?.token === token ? result.status : null),
    refresh: () => setToken((value) => value + 1),
  }
}

// The Settings switch, shared with every picker without threading props.
let enabled = false
const listeners = new Set<() => void>()

export function publishClaudeCodeEngineEnabled(next: boolean): void {
  if (enabled === next) return
  enabled = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useClaudeCodeEngineEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled, () => false)
}

/** No prompt, path, version or account detail. Only the switch position. */
export function trackClaudeCodeEngineToggled(next: boolean): void {
  trackEvent('claude_code_engine_toggled', { enabled: next ? 'on' : 'off' })
}

/** No prompt or path. The picker row was chosen for new chats. */
export function trackClaudeCodeEngineSelected(): void {
  trackEvent('claude_code_engine_selected', {})
}

/** Tests only: forget the cached status and the switch. */
export function resetClaudeCodeEngineForTests(): void {
  statusRequest = null
  enabled = false
  listeners.clear()
}
