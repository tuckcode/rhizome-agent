import { noteExistsOnDisk, persistNewNote } from './hooks/useNoteCreation'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionsPanel, type ConnectionsPanelHandle, type ConnectionsViewRequest } from './components/ConnectionsPanel'
import { APP_STORAGE_KEYS } from './constants/appStorage'
import { usePanelWidth } from './hooks/usePanelWidth'
import { startResizeDrag } from './utils/startResizeDrag'
import { subheadTrafficLightInset } from './utils/trafficLights'
import { Sidebar } from './components/Sidebar'
import { CommandRail, type CommandRailDestination } from './components/CommandRail'
import { NoteList } from './components/NoteList'
import {
  VaultPanel,
  VaultPanelRestoreButton,
} from './components/VaultPanel'
import { Editor } from './components/Editor'
import { AskChatExcerptMenu } from './components/AskChatExcerptMenu'
import { ChatNoteSplitToggle } from './components/ChatNoteSplitToggle'
import { useChatNoteSplit, shouldForceChatShellCompact, type ChatNoteSplit } from './components/chatNoteSplit'
import { formatAskChatExcerpt } from './components/askChatExcerpt'
import { prefillAiComposer } from './utils/aiPromptBridge'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { CreateViewDialog } from './components/CreateViewDialog'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog'
import { SearchPanel } from './components/SearchPanel'
import { Toast } from './components/Toast'
import { CommitDialog } from './components/CommitDialog'
import { PulseView } from './components/PulseView'
import { StatusBar } from './components/StatusBar'
// Lazy: keeps three.js/3d-force-graph out of the main bundle chunk.
const GraphView = lazy(() => import('./components/graph/GraphView'))
const MyceliumView = lazy(() => import('./components/MyceliumView'))
const ChatHome = lazy(() => import('./components/ChatHome'))
import { AppAiWorkspaceSurface } from './components/AppAiWorkspaceSurface'
import { writePromoteNoteFromChat } from './utils/promoteChatToVault'
import { AiWorkspaceWindowApp } from './components/AiWorkspaceWindowApp'
import { SettingsPanel } from './components/SettingsPanel'
import { CloneVaultModal } from './components/CloneVaultModal'
import { FeedbackDialog } from './components/FeedbackDialog'
import { McpSetupDialog } from './components/McpSetupDialog'
import { ResearchPanel } from './components/ResearchPanel'
import { NoteRetargetingDialogs } from './components/note-retargeting/NoteRetargetingDialogs'
import { StartupScreen } from './components/StartupScreen'
import { useAiAgentsOnboarding } from './hooks/useAiAgentsOnboarding'
import { useAiAgentsStatus } from './hooks/useAiAgentsStatus'
import { useVaultAiGuidanceStatus } from './hooks/useVaultAiGuidanceStatus'
import { useAutoGit } from './hooks/useAutoGit'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useIsWikiVault } from './hooks/useIsWikiVault'
import { useInboxWatcher } from './hooks/useInboxWatcher'
import { isInboxAutomationEnabled } from './utils/inboxAutomation'
import { useRecentVaultWrites, useVaultWatcher } from './hooks/useVaultWatcher'
import { useSettings } from './hooks/useSettings'
import { CelebrationProvider } from './components/CelebrationProvider'
import { PrimeActivityProvider } from './components/PrimeActivityProvider'
import { readCelebrationsEnabled } from './lib/celebration'
import { requestCelebration } from './lib/celebrationEvents'
import { useNoteWidthMode } from './hooks/useNoteWidthMode'
import { useNoteActions } from './hooks/useNoteActions'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useGitRepositories } from './hooks/useGitRepositories'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { triggerCommitEntryAction } from './utils/commitEntryAction'
import { generateCommitMessage } from './utils/commitMessage'
import { useDialogs } from './hooks/useDialogs'
import { useVaultSwitcher } from './hooks/useVaultSwitcher'
import { useGitHistory } from './hooks/useGitHistory'
import { useUpdater, restartApp } from './hooks/useUpdater'
import { usePrimeUpdate } from './hooks/usePrimeUpdate'
import { usePrimeHostStatus } from './hooks/usePrimeHostStatus'
import { useAutoSync } from './hooks/useAutoSync'
import { useConflictResolver } from './hooks/useConflictResolver'
import { useVaultConfig } from './hooks/useVaultConfig'
import { useOnboarding } from './hooks/useOnboarding'
import { useGettingStartedClone } from './hooks/useGettingStartedClone'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAiActivity } from './hooks/useAiActivity'
import { useBulkActions } from './hooks/useBulkActions'
import { useDeleteActions } from './hooks/useDeleteActions'
import { useFolderActions } from './hooks/useFolderActions'
import { useFileActions } from './hooks/useFileActions'
import { useDeepLinks } from './hooks/useDeepLinks'
import { useNoteGitUrls } from './hooks/useNoteGitUrls'
import { useLayoutPanels } from './hooks/useLayoutPanels'
import { useConflictFlow } from './hooks/useConflictFlow'
import { useAppSave } from './hooks/useAppSave'
import { useNoteRetargetingUi } from './hooks/useNoteRetargetingUi'
import { useVaultBridge } from './hooks/useVaultBridge'
import { useSavedViewOrdering } from './hooks/useSavedViewOrdering'
import { useAppViewActions } from './hooks/useAppViewActions'
import { useAppWindowControls } from './hooks/useAppWindowControls'
import { useShellCompactLayout } from './hooks/useShellCompactLayout'
import { useAiWorkspacePublishedContext } from './hooks/useAiWorkspacePublishedContext'
import {
  useNeighborhoodEntry,
  useNeighborhoodEscape,
  useNeighborhoodHistoryBack,
  useSelectionSanitizer,
} from './hooks/useNeighborhoodSelection'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { PrimeActiveCloseDialog } from './components/PrimeActiveCloseDialog'
import { usePrimeActiveClose } from './hooks/usePrimeActiveClose'
import { DeleteProgressNotice } from './components/DeleteProgressNotice'
import { UpdateBanner } from './components/UpdateBanner'
import { VersionUpdateIndicator } from './components/VersionUpdateIndicator'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from './mock-tauri'
import type { AiWorkspaceConversationSetting, GitSetupPreference, SidebarSelection, InboxPeriod, VaultEntry, WorkspaceIdentity } from './types'
import { initializeNoteProperties } from './utils/initializeNoteProperties'
import { type NoteListFilter } from './utils/noteListHelpers'
import { openNoteInNewWindow } from './utils/openNoteWindow'
import { refreshPulledVaultState } from './utils/pulledVaultRefresh'
import { viewMatchesSelection } from './utils/viewIdentity'
import { isAiWorkspaceWindow, isMenuBarCompanionWindow, isNoteWindow, getNoteWindowParams, type NoteWindowParams } from './utils/windowMode'
import { MenuBarCompanionApp } from './components/MenuBarCompanionApp'
import { GitSetupDialog } from './components/GitRequiredModal'
import { RenameDetectedBanner } from './components/RenameDetectedBanner'
import { openNoteListPropertiesPicker } from './components/note-list/noteListPropertiesEvents'
import type { NoteListMultiSelectionCommands } from './components/note-list/multiSelectionCommands'
import { focusNoteIconPropertyEditor } from './components/noteIconPropertyEvents'
import { trackEvent } from './lib/telemetry'
import { trackVaultCredentialsHandled } from './lib/productAnalytics'
import { redactCredentialTokens } from './lib/sensitiveTextRedaction'
import { areAutomaticUpdateChecksEnabled } from './lib/automaticUpdateChecks'
import { aiTargetReady, type AiTarget } from './lib/aiTargets'
import { areGitFeaturesEnabled } from './lib/gitSettings'
import { useAppCommandAiActions } from './hooks/useAppCommandAiActions'
import { RHIZOME_DOCS_URL } from './constants/feedback'
import { openExternalUrl } from './utils/url'
import {
  translate,
} from './lib/i18n'
import { normalizeReleaseChannel } from './lib/releaseChannel'
import {
  buildVaultAiGuidanceRefreshKey,
} from './lib/vaultAiGuidance'
import { hasNoteIconValue } from './utils/noteIcon'
import {
  INBOX_SELECTION,
  isExplicitOrganizationEnabled,
  sanitizeSelectionForOrganization,
  toggleGraphSelection,
} from './utils/organizationWorkflow'
import { requestPlainTextPaste } from './utils/plainTextPaste'
import { SETTINGS_SECTION_IDS } from './components/settingsSectionIds'
import {
  vaultPathForEntry,
} from './utils/workspaces'
import { notePathsMatch } from './utils/notePathIdentity'
import { activeGitRepositories } from './utils/gitRepositories'
import { isMarkdownEntry } from './utils/typeDefinitions'
import { resolveTypeDeleteRequest, typeDeleteBlockedMessageKey } from './utils/typeDeletion'
import { useVisibleWorkspaceEntries, useWorkspaceGraphState } from './hooks/useWorkspaceGraphState'
import { useGitSetupState } from './hooks/useGitSetupState'
import { AppPreferencesProvider, useAppPreferences } from './hooks/useAppPreferences'
import { useInboxOrganizeAdvance } from './hooks/useInboxOrganizeAdvance'
import { syncVaultAssetScope, useNoteWindowLifecycle } from './hooks/useNoteWindowLifecycle'
import { useVaultRenameDetection } from './hooks/useVaultRenameDetection'
import { useVaultOpenedTelemetry } from './hooks/useVaultOpenedTelemetry'
import { useStartupScreenState } from './hooks/useStartupScreenState'
import { useGitFileWorkflows } from './hooks/useGitFileWorkflows'
import { useAutoGitWork } from './hooks/useAutoGitWork'
import { useAppAiWorkspaceBridge } from './hooks/useAppAiWorkspaceBridge'
import { useAiWorkspaceWindowBridgeEvents } from './hooks/useAiWorkspaceWindowBridgeEvents'
import { useMcpSetupDialogController } from './hooks/useMcpSetupDialogController'
import { useFeatureFlag } from './hooks/useFeatureFlag'
import { shouldReplaceSyncedTabEntry } from './utils/tabEntrySync'
import {
  activeVaultModifiedFiles,
  aiWorkspaceWindowContextForPath,
  canCustomizeColumnsForSelection,
  isActiveElementInsideEditorSurface,
  mergeModifiedFiles,
  runNativeTextHistoryCommand,
  shouldPreferOnboardingVaultPath,
} from './utils/appOrchestration'
import './App.css'

const DEFAULT_SELECTION: SidebarSelection = INBOX_SELECTION

/** Wraps useEditorSave to also keep outgoingLinks in sync on save and on content change. */
function App() {
  const noteWindowParams = useMemo(() => isNoteWindow() ? getNoteWindowParams() : null, [])
  const aiWorkspaceWindow = useMemo(() => isAiWorkspaceWindow(), [])
  const menuBarCompanionWindow = useMemo(() => isMenuBarCompanionWindow(), [])

  if (menuBarCompanionWindow) return <MenuBarCompanionApp />
  if (aiWorkspaceWindow) return <AiWorkspaceWindowApp />

  return <MainApp noteWindowParams={noteWindowParams} />
}

function MainApp({ noteWindowParams }: { noteWindowParams: NoteWindowParams | null }) {
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>('open')
  const [pendingNoteListPdfExportPath, setPendingNoteListPdfExportPath] = useState<string | null>(null)
  const selectionRef = useRef<SidebarSelection>(DEFAULT_SELECTION)
  const neighborhoodHistoryRef = useRef<SidebarSelection[]>([])
  const inboxPeriod: InboxPeriod = 'all'
  const handleSetSelection = useCallback((sel: SidebarSelection, options?: { preserveNeighborhoodHistory?: boolean }) => {
    if (!options?.preserveNeighborhoodHistory && sel.kind !== 'entity') {
      neighborhoodHistoryRef.current = []
    }
    selectionRef.current = sel
    setSelection(sel)
    setNoteListFilter('open')
  }, [])
  const handleEnterNeighborhood = useNeighborhoodEntry({
    neighborhoodHistoryRef,
    selectionRef,
    setSelection: handleSetSelection,
  })
  const layout = useLayoutPanels(noteWindowParams ? { initialInspectorCollapsed: true } : undefined)
  const { setInspectorCollapsed } = layout
  const visibleNotesRef = useRef<VaultEntry[]>([])
  const multiSelectionCommandRef = useRef<NoteListMultiSelectionCommands | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // "Ask the agent about this note" — the vault pointing at the conversation.
  // `requestId` rather than a bare path so asking twice about the same note
  // reopens it after the user has closed the pane.
  const [chatNoteRequest, setChatNoteRequest] = useState<
    { path: string; label: string; requestId: number } | null
  >(null)
  const chatNoteRequestId = useRef(1)
  const [gitHistoryRefreshKey, setGitHistoryRefreshKey] = useState(0)
  const dialogs = useDialogs()
  const { closeAIChat, openAIChat, showAIChat } = dialogs
  const [showFeedback, setShowFeedback] = useState(false)
  const [myceliumFocusPath, setMyceliumFocusPath] = useState<string | null>(null)
  const openFeedback = useCallback(() => setShowFeedback(true), [])
  const closeFeedback = useCallback(() => setShowFeedback(false), [])
  const openDocs = useCallback(() => {
    void openExternalUrl(RHIZOME_DOCS_URL)
  }, [])
  const networkStatus = useNetworkStatus()
  const { settings, loaded: settingsLoaded, saveSettings } = useSettings()
  const primeActiveClose = usePrimeActiveClose()

  // onSwitch closure captures `notes` declared below — safe because it's only
  // called on user interaction, never during render (refs inside the hook
  // guarantee the latest closure is always used).
  const vaultSwitcher = useVaultSwitcher({
    onSwitch: () => {
      if (noteWindowParams) return
      handleSetSelection(DEFAULT_SELECTION)
      notes.closeAllTabs()
    },
    onToast: (msg) => setToastMessage(msg),
  })
  const {
    allVaults,
    defaultWorkspacePath,
    registerVaultSelection,
    selectedVaultPath,
    syncVaultSelection,
    switchVault,
  } = vaultSwitcher

  const rememberVaultChoice = useCallback((vaultPath: string) => {
    if (!vaultPath) return

    if (allVaults.some((vault) => vault.path === vaultPath)) {
      switchVault(vaultPath)
      return
    }

    const label = vaultPath.split('/').filter(Boolean).pop() || 'Local Vault'
    syncVaultSelection(vaultPath, label)
  }, [allVaults, switchVault, syncVaultSelection])

  const handleGettingStartedVaultReady = useCallback((vaultPath: string) => {
    rememberVaultChoice(vaultPath)
    setToastMessage(`Getting Started vault created and opened at ${vaultPath}`)
  }, [rememberVaultChoice])

  const handleOnboardingVaultReady = useCallback((vaultPath: string, source: 'template' | 'empty' | 'existing') => {
    rememberVaultChoice(vaultPath)
    if (source === 'template') {
      setToastMessage(`Getting Started vault created and opened at ${vaultPath}`)
    }
  }, [rememberVaultChoice])
  const cloneGettingStartedVault = useGettingStartedClone({
    onError: (message) => setToastMessage(message),
    onSuccess: handleGettingStartedVaultReady,
  })
  const onboarding = useOnboarding(vaultSwitcher.vaultPath, {
    onVaultReady: handleOnboardingVaultReady,
    registerVault: registerVaultSelection,
  }, vaultSwitcher.loaded)
  const aiAgentsStatus = useAiAgentsStatus()
  const aiAgentsOnboarding = useAiAgentsOnboarding(
    onboarding.state.status === 'ready' && !noteWindowParams,
  )

  // Onboarding can briefly own the vault path for a newly created/opened vault
  // before the persisted switcher catches up, but once the path is already in
  // the switcher list we should trust the explicit switcher state.
  const resolvedPath = noteWindowParams?.vaultPath ?? (
    shouldPreferOnboardingVaultPath(onboarding.state, vaultSwitcher.allVaults)
      ? onboarding.state.vaultPath
      : vaultSwitcher.vaultPath
  )
  const aiWorkspaceWindowContext = useMemo(() => aiWorkspaceWindowContextForPath(resolvedPath), [resolvedPath])
  const [settingsInitialSectionId, setSettingsInitialSectionId] = useState<string | null>(null)
  // Wave 5.3 command rail. Default on; classic shell is `ff_shell_command_rail=false`.
  const commandRailEnabled = useFeatureFlag('shell_command_rail')
  const chatCentered = commandRailEnabled && !noteWindowParams
  const openChatHome = useCallback(() => {
    // Rail-on Chat is furniture, not a destination. Classic shell still
    // replaces the notes window with ChatHome.
    if (commandRailEnabled) return
    handleSetSelection({ kind: 'filter', filter: 'chat' })
  }, [commandRailEnabled, handleSetSelection])
  const {
    effectiveShowAIChat,
    handleOpenAiSettings,
    handleOpenDockedAiWorkspace,
  } = useAppAiWorkspaceBridge({
    aiWorkspaceWindow: false,
    openAIChat,
    openChatHome,
    openSettings: dialogs.openSettings,
    setSettingsInitialSectionId,
    showAIChat,
    suppressDefaultOpen: Boolean(noteWindowParams),
    vaultReady: vaultSwitcher.loaded,
  })
  const handleToggleAiWorkspace = useCallback(() => {
    if (effectiveShowAIChat) {
      closeAIChat()
      return
    }
    handleOpenDockedAiWorkspace()
  }, [closeAIChat, effectiveShowAIChat, handleOpenDockedAiWorkspace])
  const [lastAiWorkspaceConversationId, setLastAiWorkspaceConversationId] = useState<string | null>(null)
  const handleActiveAiWorkspaceConversationChange = useCallback((id: string) => {
    setLastAiWorkspaceConversationId(id)
  }, [])
  const [lastAiWorkspaceTarget, setLastAiWorkspaceTarget] = useState<AiTarget | null>(null)
  const handleActiveAiWorkspaceTargetChange = useCallback((target: AiTarget) => {
    setLastAiWorkspaceTarget((current) => (current?.id === target.id ? current : target))
  }, [])
  const {
    folderVaults,
    graphDefaultWorkspacePath,
    graphVaults,
    inspectorWorkspaces,
    multiWorkspaceEnabled,
    visibleWorkspacePathList,
    writableVaultPaths,
  } = useWorkspaceGraphState({
    allVaults,
    defaultWorkspacePath,
    resolvedPath,
    settings,
    vaultSwitcherLoaded: vaultSwitcher.loaded,
    windowMode: Boolean(noteWindowParams),
  })
  const vaultWorkspaceOrder = useMemo(
    () => vaultSwitcher.allVaults.map((vault) => vault.path),
    [vaultSwitcher.allVaults],
  )
  const { config: vaultConfig, updateConfig } = useVaultConfig(resolvedPath)
  const gitFeaturesEnabled = areGitFeaturesEnabled(settings)
  const handleGitSetupPreferenceChange = useCallback((preference: GitSetupPreference) => {
    updateConfig('git_setup_preference', preference)
  }, [updateConfig])
  const {
    dismissGitSetupDialog,
    gitRepoState,
    handleInitGitRepo,
    neverForVaultGitSetupDialog,
    openGitSetupDialog,
    shouldShowGitSetupDialog,
  } = useGitSetupState({
    gitSetupPreference: vaultConfig.git_setup_preference,
    onGitSetupPreferenceChange: handleGitSetupPreferenceChange,
    onToast: setToastMessage,
    resolvedPath,
    windowMode: Boolean(noteWindowParams),
  })

  const vault = useVaultLoader(resolvedPath, graphVaults, multiWorkspaceEnabled ? defaultWorkspacePath : null, folderVaults)
  const isWikiVault = useIsWikiVault(resolvedPath)
  useInboxWatcher(resolvedPath, isInboxAutomationEnabled(vaultConfig.inbox_automation_enabled), setToastMessage)
  const gitRepositories = useMemo(() => activeGitRepositories({
    defaultVaultPath: graphDefaultWorkspacePath,
    multiWorkspaceEnabled,
    vaults: allVaults,
  }), [allVaults, graphDefaultWorkspacePath, multiWorkspaceEnabled])
  const activeGitRepositoryPaths = useMemo(
    () => gitRepositories.map((repository) => repository.path),
    [gitRepositories],
  )
  const gitSurfaces = useGitRepositories({
    defaultVaultPath: graphDefaultWorkspacePath,
    repositories: gitRepositories,
  })
  const watchedVaultPaths = useMemo(() => {
    if (visibleWorkspacePathList && visibleWorkspacePathList.length > 0) return visibleWorkspacePathList
    return resolvedPath.trim() ? [resolvedPath] : []
  }, [resolvedPath, visibleWorkspacePathList])
  const visibleEntries = useVisibleWorkspaceEntries({
    entries: vault.entries,
    multiWorkspaceEnabled,
    visibleWorkspacePathList,
  })
  const runtimeMissingVaultPath = vault.unavailableVaultPath
  const {
    markInternalWrite: markRecentVaultWrite,
    filterExternalPaths: filterExternalVaultPaths,
  } = useRecentVaultWrites({
    vaultPath: resolvedPath,
    vaultPaths: watchedVaultPaths,
  })
  const {
    status: vaultAiGuidanceStatus,
    refresh: refreshVaultAiGuidance,
  } = useVaultAiGuidanceStatus(
    resolvedPath,
    buildVaultAiGuidanceRefreshKey(vault.entries),
  )
  const explicitOrganizationEnabled = isExplicitOrganizationEnabled(vaultConfig.inbox?.explicitOrganization)
  const effectiveSelection = sanitizeSelectionForOrganization(selection, vaultConfig.inbox?.explicitOrganization)
  const isChangesSelection = effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'changes'

  useSelectionSanitizer({
    effectiveSelection,
    neighborhoodHistoryRef,
    selection,
    selectionRef,
    setNoteListFilter,
    setSelection,
  })

  const handleNeighborhoodHistoryBack = useNeighborhoodHistoryBack({
    neighborhoodHistoryRef,
    setSelection: handleSetSelection,
  })

  const handleSaveExplicitOrganization = useCallback((enabled: boolean) => {
    updateConfig('inbox', {
      noteListProperties: vaultConfig.inbox?.noteListProperties ?? null,
      explicitOrganization: enabled,
    })
  }, [updateConfig, vaultConfig.inbox?.noteListProperties])
  const {
    aiAgentPreferences,
    allNotesFileVisibility,
    appLocale,
    dateDisplayFormat,
    documentThemeMode,
    handleSetThemeMode,
    handleSetUiLanguage,
    handleToggleThemeMode,
    selectedUiLanguage,
    systemLocale,
  } = useAppPreferences({
    aiAgentsStatus,
    onToast: setToastMessage,
    saveSettings,
    settings,
    settingsLoaded,
  })
  const quickPromptTarget = lastAiWorkspaceTarget ?? aiAgentPreferences.defaultAiTarget
  const quickPromptTargetReady = aiTargetReady(quickPromptTarget, aiAgentsStatus)

  useVaultOpenedTelemetry({
    entryCount: vault.entries.length,
    gitRepoState,
    resolvedPath,
  })
  const mcpSetupDialog = useMcpSetupDialogController(resolvedPath, setToastMessage, appLocale)
  const loadDefaultVaultModifiedFiles = vault.loadModifiedFiles
  const loadAllGitModifiedFiles = gitSurfaces.loadAllModifiedFiles
  const loadModifiedFilesForRepository = gitSurfaces.loadModifiedFilesForRepository
  const refreshAllGitRemoteStatuses = gitSurfaces.refreshAllRemoteStatuses
  const refreshRemoteStatusForRepository = gitSurfaces.refreshRemoteStatusForRepository
  const refreshGitRemoteStatus = useCallback(
    () => refreshRemoteStatusForRepository(resolvedPath),
    [refreshRemoteStatusForRepository, resolvedPath],
  )
  const refreshGitModifiedFiles = useCallback(async () => {
    if (!gitFeaturesEnabled) return
    await Promise.all([
      loadDefaultVaultModifiedFiles(),
      loadAllGitModifiedFiles({ includeStats: isChangesSelection }),
    ])
  }, [gitFeaturesEnabled, isChangesSelection, loadAllGitModifiedFiles, loadDefaultVaultModifiedFiles])
  const loadVaultModifiedFiles = refreshGitModifiedFiles

  useEffect(() => {
    if (!gitFeaturesEnabled) return
    if (gitRepoState !== 'ready') return
    void loadVaultModifiedFiles()
    void refreshGitRemoteStatus()
    void refreshAllGitRemoteStatuses()
  }, [gitFeaturesEnabled, gitRepoState, loadVaultModifiedFiles, refreshAllGitRemoteStatuses, refreshGitRemoteStatus])

  const handleOpenSettings = useCallback(() => {
    setSettingsInitialSectionId(null)
    dialogs.openSettings()
  }, [dialogs])

  /*
    The note tree only docks right when the command rail is there to hold the
    left edge — the rail is what reserves room for the macOS traffic lights.
    With the classic shell (`ff_shell_command_rail=false`) nothing else would,
    so the tree stays where it was.
  */
  const sidebarDock: 'left' | 'right' = commandRailEnabled ? 'right' : 'left'
  const isGraphDestination =
    effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'graph'
  const isMyceliumDestination =
    effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'mycelium'
  const isResearchDestination =
    effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'research'
  // Classic shell only: Chat is still a destination that replaces the vault.
  const isChatDestination =
    !chatCentered &&
    effectiveSelection.kind === 'filter' &&
    effectiveSelection.filter === 'chat'
  const handleRailSelectChat = useCallback(() => {
    if (isGraphDestination || isMyceliumDestination || isResearchDestination) {
      handleSetSelection({
        kind: 'filter',
        filter: explicitOrganizationEnabled ? 'inbox' : 'all',
      })
    }
  }, [
    explicitOrganizationEnabled,
    handleSetSelection,
    isGraphDestination,
    isMyceliumDestination,
    isResearchDestination,
  ])
  /**
   * Right-click a note → hand it to the agent.
   *
   * Switches to Chat and opens the note above it, which is what makes the
   * agent able to see it — `ChatHome` feeds its open note into the agent's
   * context. So this is one action, not two: go to chat, and bring the note.
   */
  const handleAskAgentAboutNote = useCallback((entry: VaultEntry) => {
    handleRailSelectChat()
    setChatNoteRequest({
      path: entry.path,
      label: entry.title || entry.filename || entry.path,
      requestId: chatNoteRequestId.current++,
    })
  }, [handleRailSelectChat])
  const handleRailSelectResearch = useCallback(() => {
    handleSetSelection({ kind: 'filter', filter: 'research' })
  }, [handleSetSelection])
  const handleRailSelectInbox = useCallback(() => {
    handleSetSelection({ kind: 'filter', filter: explicitOrganizationEnabled ? 'inbox' : 'all' })
  }, [handleSetSelection, explicitOrganizationEnabled])
  // Graph and Mycelium live under Notes on the Changes tab only. Inbox
  // keeps the full notes list. Classic shell still uses the old toggle.
  const connectionsPanelRef = useRef<ConnectionsPanelHandle>(null)
  const connectionsRequestSeq = useRef(0)
  const [connectionsRequest, setConnectionsRequest] = useState<ConnectionsViewRequest | null>(null)
  // Note sits on top of Chat by default. Side-by-side reuses width.
  // Bounds leave a usable note and a usable composer in both layouts.
  const { split: chatNoteSplitMode, setSplit: setChatNoteSplit } = useChatNoteSplit()
  const chatNoteEditorWidth = usePanelWidth(APP_STORAGE_KEYS.chatNoteEditorWidth, 560, 220, 900)
  const chatNoteEditorHeight = usePanelWidth(APP_STORAGE_KEYS.chatNoteEditorHeight, 320, 140, 720)
  const handleRailSelectChanges = useCallback(() => {
    handleSetSelection({ kind: 'filter', filter: 'changes' })
  }, [handleSetSelection])

  const handleOpenVaultSettings = useCallback(() => {
    setSettingsInitialSectionId(SETTINGS_SECTION_IDS.workspaces)
    dialogs.openSettings()
  }, [dialogs])

  // Re-show the full-screen AI setup onboarding on demand. Close Settings first
  // so the startup gate (which only renders when no in-app dialog is up) can
  // take over the screen with the onboarding.
  const handleReopenAiOnboarding = useCallback(() => {
    dialogs.closeSettings()
    aiAgentsOnboarding.reopenPrompt()
  }, [dialogs, aiAgentsOnboarding])

  const {
    detectedRenames,
    handleUpdateWikilinks,
    handleDismissRenames,
  } = useVaultRenameDetection({
    reloadVault: vault.reloadVault,
    setToastMessage,
    vaultPath: resolvedPath,
  })

  const conflictResolver = useConflictResolver({
    vaultPath: resolvedPath,
    onResolved: () => {
      dialogs.closeConflictResolver()
      autoSync.resumePull()
      vault.reloadVault()
      autoSync.triggerSync()
    },
    onToast: (msg) => setToastMessage(msg),
    onOpenFile: (relativePath) => conflictFlow.openConflictFileRef.current(relativePath),
  })
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const flushPendingRawContentRef = useRef<((path: string) => void) | null>(null)
  const appSaveFlushBeforeActionRef = useRef<((path: string) => Promise<unknown>) | null>(null)
  const flushEditorStateBeforeAction = useCallback(async (path: string) => {
    flushPendingEditorContentRef.current?.(path)
    flushPendingRawContentRef.current?.(path)
    await appSaveFlushBeforeActionRef.current?.(path)
  }, [])
  const handleCreatedVaultEntryPersisting = useCallback((path: string) => {
    markRecentVaultWrite(path)
    vault.addPendingSave(path)
  }, [markRecentVaultWrite, vault])
  const handleCreatedVaultEntryPersisted = useCallback((path: string) => {
    markRecentVaultWrite(path)
    void refreshGitModifiedFiles()
  }, [markRecentVaultWrite, refreshGitModifiedFiles])
  const handleMissingActiveVault = useCallback(() => {
    if (!noteWindowParams && resolvedPath) vault.markVaultUnavailable(resolvedPath)
  }, [noteWindowParams, resolvedPath, vault])

  const notes = useNoteActions({
    addEntry: vault.addEntry,
    removeEntry: vault.removeEntry,
    entries: visibleEntries,
    flushBeforeNoteSwitch: flushEditorStateBeforeAction,
    flushBeforeNoteMutation: flushEditorStateBeforeAction,
    reloadVault: vault.reloadVault,
    setToastMessage,
    updateEntry: vault.updateEntry,
    vaultPath: resolvedPath,
    defaultWorkspacePath: multiWorkspaceEnabled ? defaultWorkspacePath : null,
    vaults: graphVaults ?? [],
    addPendingSave: handleCreatedVaultEntryPersisting,
    removePendingSave: vault.removePendingSave,
    trackUnsaved: vault.trackUnsaved,
    clearUnsaved: vault.clearUnsaved,
    unsavedPaths: vault.unsavedPaths,
    markContentPending: (path, content) => appSave.contentChangeRef.current(path, content),
    onNewNotePersisted: handleCreatedVaultEntryPersisted,
    onMissingActiveVault: handleMissingActiveVault,
    onTypeStateChanged: async () => { await vault.reloadVault() },
    replaceEntry: vault.replaceEntry,
    onInternalVaultWrite: markRecentVaultWrite,
    onFrontmatterPersisted: refreshGitModifiedFiles,
    onPathRenamed: (oldPath, newPath) => appSave.trackRenamedPath(oldPath, newPath),
  })
  const {
    handleSelectNote,
    handleReplaceActiveTab,
    closeAllTabs,
    openTabWithContent,
  } = notes
  const noteActiveTabPath = notes.activeTabPath
  const noteActiveTabPathRef = notes.activeTabPathRef
  const noteTabsRef = useRef(notes.tabs)
  useEffect(() => {
    noteTabsRef.current = notes.tabs
  }, [notes.tabs])
  const refocusActiveEditor = useCallback((path: string) => {
    window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { path } }))
  }, [])
  const isActiveTabContentCurrent = useCallback(async (path: string) => {
    const activeTab = noteTabsRef.current.find((tab) => notePathsMatch(tab.entry.path, path))
    if (!activeTab) return false

    const request = {
      path: activeTab.entry.path,
      vaultPath: vaultPathForEntry(activeTab.entry, resolvedPath),
    }

    try {
      const content = isTauri()
        ? await invoke<string>('get_note_content', request)
        : await mockInvoke<string>('get_note_content', request)
      return content === activeTab.content
    } catch (error) {
      console.warn('Failed to compare active tab content before vault refresh:', error)
      return false
    }
  }, [resolvedPath])
  useNoteWindowLifecycle({
    activeTabPath: notes.activeTabPath,
    handleSelectNote,
    noteWindowParams,
    openTabWithContent,
    setToastMessage,
    tabs: notes.tabs,
  })
  const handleVaultUpdate = useCallback(async (
    updatedFiles: string[],
    options: { vaultPath?: string } = {},
  ) => {
    const updateVaultPath = options.vaultPath ?? resolvedPath
    await refreshPulledVaultState({
      activeTabPath: noteActiveTabPath,
      closeAllTabs,
      getActiveTabPath: () => noteActiveTabPathRef.current,
      hasUnsavedChanges: (path) => vault.unsavedPaths.has(path),
      isActiveTabContentCurrent,
      reloadFolders: vault.reloadFolders,
      reloadVault: vault.reloadVault,
      reloadViews: vault.reloadViews,
      replaceActiveTab: handleReplaceActiveTab,
      refocusActiveEditor,
      shouldRefocusActiveEditor: isActiveElementInsideEditorSurface,
      updatedFiles,
      vaultPath: updateVaultPath,
    })
    await refreshGitModifiedFiles()
  }, [
      closeAllTabs,
      handleReplaceActiveTab,
      isActiveTabContentCurrent,
      noteActiveTabPath,
      noteActiveTabPathRef,
      refocusActiveEditor,
      refreshGitModifiedFiles,
      resolvedPath,
      vault.reloadFolders,
      vault.reloadVault,
      vault.reloadViews,
      vault.unsavedPaths,
    ])
  const handlePulledVaultUpdate = useCallback(
    (updatedFiles: string[], vaultPath: string) => handleVaultUpdate(updatedFiles, { vaultPath }),
    [handleVaultUpdate],
  )
  const refreshGitHistorySurfaces = useCallback(() => {
    setGitHistoryRefreshKey((key) => key + 1)
  }, [])
  const handleFocusedVaultUpdate = useCallback(
    (updatedFiles: string[]) => handleVaultUpdate(updatedFiles),
    [handleVaultUpdate],
  )
  useEffect(() => {
    if (watchedVaultPaths.length === 0) return
    let cancelled = false
    for (const vaultPath of watchedVaultPaths) {
      void syncVaultAssetScope(vaultPath).catch((err) => {
        if (!cancelled) console.warn('[vault] Failed to sync asset scope:', err)
      })
    }
    return () => {
      cancelled = true
    }
  }, [watchedVaultPaths])
  useVaultWatcher({
    vaultPath: resolvedPath,
    vaultPaths: watchedVaultPaths,
    onVaultChanged: handleFocusedVaultUpdate,
    filterChangedPaths: filterExternalVaultPaths,
  })
  const autoSync = useAutoSync({
    enabled: gitFeaturesEnabled && gitRepoState === 'ready',
    vaultPath: gitSurfaces.syncRepositoryPath,
    vaultPaths: activeGitRepositoryPaths,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: handlePulledVaultUpdate,
    onSyncUpdated: refreshGitHistorySurfaces,
    onConflict: (files) => {
      const names = files.map((f) => f.split('/').pop()).join(', ')
      setToastMessage(`Conflict in ${names} — click to resolve`)
    },
    onToast: (msg) => setToastMessage(msg),
  })
  // Keep note entry in sync with vault entries so banners (trash/archive)
  // and read-only state react immediately without reopening the note.
  useEffect(() => {
    notes.setTabs(prev => {
      let changed = false
      const next = prev.map(tab => {
        const fresh = visibleEntries.find(e => e.path === tab.entry.path)
        if (fresh && shouldReplaceSyncedTabEntry(tab.entry, fresh)) {
          changed = true
          return { ...tab, entry: fresh }
        }
        return tab
      })
      return changed ? next : prev
    })
  }, [visibleEntries, notes.setTabs]) // eslint-disable-line react-hooks/exhaustive-deps -- notes.setTabs is stable (useState setter)

  const { handleGoBack, handleGoForward, canGoBack, canGoForward, entriesByPath } = useAppNavigation({
    entries: visibleEntries,
    activeTabPath: notes.activeTabPath,
    onSelectNote: notes.handleSelectNote,
  })

  const handleOpenFavorite = useCallback(async (entry: VaultEntry) => {
    await handleReplaceActiveTab(entry)
    handleEnterNeighborhood(entry)
  }, [handleEnterNeighborhood, handleReplaceActiveTab])

  const vaultBridge = useVaultBridge({
    entriesByPath,
    resolvedPath,
    reloadVault: vault.reloadVault,
    reloadFolders: vault.reloadFolders,
    reloadViews: vault.reloadViews,
    closeAllTabs,
    replaceActiveTab: handleReplaceActiveTab,
    refocusActiveEditor,
    hasUnsavedChanges: (path) => vault.unsavedPaths.has(path),
    shouldRefocusActiveEditor: isActiveElementInsideEditorSurface,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    getActiveTabPath: () => notes.activeTabPathRef.current,
  })
  const handleAiWorkspaceWindowOpenNote = notes.handleNavigateWikilink
  const {
    handleAgentFileCreated: handleAiWorkspaceWindowFileCreated,
    handleAgentFileModified: handleAiWorkspaceWindowFileModified,
    handleAgentVaultChanged: handleAiWorkspaceWindowVaultChanged,
  } = vaultBridge
  useAiWorkspaceWindowBridgeEvents({
    onFileCreated: handleAiWorkspaceWindowFileCreated,
    onFileModified: handleAiWorkspaceWindowFileModified,
    onOpenNote: handleAiWorkspaceWindowOpenNote,
    onVaultChanged: handleAiWorkspaceWindowVaultChanged,
  })

  const conflictFlow = useConflictFlow({
    resolvedPath: autoSync.conflictVaultPath ?? graphDefaultWorkspacePath,
    entries: visibleEntries,
    conflictFiles: autoSync.conflictFiles,
    pausePull: autoSync.pausePull, resumePull: autoSync.resumePull,
    triggerSync: autoSync.triggerSync, reloadVault: vault.reloadVault,
    initConflictFiles: conflictResolver.initFiles,
    openConflictResolver: dialogs.openConflictResolver,
    closeConflictResolver: dialogs.closeConflictResolver,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    setToastMessage,
  })

  const appSave = useAppSave({
    updateEntry: vault.updateEntry, setTabs: notes.setTabs, handleSwitchTab: notes.handleSwitchTab, setToastMessage,
    loadModifiedFiles: refreshGitModifiedFiles, reloadViews: async () => { await vault.reloadViews() },
    trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths,
    tabs: notes.tabs, activeTabPath: notes.activeTabPath,
    handleRenameNote: notes.handleRenameNote, handleRenameFilename: notes.handleRenameFilename,
    replaceEntry: vault.replaceEntry, resolvedPath,
    writableVaultPaths,
    initialH1AutoRenameEnabled: settings.initial_h1_auto_rename_enabled !== false,
    onInternalVaultWrite: markRecentVaultWrite,
    locale: appLocale,
  })
  useEffect(() => {
    appSaveFlushBeforeActionRef.current = appSave.flushBeforeAction
  }, [appSave.flushBeforeAction])

  const handleChangeWorkspace = useCallback(async (entry: VaultEntry, workspace: WorkspaceIdentity) => {
    const sourceVaultPath = vaultPathForEntry(entry, resolvedPath)
    if (sourceVaultPath === workspace.path) return

    try {
      await flushEditorStateBeforeAction(entry.path)
      const result = await notes.handleMoveNoteToWorkspace(
        entry.path,
        workspace,
        sourceVaultPath,
        (oldPath, newEntry) => {
          appSave.trackRenamedPath(oldPath, newEntry.path)
          vault.replaceEntry(oldPath, newEntry)
          if (effectiveSelection.kind === 'entity' && effectiveSelection.entry.path === oldPath) {
            handleSetSelection({
              kind: 'entity',
              entry: {
                ...effectiveSelection.entry,
                ...newEntry,
              },
            })
          }
        },
      )
      if (!result) return

      markRecentVaultWrite(entry.path)
      markRecentVaultWrite(result.new_path)
      await refreshGitModifiedFiles()
    } catch (err) {
      console.error('Failed to change note workspace:', err)
      setToastMessage(`Failed to move note: ${String(err)}`)
    }
  }, [
    appSave,
    effectiveSelection,
    flushEditorStateBeforeAction,
    handleSetSelection,
    markRecentVaultWrite,
    notes,
    refreshGitModifiedFiles,
    resolvedPath,
    vault
  ])

  const aiActivity = useAiActivity({
    onOpenNote: vaultBridge.openNoteByPath,
    onOpenTab: vaultBridge.openNoteByPath,
    onSetFilter: (filterType) => {
      handleSetSelection({ kind: 'sectionGroup', type: filterType })
    },
    onVaultChanged: (path) => { void handlePulledVaultUpdate(path ? [path] : [], resolvedPath) },
    // Handed to the celebration gate rather than acted on here: whether a
    // burst appears depends on the setting, reduced motion, and whether
    // something already celebrated moments ago.
    onCelebrate: (details) => { requestCelebration(details) },
  })

  const handleInitializeProperties = useCallback((path: string) => {
    void initializeNoteProperties(notes.handleUpdateFrontmatter, path).catch((err) => {
      console.warn('Failed to initialize note properties:', err)
    })
  }, [notes])

  const handleRemoveNoteIcon = useCallback(async (path: string) => {
    await notes.handleDeleteProperty(path, 'icon')
  }, [notes])

  const handleSetNoteIconCommand = useCallback(() => {
    setInspectorCollapsed(false)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusNoteIconPropertyEditor()
      })
    })
  }, [setInspectorCollapsed])

  const handleCustomizeNoteListColumns = useCallback(() => {
    if (effectiveSelection.kind === 'view') {
      openNoteListPropertiesPicker('view')
      return
    }

    if (effectiveSelection.kind !== 'filter') return
    if (effectiveSelection.filter === 'all') {
      openNoteListPropertiesPicker('all')
      return
    }
    if (effectiveSelection.filter === 'inbox') {
      openNoteListPropertiesPicker('inbox')
    }
  }, [effectiveSelection])

  const handleUpdateAllNotesNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('allNotes', {
      ...(vaultConfig.allNotes ?? { noteListProperties: null }),
      noteListProperties: value && value.length > 0 ? value : null,
    })
  }, [updateConfig, vaultConfig.allNotes])

  const handleUpdateInboxNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('inbox', {
      ...(vaultConfig.inbox ?? { noteListProperties: null }),
      noteListProperties: value && value.length > 0 ? value : null,
    })
  }, [updateConfig, vaultConfig.inbox])

  const handleCreateFolder = useCallback(async (
    name: string,
    parent?: { path: string; rootPath?: string },
  ) => {
    try {
      const vaultPath = parent?.rootPath?.trim() ? parent.rootPath : resolvedPath
      const parentPath = parent?.path && parent.path.length > 0 ? parent.path : null
      const args = { vaultPath, folderName: name, parentPath }
      if (isTauri()) {
        await invoke('create_vault_folder', args)
      } else {
        await mockInvoke('create_vault_folder', args)
      }
      await vault.reloadFolders()
      setToastMessage(`Created folder "${name}"`)
      return true
    } catch (e) {
      setToastMessage(`Failed to create folder: ${e}`)
      return false
    }
  }, [resolvedPath, vault])

  const folderActions = useFolderActions({
    vaultPath: resolvedPath,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setTabs: notes.setTabs,
    activeTabPathRef: notes.activeTabPathRef,
    handleSwitchTab: notes.handleSwitchTab,
    closeAllTabs: notes.closeAllTabs,
    reloadVault: vault.reloadVault,
    reloadFolders: vault.reloadFolders,
    setToastMessage,
  })
  const fileActions = useFileActions({
    selection: effectiveSelection,
    setToastMessage,
    vaultPath: resolvedPath,
  })

  const handleRemoveNoteIconCommand = useCallback(() => {
    if (notes.activeTabPath) handleRemoveNoteIcon(notes.activeTabPath)
  }, [notes.activeTabPath, handleRemoveNoteIcon])

  const handleOpenInNewWindow = useCallback(() => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    if (activeTab) {
      openNoteInNewWindow(
        activeTab.entry.path,
        vaultPathForEntry(activeTab.entry, resolvedPath),
        activeTab.entry.title,
      )
    }
  }, [notes.tabs, notes.activeTabPath, resolvedPath])

  const handleOpenEntryInNewWindow = useCallback((entry: Pick<VaultEntry, 'path' | 'title' | 'workspace'>) => {
    openNoteInNewWindow(entry.path, vaultPathForEntry(entry, resolvedPath), entry.title)
  }, [resolvedPath])

  const allGitModifiedFiles = useMemo(
    () => mergeModifiedFiles(
      gitSurfaces.allModifiedFiles,
      activeVaultModifiedFiles(vault.modifiedFiles, resolvedPath),
    ),
    [gitSurfaces.allModifiedFiles, resolvedPath, vault.modifiedFiles],
  )
  const selectedChangesModifiedFiles = gitSurfaces.changesModifiedFiles
  const commitModifiedFiles = gitSurfaces.commitModifiedFiles
  const changesRepositoryPath = gitSurfaces.changesRepositoryPath
  const gitModifiedCount = gitFeaturesEnabled ? allGitModifiedFiles.length : 0

  const {
    activeDeletedFile,
    activeNoteModified,
    handleDiscardFile,
    handleOpenDeletedNote,
    handlePendingDiffHandled,
    handlePulseOpenNote,
    handleReplaceActiveTabWithQueuedDiff,
    loadDiffAtCommitForPath,
    loadDiffForPath,
    loadGitHistoryForPath,
    pendingDiffRequest,
  } = useGitFileWorkflows({
    activeTabPath: notes.activeTabPath,
    allGitModifiedFiles,
    changesRepositoryPath,
    effectiveSelection,
    entriesByPath,
    historyRepositoryPath: gitSurfaces.historyRepositoryPath,
    loadModifiedFilesForRepository,
    onCloseAllTabs: notes.closeAllTabs,
    onOpenTabWithContent: notes.openTabWithContent,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    reloadVault: vault.reloadVault,
    resolvedPath,
    selectedChangesModifiedFiles,
    setToastMessage,
    tabs: notes.tabs,
    vaultEntries: vault.entries,
    visibleEntries,
  })

  const commitFlow = useCommitFlow({
    savePending: appSave.savePending,
    loadModifiedFiles: refreshGitModifiedFiles,
    loadModifiedFilesForVaultPath: loadModifiedFilesForRepository,
    resolveRemoteStatusForVaultPath: refreshRemoteStatusForRepository,
    setToastMessage,
    onPushRejected: autoSync.handlePushRejected,
    automaticVaultPaths: gitFeaturesEnabled ? activeGitRepositoryPaths : [],
    locale: appLocale,
    manualVaultPath: gitSurfaces.commitRepositoryPath,
    vaultPath: resolvedPath,
  })
  const suggestedCommitMessage = useMemo(() => generateCommitMessage(commitModifiedFiles), [commitModifiedFiles])
  const isGitVault = gitFeaturesEnabled && gitRepoState !== 'missing'
  const {
    activitySignature: autoGitActivitySignature,
    hasPendingWork: autoGitHasPendingWork,
  } = useAutoGitWork({
    activeRemoteStatus: autoSync.remoteStatus,
    activeVaultPath: resolvedPath,
    modifiedFiles: allGitModifiedFiles,
    repositoryPaths: activeGitRepositoryPaths,
    remoteStatusForRepository: gitSurfaces.remoteStatusForRepository,
  })
  const autoGit = useAutoGit({
    enabled: settings.autogit_enabled === true,
    idleThresholdSeconds: settings.autogit_idle_threshold_seconds ?? 90,
    inactiveThresholdSeconds: settings.autogit_inactive_threshold_seconds ?? 30,
    isGitVault,
    hasPendingChanges: autoGitHasPendingWork,
    hasUnsavedChanges: vault.unsavedPaths.size > 0,
    onCheckpoint: () => commitFlow.runAutomaticCheckpoint(),
  })
  const recordAutoGitActivity = autoGit.recordActivity
  const openCommitDialog = commitFlow.openCommitDialog
  const runAutomaticCheckpoint = commitFlow.runAutomaticCheckpoint
  const handleAppContentChange = appSave.handleContentChange
  const handleAppSave = appSave.handleSave
  const loadModifiedFiles = refreshGitModifiedFiles
  const triggerSync = autoSync.triggerSync
  const pullAndPush = autoSync.pullAndPush

  useEffect(() => {
    if (!gitFeaturesEnabled) return
    if (!isChangesSelection) return
    void loadModifiedFilesForRepository(changesRepositoryPath, { includeStats: true })
  }, [changesRepositoryPath, gitFeaturesEnabled, isChangesSelection, loadModifiedFilesForRepository])

  useEffect(() => {
    if (autoGitActivitySignature.length === 0) return
    recordAutoGitActivity()
  }, [autoGitActivitySignature, recordAutoGitActivity])

  const handleCommitPush = useCallback(() => {
    if (!gitFeaturesEnabled) return
    triggerCommitEntryAction({
      autoGitEnabled: settings.autogit_enabled === true,
      openCommitDialog,
      runAutomaticCheckpoint,
    })
  }, [gitFeaturesEnabled, openCommitDialog, runAutomaticCheckpoint, settings.autogit_enabled])
  const handlePullRepository = useCallback((targetVaultPath: string) => {
    if (!gitFeaturesEnabled) return
    triggerSync(targetVaultPath)
  }, [gitFeaturesEnabled, triggerSync])
  const handlePullSelectedRepository = useCallback(() => {
    if (!gitFeaturesEnabled) return
    triggerSync()
  }, [gitFeaturesEnabled, triggerSync])
  const handlePullAndPushSelectedRepository = useCallback(() => {
    pullAndPush()
  }, [pullAndPush])

  const handleTrackedContentChange = useCallback((path: string, content: string) => {
    recordAutoGitActivity()
    handleAppContentChange(path, content)
  }, [handleAppContentChange, recordAutoGitActivity])

  const handleTrackedSave = useCallback(async (...args: Parameters<typeof handleAppSave>) => {
    if (notes.activeTabPath) {
      flushPendingEditorContentRef.current?.(notes.activeTabPath)
      flushPendingRawContentRef.current?.(notes.activeTabPath)
    }
    const result = await handleAppSave(...args)
    const activeTab = notes.activeTabPath
      ? notes.tabs.find((tab) => tab.entry.path === notes.activeTabPath)
      : null
    if (activeTab) {
      await loadModifiedFilesForRepository(vaultPathForEntry(activeTab.entry, resolvedPath), {
        includeStats: isChangesSelection,
      })
    }
    recordAutoGitActivity()
    return result
  }, [
    handleAppSave,
    isChangesSelection,
    loadModifiedFilesForRepository,
    notes.activeTabPath,
    notes.tabs,
    recordAutoGitActivity,
    resolvedPath,
  ])

  const seedAutoGitSavedChange = useCallback(async () => {
    if (isTauri()) {
      throw new Error('seedAutoGitSavedChange is only available in browser smoke tests')
    }

    const activePath = notes.activeTabPath
    const activeTab = activePath
      ? notes.tabs.find((tab) => tab.entry.path === activePath)
      : null

    if (!activePath || !activeTab) {
      throw new Error('No active note is available for the AutoGit test bridge')
    }

    const saveNoteContent = window.__mockHandlers?.save_note_content
    const activeVaultPath = vaultPathForEntry(activeTab.entry, resolvedPath)
    if (typeof saveNoteContent === 'function') {
      await Promise.resolve(saveNoteContent({ path: activePath, content: activeTab.content, vaultPath: activeVaultPath }))
    } else {
      await mockInvoke('save_note_content', { path: activePath, content: activeTab.content, vaultPath: activeVaultPath })
    }

    await loadModifiedFiles()
    recordAutoGitActivity()
  }, [loadModifiedFiles, notes.activeTabPath, notes.tabs, recordAutoGitActivity, resolvedPath])

  useEffect(() => {
    window.__rhizomeTest = {
      ...window.__rhizomeTest,
      activeTabPath: notes.activeTabPath,
      seedAutoGitSavedChange,
    }

    return () => {
      if (window.__rhizomeTest?.seedAutoGitSavedChange === seedAutoGitSavedChange) {
        delete window.__rhizomeTest.seedAutoGitSavedChange
      }
    }
  }, [notes.activeTabPath, seedAutoGitSavedChange])

  const entryActions = useEntryActions({
    entries: visibleEntries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onBeforeAction: flushEditorStateBeforeAction,
    actionHistory: notes.actionHistory,
  })

  const resolveVaultPathForNotePath = useCallback((path: string) => {
    const entry = vault.entries.find((candidate) => candidate.path === path)
    return entry ? vaultPathForEntry(entry, resolvedPath) : resolvedPath
  }, [resolvedPath, vault.entries])

  const handleCloseNote = useCallback(() => {
    const path = notes.activeTabPathRef.current
    if (path) {
      flushPendingEditorContentRef.current?.(path)
      flushPendingRawContentRef.current?.(path)
    }
    notes.closeAllTabs()
  }, [notes])

  const deleteActions = useDeleteActions({
    onDeselectNote: (path: string) => { if (notes.activeTabPath === path) notes.closeAllTabs() },
    removeEntry: vault.removeEntry,
    removeEntries: vault.removeEntries,
    resolveVaultPathForPath: resolveVaultPathForNotePath,
    refreshModifiedFiles: refreshGitModifiedFiles,
    reloadVault: vault.reloadVault,
    setToastMessage,
  })

  const handleDeleteType = useCallback((typeName: string) => {
    const request = resolveTypeDeleteRequest(vault.entries, typeName)
    if (request.kind === 'blocked') {
      trackEvent('sidebar_type_delete_blocked', {
        reason: request.reason,
        instance_count: request.instanceCount,
      })
      setToastMessage(translate(appLocale, typeDeleteBlockedMessageKey(request), {
        count: request.instanceCount,
        type: typeName,
      }))
      return
    }

    trackEvent('sidebar_type_delete_requested')
    deleteActions.handleDeleteNote(request.typeEntry.path)
  }, [appLocale, deleteActions, vault.entries])

  const shouldLoadGitHistory = !layout.inspectorCollapsed && !effectiveShowAIChat
  const gitHistory = useGitHistory(notes.activeTabPath, loadGitHistoryForPath, shouldLoadGitHistory, gitHistoryRefreshKey)

  const {
    availableFields,
    handleCreateMissingType,
    handleCreateOrUpdateView,
    handleCreateType,
    handleDeleteView,
    handleEditView,
    handleSidebarUpdateViewDefinition,
    handleUpdateViewDefinition,
  } = useAppViewActions({
    editingView: dialogs.editingView,
    graphDefaultWorkspacePath,
    handleSetSelection,
    multiWorkspaceEnabled,
    notes,
    onOpenEditView: dialogs.openEditView,
    resolvedPath,
    selection,
    setToastMessage,
    vault,
    visibleEntries,
  })

  const bulkActions = useBulkActions(entryActions, visibleEntries, setToastMessage)

  const {
    buildNumber,
    diffToggleRef,
    findInNoteRef,
    handleCollapseSidebar,
    handleSetViewMode,
    handleToggleInspector,
    noteListVisible,
    noteLockToggleRef,
    pdfExportRef,
    rawToggleRef,
    sidebarVisible,
    tableOfContentsToggleRef,
    viewMode,
    zoom,
  } = useAppWindowControls({
    layout,
    unifiedVaultPanel: chatCentered,
    windowMode: Boolean(noteWindowParams),
  })
  const handleChatViewMode = useCallback((mode: typeof viewMode) => {
    if (mode === 'editor-only') handleRailSelectChat()
    handleSetViewMode(mode)
  }, [handleRailSelectChat, handleSetViewMode])
  const railActiveDestination = useMemo((): CommandRailDestination => {
    if (isResearchDestination) return 'research'
    if (effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'changes') return 'changes'
    if (chatCentered && viewMode === 'editor-only') return 'chat'
    if (isChatDestination) return 'chat'
    return 'inbox'
  }, [
    chatCentered,
    effectiveSelection,
    isChatDestination,
    isResearchDestination,
    viewMode,
  ])



  const { status: updateStatus, actions: updateActions } = useUpdater(
    settings.release_channel,
    areAutomaticUpdateChecksEnabled(settings),
  )

  // #19: one indicator covering both Rhizome and Prime. Prime's installed
  // version comes from the daemon handshake (AiPanel already polls the same
  // status independently for its own chrome); this is a second lightweight
  // poll of the same cheap command, not a new connection to Prime.
  const primeHostStatusForUpdates = usePrimeHostStatus(true, resolvedPath)
  // Optional-chained deliberately: the hook resolves to null whenever its
  // command is absent from a test's fake-IPC table, and dereferencing that
  // unmounts the whole app rather than degrading this one badge. The same
  // shape already broke App.test.tsx once via primeModelLabel(null).
  const { status: primeUpdateStatus, actions: primeUpdateActions } = usePrimeUpdate(
    primeHostStatusForUpdates?.version,
  )
  const versionUpdateIndicator = (
    <VersionUpdateIndicator
      rhizomeStatus={updateStatus}
      rhizomeActions={updateActions}
      primeStatus={primeUpdateStatus}
      primeActions={primeUpdateActions}
      locale={appLocale}
    />
  )

  const handleCheckForUpdates = useCallback(async () => {
    if (updateStatus.state === 'downloading') {
      setToastMessage('Update is downloading…')
      return
    }
    if (updateStatus.state === 'ready') {
      await restartApp()
      return
    }
    setToastMessage(translate(appLocale, 'update.checking'))
    const result = await updateActions.checkForUpdates()
    if (result.kind === 'up-to-date') {
      const checkedChannel = normalizeReleaseChannel(settings.release_channel)
      setToastMessage(`No newer ${checkedChannel} update is available right now`)
    } else if (result.kind === 'available') {
      setToastMessage(`rhizome ${result.displayVersion} is available`)
    } else {
      setToastMessage(result.message)
    }
  }, [appLocale, settings.release_channel, updateActions, updateStatus.state])

  const handleRepairVault = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('repair_vault', { vaultPath: resolvedPath })
      await vault.reloadVault()
      await refreshVaultAiGuidance()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to repair vault: ${err}`)
    }
  }, [refreshVaultAiGuidance, resolvedPath, vault])

  const handleAdoptPortentTypes = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const created = await tauriInvoke<string[]>('seed_portent_type_definitions', { vaultPath: resolvedPath })
      await vault.reloadVault()
      setToastMessage(
        created.length > 0
          ? `Added ${created.length} default work type${created.length === 1 ? '' : 's'}`
          : 'Default work types are already present in this vault',
      )
    } catch (err) {
      setToastMessage(`Failed to adopt Portent types: ${err}`)
    }
  }, [resolvedPath, vault])

  const restoreVaultAiGuidance = useCallback(async (successToast: string | null = 'Rhizome AI guidance restored') => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      await tauriInvoke('restore_vault_ai_guidance', { vaultPath: resolvedPath })
      await vault.reloadVault()
      await refreshVaultAiGuidance()
      if (successToast) setToastMessage(successToast)
    } catch (err) {
      setToastMessage(`Failed to restore Rhizome AI guidance: ${err}`)
    }
  }, [refreshVaultAiGuidance, resolvedPath, vault])

  const activeCommandEntry = useMemo(() => {
    if (!notes.activeTabPath) return null
    return notes.tabs.find((tab) => tab.entry.path === notes.activeTabPath)?.entry
      ?? vault.entries.find((entry) => entry.path === notes.activeTabPath)
      ?? null
  }, [notes.activeTabPath, notes.tabs, vault.entries])
  const noteRetargetingUi = useNoteRetargetingUi({
    activeEntry: activeCommandEntry,
    activeNoteBlocked: !!activeDeletedFile,
    entries: visibleEntries,
    folders: vault.folders,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setToastMessage,
    vaultPath: resolvedPath,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    moveNoteToFolder: notes.handleMoveNoteToFolder,
  })

  const canToggleRichEditor = !!activeCommandEntry
    && activeCommandEntry.filename.toLowerCase().endsWith('.md')
    && !activeDeletedFile
  const shouldBlockNeighborhoodEscape = (
    dialogs.showCreateTypeDialog
    || dialogs.showQuickOpen
    || dialogs.showCommandPalette
    || dialogs.showKeyboardShortcuts
    || effectiveShowAIChat
    || dialogs.showSettings
    || dialogs.showCloneVault
    || dialogs.showSearch
    || dialogs.showConflictResolver
    || dialogs.showCreateViewDialog
    || noteRetargetingUi.isDialogOpen
    || showFeedback
  )

  useNeighborhoodEscape({
    onBack: handleNeighborhoodHistoryBack,
    selectionRef,
    shouldBlockNeighborhoodEscape,
  })

  const noteListColumnsLabel = useMemo(() => {
    if (effectiveSelection.kind === 'view') {
      const selectedView = vault.views.find((view) => viewMatchesSelection(view, effectiveSelection))
      return selectedView ? `Customize ${selectedView.definition.name} columns` : 'Customize View columns'
    }

    return effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'all'
      ? 'Customize All Notes columns'
      : 'Customize Inbox columns'
  }, [effectiveSelection, vault.views])
  const viewOrdering = useSavedViewOrdering({
    views: vault.views,
    selection: effectiveSelection,
    vaultPath: resolvedPath,
    reloadViews: vault.reloadViews,
    loadModifiedFiles: refreshGitModifiedFiles,
    onToast: setToastMessage,
    locale: appLocale,
  })
  const canReorderSavedViews = useMemo(() => (
    vault.views.every((view) => !view.rootPath)
  ), [vault.views])
  const toggleDiffCommand = useCallback(() => diffToggleRef.current(), [diffToggleRef])
  const toggleRawEditorCommand = useMemo(
    () => canToggleRichEditor ? () => rawToggleRef.current() : undefined,
    [canToggleRichEditor, rawToggleRef],
  )
  const toggleNoteLockCommand = useCallback(() => {
    if (notes.activeTabPath) noteLockToggleRef.current()
  }, [noteLockToggleRef, notes.activeTabPath])
  const toggleTableOfContentsCommand = useCallback(() => {
    if (notes.activeTabPath) tableOfContentsToggleRef.current()
  }, [notes.activeTabPath, tableOfContentsToggleRef])
  const exportNotePdfCommand = useCallback(() => {
    pdfExportRef.current?.('app_command')
  }, [pdfExportRef])
  const findInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: false })
  }, [findInNoteRef])
  const replaceInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: true })
  }, [findInNoteRef])
  const pastePlainTextCommand = useCallback(() => {
    void requestPlainTextPaste().catch((error) => {
      console.warn('[paste] Failed to paste plain text:', error)
    })
  }, [])
  const removeActiveVaultCommand = useCallback(() => {
    vaultSwitcher.removeVault(vaultSwitcher.vaultPath)
  }, [vaultSwitcher])
  const restoreVaultAiGuidanceCommand = useCallback(() => {
    void restoreVaultAiGuidance()
  }, [restoreVaultAiGuidance])
  const changeNoteTypeCommand = useMemo(
    () => noteRetargetingUi.canChangeActiveNoteType ? noteRetargetingUi.openChangeNoteTypeDialog : undefined,
    [noteRetargetingUi.canChangeActiveNoteType, noteRetargetingUi.openChangeNoteTypeDialog],
  )
  const moveNoteToFolderCommand = useMemo(
    () => noteRetargetingUi.canMoveActiveNoteToFolder ? noteRetargetingUi.openMoveNoteToFolderDialog : undefined,
    [noteRetargetingUi.canMoveActiveNoteToFolder, noteRetargetingUi.openMoveNoteToFolderDialog],
  )
  const activeNoteHasIcon = useMemo(() => {
    const entry = vault.entries.find((candidate) => candidate.path === notes.activeTabPath)
    return hasNoteIconValue(entry?.icon)
  }, [notes.activeTabPath, vault.entries])
  const handleToggleOrganizedWithInboxAdvance = useInboxOrganizeAdvance({
    activeTabPath: notes.activeTabPath,
    activeTabPathRef: notes.activeTabPathRef,
    autoAdvanceEnabled: settings.auto_advance_inbox_after_organize === true,
    entries: visibleEntries,
    onSelectNote: notes.handleSelectNote,
    onToggleOrganized: entryActions.handleToggleOrganized,
    requestedActiveTabPathRef: notes.requestedActiveTabPathRef,
    selection: effectiveSelection,
    visibleNotesRef,
  })
  const toggleOrganizedCommand = explicitOrganizationEnabled ? handleToggleOrganizedWithInboxAdvance : undefined
  const canCustomizeNoteListColumns = useMemo(() => (
    canCustomizeColumnsForSelection(effectiveSelection, explicitOrganizationEnabled)
  ), [effectiveSelection, explicitOrganizationEnabled])
  const restoreDeletedNoteCommand = useMemo(
    () => activeDeletedFile ? () => { void handleDiscardFile(activeDeletedFile.relativePath) } : undefined,
    [activeDeletedFile, handleDiscardFile],
  )
  const reloadVaultForCommand = vault.reloadVault
  const handleManualVaultReload = useCallback(async () => {
    const entries = await reloadVaultForCommand()
    setToastMessage(`Vault reloaded (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})`)
    return entries
  }, [reloadVaultForCommand])

  const {
    activeTab,
    defaultNoteWidth,
    noteWidth: activeNoteWidth,
    setDefaultNoteWidth: handleSetDefaultNoteWidth,
    setNoteWidth: handleSetActiveNoteWidth,
    toggleNoteWidth: handleToggleNoteWidth,
  } = useNoteWidthMode({
    tabs: notes.tabs,
    activeTabPath: notes.activeTabPath,
    settings,
    saveSettings,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    setToastMessage,
  })
  const activeTabEntry = activeTab?.entry ?? null
  const activeTabPath = activeTabEntry?.path
  const handleAskChatAboutExcerpt = useCallback((excerpt: string) => {
    const title = activeTabEntry?.title || activeTabEntry?.filename || 'this note'
    prefillAiComposer(formatAskChatExcerpt(title, excerpt))
    trackEvent('note_excerpt_ask_chat')
  }, [activeTabEntry])
  const [, setChatNotePaneOpen] = useState(false)
  const [sessionRailSlot, setSessionRailSlot] = useState<HTMLDivElement | null>(null)
  const {
    shellRef,
    collapseSessions: widthCompactSessions,
    collapseVaultPanel: widthCompactVaultPanel,
  } = useShellCompactLayout(
    chatCentered,
    false,
    !layout.inspectorCollapsed,
  )
  const forceChatShellCompact = shouldForceChatShellCompact(chatNoteSplitMode, Boolean(activeTab))
  const compactSessions = forceChatShellCompact || widthCompactSessions
  const compactVaultPanel = forceChatShellCompact || widthCompactVaultPanel
  const [compactVaultPanelOpen, setCompactVaultPanelOpen] = useState(false)
  const handleChatNoteSplit = useCallback((next: ChatNoteSplit) => {
    setChatNoteSplit(next)
    if (next === 'side-by-side') setCompactVaultPanelOpen(false)
  }, [setChatNoteSplit])
  const handleRailSelectGraph = useCallback(() => {
    if (chatCentered) {
      if (viewMode === 'editor-only') handleSetViewMode('editor-list')
      setCompactVaultPanelOpen(true)
      handleRailSelectChanges()
      setConnectionsRequest({ view: 'graph', requestId: ++connectionsRequestSeq.current })
      connectionsPanelRef.current?.openView('graph')
      return
    }
    handleSetSelection(toggleGraphSelection(effectiveSelection, vaultConfig.inbox?.explicitOrganization))
  }, [chatCentered, handleRailSelectChanges, handleSetSelection, effectiveSelection, handleSetViewMode, setCompactVaultPanelOpen, setConnectionsRequest, viewMode, vaultConfig.inbox?.explicitOrganization])
  const handleOpenSessionFootprint = useCallback((path: string) => {
    if (chatCentered) {
      if (viewMode === 'editor-only') handleSetViewMode('editor-list')
      setCompactVaultPanelOpen(true)
      handleRailSelectChanges()
      setConnectionsRequest({ view: 'mycelium', focusPath: path, requestId: ++connectionsRequestSeq.current })
      connectionsPanelRef.current?.openView('mycelium', { focusPath: path })
      return
    }
    setMyceliumFocusPath(path)
    handleSetSelection({ kind: 'filter', filter: 'mycelium' })
  }, [chatCentered, handleRailSelectChanges, handleSetSelection, handleSetViewMode, setCompactVaultPanelOpen, setConnectionsRequest, viewMode])
  const handleSelectNoteForPdfExport = notes.handleSelectNote
  const handleExportNotePdfFromList = useCallback((entry: VaultEntry) => {
    if (!isMarkdownEntry(entry)) return

    if (activeTabPath === entry.path) {
      pdfExportRef.current?.('note_list_context_menu')
      return
    }

    setPendingNoteListPdfExportPath(entry.path)
    handleSelectNoteForPdfExport(entry)
  }, [activeTabPath, handleSelectNoteForPdfExport, pdfExportRef])
  useEffect(() => {
    if (!pendingNoteListPdfExportPath) return
    if (!activeTabEntry || activeTabPath !== pendingNoteListPdfExportPath) return

    const frameId = requestAnimationFrame(() => {
      if (isMarkdownEntry(activeTabEntry)) pdfExportRef.current?.('note_list_context_menu')
      setPendingNoteListPdfExportPath(null)
    })

    return () => cancelAnimationFrame(frameId)
  }, [activeTabEntry, activeTabPath, pendingNoteListPdfExportPath, pdfExportRef])

  const {
    isStartupLoading,
    isVaultContentLoading,
    shouldResumeFreshStartOnboarding,
    shouldShowStartupScreen,
  } = useStartupScreenState({
    aiAgentsPromptVisible: aiAgentsOnboarding.showPrompt,
    isNoteWindow: Boolean(noteWindowParams),
    onboardingState: onboarding.state,
    runtimeMissingVaultPath,
    selectedVaultPath,
    settingsLoaded,
    showMcpSetupDialog: mcpSetupDialog.open,
    telemetryConsent: settings.telemetry_consent,
    vaultIsLoading: vault.isLoading,
    vaultSwitcher,
  })
  const deepLinks = useDeepLinks({
    activeEntry: activeTab?.entry ?? null,
    currentVaultPath: resolvedPath,
    enabled: !noteWindowParams,
    entries: visibleEntries,
    isVaultContentLoading,
    locale: appLocale,
    onSelectNote: notes.handleSelectNote,
    onSwitchVault: vaultSwitcher.switchVault,
    reloadVault: vault.reloadVault,
    setToastMessage,
    vaultListLoaded: vaultSwitcher.loaded,
    vaults: vaultSwitcher.allVaults,
  })
  const activeEditorVaultPath = activeTab ? vaultPathForEntry(activeTab.entry, resolvedPath) : resolvedPath
  const noteGitUrls = useNoteGitUrls({
    currentVaultPath: resolvedPath,
    locale: appLocale,
    remoteStatusForRepository: gitSurfaces.remoteStatusForRepository,
    setToastMessage,
  })
  const commandAiActions = useAppCommandAiActions(dialogs, aiAgentsStatus, vaultAiGuidanceStatus, restoreVaultAiGuidanceCommand, aiAgentPreferences)
  const undoCommand = useCallback(() => {
    if (runNativeTextHistoryCommand('undo')) return
    void notes.handleUndo()
  }, [notes])
  const redoCommand = useCallback(() => {
    if (runNativeTextHistoryCommand('redo')) return
    void notes.handleRedo()
  }, [notes])

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    entries: visibleEntries,
    visibleNotesRef,
    multiSelectionCommandRef,
    modifiedCount: gitModifiedCount,
    activeNoteModified,
    selection: effectiveSelection,
    onQuickOpen: dialogs.openQuickOpen, onCommandPalette: dialogs.openCommandPalette,
    onKeyboardShortcuts: dialogs.openKeyboardShortcuts,
    onSearch: dialogs.openSearch,
    onFindInNote: findInNoteCommand,
    onReplaceInNote: activeDeletedFile ? undefined : replaceInNoteCommand,
    onPastePlainText: pastePlainTextCommand,
    onCreateNote: notes.handleCreateNoteImmediate,
    onCreateNoteOfType: notes.handleCreateNoteImmediate,
    onSave: appSave.handleSave,
    onUndo: undoCommand,
    onRedo: redoCommand,
    canUndo: notes.canUndo,
    canRedo: notes.canRedo,
    undoLabel: notes.undoLabel,
    redoLabel: notes.redoLabel,
    onOpenSettings: handleOpenSettings,
    onOpenFeedback: openFeedback,
    onOpenResearch: handleRailSelectResearch,
    onDeleteNote: deleteActions.handleDeleteNote,
    onArchiveNote: entryActions.handleArchiveNote, onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: handleCommitPush,
    gitRepositories,
    gitFeaturesEnabled,
    isGitVault,
    onInitializeGit: openGitSetupDialog,
    onPull: handlePullSelectedRepository,
    onPullRepository: handlePullRepository,
    onResolveConflicts: conflictFlow.handleOpenConflictResolver,
    onSetViewMode: handleChatViewMode,
    onToggleInspector: handleToggleInspector,
    onToggleDiff: toggleDiffCommand,
    onToggleRawEditor: toggleRawEditorCommand,
    onToggleNoteLock: notes.activeTabPath ? toggleNoteLockCommand : undefined,
    onToggleTableOfContents: toggleTableOfContentsCommand,
    onExportNoteAsPdf: activeDeletedFile ? undefined : exportNotePdfCommand,
    noteWidth: activeNoteWidth,
    defaultNoteWidth,
    onSetNoteWidth: handleSetActiveNoteWidth,
    onSetDefaultNoteWidth: handleSetDefaultNoteWidth,
    selectedViewName: viewOrdering.selectedViewName,
    onMoveSelectedViewUp: viewOrdering.onMoveSelectedViewUp,
    onMoveSelectedViewDown: viewOrdering.onMoveSelectedViewDown,
    canMoveSelectedViewUp: viewOrdering.canMoveSelectedViewUp,
    canMoveSelectedViewDown: viewOrdering.canMoveSelectedViewDown,
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: handleSetSelection,
    onRenameFolder: folderActions.renameSelectedFolder,
    onDeleteFolder: folderActions.deleteSelectedFolder,
    onRevealSelectedFolder: fileActions.revealSelectedFolder,
    onCopySelectedFolderPath: fileActions.copySelectedFolderPath,
    showInbox: explicitOrganizationEnabled,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: canGoBack, canGoForward: canGoForward,
    onOpenVault: vaultSwitcher.handleOpenLocalFolder,
    onCreateEmptyVault: vaultSwitcher.handleCreateEmptyVault,
    onCreateType: dialogs.openCreateType,
    ...commandAiActions,
    onCheckForUpdates: handleCheckForUpdates,
    onRemoveActiveVault: removeActiveVaultCommand,
    onRestoreGettingStarted: cloneGettingStartedVault,
    isGettingStartedHidden: vaultSwitcher.isGettingStartedHidden,
    vaultCount: vaultSwitcher.allVaults.length,
    locale: appLocale,
    systemLocale,
    selectedUiLanguage,
    onSetUiLanguage: handleSetUiLanguage,
    onSetThemeMode: handleSetThemeMode,
    mcpStatus: mcpSetupDialog.status,
    onInstallMcp: mcpSetupDialog.openDialog,
    onReloadVault: handleManualVaultReload,
    onRepairVault: handleRepairVault,
    onReopenAiOnboarding: handleReopenAiOnboarding,
    onSetNoteIcon: handleSetNoteIconCommand,
    onRemoveNoteIcon: handleRemoveNoteIconCommand,
    onChangeNoteType: changeNoteTypeCommand,
    onMoveNoteToFolder: moveNoteToFolderCommand,
    canMoveNoteToFolder: noteRetargetingUi.canMoveActiveNoteToFolder,
    activeNoteHasIcon,
    noteListFilter,
    onSetNoteListFilter: setNoteListFilter,
    onOpenInNewWindow: handleOpenInNewWindow,
    onRevealActiveFile: fileActions.revealFile,
    onCopyActiveFilePath: fileActions.copyFilePath,
    onCopyActiveDeepLink: deepLinks.copyPathDeepLink,
    onOpenActiveFileExternal: fileActions.openExternalFile,
    onToggleFavorite: entryActions.handleToggleFavorite,
    onToggleOrganized: toggleOrganizedCommand,
    onCustomizeNoteListColumns: handleCustomizeNoteListColumns,
    canCustomizeNoteListColumns,
    noteListColumnsLabel,
    onRestoreDeletedNote: restoreDeletedNoteCommand,
    canRestoreDeletedNote: !!activeDeletedFile,
  })

  const {
    inboxCount,
    noteList: aiNoteList,
    noteListFilter: aiNoteListFilter,
  } = useAiWorkspacePublishedContext({
    activeTab,
    allNotesFileVisibility,
    context: aiWorkspaceWindowContext,
    effectiveSelection,
    entries: visibleEntries,
    inboxPeriod,
    tabs: notes.tabs,
    views: vault.views,
  })

  const handleAiWorkspaceConversationsChange = useCallback((conversations: AiWorkspaceConversationSetting[]) => {
    void saveSettings({ ...settings, ai_workspace_conversations: conversations })
  }, [saveSettings, settings])
  const handlePromoteChatToVault = useCallback(async (text: string, session?: string) => {
    const body = text.trim()
    if (!body) return
    const vaultPath = activeEditorVaultPath
    if (!vaultPath) {
      setToastMessage(translate(appLocale, 'ai.message.saveToVaultNoVault'))
      return
    }
    const credentials = redactCredentialTokens(body)
    if (credentials.count > 0) {
      trackVaultCredentialsHandled('promote', 'refuse', credentials.count)
      setToastMessage(translate(appLocale, 'ai.message.saveToVaultCredentials'))
      return
    }
    try {
      const result = await writePromoteNoteFromChat(body, new Date(), {
        session,
        pathExists: (path) => noteExistsOnDisk({ path, vaultPath }),
        persist: (note) => persistNewNote({ path: note.path, content: note.content, vaultPath }),
      })
      if (result.status === 'refused') {
        setToastMessage(translate(appLocale, 'ai.message.saveToVaultNoContent'))
        return
      }
      if (result.status === 'duplicate') {
        setToastMessage(translate(appLocale, 'ai.message.saveToVaultDuplicate', { title: result.note.title }))
        return
      }
      vaultBridge.handleAgentFileCreated(result.note.path)
      setToastMessage(translate(appLocale, 'ai.message.saveToVaultDone', { title: result.note.title }))
    } catch (error) {
      setToastMessage(translate(appLocale, 'ai.message.saveToVaultFailed', {
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }, [activeEditorVaultPath, appLocale, vaultBridge])

  const aiWorkspaceSurface = (
    <AppAiWorkspaceSurface
      mode="side"
      open={effectiveShowAIChat}
      aiAgentsStatus={aiAgentsStatus}
      aiModelProviders={settings.ai_model_providers ?? []}
      conversationSettings={settings.ai_workspace_conversations ?? null}
      conversationSettingsReady={settingsLoaded}
      defaultAiAgent={aiAgentPreferences.defaultAiAgent}
      defaultAiTarget={aiAgentPreferences.defaultAiTarget}
      defaultAiAgentReadiness={aiAgentPreferences.defaultAiAgentReadiness}
      defaultAiAgentReady={aiAgentPreferences.defaultAiAgentReady}
      initialActiveConversationId={lastAiWorkspaceConversationId ?? undefined}
      activeEntry={activeTab?.entry ?? null}
      activeNoteContent={activeTab?.content ?? null}
      entries={visibleEntries}
      openTabs={notes.tabs.map((tab) => tab.entry)}
      noteList={aiNoteList}
      noteListFilter={aiNoteListFilter}
      onActiveConversationChange={handleActiveAiWorkspaceConversationChange}
      onActiveTargetChange={handleActiveAiWorkspaceTargetChange}
      onClose={closeAIChat}
      onConversationSettingsChange={handleAiWorkspaceConversationsChange}
      onOpenAiSettings={handleOpenAiSettings}
      onOpenNote={notes.handleNavigateWikilink}
      onPromoteToVault={handlePromoteChatToVault}
      onRestoreVaultAiGuidance={() => { void restoreVaultAiGuidance() }}
      onUnsupportedAiPaste={setToastMessage}
      onFileCreated={vaultBridge.handleAgentFileCreated}
      onFileModified={vaultBridge.handleAgentFileModified}
      onVaultChanged={vaultBridge.handleAgentVaultChanged}
      vaultAiGuidanceStatus={vaultAiGuidanceStatus}
      vaultPath={activeEditorVaultPath}
      vaultPaths={writableVaultPaths}
      locale={appLocale}
    />
  )
  if (shouldShowStartupScreen) {
    return (
      <StartupScreen
        aiAgentsOnboarding={aiAgentsOnboarding}
        aiAgentsStatus={aiAgentsStatus}
        isOffline={networkStatus.isOffline}
        isStartupLoading={isStartupLoading}
        locale={appLocale}
        noteWindowParams={noteWindowParams}
        onboarding={onboarding}
        runtimeMissingVaultPath={runtimeMissingVaultPath}
        saveSettings={saveSettings}
        settings={settings}
        settingsLoaded={settingsLoaded}
        shouldResumeFreshStartOnboarding={shouldResumeFreshStartOnboarding}
        showMcpSetupDialog={mcpSetupDialog.open}
        setToastMessage={setToastMessage}
        toastMessage={toastMessage}
        vaultSwitcher={vaultSwitcher}
      />
    )
  }

  const noteListModifiedFiles = isChangesSelection ? selectedChangesModifiedFiles : undefined
  const noteListModifiedFilesError = isChangesSelection ? gitSurfaces.changesModifiedFilesError : null

  /*
    Chat-centered shell: navigation and the selected note list share one
    right-side panel. The existing view-mode values remain the persisted
    contract:
      editor-only -> panel hidden
      editor-list -> panel open, Browse collapsed
      all         -> panel open, Browse expanded
    The classic shell keeps its historical adjacent-column interpretation.
  */
  const vaultBrowseOpen = viewMode === 'all'
  const showSidebarTree = !chatCentered && sidebarVisible && !isChatDestination
  const hideNoteListForCanvas = isGraphDestination || isMyceliumDestination || isResearchDestination
  const showNoteListPanel = !chatCentered && noteListVisible && !isChatDestination && !hideNoteListForCanvas
  const showVaultPanel =
    chatCentered &&
    viewMode !== 'editor-only' &&
    !hideNoteListForCanvas &&
    (!compactVaultPanel || compactVaultPanelOpen)
  const showVaultPanelRestore =
    chatCentered &&
    !showVaultPanel &&
    !hideNoteListForCanvas

  const handleVaultTreeSelect = (nextSelection: SidebarSelection) => {
    handleSetSelection(nextSelection)
  }

  const sidebarSurface = (unified: boolean) => (
    <Sidebar entries={visibleEntries} isWikiVault={isWikiVault} folders={vault.folders} views={vault.views} selection={effectiveSelection} onSelect={unified ? handleVaultTreeSelect : handleSetSelection} onSelectNote={notes.handleSelectNote} onSelectFavorite={handleOpenFavorite} onReorderFavorites={entryActions.handleReorderFavorites} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onUpdateTypeTemplate={entryActions.handleUpdateTypeTemplate} onReorderSections={entryActions.handleReorderSections} onRenameSection={entryActions.handleRenameSection} onDeleteType={handleDeleteType} onToggleTypeVisibility={entryActions.handleToggleTypeVisibility} onCreateFolder={handleCreateFolder} onRenameFolder={folderActions.renameFolder} onDeleteFolder={folderActions.requestDeleteFolder} folderFileActions={fileActions.folderActions} renamingFolderPath={folderActions.renamingFolderPath} onStartRenameFolder={folderActions.startFolderRename} onCancelRenameFolder={folderActions.cancelFolderRename} onCreateView={dialogs.openCreateView} onEditView={handleEditView} onDeleteView={handleDeleteView} onUpdateViewDefinition={handleSidebarUpdateViewDefinition} onReorderViews={canReorderSavedViews ? viewOrdering.onReorderViews : undefined} showInbox={explicitOrganizationEnabled} inboxCount={inboxCount} allNotesFileVisibility={allNotesFileVisibility} pluralizeTypeLabels={settings.sidebar_type_pluralization_enabled ?? true} dock={sidebarDock} showTitleBar={!unified} onCollapse={unified ? undefined : handleCollapseSidebar} onGoBack={handleGoBack} onGoForward={handleGoForward} canGoBack={canGoBack} canGoForward={canGoForward} locale={appLocale} loading={isVaultContentLoading} vaultRootPath={resolvedPath} workspaceOrder={vaultWorkspaceOrder} />
  )

  const noteListSurface = effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'pulse' ? (
    <PulseView vaultPath={gitSurfaces.historyRepositoryPath} onOpenNote={handlePulseOpenNote} refreshKey={gitHistoryRefreshKey} sidebarCollapsed={!showSidebarTree && !chatCentered} onExpandSidebar={() => handleSetViewMode('all')} repositories={gitRepositories} selectedRepositoryPath={gitSurfaces.historyRepositoryPath} onRepositoryChange={gitSurfaces.setHistoryRepositoryPath} locale={appLocale} />
  ) : (
    <NoteList entries={visibleEntries} selection={effectiveSelection} selectedNote={activeTab?.entry ?? null} loading={isVaultContentLoading} noteListFilter={noteListFilter} onNoteListFilterChange={setNoteListFilter} inboxPeriod={inboxPeriod} modifiedFiles={noteListModifiedFiles} modifiedFilesError={noteListModifiedFilesError} gitRepositories={gitRepositories} selectedGitRepositoryPath={gitSurfaces.changesRepositoryPath} onGitRepositoryChange={gitSurfaces.setChangesRepositoryPath} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!showSidebarTree && !chatCentered} onSelectNote={(entry) => { notes.handleSelectNote(entry) }} onReplaceActiveTab={(entry) => { handleReplaceActiveTabWithQueuedDiff(entry) }} onEnterNeighborhood={handleEnterNeighborhood} onCreateNote={notes.handleCreateNoteImmediate} onBulkOrganize={explicitOrganizationEnabled ? bulkActions.handleBulkOrganize : undefined} onBulkArchive={bulkActions.handleBulkArchive} onBulkDeletePermanently={deleteActions.handleBulkDeletePermanently} onUpdateTypeSort={notes.handleUpdateFrontmatter} onUpdateViewDefinition={handleUpdateViewDefinition} updateEntry={vault.updateEntry} onOpenInNewWindow={handleOpenEntryInNewWindow} onRenameFilename={appSave.handleFilenameRename} onExportPdf={handleExportNotePdfFromList} onToggleFavorite={entryActions.handleToggleFavorite} onToggleOrganized={explicitOrganizationEnabled ? entryActions.handleToggleOrganized : undefined} onAskAgent={handleAskAgentAboutNote} onRevealFile={fileActions.revealFile} onCopyFilePath={fileActions.copyFilePath} canCopyGitUrl={noteGitUrls.canCopyEntryGitUrl} onCopyGitUrl={noteGitUrls.copyEntryGitUrl} onDiscardFile={handleDiscardFile} onOpenDeletedNote={handleOpenDeletedNote} allNotesNoteListProperties={vaultConfig.allNotes?.noteListProperties ?? null} onUpdateAllNotesNoteListProperties={handleUpdateAllNotesNoteListProperties} inboxNoteListProperties={vaultConfig.inbox?.noteListProperties ?? null} onUpdateInboxNoteListProperties={handleUpdateInboxNoteListProperties} views={vault.views} visibleNotesRef={visibleNotesRef} allNotesFileVisibility={allNotesFileVisibility} multiSelectionCommandRef={multiSelectionCommandRef} locale={appLocale} />
  )

  const sidebarPanel = showSidebarTree ? (
    <>
      {sidebarDock === 'right' && <ResizeHandle onResize={layout.handleSidebarResize} edge="trailing" />}
      <div className={`app__sidebar app__sidebar--${sidebarDock}`} style={{ width: layout.sidebarWidth }}>
        {sidebarSurface(false)}
      </div>
      {sidebarDock === 'left' && <ResizeHandle onResize={layout.handleSidebarResize} />}
    </>
  ) : null

  const noteListPanel = showNoteListPanel ? (
    <>
      {chatCentered && <ResizeHandle onResize={layout.handleNoteListResize} edge="trailing" />}
      <div className={`app__note-list${aiActivity.highlightElement === 'notelist' ? ' ai-highlight' : ''}`} style={{ width: layout.noteListWidth }}>
        {noteListSurface}
      </div>
      {!chatCentered && <ResizeHandle onResize={layout.handleNoteListResize} />}
    </>
  ) : null

  const vaultPanel = showVaultPanel ? (
    <div
      className={`app__vault-panel${aiActivity.highlightElement === 'notelist' ? ' ai-highlight' : ''}`}
      style={{ width: layout.noteListWidth }}
    >
      <ResizeHandle
        onResize={layout.handleNoteListResize}
        edge="trailing"
        placement="absolute"
        label={translate(appLocale, 'notes.panel.resize')}
        testId="vault-panel-resize"
      />
      <VaultPanel
        browseOpen={vaultBrowseOpen}
        locale={appLocale}
        navigation={sidebarSurface(true)}
        noteList={noteListSurface}
        onBrowseToggle={() => handleSetViewMode(vaultBrowseOpen ? 'editor-list' : 'all')}
        onCollapse={() => {
          setCompactVaultPanelOpen(false)
          handleSetViewMode('editor-only')
        }}
      />
      {chatCentered && isChangesSelection ? (
        <ConnectionsPanel
          ref={connectionsPanelRef}
          vaultPath={resolvedPath}
          locale={appLocale}
          requestedView={connectionsRequest}
          canOpenNote={vaultBridge.canOpenNoteByPath}
          onOpenNote={path => {
            handleRailSelectChat()
            vaultBridge.openNoteByPath(path)
          }}
        />
      ) : null}
    </div>
  ) : null

  const chatHomeSurface = (
    <Suspense fallback={<div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="chat-home-suspense">{translate(appLocale, 'rail.chat')}</div>}>
      <ChatHome
        locale={appLocale}
        defaultAiAgent={aiAgentPreferences.defaultAiAgent}
        defaultAiTarget={aiAgentPreferences.defaultAiTarget}
        defaultAiAgentReadiness={aiAgentPreferences.defaultAiAgentReadiness}
        defaultAiAgentReady={aiAgentPreferences.defaultAiAgentReady}
        onExit={() => handleSetViewMode(chatCentered ? 'all' : 'editor-list')}
        vaultPath={activeEditorVaultPath}
        vaultPaths={writableVaultPaths}
        entries={visibleEntries}
        onOpenNote={notes.handleNavigateWikilink}
        onPromoteToVault={handlePromoteChatToVault}
        onFileCreated={vaultBridge.handleAgentFileCreated}
        onFileModified={vaultBridge.handleAgentFileModified}
        onVaultChanged={vaultBridge.handleAgentVaultChanged}
        onUnsupportedAiPaste={setToastMessage}
        onShowNotes={() => {
          handleSetViewMode('all')
          if (compactVaultPanel) setCompactVaultPanelOpen(true)
        }}
        sessionsAutoCollapsed={compactSessions}
        sessionsRailSlot={commandRailEnabled ? sessionRailSlot : undefined}
        onNotePaneOpenChange={setChatNotePaneOpen}
        onOpenSessionFootprint={handleOpenSessionFootprint}
        requestedNote={chatNoteRequest}
      />
    </Suspense>
  )

  return (
    <AppPreferencesProvider dateDisplayFormat={dateDisplayFormat}>
      <CelebrationProvider
        enabled={readCelebrationsEnabled(settings.celebrations_enabled)}
        locale={appLocale}
      >
      <PrimeActivityProvider>
      <div className="app-shell">
        <div
          ref={shellRef}
          className="app"
          data-compact-sessions={compactSessions ? 'true' : 'false'}
          data-compact-vault={compactVaultPanel ? 'true' : 'false'}
        >
          {commandRailEnabled && (
            <CommandRail
              locale={appLocale}
              activeDestination={railActiveDestination}
              inboxCount={inboxCount}
              onSelectChat={() => {
                // C72: selecting Chat must not wipe the right Notes column.
                handleRailSelectChat()
              }}
              onSelectInbox={() => {
                handleRailSelectInbox()
                if (chatCentered) {
                  if (viewMode === 'editor-only') {
                    handleSetViewMode('all')
                    if (compactVaultPanel) setCompactVaultPanelOpen(true)
                  } else {
                    setCompactVaultPanelOpen(false)
                    handleSetViewMode('editor-only')
                  }
                }
              }}
              onSelectResearch={handleRailSelectResearch}
              onSelectChanges={() => {
                handleRailSelectChanges()
                if (chatCentered && viewMode === 'editor-only') handleSetViewMode('editor-list')
                if (compactVaultPanel) setCompactVaultPanelOpen(true)
              }}
              onOpenSettings={handleOpenSettings}
              onSessionsSlotReady={setSessionRailSlot}
            />
          )}
          {sidebarDock === 'left' && sidebarPanel}
          {!chatCentered && noteListPanel}
          <div className={`app__editor${aiActivity.highlightElement === 'editor' || aiActivity.highlightElement === 'tab' ? ' ai-highlight' : ''}`}>
            {chatCentered ? (
              <div
                className="app__chat-center"
                data-testid="chat-center"
                data-split={activeTab ? chatNoteSplitMode : 'stacked'}
                style={{
                  ...(isGraphDestination || isMyceliumDestination || isResearchDestination ? { display: 'none' } : {}),
                  ...subheadTrafficLightInset(),
                }}
              >
                <div className="app__chat-center-body">
                <div
                  className={activeTab ? 'app__note-editor' : 'app__note-editor app__note-editor--idle'}
                  style={activeTab ? { flex: `0 0 ${chatNoteSplitMode === 'side-by-side' ? chatNoteEditorWidth.width : chatNoteEditorHeight.width}px` } : undefined}
                >
                  <AskChatExcerptMenu onAsk={handleAskChatAboutExcerpt}>
                    <Editor
                      leadingControl={activeTab ? (
                        <ChatNoteSplitToggle split={chatNoteSplitMode} onChange={handleChatNoteSplit} />
                      ) : undefined}
                      tabs={notes.tabs}
                      activeTabPath={notes.activeTabPath}
                      isVaultLoading={isVaultContentLoading}
                      entries={visibleEntries}
                      onNavigateWikilink={notes.handleNavigateWikilink}
                      onLoadDiff={loadDiffForPath}
                      onLoadDiffAtCommit={loadDiffAtCommitForPath}
                      pendingCommitDiffRequest={pendingDiffRequest}
                      onPendingCommitDiffHandled={handlePendingDiffHandled}
                      getNoteStatus={vault.getNoteStatus}
                      onCreateNote={notes.handleCreateNoteImmediate}
                      inspectorCollapsed={layout.inspectorCollapsed}
                      onToggleInspector={handleToggleInspector}
                      onCloseNote={handleCloseNote}
                      inspectorWidth={layout.inspectorWidth}
                      defaultAiAgent={aiAgentPreferences.defaultAiAgent}
                      defaultAiTarget={aiAgentPreferences.defaultAiTarget}
                      defaultAiAgentReadiness={aiAgentPreferences.defaultAiAgentReadiness}
                      defaultAiAgentReady={aiAgentPreferences.defaultAiAgentReady}
                      onUnsupportedAiPaste={setToastMessage}
                      onInspectorResize={layout.handleInspectorResize}
                      inspectorEntry={activeTab?.entry ?? null}
                      inspectorContent={activeTab?.content ?? null}
                      gitHistory={gitHistory}
                      onUpdateFrontmatter={notes.handleUpdateFrontmatter}
                      onDeleteProperty={notes.handleDeleteProperty}
                      onAddProperty={notes.handleAddProperty}
                      onCreateMissingType={handleCreateMissingType}
                      onCreateAndOpenNote={notes.handleCreateNoteForRelationship}
                      onChangeWorkspace={activeDeletedFile ? undefined : handleChangeWorkspace}
                      onInitializeProperties={handleInitializeProperties}
                      showAIChat={false}
                      vaultPath={activeEditorVaultPath}
                      vaultPaths={writableVaultPaths}
                      noteList={aiNoteList}
                      noteListFilter={aiNoteListFilter}
                      onToggleFavorite={activeDeletedFile ? undefined : entryActions.handleToggleFavorite}
                      onToggleOrganized={activeDeletedFile || !explicitOrganizationEnabled ? undefined : toggleOrganizedCommand}
                      onEnterNeighborhood={activeDeletedFile ? undefined : handleEnterNeighborhood}
                      onRevealFile={fileActions.revealFile}
                      onReloadVault={handleManualVaultReload}
                      onCopyFilePath={fileActions.copyFilePath}
                      onCopyDeepLink={activeDeletedFile ? undefined : deepLinks.copyEntryDeepLink}
                      onCopyGitUrl={activeDeletedFile || !activeTabEntry || !noteGitUrls.canCopyEntryGitUrl(activeTabEntry) ? undefined : noteGitUrls.copyEntryGitUrl}
                      onOpenExternalFile={fileActions.openExternalFile}
                      onDeleteNote={activeDeletedFile ? undefined : deleteActions.handleDeleteNote}
                      onArchiveNote={activeDeletedFile ? undefined : entryActions.handleArchiveNote}
                      onUnarchiveNote={activeDeletedFile ? undefined : entryActions.handleUnarchiveNote}
                      onContentChange={handleTrackedContentChange}
                      onSave={handleTrackedSave}
                      onRenameFilename={activeDeletedFile ? undefined : appSave.handleFilenameRename}
                      noteWidth={activeNoteWidth}
                      onToggleNoteWidth={handleToggleNoteWidth}
                      rawToggleRef={rawToggleRef}
                      noteLockToggleRef={noteLockToggleRef}
                      tableOfContentsToggleRef={tableOfContentsToggleRef}
                      pdfExportRef={pdfExportRef}
                      findInNoteRef={findInNoteRef}
                      diffToggleRef={diffToggleRef}
                      canGoBack={canGoBack}
                      canGoForward={canGoForward}
                      onGoBack={handleGoBack}
                      onGoForward={handleGoForward}
                      leftPanelsCollapsed={!sidebarVisible && !noteListVisible}
                      onFileCreated={vaultBridge.handleAgentFileCreated}
                      onFileModified={vaultBridge.handleAgentFileModified}
                      onVaultChanged={vaultBridge.handleAgentVaultChanged}
                      workspaces={inspectorWorkspaces}
                      isConflicted={conflictFlow.isConflicted}
                      onKeepMine={conflictFlow.handleKeepMine}
                      onKeepTheirs={conflictFlow.handleKeepTheirs}
                      flushPendingEditorContentRef={flushPendingEditorContentRef}
                      flushPendingRawContentRef={flushPendingRawContentRef}
                      onToast={setToastMessage}
                      locale={appLocale}
                    />
                  </AskChatExcerptMenu>
                </div>
                {activeTab ? (
                  <div
                    role="separator"
                    aria-orientation={chatNoteSplitMode === 'side-by-side' ? 'vertical' : 'horizontal'}
                    aria-label={translate(appLocale, 'notes.panel.resize')}
                    data-testid="chat-note-editor-resize"
                    className="app__chat-note-split"
                    onMouseDown={event => startResizeDrag(
                      event,
                      chatNoteSplitMode === 'side-by-side' ? 'col-resize' : 'row-resize',
                      (deltaX, deltaY) => {
                        if (chatNoteSplitMode === 'side-by-side') chatNoteEditorWidth.resizeBy(deltaX)
                        else chatNoteEditorHeight.resizeBy(-deltaY)
                      },
                    )}
                  />
                ) : null}
                {chatHomeSurface}
                </div>
              </div>
            ) : null}
            {isGraphDestination ? (
              // The AI workspace normally renders inside <Editor>, but the graph
              // replaces <Editor> entirely — so without mounting it here too,
              // clicking the AI bubble in graph view hid the bubble (it unmounts
              // on open) and then showed nothing at all.
              <div className="relative flex flex-1 min-h-0">
                <Suspense fallback={<div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="graph-suspense">{translate(appLocale, 'graph.loading')}</div>}>
                  <GraphView vaultPath={resolvedPath} onOpenNote={(path) => {
                    vaultBridge.openNoteByPath(path)
                    handleRailSelectChat()
                  }} locale={appLocale} onExit={handleRailSelectGraph} />
                </Suspense>
                {effectiveShowAIChat && aiWorkspaceSurface}
              </div>
            ) : isMyceliumDestination ? (
              <div className="relative flex flex-1 min-h-0">
                <Suspense fallback={<div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="mycelium-suspense">{translate(appLocale, 'mycelium.title')}</div>}>
                  <MyceliumView locale={appLocale} onExit={handleRailSelectChat} focusSessionPath={myceliumFocusPath} />
                </Suspense>
                {effectiveShowAIChat && aiWorkspaceSurface}
              </div>
            ) : isResearchDestination ? (
              <div className="relative flex min-h-0 flex-1" data-testid="research-destination">
                <ResearchPanel
                  variant="pane"
                  open
                  onClose={handleRailSelectChat}
                  vaultPath={resolvedPath}
                  agentMemoryVaultPath={settings.agent_memory_vault_path}
                  vaults={vaultSwitcher.allVaults}
                  onSetDefaultDestination={(path) => { void saveSettings({ ...settings, agent_memory_vault_path: path }) }}
                  onOpenNote={vaultBridge.openNoteByPath}
                  locale={appLocale}
                  settings={settings}
                  aiAgentsStatus={aiAgentsStatus}
                />
              </div>
            ) : chatCentered ? null : isChatDestination ? (
              chatHomeSurface
            ) : (
            <Editor
              tabs={notes.tabs}
              activeTabPath={notes.activeTabPath}
              isVaultLoading={isVaultContentLoading}
              entries={visibleEntries}
              onNavigateWikilink={notes.handleNavigateWikilink}
              onLoadDiff={loadDiffForPath}
              onLoadDiffAtCommit={loadDiffAtCommitForPath}
              pendingCommitDiffRequest={pendingDiffRequest}
              onPendingCommitDiffHandled={handlePendingDiffHandled}
              getNoteStatus={vault.getNoteStatus}
              onCreateNote={notes.handleCreateNoteImmediate}
              inspectorCollapsed={layout.inspectorCollapsed}
              onToggleInspector={handleToggleInspector}
              onCloseNote={handleCloseNote}
              inspectorWidth={layout.inspectorWidth}
              defaultAiAgent={aiAgentPreferences.defaultAiAgent}
              defaultAiTarget={aiAgentPreferences.defaultAiTarget}
              defaultAiAgentReadiness={aiAgentPreferences.defaultAiAgentReadiness}
              defaultAiAgentReady={aiAgentPreferences.defaultAiAgentReady}
              onUnsupportedAiPaste={setToastMessage}
              onInspectorResize={layout.handleInspectorResize}
              inspectorEntry={activeTab?.entry ?? null}
              inspectorContent={activeTab?.content ?? null}
              gitHistory={gitHistory}
              onUpdateFrontmatter={notes.handleUpdateFrontmatter}
              onDeleteProperty={notes.handleDeleteProperty}
              onAddProperty={notes.handleAddProperty}
              onCreateMissingType={handleCreateMissingType}
              onCreateAndOpenNote={notes.handleCreateNoteForRelationship}
              onChangeWorkspace={activeDeletedFile ? undefined : handleChangeWorkspace}
              onInitializeProperties={handleInitializeProperties}
              showAIChat={effectiveShowAIChat}
              onToggleAIChat={handleToggleAiWorkspace}
              aiWorkspaceSurface={aiWorkspaceSurface}
              vaultPath={activeEditorVaultPath}
              vaultPaths={writableVaultPaths}
              noteList={aiNoteList}
              noteListFilter={aiNoteListFilter}
              onToggleFavorite={activeDeletedFile ? undefined : entryActions.handleToggleFavorite}
              onToggleOrganized={activeDeletedFile || !explicitOrganizationEnabled ? undefined : toggleOrganizedCommand}
              onEnterNeighborhood={activeDeletedFile ? undefined : handleEnterNeighborhood}
              onRevealFile={fileActions.revealFile}
              onReloadVault={handleManualVaultReload}
              onCopyFilePath={fileActions.copyFilePath}
              onCopyDeepLink={activeDeletedFile ? undefined : deepLinks.copyEntryDeepLink}
              onCopyGitUrl={activeDeletedFile || !activeTabEntry || !noteGitUrls.canCopyEntryGitUrl(activeTabEntry) ? undefined : noteGitUrls.copyEntryGitUrl}
              onOpenExternalFile={fileActions.openExternalFile}
              onDeleteNote={activeDeletedFile ? undefined : deleteActions.handleDeleteNote}
              onArchiveNote={activeDeletedFile ? undefined : entryActions.handleArchiveNote}
              onUnarchiveNote={activeDeletedFile ? undefined : entryActions.handleUnarchiveNote}
              onContentChange={handleTrackedContentChange}
              onSave={handleTrackedSave}
              onRenameFilename={activeDeletedFile ? undefined : appSave.handleFilenameRename}
              noteWidth={activeNoteWidth}
              onToggleNoteWidth={handleToggleNoteWidth}
              rawToggleRef={rawToggleRef}
              noteLockToggleRef={noteLockToggleRef}
              tableOfContentsToggleRef={tableOfContentsToggleRef}
              pdfExportRef={pdfExportRef}
              findInNoteRef={findInNoteRef}
              diffToggleRef={diffToggleRef}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onGoBack={handleGoBack}
              onGoForward={handleGoForward}
              leftPanelsCollapsed={!sidebarVisible && !noteListVisible}
              onFileCreated={vaultBridge.handleAgentFileCreated}
              onFileModified={vaultBridge.handleAgentFileModified}
              onVaultChanged={vaultBridge.handleAgentVaultChanged}
              workspaces={inspectorWorkspaces}
              isConflicted={conflictFlow.isConflicted}
              onKeepMine={conflictFlow.handleKeepMine}
              onKeepTheirs={conflictFlow.handleKeepTheirs}
              flushPendingEditorContentRef={flushPendingEditorContentRef}
              flushPendingRawContentRef={flushPendingRawContentRef}
              onToast={setToastMessage}
              locale={appLocale}
            />
            )}
          </div>
          {showVaultPanelRestore && (
            <VaultPanelRestoreButton
              locale={appLocale}
              onClick={() => {
                handleSetViewMode('editor-list')
                setCompactVaultPanelOpen(true)
              }}
            />
          )}
          {vaultPanel}
          {!chatCentered && sidebarDock === 'right' && sidebarPanel}
        </div>
        <UpdateBanner status={updateStatus} actions={updateActions} locale={appLocale} />
        <RenameDetectedBanner renames={detectedRenames} onUpdate={handleUpdateWikilinks} onDismiss={handleDismissRenames} />
        <StatusBar noteCount={visibleEntries.length} modifiedCount={gitModifiedCount} vaultPath={resolvedPath} defaultWorkspacePath={defaultWorkspacePath} vaults={vaultSwitcher.allVaults} multiWorkspaceEnabled={multiWorkspaceEnabled} onSwitchVault={vaultSwitcher.switchVault} onSetDefaultWorkspace={vaultSwitcher.setDefaultWorkspace} onOpenSettings={handleOpenSettings} onOpenVaultSettings={handleOpenVaultSettings} onOpenResearch={handleRailSelectResearch} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onCreateEmptyVault={vaultSwitcher.handleCreateEmptyVault} onCloneVault={dialogs.openCloneVault} onCloneGettingStarted={cloneGettingStartedVault} onClickPending={() => handleSetSelection({ kind: 'filter', filter: 'changes' })} onClickPulse={() => handleSetSelection({ kind: 'filter', filter: 'pulse' })} onClickGraph={handleRailSelectGraph} onCommitPush={handleCommitPush} commitActionPending={commitFlow.isOpeningCommitDialog} gitFeaturesEnabled={gitFeaturesEnabled} onInitializeGit={openGitSetupDialog} isOffline={networkStatus.isOffline} isGitVault={isGitVault} isVaultReloading={vault.isReloading || isVaultContentLoading} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} remoteStatus={autoSync.remoteStatus} repositories={gitRepositories} selectedRepositoryPath={gitSurfaces.syncRepositoryPath} onRepositoryChange={gitSurfaces.setSyncRepositoryPath} onTriggerSync={handlePullSelectedRepository} onPullAndPush={handlePullAndPushSelectedRepository} onOpenConflictResolver={conflictFlow.handleOpenConflictResolver} zoomLevel={zoom.zoomLevel} themeMode={documentThemeMode} onZoomReset={zoom.zoomReset} onToggleThemeMode={settingsLoaded ? handleToggleThemeMode : undefined} buildNumber={buildNumber} onCheckForUpdates={handleCheckForUpdates} versionUpdateIndicator={versionUpdateIndicator} onRemoveVault={vaultSwitcher.removeVault} onReorderVaults={vaultSwitcher.reorderVaults} onUpdateWorkspaceIdentity={vaultSwitcher.updateWorkspaceIdentity} mcpStatus={mcpSetupDialog.status} onInstallMcp={mcpSetupDialog.openDialog} commandRailActive={commandRailEnabled} locale={appLocale} />
        <GitSetupDialog open={gitFeaturesEnabled && shouldShowGitSetupDialog} onInitGit={handleInitGitRepo} onDismiss={dismissGitSetupDialog} onNeverForVault={neverForVaultGitSetupDialog} />
        <DeleteProgressNotice count={deleteActions.pendingDeleteCount} />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        <QuickOpenPalette open={dialogs.showQuickOpen} entries={visibleEntries} isLoading={vault.isLoading} onSelect={notes.handleSelectNote} onCreateNote={(title) => notes.handleCreateNote(title, 'Note', 'quick_open')} onClose={dialogs.closeQuickOpen} locale={appLocale} />
        <CommandPalette
          open={dialogs.showCommandPalette}
          commands={commands}
          entries={visibleEntries}
          aiAgentReady={quickPromptTargetReady}
          aiAgentLabel={quickPromptTarget.label}
          aiPromptTargetId={quickPromptTarget.id}
          locale={appLocale}
          onClose={dialogs.closeCommandPalette}
        />
        <KeyboardShortcutsDialog
          open={dialogs.showKeyboardShortcuts}
          onOpenChange={(open) => {
            if (open) dialogs.openKeyboardShortcuts()
            else dialogs.closeKeyboardShortcuts()
          }}
          locale={appLocale}
        />
        <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={visibleEntries} onSelectNote={notes.handleSelectNote} onClose={dialogs.closeSearch} locale={appLocale} />
        <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
        <NoteRetargetingDialogs
          dialogState={noteRetargetingUi.dialogState}
          dialogEntry={noteRetargetingUi.dialogEntry}
          typeOptions={noteRetargetingUi.typeOptions}
          folderOptions={noteRetargetingUi.folderOptions}
          onClose={noteRetargetingUi.closeDialog}
          onSelectType={noteRetargetingUi.selectType}
          onSelectFolder={noteRetargetingUi.selectFolder}
        />
        <CreateViewDialog open={dialogs.showCreateViewDialog} onClose={dialogs.closeCreateView} onCreate={handleCreateOrUpdateView} availableFields={availableFields} locale={appLocale} editingView={dialogs.editingView?.definition ?? null} />
        <CommitDialog
          open={commitFlow.showCommitDialog}
          modifiedCount={commitModifiedFiles.length}
          commitMode={commitFlow.commitMode}
          authorIdentity={commitFlow.authorIdentity}
          locale={appLocale}
          repositories={gitRepositories}
          selectedRepositoryPath={gitSurfaces.commitRepositoryPath}
          suggestedMessage={suggestedCommitMessage}
          onRepositoryChange={gitSurfaces.setCommitRepositoryPath}
          onCommit={commitFlow.handleCommitPush}
          onClose={commitFlow.closeCommitDialog}
        />
        <ConflictResolverModal
          open={dialogs.showConflictResolver}
          fileStates={conflictResolver.fileStates}
          allResolved={conflictResolver.allResolved}
          committing={conflictResolver.committing}
          error={conflictResolver.error}
          locale={appLocale}
          onResolveFile={conflictResolver.resolveFile}
          onOpenInEditor={conflictResolver.openInEditor}
          onCommit={conflictResolver.commitResolution}
          onClose={conflictFlow.handleCloseConflictResolver}
        />
        <SettingsPanel open={dialogs.showSettings} initialSectionId={settingsInitialSectionId} settings={settings} aiAgentsStatus={aiAgentsStatus} locale={appLocale} systemLocale={systemLocale} vaults={vaultSwitcher.allVaults} activeVaultPath={resolvedPath} defaultWorkspacePath={vaultSwitcher.defaultWorkspacePath} onSetDefaultWorkspace={vaultSwitcher.setDefaultWorkspace} onRemoveVault={vaultSwitcher.removeVault} onReorderVaults={vaultSwitcher.reorderVaults} onUpdateWorkspaceIdentity={vaultSwitcher.updateWorkspaceIdentity} isGitVault={gitRepoState !== 'missing'} onSave={saveSettings} onCopyMcpConfig={mcpSetupDialog.copyManualConfig} explicitOrganizationEnabled={explicitOrganizationEnabled} onSaveExplicitOrganization={handleSaveExplicitOrganization} inboxAutomationEnabled={isInboxAutomationEnabled(vaultConfig.inbox_automation_enabled)} onSaveInboxAutomation={(enabled) => updateConfig('inbox_automation_enabled', enabled)} onAdoptPortentTypes={() => { void handleAdoptPortentTypes() }} onOpenFeedback={openFeedback} onOpenDocs={openDocs} onClose={dialogs.closeSettings} />
        <PrimeActiveCloseDialog
          open={primeActiveClose.open}
          locale={appLocale}
          onStopAndClose={primeActiveClose.stopAndClose}
          onKeepWorking={primeActiveClose.keepWorking}
          onCancel={primeActiveClose.cancel}
        />
        <FeedbackDialog open={showFeedback} onClose={closeFeedback} locale={appLocale} />
        <McpSetupDialog open={mcpSetupDialog.open} status={mcpSetupDialog.status} busyAction={mcpSetupDialog.busyAction} manualConfigSnippet={mcpSetupDialog.manualConfigSnippet} opencodeManualConfigSnippet={mcpSetupDialog.opencodeManualConfigSnippet} manualConfigLoading={mcpSetupDialog.manualConfigLoading} manualConfigError={mcpSetupDialog.manualConfigError} locale={appLocale} onClose={mcpSetupDialog.closeDialog} onConnect={mcpSetupDialog.connect} onCopyManualConfig={mcpSetupDialog.copyManualConfig} onCopyOpenCodeManualConfig={mcpSetupDialog.copyOpenCodeManualConfig} onDisconnect={mcpSetupDialog.disconnect} onLoadManualConfig={mcpSetupDialog.loadManualConfig} />
        <CloneVaultModal key={dialogs.showCloneVault ? 'clone-open' : 'clone-closed'} open={dialogs.showCloneVault} onClose={dialogs.closeCloneVault} onVaultCloned={vaultSwitcher.handleVaultCloned} />
        {deleteActions.confirmDelete && (
          <ConfirmDeleteDialog
            open={true}
            title={deleteActions.confirmDelete.title}
            message={deleteActions.confirmDelete.message}
            confirmLabel={deleteActions.confirmDelete.confirmLabel}
            onConfirm={deleteActions.confirmDelete.onConfirm}
            onCancel={() => deleteActions.setConfirmDelete(null)}
          />
        )}
        {folderActions.confirmDeleteFolder && (
          <ConfirmDeleteDialog
            open={true}
            title={folderActions.confirmDeleteFolder.title}
            message={folderActions.confirmDeleteFolder.message}
            confirmLabel={folderActions.confirmDeleteFolder.confirmLabel}
            onConfirm={folderActions.confirmDeleteSelectedFolder}
            onCancel={folderActions.cancelDeleteFolder}
          />
        )}
      </div>
    </PrimeActivityProvider>
    </CelebrationProvider>
    </AppPreferencesProvider>
  )
}

export default App
