export interface BashToolResult {
  stdout: string
  stderr: string
  exitCode?: number
  timedOut: boolean
  cancelled: boolean
  truncated: boolean
}

const RESULT_KEYS = [
  'stdout',
  'stderr',
  'exit_code',
  'exitCode',
  'timed_out',
  'timedOut',
  'cancelled',
  'canceled',
  'stopped',
  'truncated',
  'stdout_truncated',
  'stderr_truncated',
  'output_truncated',
  'stdoutTruncated',
  'stderrTruncated',
  'outputTruncated',
  'truncated_stdout',
  'truncated_stderr',
] as const

const DEFAULT_COMMAND_MAX = 48

export function parseBashToolResult(output?: string): BashToolResult {
  const empty: BashToolResult = {
    stdout: '',
    stderr: '',
    timedOut: false,
    cancelled: false,
    truncated: false,
  }
  if (!output) return empty

  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    return { ...empty, stdout: output }
  }
  if (!isRecord(parsed) || !looksLikeResult(parsed)) {
    return { ...empty, stdout: output }
  }

  return {
    stdout: stringField(parsed, ['stdout']) ?? '',
    stderr: stringField(parsed, ['stderr']) ?? '',
    exitCode: numberField(parsed, ['exit_code', 'exitCode']),
    timedOut: booleanField(parsed, ['timed_out', 'timedOut']),
    cancelled: booleanField(parsed, ['cancelled', 'canceled', 'stopped']),
    truncated: truncationFlag(parsed),
  }
}

export function truncateCommand(command: string, max = DEFAULT_COMMAND_MAX): string {
  const single = command.replace(/\s+/gu, ' ').trim()
  if (single.length <= max) return single
  return `${single.slice(0, Math.max(0, max - 1))}…`
}

function looksLikeResult(record: Record<string, unknown>): boolean {
  return RESULT_KEYS.some((key) => key in record)
}

function truncationFlag(record: Record<string, unknown>): boolean {
  if (booleanField(record, [
    'truncated',
    'stdout_truncated',
    'stderr_truncated',
    'output_truncated',
    'stdoutTruncated',
    'stderrTruncated',
    'outputTruncated',
    'truncated_stdout',
    'truncated_stderr',
  ])) {
    return true
  }
  const truncated = record.truncated
  if (!isRecord(truncated)) return false
  return Boolean(truncated.stdout || truncated.stderr)
}

function stringField(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function numberField(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function booleanField(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => record[key] === true)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
