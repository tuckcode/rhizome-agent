import { useEffect, useRef, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { aiPanelFrameStyle } from './aiPanelPulse'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

import { usePanelWidth } from '../hooks/usePanelWidth'
import { startResizeDrag } from '../utils/startResizeDrag'
import { useAiPanelAttachments } from './useAiPanelAttachments'
import { useAiPanelSendPolicy } from './useAiPanelSendPolicy'
import { useAiPanelModelChangeMarker } from './useAiPanelModelChangeMarker'
import { usePrimeSessionSwitcher } from './usePrimeSessionSwitcher'
import { usePrimeCommandActions } from './usePrimeCommandActions'
import { usePrimeQueue } from '../hooks/usePrimeQueue'
import { usePrimeSessionTree } from '../hooks/usePrimeSessionTree'
import { SessionBranchBand } from './SessionBranchBand'
import {
  AiPanelComposer,
  AiPanelHeader,
  AiPanelMessageHistory,
} from './AiPanelChrome'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate } from '../lib/i18n'
import PrimeSessionList from './PrimeSessionList'
import {
  DEFAULT_AI_AGENT,
  getAiAgentDefinition,
  type AiAgentId,
  type AiAgentReadiness,
} from '../lib/aiAgents'
import type { AiTarget } from '../lib/aiTargets'
import type { AppLocale } from '../lib/i18n'
import { type NoteListItem } from '../utils/ai-context'
import type { VaultEntry } from '../types'
import { useAiPanelController, type AiPanelController } from './useAiPanelController'
import type { AiAgentMessage } from '../lib/aiAgentConversation'
import { useAiPanelPromptQueue } from './useAiPanelPromptQueue'
import { useAiPanelFocus } from './useAiPanelFocus'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { promoteSessionFromHost } from '../utils/promoteChatToVault'
import { usePrimeSessionRestore } from '../hooks/usePrimeSessionRestore'
import { usePrimeSessionStats } from '../hooks/usePrimeSessionStats'
import { ChatComposerBar } from './ChatComposerBar'
import { lastToolName } from '../utils/lastToolName'
import { PrimeGoalDialog } from './PrimeGoalDialog'
import { PrimeScheduleDialog } from './PrimeScheduleDialog'
import { useAiPanelGoalDialog } from './useAiPanelGoalDialog'
import { useAiPanelScheduleDialog } from './useAiPanelScheduleDialog'

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string, session?: string) => void
  onUnsupportedAiPaste?: (message: string) => void
  defaultAiAgent?: AiAgentId
  defaultAiTarget?: AiTarget
  defaultAiAgentReadiness?: AiAgentReadiness
  defaultAiAgentReady?: boolean
  locale?: AppLocale
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
  vaultPath: string
  vaultPaths?: string[]
  activeEntry?: VaultEntry | null
  /** Direct content of the active note from the editor tab. */
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  /** Chat-home hides the panel header; the window chrome carries that role. */
  showHeader?: boolean
  /** Frame A subhead New chat — panel controller owns the reset. */
  newChatRef?: MutableRefObject<(() => void) | null>
  /** Rendered above the input: banners that explain why a turn may fail. */
  composerControls?: ReactNode
  /** Live turn controls for the compact row under the input (Prime only). */
  composerDeck?: ReactNode
  /** Skill label shown inside the compact row's Tools menu. */
  composerSkillsLabel?: string | null
  /** Frame B note split — sits beside the transcript so the composer spans both. */
  notePane?: ReactNode
  /** Docked at the far right, outside the note split. */
  sidePanel?: ReactNode
  /** Temporarily hide Sessions when the containing shell cannot fit it. */
  sessionsAutoCollapsed?: boolean
  /** Expanded Command Rail slot. `undefined` preserves the classic-shell column. */
  sessionsRailSlot?: HTMLElement | null
  onForkMessage?: (entryId: string) => void
  /** Fork branches the Prime session rather than copying the conversation. */
  forkTargetsPrimeEntry?: boolean
  /** Sessions-list → Mycelium for that session (C67). */
  onOpenMycelium?: (sessionPath: string) => void
}

interface AiPanelViewProps {
  controller: AiPanelController
  onClose: () => void
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string, session?: string) => void
  onUnsupportedAiPaste?: (message: string) => void
  defaultAiAgent?: AiAgentId
  defaultAiTarget?: AiTarget
  defaultAiAgentReadiness?: AiAgentReadiness
  defaultAiAgentReady?: boolean
  locale?: AppLocale
  activeEntry?: VaultEntry | null
  entries?: VaultEntry[]
  interactive?: boolean
  showHeader?: boolean
  showLeftBorder?: boolean
  surface?: 'default' | 'sidebar'
  /**
   * Vault the panel is showing. Only the session list uses it, to keep rows
   * that ran in *this* vault from all repeating its name — see
   * `primeSessionPlace`. Optional: a caller with no vault in hand gets a list
   * where every row names its place, which is the safe direction.
   */
  vaultPath?: string | null
  composerControls?: ReactNode
  composerDeck?: ReactNode
  composerSkillsLabel?: string | null
  notePane?: ReactNode
  /** Docked at the far right, outside the note split. */
  sidePanel?: ReactNode
  sessionsAutoCollapsed?: boolean
  sessionsRailSlot?: HTMLElement | null
  onForkMessage?: (messageId: string) => void
  forkTargetsPrimeEntry?: boolean
  onQueuedPromptTarget?: (targetId: string) => void
  onSendPrompt?: (text: string) => void
  onMessageHistoryScrollStateChange?: (scrolled: boolean) => void
  targetId?: string
  /** Sessions-list → Mycelium for that session (C67). */
  onOpenMycelium?: (sessionPath: string) => void
}

function readinessFromReadyFlag(ready: boolean | undefined): AiAgentReadiness {
  return (ready ?? true) ? 'ready' : 'missing'
}

function getLastAgentMessage(messages: AiAgentMessage[]): string | null {
  // Find the last message that has an agent response.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const response = messages[i]?.response
    if (response) {
      return response
    }
  }
  return null
}

interface AiPanelViewModel {
  agentLabel: string
  defaultAiAgent: AiAgentId
  defaultAiAgentReadiness: AiAgentReadiness
  targetKind: AiTarget['kind']
}

function resolveAiPanelViewModel({
  defaultAiAgent,
  defaultAiAgentReadiness,
  defaultAiAgentReady,
  defaultAiTarget,
}: {
  defaultAiAgent?: AiAgentId
  defaultAiAgentReadiness?: AiAgentReadiness
  defaultAiAgentReady?: boolean
  defaultAiTarget?: AiTarget
}): AiPanelViewModel {
  const resolvedAgent = defaultAiAgent ?? DEFAULT_AI_AGENT
  const resolvedReadiness = defaultAiAgentReadiness ?? readinessFromReadyFlag(defaultAiAgentReady)

  return {
    agentLabel: defaultAiTarget?.label ?? getAiAgentDefinition(resolvedAgent).label,
    defaultAiAgent: resolvedAgent,
    defaultAiAgentReadiness: resolvedReadiness,
    targetKind: defaultAiTarget?.kind ?? 'agent',
  }
}

function AiPanelFrame({
  children,
  isActive,
  panelRef,
  showLeftBorder,
  surface,
}: {
  children: ReactNode
  isActive: boolean
  panelRef: RefObject<HTMLElement | null>
  showLeftBorder: boolean
  surface: 'default' | 'sidebar'
}) {
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={`flex flex-1 flex-col overflow-hidden ${surface === 'sidebar' ? 'bg-sidebar text-sidebar-foreground' : 'bg-background text-foreground'}`}
      style={aiPanelFrameStyle(isActive, showLeftBorder)}
      data-testid="ai-panel"
      data-ai-active={isActive || undefined}
    >
      {children}
    </aside>
  )
}

export function AiPanelView({
  controller,
  onClose,
  onOpenNote,
  onPromoteToVault,
  onUnsupportedAiPaste,
  defaultAiAgent: providedDefaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReadiness: providedDefaultAiAgentReadiness,
  defaultAiAgentReady: providedDefaultAiAgentReady,
  locale = 'en',
  entries,
  interactive = true,
  showHeader = true,
  showLeftBorder = true,
  surface = 'default',
  composerControls,
  composerDeck,
  composerSkillsLabel,
  notePane,
  sidePanel,
  sessionsAutoCollapsed = false,
  sessionsRailSlot,
  onForkMessage,
  forkTargetsPrimeEntry,
  onQueuedPromptTarget,
  onSendPrompt,
  onMessageHistoryScrollStateChange,
  targetId,
  vaultPath = null,
  onOpenMycelium,
}: AiPanelViewProps) {
  const view = resolveAiPanelViewModel({
    defaultAiAgent: providedDefaultAiAgent,
    defaultAiAgentReadiness: providedDefaultAiAgentReadiness,
    defaultAiAgentReady: providedDefaultAiAgentReady,
    defaultAiTarget,
  })
  const inputRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const {
    agent,
    input,
    setInput,
    hasContext,
    isActive,
    permissionMode,
    handleSend,
    handleStop,
    handleNavigateWikilink,
    handlePermissionModeChange,
    handleNewChat,
  } = controller
  const isPrimeTarget = view.targetKind === 'agent' && view.defaultAiAgent === 'prime'
  const primeHost = usePrimeHostStatus(isPrimeTarget, vaultPath ?? undefined)
  const modelLabel = isPrimeTarget ? primeModelLabel(primeHost) : null
  // Refresh when a turn finishes rather than only on the interval, so context
  // usage reflects the exchange that just happened.
  const primeStats = usePrimeSessionStats(isPrimeTarget, agent.status)
  const { queue, refresh: refreshQueue, clear: clearQueue } = usePrimeQueue(isPrimeTarget, isActive)
  // If Waiting chrome shows a follow-up, the transcript must show it too —
  // send-path append alone can lose a race with rehydrate (2026-09-06 dogfood).
  useEffect(() => {
    if (!isPrimeTarget || !queue?.followUp.length) return
    for (const text of queue.followUp) {
      agent.appendQueuedFollowUp(text)
    }
  }, [agent, isPrimeTarget, queue?.followUp])
  const { tree: sessionTree, refresh: refreshSessionTree } = usePrimeSessionTree(
    isPrimeTarget,
    primeHost.sessionPath ?? isActive,
  )
  const goalDialog = useAiPanelGoalDialog()
  const scheduleDialog = useAiPanelScheduleDialog()

  useAiPanelModelChangeMarker({
    isPrimeTarget,
    primeHost,
    locale,
    addLocalMarker: agent.addLocalMarker,
  })

  useAiPanelPromptQueue({
    agent,
    currentTargetId: targetId,
    input,
    isActive,
    onTargetChange: onQueuedPromptTarget,
    setInput,
    enabled: interactive,
  })
  useAiPanelFocus({
    inputRef,
    panelRef,
    hasMessages: agent.messages.length > 0,
    isActive,
    onClose,
    enabled: interactive,
  })
  // 180–420: narrower and a session title is a truncation, wider and the
  // transcript starts losing the room the design gives it.
  const sessionsWidth = usePanelWidth(APP_STORAGE_KEYS.chatSessionsWidth, 228, 180, 420)
  const { attachments, attachImages, removeAttachment, clearAttachments } = useAiPanelAttachments({
    locale,
    onUnsupportedAiPaste,
    modelAcceptsImages: primeHost.modelAcceptsImages,
    modelName: primeHost.modelName,
    modelId: primeHost.modelId,
  })

  // Prime owns the queue. Chat used to remember follow-ups locally because
  // we had no read; `get_queue` is that read.
  const { handleComposerSend, handleSteer } = useAiPanelSendPolicy({
    handleSend,
    isActive,
    isPrimeTarget,
    onSendPrompt,
    attachments,
    clearAttachments,
    refreshQueue,
    setInput,
    onFollowUpQueued: agent.appendQueuedFollowUp,
  })

  const {
    sessionsVisible,
    toggleSessions,
    activeSessionPath,
    switchError,
    reportSwitchError,
    handleSelectSession,
    handleForkFromEntry,
    branchBusyId,
    branchError,
    handleNavigateBranch,
  } = usePrimeSessionSwitcher({
    agent,
    locale,
    vaultPath,
    sessionsAutoCollapsed,
    refreshSessionTree,
    primeHostSessionPath: primeHost.sessionPath,
    hostRunning: primeHost.running,
  })
  usePrimeSessionRestore({
    enabled: isPrimeTarget,
    host: primeHost,
    onTranscript: agent.replaceMessages,
    onOpen: handleSelectSession,
  })
  const sessionsShown = sessionsVisible
  const usesRailSessions = sessionsRailSlot !== undefined

  const { commandEntries: localizedCommands, commandDisabled, handleCommandAction } = usePrimeCommandActions({
    isPrimeTarget,
    primeSessionId: primeHost.sessionId,
    primeSessionPath: primeHost.sessionPath,
    locale,
    agent,
    setInput,
    handleForkFromEntry,
    reportError: reportSwitchError,
  })

  return (
    <>
      <AiPanelFrame panelRef={panelRef} isActive={isActive} showLeftBorder={showLeftBorder} surface={surface}>
      {showHeader && (
        <AiPanelHeader
          agentLabel={view.agentLabel}
          agentReadiness={view.defaultAiAgentReadiness}
          agentStatus={agent.status}
          modelLabel={modelLabel}
          targetKind={view.targetKind}
          locale={locale}
          permissionMode={permissionMode}
          permissionModeDisabled={isActive}
          onPermissionModeChange={handlePermissionModeChange}
          hidePermissionMode={isPrimeTarget}
          skillsLabel={isPrimeTarget ? 'rhizome-vault' : null}
          onClose={onClose}
          onNewChat={handleNewChat}
        />
      )}
      {isPrimeTarget && !usesRailSessions && (
        <div className="flex shrink-0 justify-end px-3 pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-[32px] w-[32px] p-0 [&_svg:not([class*=size-])]:size-4"
            onClick={toggleSessions}
            disabled={sessionsAutoCollapsed}
            aria-pressed={sessionsVisible}
            aria-label={translate(locale, sessionsVisible ? 'ai.sessions.close' : 'ai.sessions.open')}
            title={translate(locale, sessionsVisible ? 'ai.sessions.close' : 'ai.sessions.open')}
            data-auto-collapsed={sessionsAutoCollapsed ? 'true' : 'false'}
          >
            <ClockCounterClockwise size={16} />
          </Button>
        </div>
      )}
      {switchError ? (
        <p className="shrink-0 px-3 py-1.5 text-xs text-destructive" role="alert">
          {switchError}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {sessionsShown && !usesRailSessions && (
          // Design system: sessions are a column beside the transcript, never
          // a view that replaces it. Conversation owns the room — which is
          // why the drag has an upper bound rather than free rein.
          <div
            data-testid="prime-sessions-region"
            className="relative flex shrink-0 border-r border-border"
            style={{ width: sessionsWidth.width }}
          >
            {/* Right edge, so dragging right widens it — the mirror of the
                note pane, whose handle is on its left. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={translate(locale, 'ai.sessions.resize')}
              data-testid="prime-sessions-resize"
              className="absolute inset-y-0 -right-[10px] z-20 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-border"
              onMouseDown={(event) =>
                startResizeDrag(event, 'col-resize', (deltaX) => sessionsWidth.resizeBy(-deltaX))
              }
            />
            <PrimeSessionList
              locale={locale}
              onSelectSession={(session) => void handleSelectSession(session)}
              onNewChat={handleNewChat}
              onOpenMycelium={onOpenMycelium}
              activeSessionPath={activeSessionPath}
              working={isActive}
              vaultPath={vaultPath}
              titleBarGutter={!isPrimeTarget}
            />
          </div>
        )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {isPrimeTarget ? (
        <SessionBranchBand
          locale={locale}
          tree={sessionTree}
          onSelect={(targetId) => void handleNavigateBranch(targetId)}
          busyId={branchBusyId}
          error={branchError}
        />
      ) : null}
      {/* `flex flex-col`, not a bare block. The transcript's own scroller is
          `flex-1`, which is inert in a block parent — it then sized to its
          content, `overflow-y-auto` had nothing to overflow, and a long
          session painted straight over the composer instead of scrolling. */}
      <div className="flex min-h-0 flex-1 flex-col">
      <AiPanelMessageHistory
        agentLabel={view.agentLabel}
        agentReadiness={view.defaultAiAgentReadiness}
        locale={locale}
        messages={agent.messages}
        isActive={isActive}
        onForkMessage={forkTargetsPrimeEntry ? (entryId) => void handleForkFromEntry(entryId) : onForkMessage}
        forkTargetsPrimeEntry={forkTargetsPrimeEntry}
        onOpenNote={onOpenNote}
        onNavigateWikilink={handleNavigateWikilink}
        onRegenerateMessage={agent.regenerateMessage}
        onPromoteToVault={
          onPromoteToVault
            ? (text) => onPromoteToVault(text, promoteSessionFromHost(primeHost.sessionId, primeHost.sessionPath))
            : undefined
        }
        onScrollStateChange={onMessageHistoryScrollStateChange}
        hasContext={hasContext}
      />
      </div>
      </div>
      {notePane}
      {sidePanel}
      </div>
      {isPrimeTarget && (
        <PrimeGoalDialog
          open={goalDialog.open}
          onOpenChange={goalDialog.onOpenChange}
          locale={locale}
          currentGoal={goalDialog.currentGoal}
          onSetGoal={goalDialog.onSetGoal}
          onClearGoal={goalDialog.onClearGoal}
        />
      )}
      {isPrimeTarget && (
        <PrimeScheduleDialog
          open={scheduleDialog.open}
          onOpenChange={scheduleDialog.onOpenChange}
          locale={locale}
          onCreate={scheduleDialog.onCreate}
        />
      )}
      <AiPanelComposer
        entries={entries ?? []}
        agentLabel={view.agentLabel}
        agentReadiness={view.defaultAiAgentReadiness}
        locale={locale}
        input={input}
        inputRef={inputRef}
        isActive={isActive}
        controls={composerControls}
        onChange={setInput}
        onSend={handleComposerSend}
        onSteer={isPrimeTarget ? handleSteer : undefined} // #41: wired. GitHub body is stale.
        queue={isPrimeTarget ? queue : undefined}
        onClearQueue={isPrimeTarget ? () => void clearQueue() : undefined}
        onStop={handleStop}
        onUnsupportedAiPaste={onUnsupportedAiPaste}
        attachments={attachments}
        onAttachImages={attachImages}
        onRemoveAttachment={removeAttachment}
        lastAgentMessage={getLastAgentMessage(agent.messages)}
        foot={isPrimeTarget ? (
          <ChatComposerBar
            locale={locale}
            deck={composerDeck}
            skillsLabel={composerSkillsLabel}
            onOpenGoal={goalDialog.openDialog}
            onOpenSchedule={() => scheduleDialog.onOpenChange(true)}
            working={isActive}
            lastToolName={lastToolName(agent.messages)}
            stats={primeStats}
          />
        ) : undefined}
        commandEntries={isPrimeTarget ? localizedCommands : undefined}
        commandDisabled={isPrimeTarget ? commandDisabled : undefined}
        commandSkillLabel={translate(locale, 'ai.command.skill')}
        commandInstantLabel={translate(locale, 'ai.command.instant')}
        onCommandAction={isPrimeTarget ? (action, nextValue) => void handleCommandAction(action, nextValue) : undefined}
      />
      </AiPanelFrame>
      {usesRailSessions && sessionsRailSlot && isPrimeTarget
        ? createPortal(
            <div
              data-testid="command-rail-session-hits"
              className="h-full min-h-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_textarea]:pointer-events-auto [&_[data-slot=button]]:pointer-events-auto [&_[role='button']]:pointer-events-auto"
              style={{ pointerEvents: 'none' }}
            >
              <PrimeSessionList
                locale={locale}
                onSelectSession={(session) => void handleSelectSession(session)}
                onNewChat={handleNewChat}
                onOpenMycelium={onOpenMycelium}
                activeSessionPath={activeSessionPath}
                working={isActive}
                vaultPath={vaultPath}
              />
            </div>,
            sessionsRailSlot,
          )
        : null}
    </>
  )
}

export function AiPanel({
  onClose,
  showHeader,
  composerControls,
  composerDeck,
  composerSkillsLabel,
  onForkMessage: providedOnForkMessage,
  forkTargetsPrimeEntry,
  onOpenNote,
  onPromoteToVault,
  onUnsupportedAiPaste,
  defaultAiAgent: providedDefaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReadiness: providedDefaultAiAgentReadiness,
  defaultAiAgentReady: providedDefaultAiAgentReady,
  locale = 'en',
  onFileCreated,
  onFileModified,
  onVaultChanged,
  vaultPath,
  vaultPaths,
  activeEntry,
  activeNoteContent,
  entries,
  openTabs,
  noteList,
  noteListFilter,
  newChatRef,
  notePane,
  sidePanel,
  sessionsAutoCollapsed,
  sessionsRailSlot,
  onOpenMycelium,
}: AiPanelProps) {
  const defaultAiAgentReadiness = providedDefaultAiAgentReadiness
    ?? readinessFromReadyFlag(providedDefaultAiAgentReady)
  const controller = useAiPanelController({
    vaultPath,
    vaultPaths,
    defaultAiAgent: providedDefaultAiAgent ?? DEFAULT_AI_AGENT,
    defaultAiTarget,
    defaultAiAgentReady: providedDefaultAiAgentReady ?? true,
    defaultAiAgentReadiness,
    activeEntry,
    activeNoteContent,
    entries,
    openTabs,
    noteList,
    noteListFilter,
    locale,
    onOpenNote,
    onFileCreated,
    onFileModified,
    onVaultChanged,
  })

  useEffect(() => {
    if (!newChatRef) return
    newChatRef.current = controller.handleNewChat
  }, [controller.handleNewChat, newChatRef])

  return (
    <AiPanelView
      controller={controller}
      showHeader={showHeader}
      composerControls={composerControls}
      composerDeck={composerDeck}
      composerSkillsLabel={composerSkillsLabel}
      onForkMessage={providedOnForkMessage}
      forkTargetsPrimeEntry={forkTargetsPrimeEntry}
      notePane={notePane}
      sidePanel={sidePanel}
      sessionsAutoCollapsed={sessionsAutoCollapsed}
      sessionsRailSlot={sessionsRailSlot}
      onOpenMycelium={onOpenMycelium}
      onClose={onClose}
      onOpenNote={onOpenNote}
      onPromoteToVault={onPromoteToVault}
      onUnsupportedAiPaste={onUnsupportedAiPaste}
      defaultAiAgent={providedDefaultAiAgent}
      defaultAiTarget={defaultAiTarget}
      defaultAiAgentReadiness={defaultAiAgentReadiness}
      defaultAiAgentReady={providedDefaultAiAgentReady}
      locale={locale}
      vaultPath={vaultPath}
      activeEntry={activeEntry}
      entries={entries}
      targetId={defaultAiTarget?.id}
    />
  )
}
