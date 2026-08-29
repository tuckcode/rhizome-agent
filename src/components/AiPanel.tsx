import { useCallback, useEffect, useState, useRef, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

import {
  chatSessionsOpenDefault,
  readChatSessionsOpen,
  storedChatSessionsOpen,
} from '../lib/chatSessionsColumn'
import { callHost } from '../lib/callHost'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { startResizeDrag } from '../utils/startResizeDrag'
import { trackPrimeSessionTreeNavigated } from '../lib/productAnalytics'
import { useAiPanelAttachments } from './useAiPanelAttachments'
import { useAiPanelSendPolicy } from './useAiPanelSendPolicy'
import { useAiPanelModelChangeMarker } from './useAiPanelModelChangeMarker'
import { usePrimeQueue } from '../hooks/usePrimeQueue'
import { usePrimeSessionTree } from '../hooks/usePrimeSessionTree'
import { SessionBranchBand } from './SessionBranchBand'
import {
  primeTranscriptToConversation,
  transcriptAlongBranch,
  type PrimeTranscriptItem,
} from '../lib/primeTranscriptToConversation'
import type { PrimeSessionTree } from '../lib/primeSessionTree'
import {
  AiPanelComposer,
  AiPanelHeader,
  AiPanelMessageHistory,
} from './AiPanelChrome'
import { ClockCounterClockwise, CalendarDots, Target } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate } from '../lib/i18n'
import PrimeSessionList from './PrimeSessionList'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'
import { useMenuBarSessionOpen } from '../hooks/useMenuBarSessionOpen'
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
import { usePrimeSessionRehydrate } from '../hooks/usePrimeSessionRehydrate'
import { usePrimeSessionStats } from '../hooks/usePrimeSessionStats'
import { PrimeContextMeter } from './PrimeContextMeter'
import { ChatComposerFoot } from './ChatComposerFoot'
import { lastToolName } from '../utils/lastToolName'
import { usePrimeCommandMenu } from '../hooks/usePrimeCommandMenu'
import { type CommandMenuAction } from '../lib/primeCommandMenu'
import { trackPrimeCommandRun, trackPrimeScheduledWorkCreated } from '../lib/productAnalytics'
import { trackEvent } from '../lib/telemetry'
import { PrimeGoalDialog } from './PrimeGoalDialog'
import { PrimeScheduleDialog, type ScheduledWorkKind, type HeartbeatDelivery } from './PrimeScheduleDialog'
import type { PrimeAgentActivity } from './AgentActivityBand'
import { usePrimeActivity } from './primeActivityContext'

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
  /** Chips rendered in the composer's control row (Frame A's control deck). */
  composerControls?: ReactNode
  /** Frame B note split — sits beside the transcript so the composer spans both. */
  notePane?: ReactNode
  /** Temporarily hide Sessions when the containing shell cannot fit it. */
  sessionsAutoCollapsed?: boolean
  onForkMessage?: (entryId: string) => void
  /** Fork branches the Prime session rather than copying the conversation. */
  forkTargetsPrimeEntry?: boolean
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
  notePane?: ReactNode
  sessionsAutoCollapsed?: boolean
  onForkMessage?: (messageId: string) => void
  forkTargetsPrimeEntry?: boolean
  onQueuedPromptTarget?: (targetId: string) => void
  onSendPrompt?: (text: string) => void
  onMessageHistoryScrollStateChange?: (scrolled: boolean) => void
  targetId?: string
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

function aiPanelFrameStyle(isActive: boolean, showLeftBorder: boolean): CSSProperties {
  return {
    outline: 'none',
    borderLeft: showLeftBorder
      ? isActive
        ? '2px solid var(--accent-blue)'
        : '1px solid var(--border)'
      : undefined,
    animation: showLeftBorder && isActive ? 'ai-border-pulse 2s ease-in-out infinite' : undefined,
    transition: showLeftBorder ? 'border-color 0.3s ease' : undefined,
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
  notePane,
  sessionsAutoCollapsed = false,
  onForkMessage,
  forkTargetsPrimeEntry,
  onQueuedPromptTarget,
  onSendPrompt,
  onMessageHistoryScrollStateChange,
  targetId,
  vaultPath = null,
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
  const { tree: sessionTree, refresh: refreshSessionTree } = usePrimeSessionTree(
    isPrimeTarget,
    primeHost.sessionPath ?? isActive,
  )
  const [branchBusyId, setBranchBusyId] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)

  // Goal dialog (#20): opened on demand, not polled — the goal strip
  // (`AgentActivityBand`, wired in `ChatHome`) already polls for display.
  // This only needs a fresh read at the moment the dialog opens, so the
  // "current goal" shown there can never be stale.
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalDialogGoal, setGoalDialogGoal] = useState<PrimeAgentActivity['goal'] | null>(null)
  const handleOpenGoalDialog = useCallback(() => {

    setGoalDialogOpen(true)
    void callHost<PrimeAgentActivity>('get_prime_agent_activity')
      .then((activity) => setGoalDialogGoal(activity?.goal ?? null))
      .catch(() => setGoalDialogGoal(null))
  }, [])
  const handleSetGoal = useCallback(async (objective: string, tokenBudget: number | null) => {

    const goal = await callHost<{ objective?: string }>('set_prime_goal', {
      objective,
      tokenBudget: tokenBudget ?? undefined,
    })
    // ProductAnalyticsProperties is Record<string, string | number> — a raw
    // boolean does not typecheck under the build's stricter pass.
    trackEvent('prime_goal_set', { has_budget: tokenBudget !== null ? 'yes' : 'no' })
    return goal
  }, [])
  const handleClearGoal = useCallback(async () => {

    await callHost<void>('clear_prime_goal')
    trackEvent('prime_goal_cleared')
  }, [])

  const { refresh: refreshActivity } = usePrimeActivity()
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const handleCreateSchedule = useCallback(
    async (
      kind: ScheduledWorkKind,
      schedule: string,
      prompt: string,
      deliveryMode: HeartbeatDelivery,
    ) => {
      await callHost('create_prime_scheduled_work', {
        kind,
        schedule,
        prompt,
        deliveryMode: kind === 'heartbeat' ? deliveryMode : undefined,
      })
      trackPrimeScheduledWorkCreated(kind)
      await refreshActivity()
    },
    [refreshActivity],
  )

  // Reopening lands back in work the daemon kept running, so the panel has to
  // show that conversation rather than an empty one over a live session (#7).
  usePrimeSessionRehydrate({
    enabled: isPrimeTarget,
    reattached: primeHost.reattached ?? false,
    sessionPath: primeHost.sessionPath,
    onTranscript: agent.replaceMessages,
  })

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
  })

  // Open unless this machine says otherwise. The column is the only thing on
  // Chat home that says other sessions exist, so a closed default left the
  // landing window an empty transcript and a composer (visual audit,
  // 2026-08-20). Read lazily so the first paint already has the right column.
  const [sessionsOpen, setSessionsOpen] = useState(() => {
    try {
      return readChatSessionsOpen(localStorage.getItem(APP_STORAGE_KEYS.chatSessionsOpen))
    } catch {
      return chatSessionsOpenDefault
    }
  })

  const toggleSessions = useCallback(() => {
    if (sessionsAutoCollapsed) return
    setSessionsOpen((open) => {
      const next = !open
      try {
        localStorage.setItem(APP_STORAGE_KEYS.chatSessionsOpen, storedChatSessionsOpen(next))
      } catch {
        // A machine with no usable storage still gets the toggle, just not
        // the memory of it.
      }
      return next
    })
  }, [sessionsAutoCollapsed])
  const sessionsVisible = sessionsOpen && !sessionsAutoCollapsed
  const [activeSessionPath, setActiveSessionPath] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  /**
   * Switch the live host to a past session and rehydrate the transcript.
   *
   * The switch goes first: if the host refuses (it will not switch mid-turn),
   * the panel must keep showing the conversation it is actually on rather than
   * a transcript from a session that was never loaded.
   */
  /**
   * Branch a new session from a past entry, then show the branch.
   *
   * Only replayed turns carry a Prime entry id — the live stream has none — so
   * the button is disabled elsewhere and this always receives a real one. The
   * fork switches the host into the new session and truncates history at the
   * branch point, so the panel rehydrates from the branch's own log rather
   * than trimming what it already had.
   */
  const handleForkFromEntry = useCallback(async (entryId: string) => {

    setSwitchError(null)
    try {
      const forked = await callHost<{ sessionId: string; branchedFrom?: string }>('fork_prime_session', { entryId })
      const summaries = await callHost<PrimeSessionSummary[]>('list_prime_session_summaries')
      const branch = summaries.find((session) => session.id === forked.sessionId)
      if (!branch) {
        // Prime writes the branch log asynchronously. The fork succeeded; the
        // transcript will be there on the next open, so this does not report
        // a failure that did not happen.
        setActiveSessionPath(null)
        return
      }
      const transcript = await callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', {
        path: branch.path,
      })
      agent.replaceMessages(primeTranscriptToConversation(transcript))
      agent.addLocalMarker(
        forked.branchedFrom?.trim()
          ? translate(locale, 'ai.command.forkedFrom', { from: forked.branchedFrom.trim() })
          : translate(locale, 'ai.command.forked'),
      )
      setActiveSessionPath(branch.path)
      refreshSessionTree()
      // Same as selecting: the column stays. A fork adds a session to the very
      // list being hidden, so closing it hides the thing that just happened.
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : String(e))
    }
  }, [agent, locale, refreshSessionTree])

  /**
   * Stay in this conversation and continue from an earlier fork (#17).
   *
   * Not a session switch: the log file is the same, the leaf moves. The
   * on-disk jsonl still has every sibling, so the transcript is filtered to
   * the ancestry of the new leaf rather than replaying the abandoned turn.
   */
  const handleNavigateBranch = useCallback(async (targetId: string) => {
    setBranchError(null)
    setBranchBusyId(targetId)
    try {
      const next = await callHost<PrimeSessionTree>('navigate_prime_session_tree', { targetId })
      const path = activeSessionPath ?? primeHost.sessionPath
      if (path) {
        const transcript = await callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', {
          path,
        })
        agent.replaceMessages(
          primeTranscriptToConversation(transcriptAlongBranch(transcript, next.leafId)),
        )
      }
      trackPrimeSessionTreeNavigated()
      refreshSessionTree()
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : String(e))
    } finally {
      setBranchBusyId(null)
    }
  }, [activeSessionPath, agent, primeHost.sessionPath, refreshSessionTree])

  const commandEntries = usePrimeCommandMenu(isPrimeTarget, primeHost.sessionId)
  const latestPrimeEntryId = [...agent.messages].reverse().find((message) => message.primeEntryId)?.primeEntryId
  const commandDisabled = {
    ...(latestPrimeEntryId ? {} : { fork: translate(locale, 'ai.command.forkNeedsEntry') }),
    // Export reads the session log off disk, so it needs one to exist.
    ...(primeHost.sessionPath ? {} : { export: translate(locale, 'ai.command.exportNeedsSession') }),
  }
  const localizedCommands = commandEntries.map((entry) => {
    if (entry.slash === 'fork') {
      return { ...entry, description: translate(locale, 'ai.command.forkDescription') }
    }
    if (entry.slash === 'compact') {
      return { ...entry, description: translate(locale, 'ai.command.compactDescription') }
    }
    if (entry.slash === 'export') {
      return { ...entry, description: translate(locale, 'ai.command.exportDescription') }
    }
    return entry
  })

  const handleCommandAction = useCallback(async (action: CommandMenuAction, nextValue: string) => {

    setInput(nextValue)
    // A skill is completed into the composer, not sent — it takes arguments,
    // and sending on pick fired the turn before the user could type any.
    if (action.kind === 'compose') {
      trackPrimeCommandRun(action.name, 'skill')
      return
    }
    trackPrimeCommandRun(action.name, 'instant')
    if (action.name === 'fork') {
      if (!latestPrimeEntryId) return
      await handleForkFromEntry(latestPrimeEntryId)
      return
    }
    if (action.name === 'compact') {
      try {
        const tokens = await callHost<number | null>('compact_prime_session')
        agent.addLocalMarker(
          typeof tokens === 'number'
            ? translate(locale, 'ai.command.compactedTokens', { tokens: String(tokens) })
            : translate(locale, 'ai.command.compacted'),
        )
      } catch (e) {
        setSwitchError(e instanceof Error ? e.message : String(e))
      }
      return
    }
    if (action.name === 'export') {
      if (!primeHost.sessionPath) return
      try {
        const path = await callHost<string>('export_prime_session', {
          sessionPath: primeHost.sessionPath,
        })
        agent.addLocalMarker(translate(locale, 'ai.command.exported', { path }))
      } catch (e) {
        setSwitchError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [agent, handleForkFromEntry, latestPrimeEntryId, locale, primeHost.sessionPath, setInput])

  const handleSelectSession = useCallback(async (session: PrimeSessionSummary) => {

    setSwitchError(null)
    try {
      if (vaultPath) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      await callHost<string>('switch_prime_session', { path: session.path })
      const transcript = await callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', {
        path: session.path,
      })
      agent.replaceMessages(primeTranscriptToConversation(transcript))
      setActiveSessionPath(session.path)
      refreshSessionTree()
      // The column deliberately stays open. Closing it made sense when this
      // list was an overlay covering the conversation — dismissing it was how
      // you got back to the chat. It is a persistent sidebar now, and closing
      // it on select throws away the standing context you opened it for, then
      // makes you reopen it to pick a second session.
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : String(e))
    }
  }, [agent, refreshSessionTree, vaultPath])

  // A roster row clicked in the menu bar lands here (#13). Reuses the same
  // switch path as the in-app session list so there is one way to change
  // sessions, not two that can drift.
  const handleOpenSessionFromMenuBar = useCallback((sessionPath: string) => {
    void handleSelectSession({ id: sessionPath, path: sessionPath })
  }, [handleSelectSession])
  useMenuBarSessionOpen(handleOpenSessionFromMenuBar)

  return (
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
      {isPrimeTarget && (
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
        {sessionsVisible && (
          // Design system: sessions are a column beside the transcript, never
          // a view that replaces it. Conversation owns the room — which is
          // why the drag has an upper bound rather than free rein.
          <div
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
              activeSessionPath={activeSessionPath}
              working={isActive}
              vaultPath={vaultPath}
            />
          </div>
        )}
      <div className="flex min-h-0 min-w-[55%] flex-1 flex-col">
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
      </div>
      {isPrimeTarget && (
        <div style={{ padding: '0 12px 6px' }} className="flex items-center gap-2">
          {/*
            The meter keeps its slot even when it renders nothing. With
            `justify-between` and a meter that returns null before any tokens
            are used, Goal was the row's only child and sat hard left — then
            jumped to the far right the moment a session reported usage. One
            control, two homes, depending on state the user never chose.
          */}
          <div className="min-w-0 flex-1" data-testid="prime-context-meter-slot">
            <PrimeContextMeter stats={primeStats} locale={locale} />
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleOpenGoalDialog}
            data-testid="prime-goal-trigger"
          >
            <Target size={12} weight="regular" aria-hidden="true" />
            {translate(locale, 'ai.goal.trigger')}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setScheduleDialogOpen(true)}
            data-testid="prime-schedule-trigger"
          >
            <CalendarDots size={12} weight="regular" aria-hidden="true" />
            {translate(locale, 'ai.schedule.trigger')}
          </Button>
        </div>
      )}
      {isPrimeTarget && (
        <PrimeGoalDialog
          open={goalDialogOpen}
          onOpenChange={setGoalDialogOpen}
          locale={locale}
          currentGoal={goalDialogGoal}
          onSetGoal={handleSetGoal}
          onClearGoal={handleClearGoal}
        />
      )}
      {isPrimeTarget && (
        <PrimeScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          locale={locale}
          onCreate={handleCreateSchedule}
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
        onSteer={isPrimeTarget ? handleSteer : undefined}
        queue={isPrimeTarget ? queue : undefined}
        onClearQueue={isPrimeTarget ? () => void clearQueue() : undefined}
        onStop={handleStop}
        onUnsupportedAiPaste={onUnsupportedAiPaste}
        attachments={attachments}
        onAttachImages={attachImages}
        onRemoveAttachment={removeAttachment}
        lastAgentMessage={getLastAgentMessage(agent.messages)}
        foot={isPrimeTarget ? (
          <ChatComposerFoot
            locale={locale}
            working={isActive}
            lastToolName={lastToolName(agent.messages)}
          />
        ) : undefined}
        commandEntries={isPrimeTarget ? localizedCommands : undefined}
        commandDisabled={isPrimeTarget ? commandDisabled : undefined}
        commandSkillLabel={translate(locale, 'ai.command.skill')}
        commandInstantLabel={translate(locale, 'ai.command.instant')}
        onCommandAction={isPrimeTarget ? (action, nextValue) => void handleCommandAction(action, nextValue) : undefined}
      />
    </AiPanelFrame>
  )
}

export function AiPanel({
  onClose,
  showHeader,
  composerControls,
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
  sessionsAutoCollapsed,
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
      onForkMessage={providedOnForkMessage}
      forkTargetsPrimeEntry={forkTargetsPrimeEntry}
      notePane={notePane}
      sessionsAutoCollapsed={sessionsAutoCollapsed}
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
