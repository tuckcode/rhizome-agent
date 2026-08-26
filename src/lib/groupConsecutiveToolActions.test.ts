import { describe, expect, it } from 'vitest'
import type { AiAction } from '../components/AiMessage'
import { groupConsecutiveToolActions } from './groupConsecutiveToolActions'

function action(tool: string, toolId: string, label = tool): AiAction {
  return { tool, toolId, label, status: 'done' }
}

describe('groupConsecutiveToolActions', () => {
  it('leaves mixed tools as separate rows', () => {
    const grouped = groupConsecutiveToolActions([
      action('get_note', 'a'),
      action('bash', 'b'),
    ])
    expect(grouped).toHaveLength(2)
  })

  it('collapses a run of the same tool into one counted row', () => {
    const grouped = groupConsecutiveToolActions([
      action('ipython', 'a'),
      action('ipython', 'b'),
      action('ipython', 'c'),
      action('ipython', 'd'),
      action('ipython', 'e'),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].label).toBe('ipython ×5')
  })

  it('keeps separate runs when another tool sits between them', () => {
    const grouped = groupConsecutiveToolActions([
      action('bash', 'a', 'rg foo'),
      action('get_note', 'b'),
      action('bash', 'c', 'rg bar'),
    ])
    expect(grouped.map((row) => row.label)).toEqual(['rg foo', 'get_note', 'rg bar'])
  })
})
