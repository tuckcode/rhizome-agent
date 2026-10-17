export const BASH_RESULT_KIND = 'bash_result'
export const BASH_DEFAULT_TIMEOUT_SECS = 60
export const BASH_MAX_TIMEOUT_SECS = 300

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
  stdoutTruncated: boolean
  stderrTruncated: boolean
  stdoutLinesHidden?: number
  stderrLinesHidden?: number
}

export type BashRowVerb = 'Running' | 'Ran' | 'Denied' | 'Failed' | 'Superseded'

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
    stdoutTruncated: false,
    stderrTruncated: false,
  }
  if (!output) return unstructured

  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    return unstructured
  }
  if (!isRecord(parsed) || !isStructuredBashResult(parsed)) return unstructured

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
    stdoutTruncated,
    stderrTruncated,
    stdoutLinesHidden: numberOrZero(parsed.stdout_lines_hidden),
    stderrLinesHidden: numberOrZero(parsed.stderr_lines_hidden),
  }
}

export function bashResultRowStatus(
  actionStatus: 'pending' | 'done' | 'error',
  result: ParsedBashToolResult,
  options?: { denied?: boolean; superseded?: boolean },
): BashRowStatus {
  if (actionStatus === 'pending') return { verb: 'Running', verbDanger: false }
  if (options?.denied) return { verb: 'Denied', verbDanger: true }
  if (options?.superseded) return { verb: 'Superseded', verbDanger: false }
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

/**
 * Match the runner at f413535 (`timeout_from_args`): only a JSON whole
 * number that fits u64. Strings, floats, 0, negatives, booleans, and
 * missing values fall back to 60. Values over 300 clamp to 300.
 *
 * After JSON.parse, a `7.0` literal cannot be told apart from `7`.
 * Callers with the raw JSON text must reject frac/exp tokens first.
 */
export function bashTimeoutSecs(value?: unknown): number {
  const n = coerceTimeout(value)
  if (n === undefined || n <= 0) return BASH_DEFAULT_TIMEOUT_SECS
  return Math.min(n, BASH_MAX_TIMEOUT_SECS)
}

export function bashTimeoutLabel(timeoutSecs?: unknown): string {
  return `Stops after ${bashTimeoutSecs(timeoutSecs)} seconds.`
}

export function trimmedOutputNote(hiddenLines?: number): string {
  if (hiddenLines !== undefined && hiddenLines > 0) {
    return `${hiddenLines.toLocaleString('en-US')} lines hidden from the middle`
  }
  return 'Output trimmed (start and end shown)'
}

export function truncateCommand(command: string, max = DEFAULT_COMMAND_MAX): string {
  const collapsed = command.replace(/[ \n]+/gu, ' ').replace(/^ +| +$/gu, '')
  if (collapsed.length <= max) return collapsed
  return `${collapsed.slice(0, Math.max(0, max - 1))}…`
}

function isStructuredBashResult(record: Record<string, unknown>): boolean {
  if (record.kind !== BASH_RESULT_KIND) return false
  if (record.timed_out === true) return true
  if (record.stopped === true) return true
  return typeof record.exit_code === 'number' && Number.isFinite(record.exit_code)
}

function numberOrZero(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function coerceTimeout(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
