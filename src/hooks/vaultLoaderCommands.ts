import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { FolderNode, GitPushResult, VaultEntry, ViewFile } from '../types'
import type { VaultOption } from '../components/status-bar/types'
import { suppressManagedVaultReloadWatcherFeedback } from '../utils/managedVaultReloadWrites'
import { normalizeVaultEntries, normalizeViewFiles } from '../utils/vaultMetadataNormalization'
import { workspaceIdentityFromVault } from '../utils/workspaces'

interface TauriCallOptions {
  command: string
  tauriArgs: Record<string, unknown>
  mockArgs?: Record<string, unknown>
}

interface VaultPathOptions {
  vaultPath: string
}

interface EmptyResultReloadOptions {
  forceReload?: boolean
  reloadIfEmpty?: boolean
}

type VaultEntriesOptions = VaultPathOptions & EmptyResultReloadOptions

interface MountedVaultEntriesOptions extends VaultPathOptions, EmptyResultReloadOptions {
  defaultWorkspacePath?: string | null
  includeFallbackVault?: boolean
  vaults?: VaultOption[]
}

type MountedVaultFoldersOptions = MountedVaultEntriesOptions
type MountedVaultViewsOptions = MountedVaultEntriesOptions

type WorkspaceEntryLoadOptions = EmptyResultReloadOptions

interface CommitWithPushOptions extends VaultPathOptions {
  message: string
}

interface LoadedVaultData {
  entries: VaultEntry[]
}

interface LoadedVaultChrome {
  folders: FolderNode[]
  views: ViewFile[]
}

export function hasVaultPath({ vaultPath }: VaultPathOptions): boolean {
  return vaultPath.trim().length > 0
}

export function tauriCall<T>({ command, tauriArgs, mockArgs }: TauriCallOptions): Promise<T> {
  return isTauri() ? invoke<T>(command, tauriArgs) : mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

export async function checkVaultPathAvailability({ vaultPath }: VaultPathOptions): Promise<boolean | null> {
  if (!hasVaultPath({ vaultPath })) return false

  try {
    return await tauriCall<boolean>({
      command: 'check_vault_exists',
      tauriArgs: { path: vaultPath },
    })
  } catch {
    return null
  }
}

/** Is this vault a dedicated Rhizome wiki vault (vs. personal notes)?
 *  Drives the sidebar's Projects-vs-Types/Folders nav mode (Alpha-2). */
export async function checkIsWikiVault({ vaultPath }: VaultPathOptions): Promise<boolean> {
  if (!hasVaultPath({ vaultPath })) return false

  try {
    return await tauriCall<boolean>({
      command: 'is_wiki_vault',
      tauriArgs: { path: vaultPath },
    })
  } catch {
    return false
  }
}

function loadVaultEntriesWithCommand({ vaultPath, command }: VaultPathOptions & { command: string }): Promise<VaultEntry[]> {
  // reload_vault may rewrite AGENTS.md (stale managed template refresh). Mark it
  // as an app-owned write first so the vault watcher does not treat that write as
  // an external change and flash "Reloading vault..." again.
  if (command === 'reload_vault') {
    suppressManagedVaultReloadWatcherFeedback(vaultPath)
  }
  return tauriCall<unknown>({ command, tauriArgs: { path: vaultPath } })
    .then((entries) => normalizeVaultEntries(entries, vaultPath))
}

function shouldIncludeVault(vault: VaultOption, primaryPaths: Set<string>): boolean {
  if (!vault.path.trim() || vault.available === false) return false
  return vault.mounted !== false || primaryPaths.has(vault.path)
}

function shouldReloadEmptyResult(entries: VaultEntry[], options: EmptyResultReloadOptions): boolean {
  return entries.length === 0 && options.reloadIfEmpty === true && !options.forceReload && isTauri()
}

function shouldIncludeFallbackVault(
  byPath: Map<string, VaultOption>,
  vaultPath: string,
  includeFallbackVault: boolean,
): boolean {
  if (!includeFallbackVault) return false
  if (!vaultPath.trim()) return false
  return !byPath.has(vaultPath)
}

function loadWorkspaceEntriesWithCommand(
  vault: VaultOption,
  command: 'list_vault' | 'reload_vault',
  defaultWorkspacePath?: string | null,
): Promise<VaultEntry[]> {
  const workspace = workspaceIdentityFromVault(vault, { defaultWorkspacePath })
  if (command === 'reload_vault') {
    suppressManagedVaultReloadWatcherFeedback(vault.path)
  }
  return tauriCall<unknown>({ command, tauriArgs: { path: vault.path } })
    .then((entries) => normalizeVaultEntries(entries, vault.path, workspace))
}

export function loadWorkspaceEntries(
  vault: VaultOption,
  defaultWorkspacePath?: string | null,
  options: WorkspaceEntryLoadOptions = {},
): Promise<VaultEntry[]> {
  const command = options.forceReload && isTauri() ? 'reload_vault' : 'list_vault'
  return loadWorkspaceEntriesWithCommand(vault, command, defaultWorkspacePath)
    .then((entries) => shouldReloadEmptyResult(entries, options)
      ? loadWorkspaceEntriesWithCommand(vault, 'reload_vault', defaultWorkspacePath)
      : entries)
}

function uniqueMountedVaults({ defaultWorkspacePath, vaultPath, vaults = [], includeFallbackVault = true }: MountedVaultEntriesOptions): VaultOption[] {
  const byPath = new Map<string, VaultOption>()
  const primaryPaths = new Set([vaultPath, defaultWorkspacePath ?? ''].filter((path) => path.trim()))
  for (const vault of vaults) {
    if (!shouldIncludeVault(vault, primaryPaths)) continue
    byPath.set(vault.path, vault)
  }
  if (shouldIncludeFallbackVault(byPath, vaultPath, includeFallbackVault)) {
    byPath.set(vaultPath, { label: vaultPath.split('/').filter(Boolean).pop() || 'Workspace', path: vaultPath, mounted: true, available: true })
  }
  return [...byPath.values()]
}

function loadMountedVaultEntries(options: MountedVaultEntriesOptions): Promise<VaultEntry[]> {
  const mountedVaults = uniqueMountedVaults(options)
  if (mountedVaults.length <= 1) {
    const onlyVault = mountedVaults[0]
    return onlyVault
      ? loadWorkspaceEntries(onlyVault, options.defaultWorkspacePath, {
        forceReload: options.forceReload,
        reloadIfEmpty: options.reloadIfEmpty,
      })
      : loadVaultEntries({ vaultPath: options.vaultPath, reloadIfEmpty: options.reloadIfEmpty })
  }
  return Promise.all(mountedVaults.map((vault) => (
    loadWorkspaceEntries(vault, options.defaultWorkspacePath, {
      forceReload: options.forceReload,
      reloadIfEmpty: options.reloadIfEmpty,
    })
  )))
    .then((groups) => groups.flat())
}

function attachFolderRootPath(folders: FolderNode[], rootPath: string): FolderNode[] {
  return folders.map((folder) => ({
    ...folder,
    rootPath,
    children: attachFolderRootPath(folder.children, rootPath),
  }))
}

function attachViewRootPath(
  views: ViewFile[],
  vault: VaultOption,
  defaultWorkspacePath?: string | null,
): ViewFile[] {
  const workspace = workspaceIdentityFromVault(vault, { defaultWorkspacePath })
  return views.map((view) => ({
    ...view,
    rootPath: vault.path,
    workspace,
  }))
}

function loadVaultEntries({
  vaultPath,
  forceReload = true,
  reloadIfEmpty = false,
}: VaultEntriesOptions): Promise<VaultEntry[]> {
  const command = forceReload && isTauri() ? 'reload_vault' : 'list_vault'
  return loadVaultEntriesWithCommand({ vaultPath, command })
    .then((entries) => shouldReloadEmptyResult(entries, { forceReload, reloadIfEmpty })
      ? loadVaultEntriesWithCommand({ vaultPath, command: 'reload_vault' })
      : entries)
}

export function reloadVaultEntries({ vaultPath, vaults, defaultWorkspacePath }: MountedVaultEntriesOptions): Promise<VaultEntry[]> {
  if (vaults?.length) return loadMountedVaultEntries({ vaultPath, vaults, defaultWorkspacePath, forceReload: true })
  return loadVaultEntriesWithCommand({ vaultPath, command: 'reload_vault' })
}

export function loadVaultFolders({ vaultPath }: VaultPathOptions): Promise<FolderNode[]> {
  return tauriCall<FolderNode[]>({ command: 'list_vault_folders', tauriArgs: { path: vaultPath } })
}

export async function loadMountedVaultFolders(options: MountedVaultFoldersOptions): Promise<FolderNode[]> {
  const mountedVaults = uniqueMountedVaults(options)
  if (mountedVaults.length === 0) return []
  if (mountedVaults.length === 1) {
    const [vault] = mountedVaults
    if (vault.path === options.vaultPath) return loadVaultFolders({ vaultPath: vault.path })

    const identity = workspaceIdentityFromVault(vault, { defaultWorkspacePath: options.defaultWorkspacePath })
    const children = await loadVaultFolders({ vaultPath: vault.path })
      .then((folders) => attachFolderRootPath(folders ?? [], vault.path))
      .catch(() => [] as FolderNode[])
    return [{
      name: identity.label,
      path: '',
      rootPath: vault.path,
      children,
    }]
  }

  const folderGroups = await Promise.all(mountedVaults.map(async (vault) => {
    const identity = workspaceIdentityFromVault(vault, { defaultWorkspacePath: options.defaultWorkspacePath })
    const children = await loadVaultFolders({ vaultPath: vault.path })
      .then((folders) => attachFolderRootPath(folders ?? [], vault.path))
      .catch(() => [] as FolderNode[])
    return {
      name: identity.label,
      path: '',
      rootPath: vault.path,
      children,
    }
  }))

  return folderGroups
}

export function loadVaultViews({ vaultPath }: VaultPathOptions): Promise<ViewFile[]> {
  return tauriCall<unknown>({ command: 'list_views', tauriArgs: { vaultPath } })
    .then(normalizeViewFiles)
}

export async function loadMountedVaultViews(options: MountedVaultViewsOptions): Promise<ViewFile[]> {
  const mountedVaults = uniqueMountedVaults(options)
  if (mountedVaults.length === 0) return []
  if (mountedVaults.length === 1 && mountedVaults[0].path === options.vaultPath) {
    return loadVaultViews({ vaultPath: options.vaultPath })
  }

  const viewGroups = await Promise.all(mountedVaults.map(async (vault) => {
    const views = await loadVaultViews({ vaultPath: vault.path }).catch(() => [] as ViewFile[])
    return attachViewRootPath(views ?? [], vault, options.defaultWorkspacePath)
  }))
  return viewGroups.flat()
}

export async function loadVaultData({
  vaultPath,
  vaults,
  defaultWorkspacePath,
  forceReload,
  reloadIfEmpty,
}: MountedVaultEntriesOptions): Promise<LoadedVaultData> {
  if (!isTauri()) console.info('[mock] Using mock Tauri data for browser testing')
  const entries = vaults?.length
    ? await loadMountedVaultEntries({ vaultPath, vaults, defaultWorkspacePath, forceReload, reloadIfEmpty })
    : await loadVaultEntries({ vaultPath, forceReload, reloadIfEmpty })
  return { entries }
}

export async function loadVaultChrome({
  defaultWorkspacePath,
  vaultPath,
  vaults,
}: MountedVaultEntriesOptions): Promise<LoadedVaultChrome> {
  const [folders, views] = await Promise.all([
    loadVaultFolders({ vaultPath }).catch(() => [] as FolderNode[]),
    vaults?.length
      ? loadMountedVaultViews({ defaultWorkspacePath, vaultPath, vaults }).catch(() => [] as ViewFile[])
      : loadVaultViews({ vaultPath }).catch(() => [] as ViewFile[]),
  ])

  return {
    folders: folders ?? [],
    views: views ?? [],
  }
}

export async function commitWithPush({ vaultPath, message }: CommitWithPushOptions): Promise<GitPushResult> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { message })
    return mockInvoke<GitPushResult>('git_push', {})
  }
  await invoke<string>('git_commit', { vaultPath, message })
  return invoke<GitPushResult>('git_push', { vaultPath })
}
