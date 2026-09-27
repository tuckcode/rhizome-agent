import { describe, it, expect, vi } from 'vitest'
import type { MouseEvent } from 'react'
import { createNoteStatusResolver, resolveHeaderTitle, routeNoteClick } from './noteListUtils'
import type { ModifiedFile, NoteStatus, SidebarSelection, VaultEntry } from '../../types'

function makeEntry(path = '/test.md'): VaultEntry {
  return {
    path, filename: 'test.md', title: 'Test', isA: null,
    aliases: [], belongsTo: [], relatedTo: [], status: null,
    archived: false,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {},
    icon: null, color: null, order: null, sidebarLabel: null,
    template: null, sort: null, view: null, visible: null,
    outgoingLinks: [], properties: {},
  } as unknown as VaultEntry
}

function makeActions() {
  return {
    onReplace: vi.fn(),
    onEnterNeighborhood: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    multiSelect: {
      selectRange: vi.fn(),
      clear: vi.fn(),
      setAnchor: vi.fn(),
    },
  }
}

function makeMouseEvent(overrides: Partial<Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>> = {}): MouseEvent {
  return { metaKey: false, ctrlKey: false, shiftKey: false, ...overrides } as MouseEvent
}

function makeStatusResolver(activeStatus: NoteStatus, modifiedFiles: ModifiedFile[]) {
  return createNoteStatusResolver(
    () => activeStatus,
    modifiedFiles,
    new Set(modifiedFiles.map((file: ModifiedFile) => file.path)),
  )
}

describe('resolveHeaderTitle', () => {
  it('returns History for the pulse filter', () => {
    const selection = { kind: 'filter', filter: 'pulse' } as SidebarSelection
    expect(resolveHeaderTitle(selection, null)).toBe('History')
  })

  it('localizes built-in note list titles', () => {
    const selection = { kind: 'filter', filter: 'archived' } as SidebarSelection
    expect(resolveHeaderTitle(selection, null, [], 'zh-CN')).toBe('归档')
  })

  it('keeps user-authored view names unchanged', () => {
    const selection = { kind: 'view', filename: 'custom.yml' } as SidebarSelection

    expect(resolveHeaderTitle(selection, null, [{
      filename: 'custom.yml',
      definition: {
        name: '客户',
        icon: null,
        color: null,
        sort: null,
        filters: { all: [] },
      },
    }], 'en')).toBe('客户')
  })
})

describe('routeNoteClick', () => {
  it('plain click replaces active tab', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent(), actions)
    expect(actions.onReplace).toHaveBeenCalledWith(entry)
    expect(actions.multiSelect.clear).toHaveBeenCalled()
    expect(actions.multiSelect.setAnchor).toHaveBeenCalledWith(entry.path)
  })

  it('Cmd+click enters Neighborhood mode', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ metaKey: true }), actions)
    expect(actions.onEnterNeighborhood).toHaveBeenCalledWith(entry)
    expect(actions.multiSelect.clear).toHaveBeenCalled()
    expect(actions.onReplace).not.toHaveBeenCalled()
  })

  it('Shift+click selects range', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ shiftKey: true }), actions)
    expect(actions.multiSelect.selectRange).toHaveBeenCalledWith(entry.path)
  })

  it('Cmd+Shift+click opens in new window', () => {
    const entry = makeEntry()
    const actions = makeActions()
    routeNoteClick(entry, makeMouseEvent({ metaKey: true, shiftKey: true }), actions)
    expect(actions.onOpenInNewWindow).toHaveBeenCalledWith(entry)
    expect(actions.onReplace).not.toHaveBeenCalled()
    expect(actions.onEnterNeighborhood).not.toHaveBeenCalled()
  })

  it('Cmd+Shift+click is a no-op when handler is undefined', () => {
    const entry = makeEntry()
    const actions = makeActions()
    delete (actions as Partial<typeof actions>).onOpenInNewWindow
    routeNoteClick(entry, makeMouseEvent({ metaKey: true, shiftKey: true }), actions)
    expect(actions.onReplace).not.toHaveBeenCalled()
    expect(actions.onEnterNeighborhood).not.toHaveBeenCalled()
  })
})

describe('createNoteStatusResolver', () => {
  it('keeps transient note status ahead of repository status', () => {
    const modifiedFiles: ModifiedFile[] = [{
      path: '/vault/note.md',
      relativePath: 'note.md',
      status: 'modified',
    }]
    const resolver = makeStatusResolver('unsaved', modifiedFiles)

    expect(resolver('/vault/note.md')).toBe('unsaved')
  })

  it('uses modified files when active-vault status says the note is clean', () => {
    const modifiedFiles: ModifiedFile[] = [{
      path: '/other-vault/note.md',
      relativePath: 'note.md',
      status: 'untracked',
      vaultPath: '/other-vault',
    }]
    const resolver = makeStatusResolver('clean', modifiedFiles)

    expect(resolver('/other-vault/note.md')).toBe('new')
  })
})
