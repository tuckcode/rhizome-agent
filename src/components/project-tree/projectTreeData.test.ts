import { describe, it, expect } from 'vitest'
import { entryProject, buildProjectTree } from './projectTreeData'
import type { VaultEntry } from '../../types'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: overrides.path ?? `${overrides.title ?? 'note'}.md`,
    filename: overrides.filename ?? `${overrides.title ?? 'note'}.md`,
    title: overrides.title ?? 'Note',
    isA: overrides.isA ?? null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: overrides.archived ?? false,
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
    organized: overrides.organized ?? true,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: overrides.properties ?? {},
    hasH1: false,
    fileKind: overrides.fileKind ?? 'markdown',
    ...overrides,
  }
}

describe('entryProject', () => {
  it('reads a scalar string project value', () => {
    expect(entryProject(makeEntry({ properties: { project: 'rhizome' } }))).toBe('rhizome')
  })

  it('reads the first element of an array project value', () => {
    expect(entryProject(makeEntry({ properties: { project: ['rhizome', 'other'] } }))).toBe(
      'rhizome'
    )
  })

  it('returns null for an absent project value', () => {
    expect(entryProject(makeEntry({ properties: {} }))).toBeNull()
  })

  it('returns null for a blank/whitespace project value', () => {
    expect(entryProject(makeEntry({ properties: { project: '   ' } }))).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(entryProject(makeEntry({ properties: { project: [] } }))).toBeNull()
  })
})

describe('buildProjectTree', () => {
  it('groups entries by project, sorted by project then title', () => {
    const entries = [
      makeEntry({ title: 'Zeta Concept', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'Alpha Concept', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'Only Page', properties: { project: 'grok-wiki' } }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.projects.map((p) => p.project)).toEqual(['grok-wiki', 'rhizome'])
    const rhizome = tree.projects.find((p) => p.project === 'rhizome')!
    expect(rhizome.entries.map((e) => e.title)).toEqual(['Alpha Concept', 'Zeta Concept'])
  })

  it('puts entries with no project into the unassigned bucket', () => {
    const entries = [makeEntry({ title: 'Orphan', properties: {} })]
    const tree = buildProjectTree(entries)
    expect(tree.projects).toEqual([])
    const unassigned = tree.buckets.find((b) => b.kind === 'unassigned')!
    expect(unassigned.entries.map((e) => e.title)).toEqual(['Orphan'])
  })

  it('puts archived entries into the archive bucket even when a project is set', () => {
    const entries = [
      makeEntry({ title: 'Old Repo', archived: true, properties: { project: 'rhizome' } }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.projects).toEqual([])
    const archive = tree.buckets.find((b) => b.kind === 'archive')!
    expect(archive.entries.map((e) => e.title)).toEqual(['Old Repo'])
  })

  it('honors an assigned project even when the note is not yet organized', () => {
    // Regression: previously an unorganized note (the default) was dumped into
    // Inbox regardless of its project:, so every note landed in Inbox. A note
    // with a project set belongs to that project, not Inbox.
    const entries = [
      makeEntry({
        title: 'Assigned Drop',
        organized: false,
        path: 'wiki/concepts/assigned-drop.md',
        properties: { project: 'rhizome' },
      }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.buckets.find((b) => b.kind === 'inbox')!.entries).toEqual([])
    const rhizome = tree.projects.find((p) => p.project === 'rhizome')!
    expect(rhizome.entries.map((e) => e.title)).toEqual(['Assigned Drop'])
  })

  it('routes a note physically under raw/inbox/ to the inbox bucket', () => {
    const entries = [
      makeEntry({ title: 'Fresh Drop', organized: false, path: 'raw/inbox/fresh-drop.md' }),
    ]
    const tree = buildProjectTree(entries)
    const inbox = tree.buckets.find((b) => b.kind === 'inbox')!
    expect(inbox.entries.map((e) => e.title)).toEqual(['Fresh Drop'])
  })

  it('puts a project-less note outside raw/inbox/ into unassigned, not inbox', () => {
    const entries = [
      makeEntry({ title: 'Orphan Page', organized: false, path: 'wiki/concepts/orphan-page.md' }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.buckets.find((b) => b.kind === 'inbox')!.entries).toEqual([])
    const unassigned = tree.buckets.find((b) => b.kind === 'unassigned')!
    expect(unassigned.entries.map((e) => e.title)).toEqual(['Orphan Page'])
  })

  it('treats organized:true as an escape hatch that pulls a note out of inbox', () => {
    const entries = [
      makeEntry({ title: 'Processed Drop', organized: true, path: 'raw/inbox/processed-drop.md' }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.buckets.find((b) => b.kind === 'inbox')!.entries).toEqual([])
    const unassigned = tree.buckets.find((b) => b.kind === 'unassigned')!
    expect(unassigned.entries.map((e) => e.title)).toEqual(['Processed Drop'])
  })

  it('archive takes priority over inbox when both apply', () => {
    const entries = [
      makeEntry({
        title: 'Old Unsorted',
        archived: true,
        organized: false,
        path: 'raw/inbox/old-unsorted.md',
      }),
    ]
    const tree = buildProjectTree(entries)
    const archive = tree.buckets.find((b) => b.kind === 'archive')!
    const inbox = tree.buckets.find((b) => b.kind === 'inbox')!
    expect(archive.entries.map((e) => e.title)).toEqual(['Old Unsorted'])
    expect(inbox.entries).toEqual([])
  })

  it('excludes non-markdown entries and Type definitions', () => {
    const entries = [
      makeEntry({ title: 'Binary File', fileKind: 'binary', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'Concept', isA: 'Type', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'Real Page', properties: { project: 'rhizome' } }),
    ]
    const tree = buildProjectTree(entries)
    expect(tree.projects).toHaveLength(1)
    expect(tree.projects[0].entries.map((e) => e.title)).toEqual(['Real Page'])
  })

  it('never double-counts an entry into two buckets or a bucket and a project', () => {
    const entries = [
      makeEntry({ title: 'A', properties: { project: 'rhizome' } }),
      makeEntry({ title: 'B', archived: true }),
      makeEntry({ title: 'C', organized: false }),
      makeEntry({ title: 'D', properties: {} }),
    ]
    const tree = buildProjectTree(entries)
    const allIds = [
      ...tree.projects.flatMap((p) => p.entries.map((e) => e.title)),
      ...tree.buckets.flatMap((b) => b.entries.map((e) => e.title)),
    ]
    expect(allIds.sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})
