import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockInvoke } from '../mock-tauri'
import type { GitRemoteStatus, VaultEntry } from '../types'
import { writeClipboardText } from '../utils/clipboardText'
import { useNoteGitUrls } from './useNoteGitUrls'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  mockInvoke: vi.fn(),
}))
vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: vi.fn(),
}))
vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

function remoteStatus(hasRemote: boolean): GitRemoteStatus {
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    hasRemote,
  }
}

function entry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/notes/share.md',
    filename: 'share.md',
    title: 'Share',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
    ...overrides,
  }
}

describe('useNoteGitUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(writeClipboardText).mockResolvedValue(undefined)
  })

  it('copies the backend git URL for remote-backed notes', async () => {
    const setToastMessage = vi.fn()
    const note = entry()
    vi.mocked(mockInvoke).mockResolvedValue('https://github.com/team/vault/blob/main/notes/share.md')
    const { result } = renderHook(() => useNoteGitUrls({
      currentVaultPath: '/vault',
      remoteStatusForRepository: () => remoteStatus(true),
      setToastMessage,
    }))

    expect(result.current.canCopyEntryGitUrl(note)).toBe(true)

    act(() => result.current.copyEntryGitUrl(note))

    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('https://github.com/team/vault/blob/main/notes/share.md')
    })
    expect(mockInvoke).toHaveBeenCalledWith('git_file_url', { vaultPath: '/vault', path: note.path })
    expect(setToastMessage).toHaveBeenCalledWith('Git URL copied')
  })

  it('does not request a URL for local-only notes', () => {
    const note = entry()
    const { result } = renderHook(() => useNoteGitUrls({
      currentVaultPath: '/vault',
      remoteStatusForRepository: () => remoteStatus(false),
      setToastMessage: vi.fn(),
    }))

    expect(result.current.canCopyEntryGitUrl(note)).toBe(false)

    act(() => result.current.copyEntryGitUrl(note))

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(writeClipboardText).not.toHaveBeenCalled()
  })
})
