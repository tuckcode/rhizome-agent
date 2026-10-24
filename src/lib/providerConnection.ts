export type ConnectionStatus = 'checking' | 'ready' | 'needs_key' | 'not_running' | 'load_failed'

export type ConnectionAction = 'add_key' | 'retry' | 'open' | 'install' | 'none'

export interface ConnectionProbe {
  unreachable?: boolean
  failed?: boolean
  /** Successful list. Null means the probe has not finished. */
  models?: string[] | null
}

export function connectionStatus(input: {
  needsKey: boolean
  local: boolean
  probe?: ConnectionProbe | null
}): ConnectionStatus {
  if (input.needsKey) return 'needs_key'
  const probe = input.probe
  if (!probe || probe.models === undefined) return 'checking'
  if (probe.unreachable && input.local) return 'not_running'
  if (probe.failed) return 'load_failed'
  if (!probe.models || probe.models.length === 0) return 'load_failed'
  return 'ready'
}

export function connectionStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking…'
    case 'ready':
      return 'Ready'
    case 'needs_key':
      return 'Needs a key'
    case 'not_running':
      return 'Not running'
    case 'load_failed':
      return "Couldn't load models"
  }
}

export function connectionAction(status: ConnectionStatus): ConnectionAction {
  if (status === 'checking') return 'none'
  if (status === 'needs_key') return 'add_key'
  if (status === 'ready') return 'open'
  return 'retry'
}

/** Installed agents are ready. A missing binary is not a model-list failure. */
export function agentConnectionStatus(installed: boolean): ConnectionStatus {
  return installed ? 'ready' : 'not_running'
}

export function providersNeedAttentionLabel(count: number): string {
  if (count === 1) return '1 provider needs attention'
  return `${count} providers need attention`
}

/** Strip a pasted secret if a host error echoes it. Never log the raw message with the key. */
export function connectionErrorMessage(error: unknown, secret: string): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : ''
  const trimmed = message.trim()
  if (!trimmed) return 'Could not connect.'
  if (secret && trimmed.includes(secret)) return 'Could not connect.'
  return trimmed
}
