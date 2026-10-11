import { describe, expect, it } from 'vitest'
import {
  chatRunSnapshotFromMessages,
  nextChatRunAnnouncement,
  type ChatRunSnapshot,
} from './chatRunLiveStatus'

function snap(partial: Partial<ChatRunSnapshot> = {}): ChatRunSnapshot {
  return {
    isActive: false,
    hasResponse: false,
    tools: [],
    ...partial,
  }
}

describe('nextChatRunAnnouncement', () => {
  it('stays silent on the first snapshot so the region can mount empty', () => {
    expect(nextChatRunAnnouncement(null, snap({ isActive: true }))).toBeNull()
  })

  it('announces a newly started tool', () => {
    const previous = snap({ isActive: true })
    const next = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'get_note', status: 'pending' }],
    })
    expect(nextChatRunAnnouncement(previous, next)).toBe('Running get_note')
  })

  it('announces a finished tool', () => {
    const previous = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'get_note', status: 'pending' }],
    })
    const next = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'get_note', status: 'done' }],
    })
    expect(nextChatRunAnnouncement(previous, next)).toBe('get_note done')
  })

  it('announces a completed reply when the turn ends with a response', () => {
    const previous = snap({ isActive: true, hasResponse: true })
    const next = snap({ isActive: false, hasResponse: true })
    expect(nextChatRunAnnouncement(previous, next)).toBe('Response complete')
  })

  it('announces stopped when the turn ends without a response', () => {
    const previous = snap({ isActive: true })
    const next = snap({ isActive: false })
    expect(nextChatRunAnnouncement(previous, next)).toBe('Stopped')
  })

  it('announces a failed tool', () => {
    const previous = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'get_note', status: 'pending' }],
    })
    const next = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'get_note', status: 'error' }],
    })
    expect(nextChatRunAnnouncement(previous, next)).toBe('get_note failed')
  })
})

describe('chatRunSnapshotFromMessages', () => {
  it('reads tools and reply state from the latest turn', () => {
    const snapshot = chatRunSnapshotFromMessages(
      [
        {
          actions: [{ tool: 'get_note', toolId: 't1', status: 'done' }],
          response: 'found it',
        },
      ],
      true,
    )
    expect(snapshot).toEqual({
      isActive: true,
      hasResponse: true,
      tools: [{ id: 't1', name: 'get_note', status: 'done' }],
    })
  })

  it('ignores a previous turn when the latest message has no reply', () => {
    const snapshot = chatRunSnapshotFromMessages(
      [
        { response: 'old reply' },
        { response: '' },
      ],
      false,
    )
    expect(snapshot.hasResponse).toBe(false)
    expect(snapshot.tools).toEqual([])
  })

  it('announces Stopped when Stop lands before the latest turn has any text', () => {
    const messages = [
      { response: 'old reply' },
      { response: '' },
    ]
    const previous = chatRunSnapshotFromMessages(messages, true)
    const next = chatRunSnapshotFromMessages(messages, false)
    expect(nextChatRunAnnouncement(previous, next)).toBe('Stopped')
  })
})
