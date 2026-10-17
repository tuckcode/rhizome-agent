import { describe, expect, it } from 'vitest'
import {
  BASH_DEFAULT_TIMEOUT_SECS,
  BASH_RESULT_KIND,
  bashResultRowStatus,
  bashTimeoutLabel,
  parseBashToolResult,
  trimmedOutputNote,
  truncateCommand,
} from './bashToolResult'

function result(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    kind: BASH_RESULT_KIND,
    exit_code: 0,
    timed_out: false,
    stopped: false,
    stdout: 'hello\n',
    stderr: 'warn\n',
    stdout_truncated: false,
    stderr_truncated: false,
    ...over,
  })
}

describe('parseBashToolResult', () => {
  it('reads a kind=bash_result body', () => {
    const parsed = parseBashToolResult(result())
    expect(parsed.structured).toBe(true)
    expect(parsed.stdout).toBe('hello\n')
    expect(parsed.stderr).toBe('warn\n')
    expect(parsed.exitCode).toBe(0)
    expect(parsed.timedOut).toBe(false)
    expect(parsed.stopped).toBe(false)
    expect(parsed.truncated).toBe(false)
  })

  it('treats the stub echo of args with a fake stdout/exit_code as unstructured', () => {
    const raw = JSON.stringify({
      command: 'npm test',
      stdout: 'All tests passed',
      exit_code: 0,
    })
    const parsed = parseBashToolResult(raw)
    expect(parsed.structured).toBe(false)
    expect(parsed.stdout).toBe(raw)
    expect(parsed.exitCode).toBeUndefined()
    expect(bashResultRowStatus('done', parsed, raw).extra?.text).toBe('status unknown')
  })

  it('uses a plain string as stdout when the result is not JSON', () => {
    expect(parseBashToolResult('ls').stdout).toBe('ls')
    expect(parseBashToolResult('ls').structured).toBe(false)
    expect(parseBashToolResult(undefined).stdout).toBe('')
  })
})

describe('bashResultRowStatus', () => {
  it('uses Denied and Failed instead of Ran', () => {
    const empty = parseBashToolResult('denied')
    expect(bashResultRowStatus('error', empty, 'denied')).toEqual({
      verb: 'Denied',
      verbDanger: true,
    })
    expect(bashResultRowStatus('error', parseBashToolResult('boom'), 'boom')).toMatchObject({
      verb: 'Failed',
      verbDanger: true,
      extra: { kind: 'unknown', text: 'status unknown' },
    })
  })

  it('prefers timed out and stopped over an exit code', () => {
    const timed = parseBashToolResult(result({ timed_out: true, exit_code: 124 }))
    expect(bashResultRowStatus('error', timed).extra).toMatchObject({
      kind: 'timed-out',
      text: 'timed out',
      danger: true,
    })
    const stopped = parseBashToolResult(result({ stopped: true, exit_code: null }))
    expect(bashResultRowStatus('error', stopped).extra).toMatchObject({
      kind: 'stopped',
      text: 'stopped',
      danger: false,
    })
  })

  it('reads the runner timeout and cancel bodies with a null exit_code', () => {
    const timed = parseBashToolResult(result({ timed_out: true, exit_code: null }))
    expect(timed.structured).toBe(true)
    expect(timed.timedOut).toBe(true)
    expect(timed.exitCode).toBeUndefined()
    expect(bashResultRowStatus('done', timed).extra).toMatchObject({
      kind: 'timed-out',
      text: 'timed out',
      danger: true,
    })
    const stopped = parseBashToolResult(result({ stopped: true, exit_code: null }))
    expect(stopped.structured).toBe(true)
    expect(stopped.stopped).toBe(true)
    expect(bashResultRowStatus('done', stopped).extra).toMatchObject({
      kind: 'stopped',
      text: 'stopped',
      danger: false,
    })
  })
})

describe('timeout and trim copy', () => {
  it('names the 60 second default', () => {
    expect(BASH_DEFAULT_TIMEOUT_SECS).toBe(60)
    expect(bashTimeoutLabel()).toBe('Stops after 60 seconds.')
    expect(bashTimeoutLabel(30)).toBe('Stops after 30 seconds.')
  })

  it('includes hidden line counts when known', () => {
    expect(trimmedOutputNote(9994)).toBe(
      'Output trimmed, 9,994 lines hidden (start and end shown)',
    )
    expect(trimmedOutputNote()).toBe('Output trimmed (start and end shown)')
  })
})

describe('truncateCommand', () => {
  it('collapses whitespace and keeps a short command', () => {
    expect(truncateCommand('rg foo\n  wiki/')).toBe('rg foo wiki/')
  })

  it('clips a long command with an ellipsis', () => {
    const long = 'a'.repeat(80)
    expect(truncateCommand(long, 12)).toBe(`${'a'.repeat(11)}…`)
  })
})
