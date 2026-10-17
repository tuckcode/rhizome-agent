import { describe, expect, it } from 'vitest'
import { bashTimeoutLabel } from './bashToolResult'
import {
  approvalTitle,
  bashApprovalCommand,
  commandFromToolCallInput,
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

  it('matches an approval by call_id when the prompt has one', () => {
    const actions = [
      { tool: 'bash', toolId: 'call_old', status: 'pending' },
      { tool: 'bash', toolId: 'call_2', status: 'pending' },
    ]
    expect(matchPendingApprovalAction(actions, { tool: 'bash', callId: 'call_2' })?.toolId).toBe('call_2')
    expect(matchPendingApprovalAction(actions, { tool: 'bash', call_id: 'call_2' })?.toolId).toBe('call_2')
  })

  it('falls back to the last pending action of the same tool when call_id is absent', () => {
    const actions = [
      { tool: 'edit_file', toolId: 'call_edit', status: 'pending' },
      { tool: 'bash', toolId: 'call_old', status: 'pending' },
      { tool: 'bash', toolId: 'call_new', status: 'pending' },
    ]
    expect(matchPendingApprovalAction(actions, { tool: 'bash' })?.toolId).toBe('call_new')
    expect(matchPendingApprovalAction(actions, { tool: 'edit_file' })?.toolId).toBe('call_edit')
  })

  it('reads a JSON tool-call command without trimming it', () => {
    expect(commandFromToolCallInput('{"command":"  rg foo wiki/  ","timeout_secs":30}')).toBe('  rg foo wiki/  ')
    expect(timeoutSecsFromToolArgs('{"command":"  rg foo wiki/  ","timeout_secs":30}')).toBe(30)
    expect(timeoutSecsFromToolArgs('{"command":"ls"}')).toBeUndefined()
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":"7"}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":" 7 "}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":7.5}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":"7.5"}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":7.0}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":1e20}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":true}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":0}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":301}')).toBe(300)
    expect(timeoutSecsFromToolArgs('{"command":"ls","timeout_secs":500}')).toBe(300)
    expect(timeoutSecsFromToolArgs('{"command":"echo \\"timeout_secs\\": 7.0","timeout_secs":30}')).toBe(30)
    expect(timeoutSecsFromToolArgs('{"timeoutSecs":7}')).toBeUndefined()
    expect(bashTimeoutLabel(timeoutSecsFromToolArgs('{"timeoutSecs":7}'))).toBe('Stops after 60 seconds.')
    expect(timeoutSecsFromToolArgs('{"x":{"timeout_secs":7.5},"timeout_secs":30}')).toBe(30)
    expect(timeoutSecsFromToolArgs('{"timeout_secs":7,"timeout_secs":30}')).toBe(30)
    expect(timeoutSecsFromToolArgs('{"timeout_secs":30,"timeout_secs":7.5}')).toBe(60)
    expect(timeoutSecsFromToolArgs('{"timeout\\u005fsecs":12}')).toBe(12)
    expect(timeoutSecsFromToolArgs('{"timeout_secs":9007199254740992}')).toBe(300)
    expect(timeoutSecsFromToolArgs('{"timeout_secs":18446744073709551615}')).toBe(300)
    expect(timeoutSecsFromToolArgs('{"timeout_secs":18446744073709551616}')).toBe(60)
  })

  it('uses a raw ApprovalRequested command as-is, including surrounding whitespace', () => {
    expect(bashApprovalCommand('  ls notes  ')).toBe('  ls notes  ')
    expect(bashApprovalCommand('ls')).toBe('ls')
    expect(bashApprovalCommand('')).toBe('')
    expect(bashApprovalCommand()).toBeUndefined()
  })

  it('reads the command field from #202 JSON ApprovalRequested.args', () => {
    expect(bashApprovalCommand('{"command":"ls"}')).toBe('ls')
    expect(bashApprovalCommand('{"command":"  ls notes  ","timeout_secs":30}')).toBe('  ls notes  ')
    expect(bashApprovalCommand(
      '{"command":"echo hi","x":"$(touch /tmp/pwned)"}',
    )).toBe('echo hi')
  })

  it('detects a new-file preview', () => {
    expect(previewLooksCreated('--- /dev/null\n+++ notes/a.md\n+hello\n')).toBe(true)
    expect(previewLooksCreated('--- notes/a.md\n+++ notes/a.md\n-old\n+new\n')).toBe(false)
  })
})
