import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../../types'
import { filterInboxEntries } from '../../utils/noteListHelpers'
import { useNoteListData } from './noteListHooks'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/note/old.md',
    filename: 'old.md',
    title: 'Old',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: 10,
    createdAt: 10,
    fileSize: 10,
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
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    fileKind: 'markdown',
    ...overrides,
  }
}

describe('inbox list and count', () => {
  it('renders the same inbox rows the badge counts, including notes older than a month', () => {
    const entries = [makeEntry()]
    const shared = filterInboxEntries(entries, 'all')
    expect(shared).toHaveLength(1)

    const { result } = renderHook(() => useNoteListData({
      entries,
      selection: { kind: 'filter', filter: 'inbox' },
      query: '',
      listSort: 'modified',
      listDirection: 'desc',
      modifiedPathSet: new Set(),
      modifiedSuffixes: [],
      inboxPeriod: 'month',
      inboxEntries: shared,
    }))

    expect(result.current.searched.map((entry) => entry.title)).toEqual(['Old'])
    expect(result.current.searched).toHaveLength(shared.length)
  })

  it('does not drop old inbox notes when the period is omitted', () => {
    const entries = [makeEntry({ title: 'Ancient' })]
    const { result } = renderHook(() => useNoteListData({
      entries,
      selection: { kind: 'filter', filter: 'inbox' },
      query: '',
      listSort: 'modified',
      listDirection: 'desc',
      modifiedPathSet: new Set(),
      modifiedSuffixes: [],
    }))
    expect(result.current.searched.map((entry) => entry.title)).toEqual(['Ancient'])
    expect(result.current.searched).toHaveLength(filterInboxEntries(entries, 'all').length)
  })
})
