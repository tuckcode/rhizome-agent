import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveNote } from './useSaveNote'
import { cacheNoteContent, clearPrefetchCache, prefetchNoteContent, useTabManagement } from './useTabManagement'
import { clearSaveBaseline, clearSaveBaselines, getSaveBaseline, moveSaveBaseline } from './noteContentCache'
import type { VaultEntry } from '../types'

const invokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (c: string, a?: Record<string, unknown>) => invokeFn(c, a) }))
vi.mock('../mock-tauri', () => ({ isTauri: () => true, mockInvoke: vi.fn(), updateMockContent: vi.fn() }))

const PATH = '/vault/plan.md'
const OPENED = '---\nStatus: In progress\n---\nfirst\n'
const MOVED = '---\nStatus: Done\n---\nfirst\n'
const BUFFER = '---\nStatus: In progress\n---\nfirst typed\n'

function expectedSent(): unknown {
  const call = invokeFn.mock.calls.filter(([c]) => c === 'save_note_content_checked').at(-1)
  return call?.[1]?.expectedContent
}

async function save(content = BUFFER) {
  const { result } = renderHook(() => useSaveNote(vi.fn()))
  await act(async () => { await result.current.saveNote(PATH, content) })
}

beforeEach(() => {
  invokeFn.mockReset()
  invokeFn.mockImplementation(async (cmd) => cmd === 'get_note_content' ? MOVED : { contentHash: 'x', splicedContent: null })
  clearPrefetchCache()
  clearSaveBaselines()
})

// PROBE1–3 from the #242 hold review. Each one sent a null or moved
// baseline before the baseline left the preload cache.
describe('save baseline survives the preload cache', () => {
  it('PROBE1 a vault reload (clearPrefetchCache) keeps the baseline', async () => {
    cacheNoteContent(PATH, OPENED)
    clearPrefetchCache() // what runEntryReload does on every watcher or pull refresh
    await save()
    expect(expectedSent()).toBe(OPENED)
  })

  it('PROBE2 LRU eviction keeps the baseline', async () => {
    cacheNoteContent(PATH, OPENED)
    for (let i = 0; i < 24; i++) cacheNoteContent(`/vault/other-${i}.md`, 'x')
    await save()
    expect(expectedSent()).toBe(OPENED)
  })

  it('PROBE3 a preload of the open note after a move keeps the opened baseline', async () => {
    const opened = { path: PATH, modifiedAt: 1, fileSize: 30 } as unknown as VaultEntry
    cacheNoteContent(PATH, OPENED, opened)
    const entry = { path: PATH, modifiedAt: 2, fileSize: 30 } as unknown as VaultEntry
    prefetchNoteContent(entry, { parsedBlockPreload: false })
    await new Promise((r) => setTimeout(r, 50))
    expect(invokeFn).toHaveBeenCalledWith('get_note_content', expect.anything())
    await save()
    expect(expectedSent()).toBe(OPENED)
  })

  it('a save moves the baseline to the saved text', async () => {
    cacheNoteContent(PATH, OPENED)
    await save()
    await save(`${BUFFER}more\n`)
    expect(expectedSent()).toBe(BUFFER)
  })

  it('a spliced save makes the spliced text the baseline', async () => {
    invokeFn.mockImplementation(async () => ({ contentHash: 'x', splicedContent: MOVED }))
    cacheNoteContent(PATH, OPENED)
    await save()
    expect(getSaveBaseline(PATH)).toBe(MOVED)
  })

  it('no baseline sends no check', async () => {
    await save()
    expect(expectedSent()).toBeNull()
  })

  it('close clears the baseline and rename moves it', () => {
    cacheNoteContent(PATH, OPENED)
    moveSaveBaseline(PATH, '/vault/renamed.md', MOVED)
    expect(getSaveBaseline(PATH)).toBeNull()
    expect(getSaveBaseline('/vault/renamed.md')).toBe(MOVED)
    clearSaveBaseline('/vault/renamed.md')
    expect(getSaveBaseline('/vault/renamed.md')).toBeNull()
  })

  it('opening a note sets the baseline, opening another or closing clears it', async () => {
    const { result } = renderHook(() => useTabManagement())
    const entry = (path: string) => ({ path, title: 'Plan', fileKind: 'markdown' }) as unknown as VaultEntry
    await act(async () => { await result.current.handleSelectNote(entry(PATH)) })
    expect(getSaveBaseline(PATH)).toBe(MOVED)
    await act(async () => { await result.current.handleSelectNote(entry('/vault/next.md')) })
    expect(getSaveBaseline(PATH)).toBeNull()
    expect(getSaveBaseline('/vault/next.md')).toBe(MOVED)
    act(() => { result.current.closeAllTabs() })
    expect(getSaveBaseline('/vault/next.md')).toBeNull()
  })
})
