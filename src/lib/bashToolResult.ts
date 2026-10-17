export const BASH_RESULT_KIND = 'bash_result'
export const BASH_DEFAULT_TIMEOUT_SECS = 60

/**
 * JSON body from the native bash runner (`BashResult` in the shell PR).
 * Field names are the serde keys: kind, exit_code, timed_out, stopped,
 * stdout, stderr, stdout_truncated, stderr_truncated, and optional
 * stdout_lines_hidden / stderr_lines_hidden. exit_code is null on
 * timeout or cancel.
 */
export interface NativeBashToolResult {
  kind: typeof BASH_RESULT_KIND
  exit_code: number | null
  timed_out: boolean
  stopped: boolean
  stdout: string
  stderr: string
  stdout_truncated: boolean
  stderr_truncated: boolean
  stdout_lines_hidden?: number
  stderr_lines_hidden?: number
}

export interface ParsedBashToolResult {
  structured: boolean
  stdout: string
  stderr: string
  exitCode?: number
  timedOut: boolean
  stopped: boolean
  truncated: boolean
  hiddenLines?: number
}

export type BashRowVerb = 'Running' | 'Ran' | 'Denied' | 'Failed'

export interface BashRowStatus {
  verb: BashRowVerb
  verbDanger: boolean
  extra?: {
    kind: 'exit' | 'timed-out' | 'stopped' | 'unknown'
    text: string
    danger: boolean
  }
}

const DEFAULT_COMMAND_MAX = 48

export function parseBashToolResult(output?: string): ParsedBashToolResult {
  const unstructured: ParsedBashToolResult = {
    structured: false,
    stdout: output ?? '',
    stderr: '',
    timedOut: false,
    stopped: false,
    truncated: false,
  }
  if (!output) return unstructured

  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    return unstructured
  }
  if (!isRecord(parsed) || !isStructuredBashResult(parsed)) return unstructured

  const hidden = hiddenLineCount(parsed)
  const stdoutTruncated = parsed.stdout_truncated === true
  const stderrTruncated = parsed.stderr_truncated === true
  return {
    structured: true,
    stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
    stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
    exitCode: typeof parsed.exit_code === 'number' && Number.isFinite(parsed.exit_code)
      ? parsed.exit_code
      : undefined,
    timedOut: parsed.timed_out === true,
    stopped: parsed.stopped === true,
    truncated: stdoutTruncated || stderrTruncated,
    hiddenLines: hidden,
  }
}

export function bashResultRowStatus(
  actionStatus: 'pending' | 'done' | 'error',
  result: ParsedBashToolResult,
  output?: string,
): BashRowStatus {
  if (actionStatus === 'pending') return { verb: 'Running', verbDanger: false }
  if (result.structured) {
    if (result.timedOut) {
      return {
        verb: 'Ran',
        verbDanger: false,
        extra: { kind: 'timed-out', text: 'timed out', danger: true },
      }
    }
    if (result.stopped) {
      return {
        verb: 'Ran',
        verbDanger: false,
        extra: { kind: 'stopped', text: 'stopped', danger: false },
      }
    }
    if (result.exitCode !== undefined) {
      return {
        verb: 'Ran',
        verbDanger: false,
        extra: {
          kind: 'exit',
          text: `exit ${result.exitCode}`,
          danger: result.exitCode !== 0,
        },
      }
    }
    return {
      verb: 'Ran',
      verbDanger: false,
      extra: { kind: 'unknown', text: 'status unknown', danger: false },
    }
  }
  if (actionStatus === 'error') {
    if (isDeniedOutput(output)) return { verb: 'Denied', verbDanger: true }
    return {
      verb: 'Failed',
      verbDanger: true,
      extra: { kind: 'unknown', text: 'status unknown', danger: false },
    }
  }
  return {
    verb: 'Ran',
    verbDanger: false,
    extra: { kind: 'unknown', text: 'status unknown', danger: false },
  }
}

export function bashTimeoutLabel(timeoutSecs?: number): string {
  const secs = timeoutSecs ?? BASH_DEFAULT_TIMEOUT_SECS
  return `Stops after ${secs} seconds.`
}

export function trimmedOutputNote(hiddenLines?: number): string {
  if (hiddenLines !== undefined && hiddenLines > 0) {
    return `Output trimmed, ${hiddenLines.toLocaleString('en-US')} lines hidden (start and end shown)`
  }
  return 'Output trimmed (start and end shown)'
}

export function truncateCommand(command: string, max = DEFAULT_COMMAND_MAX): string {
  const single = command.replace(/\s+/gu, ' ').trim()
  if (single.length <= max) return single
  return `${single.slice(0, Math.max(0, max - 1))}…`
}

function isStructuredBashResult(record: Record<string, unknown>): boolean {
  if (record.kind !== BASH_RESULT_KIND) return false
  if (record.timed_out === true) return true
  if (record.stopped === true) return true
  return typeof record.exit_code === 'number' && Number.isFinite(record.exit_code)
}

function hiddenLineCount(record: Record<string, unknown>): number | undefined {
  const stdout = numberOrZero(record.stdout_lines_hidden)
  const stderr = numberOrZero(record.stderr_lines_hidden)
  if (stdout === undefined && stderr === undefined) return undefined
  return (stdout ?? 0) + (stderr ?? 0)
}

function numberOrZero(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function isDeniedOutput(output?: string): boolean {
  const trimmed = output?.trim().toLowerCase()
  return trimmed === 'denied' || trimmed === 'approval cancelled'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
