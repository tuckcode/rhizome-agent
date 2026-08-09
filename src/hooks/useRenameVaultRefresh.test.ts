import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { VaultEntry } from '../types'
import type { NoteActionsConfig } from './useNoteActions'
import { useNoteActions } from './useNoteActions'
import { useNoteRename } from './useNoteRename'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
  mockInvoke: vi.fn().mockResolvedValue(''),
}))
vi.mock('./mockFrontmatterHelpers', () => ({
  updateMockFrontmatter: vi.fn().mockReturnValue('---\ntitle: New Title\n---\n# New Title\n'),
  deleteMockFrontmatterProperty: vi.fn().mockReturnValue('---\n---\n'),
}))

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/old-title.md',
    filename: 'old-title.md',
    title: 'Old Title',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    archived: false,
    modifiedAt: 1700000000,
    createdAt: 1700000000,
    fileSize: 100,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    outgoingLinks: [],
    template: null,
    sort: null,
    sidebarLabel: null,
    view: null,
    visible: null,
    properties: {},
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    hasH1: false,
    ...overrides,
  }
}

function mockRenameSuccess() {
  vi.mocked(mockInvoke).mockImplementation(async (command: string) => {
    if (command === 'rename_note') return { new_path: '/vault/new-title.md', updated_files: 2 }
    if (command === 'get_note_content') return '---\ntitle: New Title\n---\n# New Title\n'
    return ''
  })
}

function makeRenameHookConfig(reloadVault: () => Promise<unknown>) {
  return {
    entries: [makeEntry()],
    setToastMessage: vi.fn(),
    reloadVault,
  } as Parameters<typeof useNoteRename>[0] & { reloadVault: typeof reloadVault }
}

function makeRenameHookDeps() {
  return {
    tabs: [] as { entry: VaultEntry; content: string }[],
    setTabs: vi.fn((update: (prev: { entry: VaultEntry; content: string }[]) => { entry: VaultEntry; content: string }[]) => update([])),
    activeTabPathRef: { current: null as string | null },
    handleSwitchTab: vi.fn(),
    updateTabContent: vi.fn(),
  }
}

function makeNoteActionsConfig(reloadVault: () => Promise<unknown>): NoteActionsConfig & { reloadVault: typeof reloadVault } {
  return {
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    entries: [makeEntry()],
    setToastMessage: vi.fn(),
    updateEntry: vi.fn(),
    vaultPath: '/vault',
    reloadVault,
  }
}

describe('rename vault refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
    mockRenameSuccess()
  })

  it('reloads the vault after handleRenameNote completes', async () => {
    const reloadVault = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useNoteRename(makeRenameHookConfig(reloadVault), makeRenameHookDeps()))

    await act(async () => {
      await result.current.handleRenameNote('/vault/old-title.md', 'New Title', '/vault', vi.fn())
    })

    expect(reloadVault).toHaveBeenCalledTimes(1)
  })

  it('reloads the vault after title frontmatter rename completes', async () => {
    const reloadVault = vi.fn().mockResolvedValue([])
    const config = makeNoteActionsConfig(reloadVault)
    const { result } = renderHook(() => useNoteActions(config))

    await act(async () => {
      await result.current.handleSelectNote(makeEntry())
    })

    await act(async () => {
      await result.current.handleUpdateFrontmatter('/vault/old-title.md', 'title', 'New Title')
    })

    expect(reloadVault).toHaveBeenCalledTimes(1)
  })
})
