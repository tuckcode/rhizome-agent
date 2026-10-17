import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_COMMAND_VISIBLE_CHARS,
  collapsedApprovalOverflow,
} from './collapsedApproval'

describe('collapsedApprovalOverflow', () => {
  it('keeps short literal commands on the collapsed row', () => {
    expect(collapsedApprovalOverflow('echo SAFE')).toEqual({
      review: false,
      moreChars: 0,
      hiddenChars: false,
    })
  })

  it('asks for Review when the command is longer than the character budget', () => {
    const command = `echo ${'A'.repeat(COLLAPSED_COMMAND_VISIBLE_CHARS)}`
    const result = collapsedApprovalOverflow(command)
    expect(result.review).toBe(true)
    expect(result.moreChars).toBe(command.length - COLLAPSED_COMMAND_VISIBLE_CHARS)
    expect(result.hiddenChars).toBe(false)
  })

  it('asks for Review when hidden characters are present', () => {
    expect(collapsedApprovalOverflow('echo \u202Esecret')).toMatchObject({
      review: true,
      hiddenChars: true,
    })
  })
})
