import { describe, expect, it } from 'vitest'
import { approvalTitle, pathFromToolArgs, previewLooksCreated } from './nativeToolApproval'

describe('native tool approval helpers', () => {
  it('reads the path from tool args', () => {
    expect(pathFromToolArgs('{"path":"notes/a.md","content":"x"}')).toBe('notes/a.md')
    expect(pathFromToolArgs('not-json')).toBeUndefined()
  })

  it('titles a new write as create', () => {
    expect(approvalTitle('write_file', true)).toBe('Create file')
    expect(approvalTitle('write_file', false)).toBe('Write file')
    expect(approvalTitle('edit_file', false)).toBe('Edit file')
  })

  it('detects a new-file preview', () => {
    expect(previewLooksCreated('--- /dev/null\n+++ notes/a.md\n+hello\n')).toBe(true)
    expect(previewLooksCreated('--- notes/a.md\n+++ notes/a.md\n-old\n+new\n')).toBe(false)
  })
})
