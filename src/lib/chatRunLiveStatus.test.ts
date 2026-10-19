import { describe, expect, it } from 'vitest'
import {
  chatRunSnapshotFromMessages,
  joinChatRunLines,
  nextChatRunAnnouncement,
  type ChatRunSnapshot,
} from './chatRunLiveStatus'

const LOG_SAVE_NOTICE =
  "This part of the chat couldn't be saved, so it won't be there after a restart."

function snap(partial: Partial<ChatRunSnapshot> = {}): ChatRunSnapshot {
  return {
    isActive: false,
    hasResponse: false,
    tools: [],
    ...partial,
  }
}

describe('nextChatRunAnnouncement', () => {
  it('announces a capped turn as paused rather than complete', () => {
    const next = chatRunSnapshotFromMessages([{ response: 'Partial', capped: { steps: 10, max_steps: 10 } }], false)
    expect(nextChatRunAnnouncement(snap({ isActive: true }), next)).toBe('Paused at step limit. Continue available.')
  })
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

  it('announces a mutate tool that needs approval', () => {
    const previous = snap({ isActive: true })
    const next = snap({
      isActive: true,
      tools: [{ id: 't1', name: 'edit_file', status: 'pending', needsApproval: true }],
    })
    expect(nextChatRunAnnouncement(previous, next)).toBe('Needs approval for edit_file')
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
      tools: [{ id: 't1', name: 'get_note', status: 'done', needsApproval: false }],
      notice: undefined,
      noticeId: undefined,
    })
  })

  it('announces a new warning notice without treating the marker as the turn', () => {
    const previous = chatRunSnapshotFromMessages(
      [{ actions: [{ tool: 'get_note', toolId: 't1', status: 'done' }], response: 'found it' }],
      true,
    )
    const next = chatRunSnapshotFromMessages(
      [
        { actions: [{ tool: 'get_note', toolId: 't1', status: 'done' }], response: 'found it' },
        { id: 'notice-1', localMarker: LOG_SAVE_NOTICE, localMarkerTone: 'warning' },
      ],
      true,
    )
    expect(next.hasResponse).toBe(true)
    expect(next.notice).toBe(LOG_SAVE_NOTICE)
    expect(nextChatRunAnnouncement(previous, next)).toBe(LOG_SAVE_NOTICE)
    expect(nextChatRunAnnouncement(next, next)).toBeNull()
  })

  it('joins appended lines with a period unless one is already there', () => {
    expect(joinChatRunLines('Running get_note', 'get_note done')).toBe(
      'Running get_note. get_note done',
    )
    expect(joinChatRunLines(LOG_SAVE_NOTICE, 'Response complete')).toBe(
      `${LOG_SAVE_NOTICE} Response complete`,
    )
  })

  it('returns the notice and the end-of-turn line together in one render', () => {
    const previous = snap({ isActive: true, hasResponse: true })
    const next = snap({
      isActive: false,
      hasResponse: true,
      notice: LOG_SAVE_NOTICE,
      noticeId: 'notice-1',
    })
    expect(nextChatRunAnnouncement(previous, next)).toBe(
      `${LOG_SAVE_NOTICE} Response complete`,
    )
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
