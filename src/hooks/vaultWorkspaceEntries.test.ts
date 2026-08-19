import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import {
  replaceLoadedWorkspaceEntries,
  replaceWorkspaceEntries,
} from './vaultWorkspaceEntries'
import { reconcileReloadedEntries } from './useVaultLoader'

const baseEntry = (path: string, title = path): VaultEntry => ({
  path,
  filename: path.split('/').pop() ?? path,
  title,
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
  template: null,
  sort: null,
  outgoingLinks: [],
  sidebarLabel: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  properties: {},
  hasH1: false,
})

describe('C29 protectedPaths on workspace entry replace', () => {
  const existing = baseEntry('/vault/note/hello.md', 'Hello')
  const created = baseEntry('/vault/note/untitled-note.md', 'Untitled note')

  it('replaceLoadedWorkspaceEntries keeps a protected path missing from the loaded snapshot', () => {
    const next = replaceLoadedWorkspaceEntries({
      entries: [created, existing],
      fallbackVaultPath: '/vault',
      loadedEntries: [existing],
      protectedPaths: new Set([created.path]),
    })
    expect(next.map((e) => e.path)).toContain(created.path)
    expect(next.map((e) => e.path)).toContain(existing.path)
  })

  it('replaceLoadedWorkspaceEntries drops an unprotected path missing from the loaded snapshot', () => {
    const next = replaceLoadedWorkspaceEntries({
      entries: [created, existing],
      fallbackVaultPath: '/vault',
      loadedEntries: [existing],
    })
    expect(next.map((e) => e.path)).not.toContain(created.path)
  })

  it('replaceWorkspaceEntries keeps a protected path for the reloaded workspace', () => {
    const next = replaceWorkspaceEntries({
      entries: [created, existing],
      fallbackVaultPath: '/vault',
      loadedEntries: [existing],
      loadedWorkspacePath: '/vault',
      protectedPaths: new Set([created.path]),
    })
    expect(next.map((e) => e.path)).toContain(created.path)
  })

  it('reconcileReloadedEntries re-appends protected entries only', () => {
    const reloaded = [existing]
    const previous = [created, existing]
    const kept = reconcileReloadedEntries(previous, reloaded, new Set([created.path]))
    expect(kept.map((e) => e.path)).toEqual([created.path, existing.path])

    const unprotected = reconcileReloadedEntries(previous, reloaded, new Set())
    expect(unprotected.map((e) => e.path)).toEqual([existing.path])
  })

  it('replaceLoadedWorkspaceEntries does not duplicate a protected note from another workspace', () => {
    const other = {
      ...created,
      path: '/research/note/hello.md',
      workspace: { path: '/research', label: 'Research', alias: 'research' },
    } as typeof created
    const next = replaceLoadedWorkspaceEntries({
      entries: [other],
      fallbackVaultPath: '/field',
      loadedEntries: [{ ...existing, path: '/field/note/hello.md', workspace: { path: '/field', label: 'Field', alias: 'field' } } as typeof existing],
      protectedEntries: new Map([[other.path, other]]),
    })
    expect(next.filter((e) => e.path === other.path)).toHaveLength(1)
    expect(next.map((e) => e.path)).toContain('/field/note/hello.md')
  })

  it('replaceLoadedWorkspaceEntries restores a protected entry even when current entries were wiped', () => {
    const next = replaceLoadedWorkspaceEntries({
      entries: [],
      fallbackVaultPath: '/vault',
      loadedEntries: [existing],
      protectedEntries: new Map([[created.path, created]]),
    })
    expect(next.map((e) => e.path)).toEqual([created.path, existing.path])
  })

  it('reconcileReloadedEntries restores from the protected entry map after a wipe', () => {
    const next = reconcileReloadedEntries(
      [],
      [existing],
      new Set([created.path]),
      new Map([[created.path, created]]),
    )
    expect(next.map((e) => e.path)).toEqual([created.path, existing.path])
  })
})
