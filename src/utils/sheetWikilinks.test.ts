import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import {
  firstSheetWikilinkTarget,
  sheetCellContainsPlainWikilink,
  sheetWikilinkColor,
  sheetWikilinkDisplayValue,
} from './sheetWikilinks'

function makeEntry(overrides: Partial<VaultEntry>): VaultEntry {
  return {
    path: '/vault/project-alpha.md',
    filename: 'project-alpha.md',
    title: 'Project Alpha',
    isA: 'Project',
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
    hasH1: false,
    fileKind: 'markdown',
    ...overrides,
  }
}

describe('sheetWikilinks', () => {
  it('detects plain-cell wikilinks but not formulas', () => {
    expect(sheetCellContainsPlainWikilink('See [[project-alpha]]')).toBe(true)
    expect(sheetCellContainsPlainWikilink('=[[project-alpha]].B2')).toBe(false)
  })

  it('renders resolved wikilinks as note titles while preserving surrounding text', () => {
    const entry = makeEntry({ icon: '📈' })

    expect(sheetWikilinkDisplayValue('Owner: [[project-alpha]]', [entry])).toBe('Owner: 📈 Project Alpha')
  })

  it('keeps explicit wikilink aliases as display text', () => {
    const entry = makeEntry({})

    expect(sheetWikilinkDisplayValue('[[project-alpha|Alpha]]', [entry])).toBe('Alpha')
  })

  it('extracts the raw navigation target', () => {
    expect(firstSheetWikilinkTarget('[[project-alpha|Alpha]]')).toBe('project-alpha|Alpha')
  })

  it('uses the resolved entry type color when available', () => {
    const entry = makeEntry({})

    expect(sheetWikilinkColor('[[project-alpha]]', [entry], null, '#155dff')).toBe('var(--accent-red)')
  })
})
