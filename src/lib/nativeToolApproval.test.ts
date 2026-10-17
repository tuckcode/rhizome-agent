import { describe, expect, it } from 'vitest'
import {
  approvalTitle,
  commandFromToolArgs,
  isBashTool,
  matchPendingApprovalAction,
  pathFromToolArgs,
  previewLooksCreated,
  timeoutSecsFromToolArgs,
} from './nativeToolApproval'

describe('native tool approval helpers', () => {
  it('reads the path from tool args', () => {
    expect(pathFromToolArgs('{"path":"notes/a.md","content":"x"}')).toBe('notes/a.md')
    expect(pathFromToolArgs('not-json')).toBeUndefined()
  })

  it('titles a new write as create', () => {
    expect(approvalTitle('write_file', true)).toBe('Create file')
    expect(approvalTitle('write_file', false)).toBe('Write file')
    expect(approvalTitle('edit_file', false)).toBe('Edit file')
    expect(approvalTitle('bash', false)).toBe('Run command')
    expect(approvalTitle('Bash', false)).toBe('Bash')
  })

  it('matches only the native lowercase bash tool', () => {
    expect(isBashTool('bash')).toBe(true)
    expect(isBashTool('Bash')).toBe(false)
    expect(isBashTool('bash_like')).toBe(false)
  })

  it('matches an approval by call id when the prompt has one', () => {
    const actions = [
      { tool: 'bash', toolId: 'call_old', status: 'pending' },
      { tool: 'bash', toolId: 'call_2', status: 'pending' },
    ]
    expect(matchPendingApprovalAction(actions, { tool: 'bash', callId: 'call_2' })?.toolId).toBe('call_2')
    expect(matchPendingApprovalAction(actions, { tool: 'bash' })?.toolId).toBe('call_2')
  })

  it('reads the command and timeout from bash args', () => {
    expect(commandFromToolArgs('{"command":"rg foo wiki/","timeout_secs":30}')).toBe('rg foo wiki/')
    expect(timeoutSecsFromToolArgs('{"command":"rg foo wiki/","timeout_secs":30}')).toBe(30)
    expect(timeoutSecsFromToolArgs('{"command":"ls"}')).toBeUndefined()
    expect(commandFromToolArgs('ls')).toBe('ls')
    expect(commandFromToolArgs('not-json')).toBe('not-json')
    expect(commandFromToolArgs('')).toBeUndefined()
  })

  it('detects a new-file preview', () => {
    expect(previewLooksCreated('--- /dev/null\n+++ notes/a.md\n+hello\n')).toBe(true)
    expect(previewLooksCreated('--- notes/a.md\n+++ notes/a.md\n-old\n+new\n')).toBe(false)
  })
})
