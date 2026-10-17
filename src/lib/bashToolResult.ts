import { commandHasHiddenChars } from './visibleCommand'

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

export type BashRowVerb = 'Running' | 'Ran' | 'Denied' | 'Failed' | 'No result for'

export interface BashRowStatus {
  verb: BashRowVerb
  verbDanger: boolean
  extra?: {
    kind: 'exit' | 'timed-out' | 'stopped' | 'unknown'
    text: string
    danger: boolean
  }
}

export const DEFAULT_COMMAND_MAX = 48
const U64_MAX = 18446744073709551615n

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
  if (options?.superseded) return { verb: 'No result for', verbDanger: false }
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
 * Match the runner at c63e712 (`timeout_from_args` in shell.rs): only a
 * JSON whole number that `as_u64` accepts. Strings, floats, 7.0, 0,
 * negatives, booleans, and missing values fall back to 60. Values over
 * 300 clamp to 300. Integers from 2^53 through u64 max clamp to 300;
 * above u64 max stays 60. Decide from the raw digit token, not
 * Number.isSafeInteger.
 */
export function bashTimeoutSecs(value?: unknown): number {
  const n = coerceTimeout(value)
  if (n === undefined || n <= 0) return BASH_DEFAULT_TIMEOUT_SECS
  return Math.min(n, BASH_MAX_TIMEOUT_SECS)
}

/** Whole-number JSON token → seconds, matching serde_json `Number::as_u64`. */
export function bashTimeoutFromJsonLiteral(token: string): number {
  if (!/^(?:0|[1-9]\d*)$/u.test(token)) return BASH_DEFAULT_TIMEOUT_SECS
  const value = BigInt(token)
  if (value <= 0n || value > U64_MAX) return BASH_DEFAULT_TIMEOUT_SECS
  if (value > BigInt(BASH_MAX_TIMEOUT_SECS)) return BASH_MAX_TIMEOUT_SECS
  return Number(value)
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

export interface CutCommand {
  text: string
  truncated: boolean
  hiddenPastCut: boolean
}

export function truncateCommand(command: string, max = DEFAULT_COMMAND_MAX): string {
  return cutCommand(command, max).text
}

export function cutCommand(command: string, max = DEFAULT_COMMAND_MAX): CutCommand {
  const chars = [...command]
  if (chars.length <= max) {
    return { text: command, truncated: false, hiddenPastCut: false }
  }
  const kept = chars.slice(0, Math.max(0, max - 1))
  const rest = chars.slice(kept.length).join('')
  return {
    text: `${kept.join('')}…`,
    truncated: true,
    hiddenPastCut: commandHasHiddenChars(rest),
  }
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
