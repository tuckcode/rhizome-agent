import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatNoteContent } from './useChatNoteContent'

const loader = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('../utils/loadChatNoteContent', () => ({
  loadChatNoteContent: (path: string, vaultPath: string) => loader.fn(path, vaultPath),
}))

beforeEach(() => {
  loader.fn.mockReset()
  loader.fn.mockResolvedValue('# Note body')
})

describe('useChatNoteContent', () => {
  it('loads the note once and reports its body', async () => {
    const { result } = renderHook(() => useChatNoteContent('a.md', '/vault'))

    await waitFor(() => expect(result.current.body).toBe('# Note body'))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
    expect(loader.fn).toHaveBeenCalledTimes(1)
  })

  it('reports nothing when no note is open, without calling the loader', () => {
    const { result } = renderHook(() => useChatNoteContent(null, '/vault'))

    expect(result.current.body).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(loader.fn).not.toHaveBeenCalled()
  })

  /**
   * The body belongs to a path. Showing the previous note's text under a new
   * title is worse than showing nothing, and it would also feed the agent the
   * wrong note.
   */
  it('drops the old body immediately when the note changes', async () => {
    const { result, rerender } = renderHook(
      ({ path }) => useChatNoteContent(path, '/vault'),
      { initialProps: { path: 'a.md' } },
    )
    await waitFor(() => expect(result.current.body).toBe('# Note body'))

    loader.fn.mockResolvedValue('# Second note')
    rerender({ path: 'b.md' })
    expect(result.current.body).toBeNull()

    await waitFor(() => expect(result.current.body).toBe('# Second note'))
  })

  it('surfaces a failed read as an error rather than an endless spinner', async () => {
    loader.fn.mockRejectedValue(new Error('gone'))
    const { result } = renderHook(() => useChatNoteContent('a.md', '/vault'))

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.body).toBeNull()
  })

  it('finishes loading when the note exists but is empty', async () => {
    loader.fn.mockResolvedValue('')
    const { result } = renderHook(() => useChatNoteContent('empty.md', '/vault'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.body).toBe('')
    expect(result.current.error).toBe(false)
  })
})
