import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { VaultEntry, FolderNode, GitCommit, ModifiedFile, NoteStatus, GitPushResult, ViewFile } from '../types'
import type { VaultOption } from '../components/status-bar/types'
import {
  GITIGNORED_VISIBILITY_CHANGED_EVENT,
  notifyGitignoredVisibilityApplied,
  type GitignoredVisibilityChangedEvent,
} from '../lib/gitignoredVisibilityEvents'
import { clearPrefetchCache } from './useTabManagement'
import {
  checkVaultPathAvailability,
  commitWithPush,
  hasVaultPath,
  loadVaultChrome,
  loadVaultData,
  loadMountedVaultFolders,
  loadMountedVaultViews,
  loadVaultFolders,
  loadVaultViews,
  loadWorkspaceEntries,
  reloadVaultEntries,
  tauriCall,
} from './vaultLoaderCommands'
import { normalizeVaultEntry } from '../utils/vaultMetadataNormalization'
import { normalizeNotePathForIdentity, notePathsMatch } from '../utils/notePathIdentity'
import { isNoteWindow } from '../utils/windowMode'
import { useUnavailableVaultState } from './useUnavailableVaultState'
import { resetVaultState } from './vaultStateReset'
import {
  initialVaultsForPath,
  loadedWorkspacePathsFromEntries,
  pruneEntriesOutsideWorkspaceSet,
  replaceLoadedWorkspaceEntries,
  replaceWorkspaceEntries,
  retagEntriesForWorkspaceMetadata,
  uniqueWorkspacePathsFromVaults,
  workspacePathSetKey,
} from './vaultWorkspaceEntries'

interface InitialVaultLoadStateOptions {
  defaultWorkspacePath?: string | null
  folderVaults?: VaultOption[]
  handleVaultAvailable: (path: string) => void
  path: string
  forceReload: boolean, reloadIfEmpty: boolean
  handleVaultUnavailable: (path: string) => void
  isCurrentVaultPath: (path: string) => boolean
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  setFolders: (folders: FolderNode[]) => void
  setIsLoading: (isLoading: boolean) => void
  setViews: (views: ViewFile[]) => void
  vaults?: VaultOption[]
}

interface InitialVaultChromeOptions extends Pick<
  InitialVaultLoadStateOptions,
  'defaultWorkspacePath' | 'folderVaults' | 'handleVaultUnavailable' | 'isCurrentVaultPath' | 'path' | 'setFolders' | 'setViews'
> {
  shouldApplyChrome: () => boolean
}

async function loadInitialVaultChromeState(options: InitialVaultChromeOptions): Promise<boolean> {
  const {
    defaultWorkspacePath,
    folderVaults,
    handleVaultUnavailable,
    isCurrentVaultPath,
    path,
    setFolders,
    setViews,
    shouldApplyChrome,
  } = options
  try {
    const { folders, views } = await loadVaultChrome({
      defaultWorkspacePath,
      vaultPath: path,
      vaults: folderVaults,
    })
    if (shouldApplyChrome()) {
      setFolders(folders)
      setViews(views)
    }
  } catch (err) {
    const unavailable = await handleUnavailableVaultPath({ handleVaultUnavailable, isCurrentVaultPath, path })
    if (unavailable) return true
    console.warn('Vault chrome load failed:', err)
  }
  return false
}

async function loadInitialVaultEntriesState(options: Pick<
  InitialVaultLoadStateOptions,
  'defaultWorkspacePath' | 'forceReload' | 'handleVaultAvailable' | 'handleVaultUnavailable' | 'isCurrentVaultPath' | 'newEntriesRef' | 'newPathsRef' | 'path' | 'reloadIfEmpty' | 'setEntries' | 'vaults'
>): Promise<boolean> {
  const { handleVaultAvailable, handleVaultUnavailable, isCurrentVaultPath, path, setEntries } = options

  try {
    const { entries } = await loadVaultData({
      vaultPath: path,
      vaults: initialVaultsForPath(path, options.vaults),
      defaultWorkspacePath: options.defaultWorkspacePath,
      forceReload: options.forceReload,
      reloadIfEmpty: options.reloadIfEmpty,
    })
    if (isCurrentVaultPath(path)) {
      handleVaultAvailable(path)
      // See reconcileReloadedEntries: an initial/background scan can still
      // be reading disk when Cmd+N optimistically adds a brand-new note. If
      // that scan resolves afterward, don't let its pre-create snapshot wipe
      // the note back out of the workspace it belongs to.
      setEntries((currentEntries) => replaceLoadedWorkspaceEntries({
        defaultWorkspacePath: options.defaultWorkspacePath,
        entries: currentEntries,
        fallbackVaultPath: path,
        loadedEntries: entries,
        protectedPaths: options.newPathsRef.current,
        protectedEntries: options.newEntriesRef.current,
        vaults: options.vaults,
      }))
    }
  } catch (err) {
    const unavailable = await handleUnavailableVaultPath({ handleVaultUnavailable, isCurrentVaultPath, path })
    if (unavailable) return true
    console.warn('Vault scan failed:', err)
  }
  return false
}

async function loadInitialVaultState(options: InitialVaultLoadStateOptions) {
  const { path, isCurrentVaultPath, setIsLoading } = options
  let vaultUnavailable = false
  const chromeLoad = loadInitialVaultChromeState({
    ...options,
    shouldApplyChrome: () => !vaultUnavailable && isCurrentVaultPath(path),
  })

  setIsLoading(true)
  vaultUnavailable = await loadInitialVaultEntriesState(options)
  if (isCurrentVaultPath(path)) setIsLoading(false)
  await chromeLoad
}

async function handleUnavailableVaultPath(options: {
  handleVaultUnavailable: (path: string) => void
  isCurrentVaultPath: (path: string) => boolean
  path: string
}): Promise<boolean> {
  const { handleVaultUnavailable, isCurrentVaultPath, path } = options
  if (!isCurrentVaultPath(path)) return true

  const available = await checkVaultPathAvailability({ vaultPath: path })
  if (available !== false) return false
  if (isCurrentVaultPath(path)) handleVaultUnavailable(path)
  return true
}

function useCurrentVaultPathGuard(vaultPath: string) {
  const currentPathRef = useRef(vaultPath)

  useEffect(() => {
    currentPathRef.current = vaultPath
  }, [vaultPath])

  return useCallback((path: string) => currentPathRef.current === path, [])
}

function useCoalescedAsyncTask<T>(runTask: () => Promise<T>) {
  const inFlightRef = useRef<Promise<T> | null>(null)
  const requestedDuringFlightRef = useRef(false)
  const latestTaskRef = useRef<(() => Promise<T>) | null>(null)

  const task = useCallback(async () => {
    if (inFlightRef.current) {
      requestedDuringFlightRef.current = true
      return inFlightRef.current
    }

    const next = (async () => {
      try {
        return await runTask()
      } finally {
        inFlightRef.current = null
        if (requestedDuringFlightRef.current) {
          requestedDuringFlightRef.current = false
          void latestTaskRef.current?.()
        }
      }
    })()
    inFlightRef.current = next
    return next
  }, [runTask])

  useEffect(() => {
    latestTaskRef.current = task
  }, [task])

  return task
}

function useNewNoteTracker() {
  const [newPaths, setNewPaths] = useState<Set<string>>(new Set())
  // Mirrors `newPaths` but updates synchronously in the same callback that
  // mutates state, instead of waiting for a `useEffect` to observe the new
  // render. Async vault-load reconciliation (see reconcileReloadedEntries
  // and preserveMissingProtectedEntries) reads these refs at promise-resolve
  // time; an effect-synced ref left a window where a reload could resolve
  // between addEntry()'s setState and the effect flushing, reading a stale
  // (pre-create) snapshot and dropping the just-created note anyway.
  //
  // `newEntriesRef` keeps the optimistic VaultEntry itself. The load-reset
  // effect can empty `entries` before a stale scan resolves, so restoring
  // only from "what was in current entries" has nothing to put back.
  const newPathsRef = useRef<Set<string>>(new Set())
  const newEntriesRef = useRef<Map<string, VaultEntry>>(new Map())

  const trackNew = useCallback((entry: VaultEntry) => {
    setNewPaths((prev) => {
      const next = new Set(prev).add(entry.path)
      newPathsRef.current = next
      const nextEntries = new Map(newEntriesRef.current)
      nextEntries.set(entry.path, entry)
      newEntriesRef.current = nextEntries
      return next
    })
  }, [])

  const untrack = useCallback((path: string) => {
    setNewPaths((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      newPathsRef.current = next
      const nextEntries = new Map(newEntriesRef.current)
      nextEntries.delete(path)
      newEntriesRef.current = nextEntries
      return next
    })
  }, [])

  const clear = useCallback(() => {
    const next = new Set<string>()
    newPathsRef.current = next
    newEntriesRef.current = new Map()
    setNewPaths(next)
  }, [])

  return { newPaths, newPathsRef, newEntriesRef, trackNew, untrack, clear }
}

function useUnsavedTracker() {
  const [unsavedPaths, setUnsavedPaths] = useState<Set<string>>(new Set())

  const trackUnsaved = useCallback((path: string) => {
    setUnsavedPaths((prev) => {
      if (prev.has(path)) return prev
      return new Set(prev).add(path)
    })
  }, [])

  const clearUnsaved = useCallback((path: string) => {
    setUnsavedPaths((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setUnsavedPaths(new Set()), [])

  return { unsavedPaths, trackUnsaved, clearUnsaved, clearAll }
}

function usePendingSaveTracker() {
  const [pendingSavePaths, setPendingSavePaths] = useState<Set<string>>(new Set())

  const addPendingSave = useCallback((path: string) => {
    setPendingSavePaths((prev) => new Set(prev).add(path))
  }, [])

  const removePendingSave = useCallback((path: string) => {
    setPendingSavePaths((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }, [])

  return { pendingSavePaths, addPendingSave, removePendingSave }
}

interface ResolveNoteStatusOptions {
  path: string
  newPaths: Set<string>
  modifiedFiles: ModifiedFile[]
  pendingSavePaths?: Set<string>
  unsavedPaths?: Set<string>
}

function resolveTransientNoteStatus({
  path,
  pendingSavePaths,
  unsavedPaths,
}: Pick<ResolveNoteStatusOptions, 'path' | 'pendingSavePaths' | 'unsavedPaths'>): NoteStatus | null {
  if (unsavedPaths?.has(path)) return 'unsaved'
  if (pendingSavePaths?.has(path)) return 'pendingSave'
  return null
}

function resolveGitBackedNoteStatus(file: ModifiedFile | undefined): NoteStatus {
  if (!file) return 'clean'
  if (file.status === 'untracked' || file.status === 'added') return 'new'
  if (file.status === 'modified' || file.status === 'deleted') return 'modified'
  return 'clean'
}

export function resolveNoteStatus({
  path,
  newPaths,
  modifiedFiles,
  pendingSavePaths,
  unsavedPaths,
}: ResolveNoteStatusOptions): NoteStatus {
  const transientStatus = resolveTransientNoteStatus({ path, pendingSavePaths, unsavedPaths })
  if (transientStatus) return transientStatus
  if (newPaths.has(path)) return 'new'
  return resolveGitBackedNoteStatus(modifiedFiles.find((file) => file.path === path))
}

interface InitialVaultLoadOptions {
  defaultWorkspacePath?: string | null
  folderVaults?: VaultOption[]
  forceReload: boolean, reloadIfEmpty: boolean
  handleVaultAvailable: (path: string) => void
  handleVaultUnavailable: (path: string) => void
  isWorkspacePathLoaded: (path: string) => boolean
  vaultPath: string
  vaults?: VaultOption[]
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  tracker: ReturnType<typeof useNewNoteTracker>
  unsaved: ReturnType<typeof useUnsavedTracker>
  isCurrentVaultPath: (path: string) => boolean
  resetReloading: () => void
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  setFolders: (folders: FolderNode[]) => void
  setIsLoading: (isLoading: boolean) => void
  setModifiedFiles: (files: ModifiedFile[]) => void
  setModifiedFilesError: (message: string | null) => void
  setViews: (views: ViewFile[]) => void
}

interface InitialVaultLoadSnapshot {
  defaultWorkspacePath?: string | null
  forceReload: boolean, reloadIfEmpty: boolean
  vaults?: VaultOption[]
}

interface InitialVaultLoadEffectOptions extends Omit<
  InitialVaultLoadOptions,
  'forceReload' | 'isWorkspacePathLoaded' | 'reloadIfEmpty' | 'tracker' | 'unsaved' | 'vaults'
> {
  clearNewPaths: () => void
  clearUnsaved: () => void
}

function useInitialVaultLoadSnapshot(vaults: VaultOption[] | undefined, defaultWorkspacePath: string | null | undefined, forceReload: boolean, reloadIfEmpty: boolean) {
  const loadOptionsRef = useRef<InitialVaultLoadSnapshot>({ vaults, defaultWorkspacePath, forceReload, reloadIfEmpty })

  useEffect(() => {
    loadOptionsRef.current = { vaults, defaultWorkspacePath, forceReload, reloadIfEmpty }
  }, [defaultWorkspacePath, forceReload, reloadIfEmpty, vaults])

  return loadOptionsRef
}

function shouldReuseLoadedWorkspaceEntries(
  path: string,
  loadOptions: InitialVaultLoadSnapshot,
  isWorkspacePathLoaded: (path: string) => boolean,
): boolean {
  return !!loadOptions.vaults?.length && isWorkspacePathLoaded(path)
}

function resetInitialVaultLoadState(options: InitialVaultLoadEffectOptions, preserveWorkspaceEntries: boolean) {
  clearPrefetchCache()
  options.setViews([])
  resetVaultState({
    // A Cmd+N during startup can land between the first scan and the
    // vaults-arrived effect re-run. Clearing protection here is what let a
    // stale scan wipe the new note with nothing left to restore.
    clearNewPaths: preserveWorkspaceEntries ? () => {} : options.clearNewPaths,
    clearUnsaved: options.clearUnsaved,
    setEntries: preserveWorkspaceEntries ? () => {} : options.setEntries,
    setFolders: options.setFolders,
    setIsLoading: options.setIsLoading,
    setModifiedFiles: options.setModifiedFiles,
    setModifiedFilesError: options.setModifiedFilesError,
    setViews: preserveWorkspaceEntries ? () => {} : options.setViews,
  })
  options.resetReloading()
}

function startReusableWorkspaceChromeLoad(
  options: InitialVaultLoadEffectOptions,
  path: string,
  isActivePath: (candidate: string) => boolean,
) {
  void loadInitialVaultChromeState({
    handleVaultUnavailable: options.handleVaultUnavailable,
    isCurrentVaultPath: isActivePath,
    path,
    defaultWorkspacePath: options.defaultWorkspacePath,
    folderVaults: options.folderVaults,
    setFolders: options.setFolders,
    setViews: options.setViews,
    shouldApplyChrome: () => isActivePath(path),
  })
}

function startFreshInitialVaultLoad(
  options: InitialVaultLoadEffectOptions,
  path: string,
  loadOptions: InitialVaultLoadSnapshot,
  isActivePath: (candidate: string) => boolean,
) {
  void loadInitialVaultState({
    handleVaultAvailable: options.handleVaultAvailable,
    path,
    handleVaultUnavailable: options.handleVaultUnavailable,
    isCurrentVaultPath: isActivePath,
    vaults: loadOptions.vaults,
    folderVaults: options.folderVaults,
    defaultWorkspacePath: loadOptions.defaultWorkspacePath, forceReload: loadOptions.forceReload, reloadIfEmpty: loadOptions.reloadIfEmpty,
    newPathsRef: options.newPathsRef,
    newEntriesRef: options.newEntriesRef,
    setEntries: options.setEntries,
    setFolders: options.setFolders,
    setIsLoading: options.setIsLoading,
    setViews: options.setViews,
  })
}

function useInitialVaultLoad(options: InitialVaultLoadOptions) {
  const {
    handleVaultAvailable,
    handleVaultUnavailable,
    isWorkspacePathLoaded,
    vaultPath,
    newPathsRef,
    newEntriesRef,
    tracker,
    unsaved,
    isCurrentVaultPath,
    resetReloading,
    setEntries,
    setFolders,
    setIsLoading,
    setModifiedFiles,
    setModifiedFilesError,
    setViews,
    vaults,
    defaultWorkspacePath,
    folderVaults,
    forceReload,
    reloadIfEmpty,
  } = options
  const loadOptionsRef = useInitialVaultLoadSnapshot(vaults, defaultWorkspacePath, forceReload, reloadIfEmpty)
  const loadOptionsKey = useMemo(
    () => workspacePathSetKey(uniqueWorkspacePathsFromVaults(vaultPath, vaults)),
    [vaultPath, vaults],
  )

  useEffect(() => {
    const path = vaultPath
    const loadOptions = loadOptionsRef.current
    const effectOptions = {
      defaultWorkspacePath: loadOptions.defaultWorkspacePath, handleVaultAvailable, handleVaultUnavailable, isCurrentVaultPath,
      resetReloading,
      clearNewPaths: tracker.clear,
      clearUnsaved: unsaved.clearAll,
      newPathsRef,
      newEntriesRef,
      setEntries, setFolders, setIsLoading, setModifiedFiles, setModifiedFilesError, setViews,
      vaultPath, folderVaults,
    }
    const reuseLoadedWorkspaceEntries = shouldReuseLoadedWorkspaceEntries(path, loadOptions, isWorkspacePathLoaded)
    const preserveWorkspaceEntries = reuseLoadedWorkspaceEntries || !!loadOptions.vaults?.length
    resetInitialVaultLoadState(effectOptions, preserveWorkspaceEntries)

    if (!hasVaultPath({ vaultPath: path })) return

    let cancelled = false
    const isActivePath = (candidate: string) => !cancelled && isCurrentVaultPath(candidate)
    if (reuseLoadedWorkspaceEntries) {
      startReusableWorkspaceChromeLoad(effectOptions, path, isActivePath)
      return () => { cancelled = true }
    }

    startFreshInitialVaultLoad(effectOptions, path, loadOptions, isActivePath)
    return () => { cancelled = true }
  }, [
    handleVaultAvailable,
    handleVaultUnavailable,
    vaultPath,
    tracker.clear,
    unsaved.clearAll,
    isCurrentVaultPath,
    isWorkspacePathLoaded,
    newPathsRef,
    newEntriesRef,
    resetReloading,
    setEntries, setFolders, setIsLoading, setModifiedFiles, setModifiedFilesError, setViews,
    loadOptionsRef,
    loadOptionsKey,
    folderVaults
  ])
}

function useModifiedFilesLoader(vaultPath: string, isCurrentVaultPath: (path: string) => boolean) {
  const [modifiedFiles, setModifiedFiles] = useState<ModifiedFile[]>([])
  const [modifiedFilesError, setModifiedFilesError] = useState<string | null>(null)

  const runModifiedFilesLoad = useCallback(async () => {
    const path = vaultPath
    setModifiedFilesError(null)

    if (!hasVaultPath({ vaultPath: path })) {
      setModifiedFiles([])
      return
    }

    try {
      const files = await tauriCall<ModifiedFile[]>({
        command: 'get_modified_files',
        tauriArgs: { vaultPath: path, includeStats: false },
        mockArgs: {},
      })
      if (isCurrentVaultPath(path)) setModifiedFiles(files)
    } catch (err) {
      if (!isCurrentVaultPath(path)) return
      const message = typeof err === 'string' ? err : 'Failed to load changes'
      console.warn('Failed to load modified files:', err)
      setModifiedFilesError(message)
      setModifiedFiles([])
    }
  }, [vaultPath, isCurrentVaultPath])

  const loadModifiedFiles = useCoalescedAsyncTask(runModifiedFilesLoad)

  useEffect(() => { loadModifiedFiles() }, [loadModifiedFiles])

  return {
    modifiedFiles,
    modifiedFilesError,
    setModifiedFiles,
    setModifiedFilesError,
    loadModifiedFiles,
  }
}

function useEntryMutations(
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>,
  trackNew: (entry: VaultEntry) => void,
  untrackNew: (path: string) => void,
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>,
) {
  const addEntry = useCallback((entry: VaultEntry) => {
    const normalizedEntry = normalizeVaultEntry(entry)
    setEntries((prev) => {
      if (prev.some(e => e.path === normalizedEntry.path)) return prev
      return [normalizedEntry, ...prev]
    })
    trackNew(normalizedEntry)
  }, [setEntries, trackNew])

  const updateEntry = useCallback((path: string, patch: Partial<VaultEntry>) => {
    setEntries((prev) => {
      let changed = false
      const next = prev.map((entry, index) => {
        if (entry.path === path) {
          changed = true
          return normalizeVaultEntry({ ...entry, ...patch }, '', index)
        }
        return entry
      })
      return changed ? next : prev
    })
  }, [setEntries])

  const removeEntry = useCallback((path: string) => {
    setEntries((prev) => removeEntryByPath(prev, path))
    untrackNew(path)
  }, [setEntries, untrackNew])

  const removeEntries = useCallback((paths: string[]) => {
    if (paths.length === 0) return
    setEntries((prev) => removeEntriesByPath(prev, paths))
    for (const path of paths) untrackNew(path)
  }, [setEntries, untrackNew])

  const replaceEntry = useCallback((oldPath: string, patch: Partial<VaultEntry> & { path: string }) => {
    setEntries((prev) => replaceEntryByPath(prev, oldPath, patch))
    // A just-created note is protected from a stale reload snapshot by path.
    // Renaming it has to carry that protection to the new name: leaving it on
    // the old one makes the reload after the rename restore the untitled row
    // from memory, so one file on disk shows as two rows until a restart (C62).
    const protectedEntry = findProtectedEntry(newEntriesRef.current, oldPath)
    if (!protectedEntry) return
    untrackNew(protectedEntry.path)
    trackNew(normalizeVaultEntry({ ...protectedEntry, ...patch }))
  }, [setEntries, trackNew, untrackNew, newEntriesRef])

  return { addEntry, updateEntry, removeEntry, removeEntries, replaceEntry }
}

/** The tracked new-note entry for `path`, matched the way renames match paths. */
function findProtectedEntry(
  protectedEntries: Map<string, VaultEntry>,
  path: string,
): VaultEntry | undefined {
  const exact = protectedEntries.get(path)
  if (exact) return exact
  for (const entry of protectedEntries.values()) {
    if (notePathsMatch(entry.path, path)) return entry
  }
  return undefined
}

function removeEntryByPath(entries: VaultEntry[], path: string): VaultEntry[] {
  const nextEntries = entries.filter((entry) => !notePathsMatch(entry.path, path))
  return nextEntries.length === entries.length ? entries : nextEntries
}

function removeEntriesByPath(entries: VaultEntry[], paths: string[]): VaultEntry[] {
  if (paths.length === 0) return entries

  const pathSet = new Set(paths.map(normalizeNotePathForIdentity))
  const nextEntries = entries.filter((entry) => !pathSet.has(normalizeNotePathForIdentity(entry.path)))
  return nextEntries.length === entries.length ? entries : nextEntries
}

function replaceEntryByPath(
  entries: VaultEntry[],
  oldPath: string,
  patch: Partial<VaultEntry> & { path: string },
): VaultEntry[] {
  const entryIndex = entries.findIndex((entry) => notePathsMatch(entry.path, oldPath))
  if (entryIndex < 0) return entries

  // A file watcher can list the renamed file before this replace runs. Dropping
  // the duplicate here keeps one row per file on disk (C62).
  const nextEntries = entries.filter((entry, index) =>
    index === entryIndex || !notePathsMatch(entry.path, patch.path))
  const replacedIndex = nextEntries.findIndex((entry) => notePathsMatch(entry.path, oldPath))
  nextEntries[replacedIndex] = normalizeVaultEntry(
    { ...nextEntries[replacedIndex], ...patch },
    '',
    replacedIndex,
  )
  return nextEntries
}

function useGitLoaders(vaultPath: string) {
  const loadGitHistory = useCallback(async (path: string): Promise<GitCommit[]> => {
    try {
      return await tauriCall<GitCommit[]>({
        command: 'get_file_history',
        tauriArgs: { vaultPath, path },
        mockArgs: { path },
      })
    }
    catch (err) { console.warn('Failed to load git history:', err); return [] }
  }, [vaultPath])

  const loadDiffAtCommit = useCallback((path: string, commitHash: string): Promise<string> =>
    tauriCall<string>({
      command: 'get_file_diff_at_commit',
      tauriArgs: { vaultPath, path, commitHash },
      mockArgs: { path, commitHash },
    }), [vaultPath])

  const loadDiff = useCallback((path: string): Promise<string> =>
    tauriCall<string>({
      command: 'get_file_diff',
      tauriArgs: { vaultPath, path },
      mockArgs: { path },
    }), [vaultPath])

  const commitAndPush = useCallback((message: string): Promise<GitPushResult> =>
    commitWithPush({ vaultPath, message }), [vaultPath])

  return { loadGitHistory, loadDiffAtCommit, loadDiff, commitAndPush }
}

interface VaultReloadOptions {
  defaultWorkspacePath?: string | null
  folderVaults?: VaultOption[]
  handleVaultAvailable: (path: string) => void
  handleVaultUnavailable: (path: string) => void
  vaultPath: string
  isCurrentVaultPath: (path: string) => boolean
  loadModifiedFiles: () => Promise<void>
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  setFolders: (folders: FolderNode[]) => void
  setViews: (views: ViewFile[]) => void
  vaults?: VaultOption[]
}

interface EntryReloadOptions extends VaultReloadOptions {
  beginReload: () => void
  finishReload: () => void
}

// A full vault reload reads a directory snapshot that can lose a race against
// a just-created note: the reload's disk read can be in flight (or its result
// can reflect a listing taken) before the new file is visible, and resolves
// *after* the optimistic addEntry() that already put the note in state. Since
// runEntryReload replaces `entries` outright, that stale snapshot would
// silently drop the new note from the list forever — nothing else re-adds it.
// Guard by re-appending any entry the app knows it just created (tracked via
// addEntry -> trackNew) that the fresh snapshot is missing. removeEntry(s)
// untracks on delete, so a genuinely deleted note is not resurrected.
export function reconcileReloadedEntries(
  previousEntries: VaultEntry[],
  reloadedEntries: VaultEntry[],
  protectedPaths: Set<string>,
  protectedEntries?: Map<string, VaultEntry>,
): VaultEntry[] {
  if (protectedPaths.size === 0 && (!protectedEntries || protectedEntries.size === 0)) {
    return reloadedEntries
  }
  const paths = protectedEntries && protectedEntries.size > 0
    ? new Set(protectedEntries.keys())
    : protectedPaths
  const reloadedPaths = new Set(reloadedEntries.map((entry) => entry.path))
  const previousByPath = new Map(previousEntries.map((entry) => [entry.path, entry]))
  const missingProtectedEntries: VaultEntry[] = []
  for (const path of paths) {
    if (reloadedPaths.has(path)) continue
    const restored = protectedEntries?.get(path) ?? previousByPath.get(path)
    if (restored) missingProtectedEntries.push(restored)
  }
  return missingProtectedEntries.length === 0 ? reloadedEntries : [...missingProtectedEntries, ...reloadedEntries]
}

interface CollectionReloadOptions<T> {
  handleVaultUnavailable: (path: string) => void
  isCurrentVaultPath: (path: string) => boolean
  loadCollection: (options: { vaultPath: string }) => Promise<T[]>
  path: string
  setCollection: (items: T[]) => void
}

async function reloadVaultCollection<T>(options: CollectionReloadOptions<T>): Promise<T[]> {
  const { handleVaultUnavailable, isCurrentVaultPath, loadCollection, path, setCollection } = options
  if (!hasVaultPath({ vaultPath: path })) return []
  try {
    const items = await loadCollection({ vaultPath: path })
    if (!isCurrentVaultPath(path)) return []
    const nextItems = items ?? []
    setCollection(nextItems)
    return nextItems
  } catch {
    await handleUnavailableVaultPath({ handleVaultUnavailable, isCurrentVaultPath, path })
    return []
  }
}

function useFolderReload({
  folderVaults,
  handleVaultUnavailable,
  isCurrentVaultPath,
  setFolders,
  vaultPath,
}: Pick<VaultReloadOptions, 'defaultWorkspacePath' | 'folderVaults' | 'handleVaultUnavailable' | 'isCurrentVaultPath' | 'setFolders' | 'vaultPath'>) {
  return useCallback(() => reloadVaultCollection({
    handleVaultUnavailable,
    isCurrentVaultPath,
    loadCollection: folderVaults?.length
      ? (options) => loadMountedVaultFolders({ ...options, vaults: folderVaults })
      : loadVaultFolders,
    path: vaultPath,
    setCollection: setFolders,
  }), [folderVaults, handleVaultUnavailable, vaultPath, isCurrentVaultPath, setFolders])
}

function useEntryReload({
  beginReload,
  finishReload,
  handleVaultAvailable,
  handleVaultUnavailable,
  isCurrentVaultPath,
  loadModifiedFiles,
  newPathsRef,
  newEntriesRef,
  setEntries,
  vaultPath,
  vaults,
  defaultWorkspacePath,
}: EntryReloadOptions) {
  const runEntryReload = useCallback(async () => {
    const path = vaultPath
    if (!hasVaultPath({ vaultPath: path })) return [] as VaultEntry[]
    clearPrefetchCache()
    beginReload()
    try {
      const entries = await reloadVaultEntries({ vaultPath: path, vaults, defaultWorkspacePath })
      if (!isCurrentVaultPath(path)) return [] as VaultEntry[]
      handleVaultAvailable(path)
      let reconciledEntries = entries
      setEntries((prev) => {
        reconciledEntries = reconcileReloadedEntries(
          prev,
          entries,
          newPathsRef.current,
          newEntriesRef.current,
        )
        return reconciledEntries
      })
      void loadModifiedFiles()
      return reconciledEntries
    } catch (err) {
      if (await handleUnavailableVaultPath({ handleVaultUnavailable, isCurrentVaultPath, path })) return [] as VaultEntry[]
      console.warn('Vault reload failed:', err)
      return [] as VaultEntry[]
    } finally {
      finishReload()
    }
  }, [handleVaultAvailable, handleVaultUnavailable, vaultPath, vaults, defaultWorkspacePath, beginReload, finishReload, loadModifiedFiles, isCurrentVaultPath, setEntries, newPathsRef, newEntriesRef])

  return useCoalescedAsyncTask(runEntryReload)
}

function useViewReload({
  defaultWorkspacePath,
  folderVaults,
  handleVaultUnavailable,
  isCurrentVaultPath,
  setViews,
  vaultPath,
}: Pick<VaultReloadOptions, 'defaultWorkspacePath' | 'folderVaults' | 'handleVaultUnavailable' | 'isCurrentVaultPath' | 'setViews' | 'vaultPath'>) {
  const defaultWorkspacePathRef = useRef(defaultWorkspacePath)

  useEffect(() => {
    defaultWorkspacePathRef.current = defaultWorkspacePath
  }, [defaultWorkspacePath])

  return useCallback(() => reloadVaultCollection({
    handleVaultUnavailable,
    isCurrentVaultPath,
    loadCollection: folderVaults?.length
      ? (options) => loadMountedVaultViews({ ...options, defaultWorkspacePath: defaultWorkspacePathRef.current, vaults: folderVaults })
      : loadVaultViews,
    path: vaultPath,
    setCollection: setViews,
  }), [folderVaults, handleVaultUnavailable, vaultPath, isCurrentVaultPath, setViews])
}

function useVaultReloads(options: VaultReloadOptions) {
  const [activeReloads, setActiveReloads] = useState(0)
  const isReloading = activeReloads > 0
  const beginReload = useCallback(() => setActiveReloads((count) => count + 1), [])
  const finishReload = useCallback(() => setActiveReloads((count) => Math.max(0, count - 1)), [])
  const resetReloading = useCallback(() => setActiveReloads(0), [])
  const reloadFolders = useFolderReload(options)
  const reloadVault = useEntryReload({ ...options, beginReload, finishReload })
  const reloadViews = useViewReload(options)

  return { isReloading, reloadFolders, reloadVault, reloadViews, resetReloading }
}

function useGitignoredVisibilityReloads(
  reloads: Pick<ReturnType<typeof useVaultReloads>, 'reloadFolders' | 'reloadVault' | 'reloadViews'>,
) {
  const { reloadFolders, reloadVault, reloadViews } = reloads

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChanged = (event: Event) => {
      const { hide } = (event as GitignoredVisibilityChangedEvent).detail
      void Promise.all([
        reloadVault(),
        reloadFolders(),
        reloadViews(),
      ]).then(([entries]) => {
        notifyGitignoredVisibilityApplied(hide, entries)
      })
    }

    window.addEventListener(GITIGNORED_VISIBILITY_CHANGED_EVENT, handleVisibilityChanged)
    return () => {
      window.removeEventListener(GITIGNORED_VISIBILITY_CHANGED_EVENT, handleVisibilityChanged)
    }
  }, [reloadFolders, reloadVault, reloadViews])
}

function useVaultState(vaultPath: string) {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [isLoading, setIsLoading] = useState(() => hasVaultPath({ vaultPath }))
  const [views, setViews] = useState<ViewFile[]>([])
  const tracker = useNewNoteTracker()
  const pendingSave = usePendingSaveTracker()
  const unsaved = useUnsavedTracker()
  const isCurrentVaultPath = useCurrentVaultPathGuard(vaultPath)
  const modified = useModifiedFilesLoader(vaultPath, isCurrentVaultPath)

  return {
    entries,
    folders,
    isCurrentVaultPath,
    isLoading,
    modified,
    pendingSave,
    setEntries,
    setFolders,
    setIsLoading,
    setViews,
    tracker,
    unsaved,
    views,
  }
}

function useVaultUnavailable(vaultPath: string, state: ReturnType<typeof useVaultState>) {
  const {
    isCurrentVaultPath,
    modified,
    setEntries,
    setFolders,
    setIsLoading,
    setViews,
    tracker,
    unsaved,
  } = state

  return useUnavailableVaultState({
    clearNewPaths: tracker.clear,
    clearUnsaved: unsaved.clearAll,
    isCurrentVaultPath,
    setEntries,
    setFolders,
    setIsLoading,
    setModifiedFiles: modified.setModifiedFiles,
    setModifiedFilesError: modified.setModifiedFilesError,
    setViews,
    vaultPath,
  })
}

interface VaultLoaderStartupOptions {
  defaultWorkspacePath?: string | null
  folderVaults?: VaultOption[]
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  reloadIfEmpty: boolean
  setInitialFolders: (folders: FolderNode[]) => void
  state: ReturnType<typeof useVaultState>
  unavailableVault: ReturnType<typeof useVaultUnavailable>
  vaultPath: string
  vaultReloads: ReturnType<typeof useVaultReloads>
  vaults?: VaultOption[]
}

function useVaultLoaderStartup(options: VaultLoaderStartupOptions) {
  const {
    defaultWorkspacePath,
    folderVaults,
    newPathsRef,
    newEntriesRef,
    reloadIfEmpty,
    setInitialFolders,
    state,
    unavailableVault,
    vaultPath,
    vaultReloads,
    vaults,
  } = options

  const isWorkspacePathLoaded = useWorkspaceEntrySync({
    defaultWorkspacePath,
    entries: state.entries,
    isCurrentVaultPath: state.isCurrentVaultPath,
    isLoading: state.isLoading,
    newPathsRef,
    newEntriesRef,
    setEntries: state.setEntries,
    vaultPath,
    vaults,
  })

  useInitialVaultLoad({
    handleVaultAvailable: unavailableVault.markVaultAvailable,
    handleVaultUnavailable: unavailableVault.markVaultUnavailable,
    vaultPath,
    vaults,
    forceReload: false,
    reloadIfEmpty,
    folderVaults,
    defaultWorkspacePath,
    isWorkspacePathLoaded,
    newPathsRef,
    newEntriesRef,
    tracker: state.tracker,
    unsaved: state.unsaved,
    isCurrentVaultPath: state.isCurrentVaultPath,
    resetReloading: vaultReloads.resetReloading,
    setEntries: state.setEntries,
    setFolders: setInitialFolders,
    setIsLoading: state.setIsLoading,
    setModifiedFiles: state.modified.setModifiedFiles,
    setModifiedFilesError: state.modified.setModifiedFilesError,
    setViews: state.setViews,
  })
}

function useInitialFolderSetter(folderVaults: VaultOption[] | undefined, setFolders: (folders: FolderNode[]) => void) {
  const folderVaultsRef = useRef(folderVaults)

  useEffect(() => {
    folderVaultsRef.current = folderVaults
  }, [folderVaults])

  return useCallback((nextFolders: FolderNode[]) => {
    if ((folderVaultsRef.current?.length ?? 0) === 0) setFolders(nextFolders)
  }, [setFolders])
}

function useVaultChromeReloadEffect(
  vaultPath: string,
  reloadFoldersForCurrentVault: () => Promise<FolderNode[]>,
  reloadViewsForCurrentVault: () => Promise<ViewFile[]>,
) {
  useEffect(() => {
    if (!hasVaultPath({ vaultPath })) return
    void Promise.all([
      reloadFoldersForCurrentVault(),
      reloadViewsForCurrentVault(),
    ])
  }, [vaultPath, reloadFoldersForCurrentVault, reloadViewsForCurrentVault])
}

interface WorkspaceLoadRefs {
  initialLoadedVaultPathRef: MutableRefObject<string | null>
  loadedWorkspacePathsRef: MutableRefObject<Set<string>>
  loadingWorkspacePathsRef: MutableRefObject<Set<string>>
}

function useDesiredWorkspacePaths(vaultPath: string, vaults?: VaultOption[]) {
  const desiredWorkspacePaths = useMemo(
    () => uniqueWorkspacePathsFromVaults(vaultPath, vaults),
    [vaultPath, vaults],
  )
  const desiredWorkspaceKey = useMemo(
    () => workspacePathSetKey(desiredWorkspacePaths),
    [desiredWorkspacePaths],
  )
  return { desiredWorkspaceKey, desiredWorkspacePaths }
}

function useWorkspaceLoadRefs() {
  const loadedWorkspacePathsRef = useRef<Set<string>>(new Set())
  const loadingWorkspacePathsRef = useRef<Set<string>>(new Set())
  const initialLoadedVaultPathRef = useRef<string | null>(null)
  const isWorkspacePathLoaded = useCallback((path: string) => (
    path.trim().length > 0 && loadedWorkspacePathsRef.current.has(path)
  ), [])

  return {
    initialLoadedVaultPathRef,
    isWorkspacePathLoaded,
    loadedWorkspacePathsRef,
    loadingWorkspacePathsRef,
  }
}

function keepDesiredWorkspacePaths(
  paths: Set<string>,
  desiredWorkspacePaths: readonly string[],
): Set<string> {
  const desiredPathSet = new Set(desiredWorkspacePaths)
  return new Set([...paths].filter((path) => desiredPathSet.has(path)))
}

function usePrunedWorkspaceLoadRefs(
  {
    loadedWorkspacePathsRef,
    loadingWorkspacePathsRef,
  }: Pick<WorkspaceLoadRefs, 'loadedWorkspacePathsRef' | 'loadingWorkspacePathsRef'>,
  desiredWorkspaceKey: string,
  desiredWorkspacePaths: readonly string[],
) {
  useEffect(() => {
    void desiredWorkspaceKey
    loadedWorkspacePathsRef.current = keepDesiredWorkspacePaths(
      loadedWorkspacePathsRef.current,
      desiredWorkspacePaths,
    )
    loadingWorkspacePathsRef.current = keepDesiredWorkspacePaths(
      loadingWorkspacePathsRef.current,
      desiredWorkspacePaths,
    )
  }, [desiredWorkspaceKey, desiredWorkspacePaths, loadedWorkspacePathsRef, loadingWorkspacePathsRef])
}

function useInitialLoadedWorkspaceMarker({
  entries,
  initialLoadedVaultPathRef,
  isLoading,
  loadedWorkspacePathsRef,
  vaultPath,
  vaults,
}: {
  entries: VaultEntry[]
  initialLoadedVaultPathRef: MutableRefObject<string | null>
  isLoading: boolean
  loadedWorkspacePathsRef: MutableRefObject<Set<string>>
  vaultPath: string
  vaults?: VaultOption[]
}) {
  useEffect(() => {
    if (isLoading || !hasVaultPath({ vaultPath }) || initialLoadedVaultPathRef.current === vaultPath) return
    const inferFallbackWorkspacePath = !vaults?.length
    const loadedPaths = inferFallbackWorkspacePath && entries.length === 0
      ? []
      : loadedWorkspacePathsFromEntries(entries, vaultPath, { inferFallbackWorkspacePath })
    initialLoadedVaultPathRef.current = vaultPath
    loadedWorkspacePathsRef.current = new Set([
      ...loadedWorkspacePathsRef.current,
      ...loadedPaths,
    ])
  }, [entries, initialLoadedVaultPathRef, isLoading, loadedWorkspacePathsRef, vaultPath, vaults])
}

function useWorkspaceMetadataRetagEffect({
  defaultWorkspacePath,
  desiredWorkspaceKey,
  desiredWorkspacePaths,
  setEntries,
  vaultPath,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  desiredWorkspaceKey: string
  desiredWorkspacePaths: readonly string[]
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  vaultPath: string
  vaults?: VaultOption[]
}) {
  useEffect(() => {
    void desiredWorkspaceKey
    if (!hasVaultPath({ vaultPath })) return

    setEntries((currentEntries) => retagEntriesForWorkspaceMetadata({
      defaultWorkspacePath,
      entries: pruneEntriesOutsideWorkspaceSet({
        desiredPaths: desiredWorkspacePaths,
        entries: currentEntries,
        fallbackVaultPath: vaultPath,
      }),
      fallbackVaultPath: vaultPath,
      vaults,
    }))
  }, [defaultWorkspacePath, desiredWorkspaceKey, desiredWorkspacePaths, setEntries, vaultPath, vaults])
}

function missingWorkspaceVaults({
  desiredWorkspacePaths,
  loadedPaths,
  loadingPaths,
  vaults,
}: {
  desiredWorkspacePaths: readonly string[]
  loadedPaths: Set<string>
  loadingPaths: Set<string>
  vaults?: VaultOption[]
}): VaultOption[] {
  if (!vaults?.length) return []
  return vaults.filter((vault) => (
    desiredWorkspacePaths.includes(vault.path)
    && !loadedPaths.has(vault.path)
    && !loadingPaths.has(vault.path)
  ))
}

function loadMissingWorkspaceEntries({
  defaultWorkspacePath,
  isCurrentVaultPath,
  loadedPaths,
  loadingPaths,
  newPathsRef,
  newEntriesRef,
  setEntries,
  vault,
  vaultPath,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  isCurrentVaultPath: (path: string) => boolean
  loadedPaths: Set<string>
  loadingPaths: Set<string>
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  vault: VaultOption
  vaultPath: string
  vaults?: VaultOption[]
}) {
  void loadWorkspaceEntries(vault, defaultWorkspacePath, {
    forceReload: vault.path === vaultPath,
    reloadIfEmpty: true,
  })
    .then((loadedEntries) => {
      if (!isCurrentVaultPath(vaultPath)) return
      loadedPaths.add(vault.path)
      setEntries((currentEntries) => replaceWorkspaceEntries({
        defaultWorkspacePath,
        entries: currentEntries,
        fallbackVaultPath: vaultPath,
        loadedEntries,
        loadedWorkspacePath: vault.path,
        protectedPaths: newPathsRef.current,
        protectedEntries: newEntriesRef.current,
        vaults,
      }))
    })
    .catch((error: unknown) => {
      console.warn(`Failed to load workspace entries for ${vault.path}:`, error)
    })
    .finally(() => {
      loadingPaths.delete(vault.path)
    })
}

function useMissingWorkspaceLoads({
  defaultWorkspacePath,
  desiredWorkspaceKey,
  desiredWorkspacePaths,
  isCurrentVaultPath,
  isLoading,
  loadedWorkspacePathsRef,
  loadingWorkspacePathsRef,
  newPathsRef,
  newEntriesRef,
  setEntries,
  vaultPath,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  desiredWorkspaceKey: string
  desiredWorkspacePaths: readonly string[]
  isCurrentVaultPath: (path: string) => boolean
  isLoading: boolean
  loadedWorkspacePathsRef: MutableRefObject<Set<string>>
  loadingWorkspacePathsRef: MutableRefObject<Set<string>>
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  vaultPath: string
  vaults?: VaultOption[]
}) {
  useEffect(() => {
    void desiredWorkspaceKey
    if (!hasVaultPath({ vaultPath }) || !vaults?.length || isLoading) return

    const loadedPaths = loadedWorkspacePathsRef.current
    const loadingPaths = loadingWorkspacePathsRef.current
    const missingVaults = missingWorkspaceVaults({ desiredWorkspacePaths, loadedPaths, loadingPaths, vaults })
    if (missingVaults.length === 0) return

    for (const vault of missingVaults) loadingPaths.add(vault.path)
    for (const vault of missingVaults) {
      loadMissingWorkspaceEntries({
        defaultWorkspacePath,
        isCurrentVaultPath,
        loadedPaths,
        loadingPaths,
        newPathsRef,
        newEntriesRef,
        setEntries,
        vault,
        vaultPath,
        vaults,
      })
    }
  }, [
    defaultWorkspacePath,
    desiredWorkspaceKey,
    desiredWorkspacePaths,
    isCurrentVaultPath,
    isLoading,
    loadedWorkspacePathsRef,
    loadingWorkspacePathsRef,
    newPathsRef,
    newEntriesRef,
    setEntries,
    vaultPath,
    vaults
  ])
}

function useWorkspaceEntrySync({
  defaultWorkspacePath,
  entries,
  isCurrentVaultPath,
  isLoading,
  newPathsRef,
  newEntriesRef,
  setEntries,
  vaultPath,
  vaults,
}: {
  defaultWorkspacePath?: string | null
  entries: VaultEntry[]
  isCurrentVaultPath: (path: string) => boolean
  isLoading: boolean
  newPathsRef: MutableRefObject<Set<string>>
  newEntriesRef: MutableRefObject<Map<string, VaultEntry>>
  setEntries: Dispatch<SetStateAction<VaultEntry[]>>
  vaultPath: string
  vaults?: VaultOption[]
}) {
  const { desiredWorkspaceKey, desiredWorkspacePaths } = useDesiredWorkspacePaths(vaultPath, vaults)
  const refs = useWorkspaceLoadRefs()

  usePrunedWorkspaceLoadRefs(refs, desiredWorkspaceKey, desiredWorkspacePaths)
  useInitialLoadedWorkspaceMarker({ entries, vaultPath, vaults, isLoading, ...refs })
  useWorkspaceMetadataRetagEffect({
    defaultWorkspacePath,
    desiredWorkspaceKey,
    desiredWorkspacePaths,
    setEntries,
    vaultPath,
    vaults,
  })
  useMissingWorkspaceLoads({
    defaultWorkspacePath,
    desiredWorkspaceKey,
    desiredWorkspacePaths,
    isCurrentVaultPath,
    isLoading,
    newPathsRef,
    newEntriesRef,
    setEntries,
    vaultPath,
    vaults,
    ...refs,
  })

  return refs.isWorkspacePathLoaded
}

interface VaultLoaderResultOptions {
  entryMutations: ReturnType<typeof useEntryMutations>
  gitLoaders: ReturnType<typeof useGitLoaders>
  state: ReturnType<typeof useVaultState>
  unavailableVault: ReturnType<typeof useVaultUnavailable>
  vaultReloads: ReturnType<typeof useVaultReloads>
}

function useVaultLoaderResult({
  entryMutations,
  gitLoaders,
  state,
  unavailableVault,
  vaultReloads,
}: VaultLoaderResultOptions) {
  const { modified, pendingSave, tracker, unsaved } = state
  const getNoteStatus = useCallback((path: string): NoteStatus =>
    resolveNoteStatus({
      path,
      newPaths: tracker.newPaths,
      modifiedFiles: modified.modifiedFiles,
      pendingSavePaths: pendingSave.pendingSavePaths,
      unsavedPaths: unsaved.unsavedPaths,
    }), [tracker.newPaths, modified.modifiedFiles, pendingSave.pendingSavePaths, unsaved.unsavedPaths])

  return {
    entries: state.entries,
    folders: state.folders,
    isLoading: state.isLoading,
    isReloading: vaultReloads.isReloading,
    views: state.views,
    modifiedFiles: modified.modifiedFiles,
    modifiedFilesError: modified.modifiedFilesError,
    unavailableVaultPath: unavailableVault.unavailableVaultPath,
    ...entryMutations,
    loadModifiedFiles: modified.loadModifiedFiles,
    ...gitLoaders,
    getNoteStatus,
    reloadVault: vaultReloads.reloadVault,
    reloadFolders: vaultReloads.reloadFolders,
    reloadViews: vaultReloads.reloadViews,
    markVaultUnavailable: unavailableVault.markVaultUnavailable,
    addPendingSave: pendingSave.addPendingSave,
    removePendingSave: pendingSave.removePendingSave,
    unsavedPaths: unsaved.unsavedPaths,
    trackUnsaved: unsaved.trackUnsaved,
    clearUnsaved: unsaved.clearUnsaved,
  }
}

export function useVaultLoader(vaultPath: string, vaults?: VaultOption[], defaultWorkspacePath?: string | null, folderVaults?: VaultOption[]) {
  const state = useVaultState(vaultPath)
  const setInitialFolders = useInitialFolderSetter(folderVaults, state.setFolders)
  const entryMutations = useEntryMutations(
    state.setEntries,
    state.tracker.trackNew,
    state.tracker.untrack,
    state.tracker.newEntriesRef,
  )
  const gitLoaders = useGitLoaders(vaultPath)
  const unavailableVault = useVaultUnavailable(vaultPath, state)
  const newPathsRef = state.tracker.newPathsRef
  const newEntriesRef = state.tracker.newEntriesRef
  const vaultReloads = useVaultReloads({
    handleVaultAvailable: unavailableVault.markVaultAvailable,
    handleVaultUnavailable: unavailableVault.markVaultUnavailable,
    defaultWorkspacePath,
    folderVaults,
    vaultPath,
    vaults,
    isCurrentVaultPath: state.isCurrentVaultPath,
    loadModifiedFiles: state.modified.loadModifiedFiles,
    newPathsRef,
    newEntriesRef,
    setEntries: state.setEntries,
    setFolders: state.setFolders,
    setViews: state.setViews,
  })

  useGitignoredVisibilityReloads(vaultReloads)
  useVaultChromeReloadEffect(vaultPath, vaultReloads.reloadFolders, vaultReloads.reloadViews)

  useVaultLoaderStartup({
    defaultWorkspacePath,
    folderVaults,
    newPathsRef,
    newEntriesRef,
    reloadIfEmpty: !isNoteWindow(),
    setInitialFolders,
    state,
    unavailableVault,
    vaultPath,
    vaultReloads,
    vaults,
  })

  return useVaultLoaderResult({ entryMutations, gitLoaders, state, unavailableVault, vaultReloads })
}
