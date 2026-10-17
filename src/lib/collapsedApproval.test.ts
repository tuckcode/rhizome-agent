import { describe, expect, it } from 'vitest'
import {
  APPROVAL_ARIA_LABEL_MAX,
  COLLAPSED_COMMAND_VISIBLE_CHARS,
  approvalAriaLabel,
  collapsePathKeepFilename,
  collapsedApprovalOverflow,
  escapeApprovalLabel,
} from './collapsedApproval'

describe('collapsedApprovalOverflow', () => {
  it('keeps short literal commands on the collapsed row', () => {
    expect(collapsedApprovalOverflow('echo SAFE')).toEqual({
      review: false,
      long: false,
      hiddenChars: false,
      hasNewline: false,
      empty: false,
    })
  })

  it('asks for Review when the command is longer than the character budget', () => {
    const command = `echo ${'A'.repeat(COLLAPSED_COMMAND_VISIBLE_CHARS)}`
    const result = collapsedApprovalOverflow(command)
    expect(result.review).toBe(true)
    expect(result.long).toBe(true)
    expect(result.hiddenChars).toBe(false)
    expect(result.hasNewline).toBe(false)
  })

  it('asks for Review when hidden characters are present', () => {
    expect(collapsedApprovalOverflow('echo \u202Esecret')).toMatchObject({
      review: true,
      hiddenChars: true,
    })
  })

  it('asks for Review when the display is empty', () => {
    expect(collapsedApprovalOverflow('')).toMatchObject({
      review: true,
      empty: true,
    })
  })

  it('counts any newline as overflow so a second line cannot sit behind Allow', () => {
    expect(collapsedApprovalOverflow('ls\nrm -rf ~')).toMatchObject({
      review: true,
      hasNewline: true,
      long: false,
    })
  })
})

describe('escapeApprovalLabel', () => {
  it('escapes hidden and bidi characters the same way VisibleCommand does', () => {
    expect(escapeApprovalLabel('echo \u202Esecret')).toBe('echo \\u{202E}secret')
  })

  it('escapes newlines and caps the label at 80 graphemes', () => {
    const command = `echo ${'A'.repeat(120)}\nmore`
    const escaped = escapeApprovalLabel(command)
    expect(escaped).not.toMatch(/[\n\u202E\u202A-\u202D]/u)
    expect(escaped.startsWith('echo ')).toBe(true)
    expect(escaped.endsWith('…')).toBe(true)
    expect([...escaped].length).toBe(APPROVAL_ARIA_LABEL_MAX + 1)
  })
})

describe('approvalAriaLabel', () => {
  it('uses only the action when the display is empty', () => {
    expect(approvalAriaLabel('Review', '')).toBe('Review')
    expect(approvalAriaLabel('Allow once', '')).toBe('Allow once')
  })

  it('prefixes the escaped command', () => {
    expect(approvalAriaLabel('Deny', 'echo \u202Esecret')).toBe('Deny: echo \\u{202E}secret')
  })
})

describe('collapsePathKeepFilename', () => {
  it('keeps a short path intact', () => {
    expect(collapsePathKeepFilename('notes/plan.md')).toBe('notes/plan.md')
  })

  it('truncates from the start and keeps the filename', () => {
    const path = 'very/deep/nested/directory/structure/notes/plan.md'
    const collapsed = collapsePathKeepFilename(path)
    expect(collapsed.startsWith('…/')).toBe(true)
    expect(collapsed.endsWith('plan.md')).toBe(true)
    expect(collapsed).not.toBe(path)
  })
})
