import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import type { ParsedFrontmatter } from '../utils/frontmatter'

const propertyModeState = vi.hoisted(() => ({
  overrides: {} as Record<string, string>,
}))

vi.mock('../components/DynamicPropertiesPanel', () => ({
  containsWikilinks: (value: unknown) => typeof value === 'string' && value.includes('[['),
}))

vi.mock('../utils/propertyTypes', async () => {
  const actual = await vi.importActual<typeof import('../utils/propertyTypes')>('../utils/propertyTypes')

  return {
    ...actual,
    loadDisplayModeOverrides: vi.fn(() => ({ ...propertyModeState.overrides })),
    saveDisplayModeOverride: vi.fn((key: string, mode: string) => {
      propertyModeState.overrides[key] = mode
    }),
    removeDisplayModeOverride: vi.fn((key: string) => {
      delete propertyModeState.overrides[key]
    }),
    getEffectiveDisplayMode: vi.fn((key: string, value: unknown, overrides: Record<string, string>) => (
      overrides[key] ?? actual.detectPropertyType(key, value as never)
    )),
  }
})

import {
  loadDisplayModeOverrides,
  removeDisplayModeOverride,
  saveDisplayModeOverride,
} from '../utils/propertyTypes'
import { usePropertyPanelState } from './usePropertyPanelState'

function entry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/note.md',
    filename: 'note.md',
    title: 'Note',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    modifiedAt: 1,
    createdAt: 1,
    fileSize: 1,
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

function createFrontmatter(overrides: ParsedFrontmatter = {}): ParsedFrontmatter {
  return {
    Status: 'Active',
    Alias: 'shown',
    Icon: 'sparkle',
    _icon: 'duplicate-hidden',
    Tags: ['alpha', 'beta'],
    Related_to: '[[Linked note]]',
    Workspace: 'hidden',
    ...overrides,
  }
}

describe('usePropertyPanelState extra coverage', () => {
  beforeEach(() => {
    propertyModeState.overrides = {}
    vi.clearAllMocks()
  })

  it('derives type, status, tag, and visible property metadata from entries and frontmatter', () => {
    const { result } = renderHook(() => usePropertyPanelState({
      entries: [
        entry({ title: 'Project', isA: 'Type', color: 'sky', icon: 'rocket' }),
        entry({ title: 'Topic', isA: 'Type', color: 'mint', icon: 'hash' }),
        entry({ title: 'Roadmap', status: 'Paused', properties: { Tags: ['alpha', 'gamma'], People: ['Brian'] } }),
      ],
      entryIsA: 'Project',
      frontmatter: createFrontmatter(),
    }))

    expect(result.current.availableTypes).toEqual(['Project', 'Topic'])
    expect(result.current.customColorKey).toBe('sky')
    expect(result.current.typeColorKeys).toEqual({ Project: 'sky', Topic: 'mint' })
    expect(result.current.typeIconKeys).toEqual({ Project: 'rocket', Topic: 'hash' })
    expect(result.current.vaultStatuses).toEqual(['Paused'])
    expect(result.current.vaultTagsByKey).toEqual({
      People: ['Brian'],
      Tags: ['alpha', 'gamma'],
    })
    expect(result.current.propertyEntries).toEqual([
      ['Status', 'Active'],
      ['Alias', 'shown'],
      ['Icon', 'sparkle'],
      ['Tags', ['alpha', 'beta']],
    ])
  })

  it('saves scalar values using number-aware coercion and deletes empty numeric values', () => {
    propertyModeState.overrides = { Estimate: 'number' }
    const onUpdateProperty = vi.fn()
    const onDeleteProperty = vi.fn()

    const { result } = renderHook(() => usePropertyPanelState({
      entries: [],
      entryIsA: null,
      frontmatter: { Estimate: 2, Done: false },
      onUpdateProperty,
      onDeleteProperty,
    }))

    act(() => {
      result.current.setEditingKey('Estimate')
      result.current.handleSaveValue('Estimate', ' 42 ')
      result.current.handleSaveValue('Estimate', '   ')
      result.current.handleSaveValue('Done', 'true')
    })

    expect(result.current.editingKey).toBeNull()
    expect(onUpdateProperty).toHaveBeenCalledWith('Estimate', 42)
    expect(onDeleteProperty).toHaveBeenCalledWith('Estimate')
    expect(onUpdateProperty).toHaveBeenCalledWith('Done', true)
  })

  it('reconciles list values, persists added display modes, and supports clearing overrides', () => {
    const onAddProperty = vi.fn()
    const onDeleteProperty = vi.fn()
    const onUpdateProperty = vi.fn()

    const { result } = renderHook(() => usePropertyPanelState({
      entries: [],
      entryIsA: null,
      frontmatter: {},
      onAddProperty,
      onDeleteProperty,
      onUpdateProperty,
    }))

    act(() => {
      result.current.setShowAddDialog(true)
      result.current.handleSaveList('Tags', [])
      result.current.handleSaveList('Tags', ['solo'])
      result.current.handleSaveList('Tags', ['alpha', 'beta'])
      result.current.handleAdd('Priority', '  3  ', 'number')
      result.current.handleAdd('People', ' Luca, Brian ', 'tags')
      result.current.handleAdd('Enabled', 'TRUE', 'boolean')
      result.current.handleAdd('   ', 'ignored', 'text')
      result.current.handleDisplayModeChange('Priority', null)
    })

    expect(onDeleteProperty).toHaveBeenCalledWith('Tags')
    expect(onUpdateProperty).toHaveBeenCalledWith('Tags', 'solo')
    expect(onUpdateProperty).toHaveBeenCalledWith('Tags', ['alpha', 'beta'])
    expect(onAddProperty).toHaveBeenCalledWith('Priority', 3)
    expect(onAddProperty).toHaveBeenCalledWith('People', ['Luca', 'Brian'])
    expect(onAddProperty).toHaveBeenCalledWith('Enabled', true)
    expect(onAddProperty).toHaveBeenCalledTimes(3)
    expect(saveDisplayModeOverride).toHaveBeenCalledWith('Priority', 'number')
    expect(saveDisplayModeOverride).toHaveBeenCalledWith('People', 'tags')
    expect(saveDisplayModeOverride).toHaveBeenCalledWith('Enabled', 'boolean')
    expect(loadDisplayModeOverrides).toHaveBeenCalled()
    expect(removeDisplayModeOverride).toHaveBeenCalledWith('Priority')
    expect(result.current.showAddDialog).toBe(false)
  })
})
