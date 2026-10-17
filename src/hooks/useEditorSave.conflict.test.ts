import { createHash } from 'node:crypto'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AUTO_SAVE_DEBOUNCE_MS, useEditorSave } from './useEditorSave'
import { useSaveNote } from './useSaveNote'
import { cacheNoteContent, clearPrefetchCache } from './useTabManagement'
import { clearSaveBaselines } from './noteContentCache'

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
  clearSaveBaselines()
})

describe('useSaveNote conflict check', () => {
  it('sends the text the editor read', async () => {
    cacheNoteContent(PATH, OPENED)
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const updateContent = vi.fn()
    const { result } = renderHook(() => useSaveNote(updateContent))

    let saved: string | undefined
    await act(async () => {
      saved = await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
    expect(saved).toBe(BUFFER)
    expect(updateContent).toHaveBeenCalledWith(PATH, BUFFER)
  })

  it('sends no expected text when the editor has no cached text', async () => {
    invokeFn.mockResolvedValue({ contentHash: sha256(BUFFER), splicedContent: null })
    const { result } = renderHook(() => useSaveNote(vi.fn()))

    await act(async () => {
      await result.current.saveNote(PATH, BUFFER)
    })

    expect(savedArgs()?.expectedContent).toBeNull()
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
    expect(savedArgs(1)?.expectedContent).toBe(SPLICED)
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

    expect(savedArgs()).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
    expect(tabContentAfter(setTabs)).toBe(SPLICED)
    expect(updateVaultContent).toHaveBeenLastCalledWith(PATH, SPLICED)

    await act(async () => {
      await result.current.handleSave()
    })
    expect(setToastMessage).toHaveBeenLastCalledWith('Nothing to save')
  })

  it('keeps the pre-splice text as the baseline for edits typed during the save', async () => {
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

    // Rust sees disk = baseline + a Status write, and splices Done into
    // the newer text (board::tests::splice_keeps_edits_typed_during_a_spliced_save).
    expect(savedArgs(1)).toEqual({ path: PATH, content: newer, expectedContent: BUFFER })
    expect(updateVaultContent).not.toHaveBeenCalledWith(PATH, SPLICED)
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
    expect(savedArgs(1)).toEqual({ path: PATH, content: BUFFER, expectedContent: OPENED })
  })
})

// PROBE4–6 from the #242 hold review. The old code swapped the whole
// frontmatter with a TS parser that missed the BOM and a "--- " close,
// and dropped frontmatter typed during the save. Now the newer text goes
// out untouched, with the pre-splice text as its baseline, and Rust's
// set_status replays and splices only the Status value. The Rust half of
// each probe is board::tests::splice_keeps_edits_typed_during_a_spliced_save.
describe('edits typed during a spliced save', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  async function inflight(opened: string, buffer: string, spliced: string, newer: string) {
    cacheNoteContent(PATH, opened)
    let finish: (v: unknown) => void = () => {}
    invokeFn.mockImplementationOnce(() => new Promise((r) => { finish = r }))
    invokeFn.mockResolvedValue({ contentHash: 'n', splicedContent: null })
    const { result } = renderHook(() => useEditorSave({ updateVaultContent: vi.fn(), setTabs: vi.fn(), setToastMessage: vi.fn() }))
    act(() => { result.current.handleContentChange(PATH, buffer) })
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_SAVE_DEBOUNCE_MS) })
    act(() => { result.current.handleContentChange(PATH, newer) })
    await act(async () => { finish({ contentHash: 'x', splicedContent: spliced }) })
    await act(async () => { await result.current.handleSave() })
    return savedArgs(1)
  }

  it('PROBE4 a BOM note keeps the BOM and the newest body', async () => {
    const B = '\uFEFF'
    const buffer = `${B}---\nStatus: In progress\n---\nbody 1\n`
    const newer = `${B}---\nStatus: In progress\n---\nbody 12\n`
    const args = await inflight(`${B}---\nStatus: In progress\n---\nbody\n`, buffer, `${B}---\nStatus: Done\n---\nbody 1\n`, newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })

  it('PROBE5 frontmatter edited during the save survives', async () => {
    const buffer = '---\nStatus: In progress\ntitle: A\n---\nbody 1\n'
    const newer = '---\nStatus: In progress\ntitle: Renamed\n---\nbody 1\n'
    const args = await inflight('---\nStatus: In progress\ntitle: A\n---\nbody\n', buffer, '---\nStatus: Done\ntitle: A\n---\nbody 1\n', newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })

  it('PROBE6 a trailing-space close fence keeps the newest body', async () => {
    const buffer = '---\nStatus: In progress\n--- \nbody 1\n'
    const newer = '---\nStatus: In progress\n--- \nbody 12\n'
    const args = await inflight('---\nStatus: In progress\n--- \nbody\n', buffer, '---\nStatus: Done\n--- \nbody 1\n', newer)
    expect(args).toEqual({ path: PATH, content: newer, expectedContent: buffer })
  })
})
