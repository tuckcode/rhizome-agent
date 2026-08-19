import type { VaultOption } from '../components/status-bar/types'
import type { VaultEntry, WorkspaceIdentity } from '../types'
import { workspaceIdentityFromVault } from '../utils/workspaces'

export function uniqueWorkspacePathsFromVaults(vaultPath: string, vaults?: VaultOption[]): string[] {
  const paths = vaults?.length
    ? vaults.map((vault) => vault.path)
    : [vaultPath]
  return [...new Set(paths.filter((path) => path.trim().length > 0))]
}

export function workspacePathSetKey(paths: readonly string[]): string {
  return paths.join('\n')
}

function entryWorkspacePath(entry: VaultEntry, fallbackVaultPath: string): string {
  return entry.workspace?.path ?? fallbackVaultPath
}

export function initialVaultsForPath(path: string, vaults?: VaultOption[]): VaultOption[] | undefined {
  if (!vaults?.length) return undefined
  const matchingVaults = vaults.filter((vault) => vault.path === path)
  return matchingVaults.length > 0 ? matchingVaults : undefined
}

function workspacePathsFromEntries(
  entries: VaultEntry[],
  fallbackVaultPath: string,
  inferFallbackWorkspacePath: boolean,
): string[] {
  const paths = new Set<string>()
  for (const entry of entries) {
    const path = inferFallbackWorkspacePath
      ? entryWorkspacePath(entry, fallbackVaultPath)
      : entry.workspace?.path ?? ''
    if (path.trim()) paths.add(path)
  }
  return [...paths]
}

export function loadedWorkspacePathsFromEntries(
  entries: VaultEntry[],
  fallbackVaultPath: string,
  options: { inferFallbackWorkspacePath?: boolean } = {},
): string[] {
  const inferFallbackWorkspacePath = options.inferFallbackWorkspacePath ?? true
  const paths = workspacePathsFromEntries(entries, fallbackVaultPath, inferFallbackWorkspacePath)
  if (paths.length > 0) return paths
  return inferFallbackWorkspacePath && fallbackVaultPath.trim() ? [fallbackVaultPath] : []
}

type WorkspaceIdentityMetadataKey =
  | 'label'
  | 'alias'
  | 'shortLabel'
  | 'color'
  | 'icon'
  | 'mounted'
  | 'available'
  | 'defaultForNewNotes'

const WORKSPACE_IDENTITY_METADATA_KEYS: WorkspaceIdentityMetadataKey[] = [
  'label',
  'alias',
  'shortLabel',
  'color',
  'icon',
  'mounted',
  'available',
  'defaultForNewNotes',
]

function workspaceIdentityMetadataMatches(
  current: WorkspaceIdentity | undefined,
  identity: WorkspaceIdentity,
): boolean {
  if (!current) return false
  return WORKSPACE_IDENTITY_METADATA_KEYS.every((key) => current[key] === identity[key])
}

export function retagEntriesForWorkspaceMetadata({
  defaultWorkspacePath,
  entries,
  fallbackVaultPath,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  entries: VaultEntry[]
  fallbackVaultPath: string
  vaults?: VaultOption[]
}): VaultEntry[] {
  if (!vaults?.length) return entries

  const identitiesByPath = new Map(vaults.map((vault) => [
    vault.path,
    workspaceIdentityFromVault(vault, { defaultWorkspacePath }),
  ]))
  let nextEntries: VaultEntry[] | null = null

  entries.forEach((entry, index) => {
    const identity = identitiesByPath.get(entryWorkspacePath(entry, fallbackVaultPath))
    const nextEntry = identity && !workspaceIdentityMetadataMatches(entry.workspace, identity)
      ? { ...entry, workspace: identity }
      : entry
    if (nextEntry === entry && nextEntries === null) return

    nextEntries ??= entries.slice(0, index)
    nextEntries.push(nextEntry)
  })

  return nextEntries ?? entries
}

export function pruneEntriesOutsideWorkspaceSet({
  desiredPaths,
  entries,
  fallbackVaultPath,
}: {
  desiredPaths: readonly string[]
  entries: VaultEntry[]
  fallbackVaultPath: string
}): VaultEntry[] {
  const desiredPathSet = new Set(desiredPaths)
  const nextEntries = entries.filter((entry) => desiredPathSet.has(entryWorkspacePath(entry, fallbackVaultPath)))
  return nextEntries.length === entries.length ? entries : nextEntries
}

export type ProtectedWorkspaceEntries = {
  paths?: Set<string>
  entries?: Map<string, VaultEntry>
}

function protectedPathSet(protection?: ProtectedWorkspaceEntries): Set<string> | undefined {
  if (protection?.entries && protection.entries.size > 0) {
    return new Set(protection.entries.keys())
  }
  return protection?.paths
}

// A workspace-scoped entries replace can race a just-created note the same
// way a full reload can (see reconcileReloadedEntries in useVaultLoader.ts):
// the disk scan that produced `loadedEntries` can predate a note that was
// optimistically added to `entries` in the meantime. Re-append any protected
// path `loadedEntries` does not already account for.
//
// Restore from `protectedEntries` first, then from `droppedEntries`. The
// load-reset path can empty `entries` before the stale scan resolves, so
// relying only on dropped current-state rows leaves nothing to put back.
// A genuinely deleted note is unaffected: removeEntry also drops its path
// from the tracked set, so it stops being protected.
function preserveMissingProtectedEntries(
  droppedEntries: VaultEntry[],
  loadedEntries: VaultEntry[],
  fallbackVaultPath: string,
  protection?: ProtectedWorkspaceEntries,
): VaultEntry[] {
  const protectedPaths = protectedPathSet(protection)
  if (!protectedPaths || protectedPaths.size === 0) return loadedEntries

  const loadedPaths = new Set(loadedEntries.map((entry) => entry.path))
  const droppedByPath = new Map(droppedEntries.map((entry) => [entry.path, entry]))
  const replacedWorkspaces = new Set([
    ...droppedEntries.map((entry) => entryWorkspacePath(entry, fallbackVaultPath)),
    ...loadedWorkspacePathsFromEntries(loadedEntries, fallbackVaultPath),
  ])
  const missingProtected: VaultEntry[] = []
  for (const path of protectedPaths) {
    if (loadedPaths.has(path)) continue
    const restored = droppedByPath.get(path) ?? protection?.entries?.get(path)
    if (!restored) continue
    // A protected note in another workspace is already in `keptEntries`.
    // Putting it into this snapshot again duplicated it when Cmd+N landed
    // in workspace B while workspace A was the scan that just resolved.
    if (!replacedWorkspaces.has(entryWorkspacePath(restored, fallbackVaultPath))) continue
    missingProtected.push(restored)
  }
  return missingProtected.length === 0 ? loadedEntries : [...missingProtected, ...loadedEntries]
}

export function replaceWorkspaceEntries({
  defaultWorkspacePath,
  entries,
  fallbackVaultPath,
  loadedEntries,
  loadedWorkspacePath,
  protectedPaths,
  protectedEntries,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  entries: VaultEntry[]
  fallbackVaultPath: string
  loadedEntries: VaultEntry[]
  loadedWorkspacePath: string
  protectedPaths?: Set<string>
  protectedEntries?: Map<string, VaultEntry>
  vaults?: VaultOption[]
}): VaultEntry[] {
  const keptEntries = entries.filter((entry) => entryWorkspacePath(entry, fallbackVaultPath) !== loadedWorkspacePath)
  const droppedEntries = entries.filter((entry) => entryWorkspacePath(entry, fallbackVaultPath) === loadedWorkspacePath)
  return retagEntriesForWorkspaceMetadata({
    defaultWorkspacePath,
    entries: [
      ...keptEntries,
      ...preserveMissingProtectedEntries(droppedEntries, loadedEntries, fallbackVaultPath, {
        paths: protectedPaths,
        entries: protectedEntries,
      }),
    ],
    fallbackVaultPath,
    vaults,
  })
}

export function replaceLoadedWorkspaceEntries({
  defaultWorkspacePath,
  entries,
  fallbackVaultPath,
  loadedEntries,
  protectedPaths,
  protectedEntries,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  entries: VaultEntry[]
  fallbackVaultPath: string
  loadedEntries: VaultEntry[]
  protectedPaths?: Set<string>
  protectedEntries?: Map<string, VaultEntry>
  vaults?: VaultOption[]
}): VaultEntry[] {
  const loadedPathSet = new Set(loadedWorkspacePathsFromEntries(loadedEntries, fallbackVaultPath))
  const keptEntries = entries.filter((entry) => !loadedPathSet.has(entryWorkspacePath(entry, fallbackVaultPath)))
  const droppedEntries = entries.filter((entry) => loadedPathSet.has(entryWorkspacePath(entry, fallbackVaultPath)))
  return retagEntriesForWorkspaceMetadata({
    defaultWorkspacePath,
    entries: [
      ...keptEntries,
      ...preserveMissingProtectedEntries(droppedEntries, loadedEntries, fallbackVaultPath, {
        paths: protectedPaths,
        entries: protectedEntries,
      }),
    ],
    fallbackVaultPath,
    vaults,
  })
}
