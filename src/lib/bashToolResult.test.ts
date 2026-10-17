import { describe, expect, it } from 'vitest'
import { parseBashToolResult, truncateCommand } from './bashToolResult'

describe('parseBashToolResult', () => {
  it('reads stdout, stderr, and exit code from JSON', () => {
    const parsed = parseBashToolResult(JSON.stringify({
      stdout: 'hello\n',
      stderr: 'warn\n',
      exit_code: 0,
    }))
    expect(parsed.stdout).toBe('hello\n')
    expect(parsed.stderr).toBe('warn\n')
    expect(parsed.exitCode).toBe(0)
    expect(parsed.timedOut).toBe(false)
    expect(parsed.cancelled).toBe(false)
    expect(parsed.truncated).toBe(false)
  })

  it('accepts camelCase and missing fields', () => {
    const parsed = parseBashToolResult(JSON.stringify({
      stdout: 'ok',
      exitCode: 2,
      timedOut: true,
      canceled: true,
      stdoutTruncated: true,
    }))
    expect(parsed.exitCode).toBe(2)
    expect(parsed.timedOut).toBe(true)
    expect(parsed.cancelled).toBe(true)
    expect(parsed.truncated).toBe(true)
    expect(parsed.stderr).toBe('')
  })

  it('treats the current stub echo of args as unstructured output', () => {
    const raw = '{"command":"ls -la","timeout_secs":20}'
    const parsed = parseBashToolResult(raw)
    expect(parsed.stdout).toBe(raw)
    expect(parsed.exitCode).toBeUndefined()
    expect(parsed.timedOut).toBe(false)
    expect(parsed.truncated).toBe(false)
  })

  it('uses a plain string as stdout when the result is not JSON', () => {
    expect(parseBashToolResult('ls').stdout).toBe('ls')
    expect(parseBashToolResult(undefined).stdout).toBe('')
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
