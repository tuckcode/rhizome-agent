import { createHash } from 'node:crypto'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AUTO_SAVE_DEBOUNCE_MS, useEditorSave } from './useEditorSave'
import { contentHash, useSaveNote } from './useSaveNote'
import { cacheNoteContent, clearPrefetchCache } from './useTabManagement'

const invokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeFn(cmd, args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
  mockInvoke: vi.fn(),
  updateMockContent: vi.fn(),
}))

const PATH = '/vault/plan.md'
const OPENED = '---\nStatus: In progress\n---\n# Plan\nfirst draft\n'
const BUFFER = '---\nStatus: In progress\n---\n# Plan\ntyped while the card moved\n'
const SPLICED = '---\nStatus: Done\n---\n# Plan\ntyped while the card moved\n'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function savedArgs(call = 0): Record<string, unknown> | undefined {
  return invokeFn.mock.calls.filter(([cmd]) => cmd === 'save_note_content_checked')[call]?.[1]
}

function tabContentAfter(setTabs: Mock): string | undefined {
  let tabs = [{ entry: { path: PATH }, content: BUFFER }]
  for (const [update] of setTabs.mock.calls) {
    tabs = typeof update === 'function' ? update(tabs) : update
  }
  return tabs[0]?.content
}

beforeEach(() => {
  invokeFn.mockReset()
  clearPrefetchCache()
})

describe('contentHash', () => {
  it('matches the Rust SHA-256 hex form', async () => {
    expect(await contentHash('﻿---\r\nStatus: Done\r\n---\r\n')).toBe(sha256('﻿---\r\nStatus: Done\r\n---\r\n'))
  })
})

describe('useSaveNote conflict check', () => {
  it('sends the hash of the text the editor read', async () => {
    cacheNoteContent(PATH, OPENED)
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const updateContent = vi.fn()
    const { result } = renderHook(() => useSaveNote(updateContent))

    let saved: string | undefined
    await act(async () => {
      saved = await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedHash: sha256(OPENED) })
    expect(saved).toBe(BUFFER)
    expect(updateContent).toHaveBeenCalledWith(PATH, BUFFER)
  })

  it('sends no hash when the editor has no cached text', async () => {
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const { result } = renderHook(() => useSaveNote(vi.fn()))

    await act(async () => {
      await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()?.expectedHash).toBeNull()
  })

  it('takes a spliced status as the new text and the next baseline', async () => {
    cacheNoteContent(PATH, OPENED)
    invokeFn.mockResolvedValueOnce({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    invokeFn.mockResolvedValueOnce({ contentHash: 'x', splicedContent: null })
    const updateContent = vi.fn()
    const { result } = renderHook(() => useSaveNote(updateContent))

    await act(async () => {
      expect(await result.current.saveNote(PATH, BUFFER)).toBe(SPLICED)
    })
    expect(updateContent).toHaveBeenCalledWith(PATH, SPLICED)

    await act(async () => {
      await result.current.saveNote(PATH, SPLICED)
    })
    expect(savedArgs(1)?.expectedHash).toBe(sha256(SPLICED))
  })
})

describe('useEditorSave with a board move', () => {
  let updateVaultContent: Mock
  let setTabs: Mock
  let setToastMessage: Mock

  beforeEach(() => {
    vi.useFakeTimers()
    updateVaultContent = vi.fn()
    setTabs = vi.fn()
    setToastMessage = vi.fn()
    cacheNoteContent(PATH, OPENED)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderSave() {
    return renderHook(() => useEditorSave({ updateVaultContent, setTabs, setToastMessage }))
  }

  it('autosave keeps the Done status a board wrote while the editor was dirty', async () => {
    invokeFn.mockResolvedValue({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    const { result } = renderSave()

    act(() => {
      result.current.handleContentChange(PATH, BUFFER)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedHash: sha256(OPENED) })
    expect(tabContentAfter(setTabs)).toBe(SPLICED)
    expect(updateVaultContent).toHaveBeenLastCalledWith(PATH, SPLICED)

    await act(async () => {
      await result.current.handleSave()
    })
    expect(setToastMessage).toHaveBeenLastCalledWith('Nothing to save')
  })

  it('gives edits typed during the save the spliced frontmatter', async () => {
    let finishSave: (value: unknown) => void = () => {}
    invokeFn.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve }))
    invokeFn.mockResolvedValue({ contentHash: 'next', splicedContent: null })
    const { result } = renderSave()
    const newer = '---\nStatus: In progress\n---\n# Plan\ntyped while the card moved, and more\n'

    act(() => {
      result.current.handleContentChange(PATH, BUFFER)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })
    act(() => {
      result.current.handleContentChange(PATH, newer)
    })
    await act(async () => {
      finishSave({ contentHash: sha256(SPLICED), splicedContent: SPLICED })
    })
    await act(async () => {
      await result.current.handleSave()
    })

    expect(savedArgs(1)).toEqual({
      path: PATH,
      content: '---\nStatus: Done\n---\n# Plan\ntyped while the card moved, and more\n',
      expectedHash: sha256(SPLICED),
    })
  })

  it('keeps the buffer dirty on a real conflict', async () => {
    invokeFn.mockRejectedValue(new Error('Save conflict: /vault/plan.md changed on disk since the editor read it.'))
    const { result } = renderSave()

    act(() => {
      result.current.handleContentChange(PATH, BUFFER)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS)
    })

    expect(setToastMessage).toHaveBeenLastCalledWith(expect.stringContaining('Save conflict:'))
    expect(updateVaultContent).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.handleSave()
    })
    expect(savedArgs(1)).toEqual({ path: PATH, content: BUFFER, expectedHash: sha256(OPENED) })
  })
})
