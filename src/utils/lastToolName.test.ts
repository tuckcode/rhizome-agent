import { describe, expect, it } from 'vitest'
import { lastToolName } from './lastToolName'
import type { AiAction } from '../components/AiMessage'

function action(tool: string, status: AiAction['status'] = 'done'): AiAction {
  return { tool, toolId: tool, label: tool, status }
}

describe('lastToolName', () => {
  it('names the last action on the last message that has actions, even when that action is still pending', () => {
    expect(lastToolName([
      { actions: [action('search_notes')] },
      { actions: [action('get_note', 'pending')] },
    ])).toBe('get_note')
  })

  it('returns null when there are no messages', () => {
    expect(lastToolName([])).toBeNull()
  })

  it('returns null when messages have no actions', () => {
    expect(lastToolName([
      { actions: [] },
      { actions: [] },
    ])).toBeNull()
  })

  it('skips trailing messages that have no actions', () => {
    expect(lastToolName([
      { actions: [action('search_notes')] },
      { actions: [] },
    ])).toBe('search_notes')
  })
})
