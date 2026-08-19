import { useCallback, useEffect, useState, useRef, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import {
  AiPanelComposer,
  AiPanelHeader,
  AiPanelMessageHistory,
} from './AiPanelChrome'
import { ClockCounterClockwise, Target } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate } from '../lib/i18n'
import PrimeSessionList from './PrimeSessionList'
import { primeTranscriptToConversation, type PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'
import { isTauri, mockInvoke } from '../mock-tauri'
import { useMenuBarSessionOpen } from '../hooks/useMenuBarSessionOpen'
import { invoke } from '@tauri-apps/api/core'
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
import { useAiPanelPromptQueue } from './useAiPanelPromptQueue'
import { useAiPanelFocus } from './useAiPanelFocus'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { usePrimeSessionRehydrate } from '../hooks/usePrimeSessionRehydrate'
import { usePrimeSessionStats } from '../hooks/usePrimeSessionStats'
import { PrimeContextMeter } from './PrimeContextMeter'
import { ChatComposerFoot } from './ChatComposerFoot'
import { lastToolName } from '../utils/lastToolName'
import { usePrimeCommandMenu } from '../hooks/usePrimeCommandMenu'
import { type CommandMenuAction } from '../lib/primeCommandMenu'
import { trackPrimeCommandRun } from '../lib/productAnalytics'
import { trackEvent } from '../lib/telemetry'
import { PrimeGoalDialog } from './PrimeGoalDialog'
import type { PrimeAgentActivity } from './AgentActivityBand'

export type { AiAgentMessage } from '../hooks/useCliAiAgent'

interface AiPanelProps {
  onClose: () => void
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string) => void
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
  onForkMessage?: (entryId: string) => void
  /** Fork branches the Prime session rather than copying the conversation. */
  forkTargetsPrimeEntry?: boolean
}

interface AiPanelViewProps {
  controller: AiPanelController
  onClose: () => void
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string) => void
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
  composerControls?: ReactNode
  notePane?: ReactNode
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
  onForkMessage,
  forkTargetsPrimeEntry,
  onQueuedPromptTarget,
  onSendPrompt,
  onMessageHistoryScrollStateChange,
  targetId,
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
  const primeHost = usePrimeHostStatus(isPrimeTarget)
  const modelLabel = isPrimeTarget ? primeModelLabel(primeHost) : null
  // Refresh when a turn finishes rather than only on the interval, so context
  // usage reflects the exchange that just happened.
  const primeStats = usePrimeSessionStats(isPrimeTarget, agent.status)

  // Goal dialog (#20): opened on demand, not polled — the goal strip
  // (`AgentActivityBand`, wired in `ChatHome`) already polls for display.
  // This only needs a fresh read at the moment the dialog opens, so the
  // "current goal" shown there can never be stale.
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalDialogGoal, setGoalDialogGoal] = useState<PrimeAgentActivity['goal'] | null>(null)
  const handleOpenGoalDialog = useCallback(() => {
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
    setGoalDialogOpen(true)
    void call<PrimeAgentActivity>('get_prime_agent_activity')
      .then((activity) => setGoalDialogGoal(activity?.goal ?? null))
      .catch(() => setGoalDialogGoal(null))
  }, [])
  const handleSetGoal = useCallback(async (objective: string, tokenBudget: number | null) => {
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
    const goal = await call<{ objective?: string }>('set_prime_goal', {
      objective,
      tokenBudget: tokenBudget ?? undefined,
    })
    // ProductAnalyticsProperties is Record<string, string | number> — a raw
    // boolean does not typecheck under the build's stricter pass.
    trackEvent('prime_goal_set', { has_budget: tokenBudget !== null ? 'yes' : 'no' })
    return goal
  }, [])
  const handleClearGoal = useCallback(async () => {
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
    await call<void>('clear_prime_goal')
    trackEvent('prime_goal_cleared')
  }, [])

  // Reopening lands back in work the daemon kept running, so the panel has to
  // show that conversation rather than an empty one over a live session (#7).
  usePrimeSessionRehydrate({
    enabled: isPrimeTarget,
    reattached: primeHost.reattached ?? false,
    sessionPath: primeHost.sessionPath,
    onTranscript: agent.replaceMessages,
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
  const handleComposerSend = useCallback((text: string, references: Parameters<typeof handleSend>[1]) => {
    if (!text.trim() || isActive) return
    onSendPrompt?.(text)
    handleSend(text, references)
  }, [handleSend, isActive, onSendPrompt])

  const [sessionsOpen, setSessionsOpen] = useState(false)
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
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
    setSwitchError(null)
    try {
      const forked = await call<{ sessionId: string }>('fork_prime_session', { entryId })
      const summaries = await call<PrimeSessionSummary[]>('list_prime_session_summaries')
      const branch = summaries.find((session) => session.id === forked.sessionId)
      if (!branch) {
        // Prime writes the branch log asynchronously. The fork succeeded; the
        // transcript will be there on the next open, so this does not report
        // a failure that did not happen.
        setActiveSessionPath(null)
        return
      }
      const transcript = await call<PrimeTranscriptItem[]>('read_prime_session_transcript', {
        path: branch.path,
      })
      agent.replaceMessages(primeTranscriptToConversation(transcript))
      setActiveSessionPath(branch.path)
      setSessionsOpen(false)
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : String(e))
    }
  }, [agent])

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
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
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
        const tokens = await call<number | null>('compact_prime_session')
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
        const path = await call<string>('export_prime_session', {
          sessionPath: primeHost.sessionPath,
        })
        agent.addLocalMarker(translate(locale, 'ai.command.exported', { path }))
      } catch (e) {
        setSwitchError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [agent, handleForkFromEntry, latestPrimeEntryId, locale, primeHost.sessionPath, setInput])

  const handleSelectSession = useCallback(async (session: PrimeSessionSummary) => {
    const call = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
      isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
    setSwitchError(null)
    try {
      await call<string>('switch_prime_session', { path: session.path })
      const transcript = await call<PrimeTranscriptItem[]>('read_prime_session_transcript', {
        path: session.path,
      })
      agent.replaceMessages(primeTranscriptToConversation(transcript))
      setActiveSessionPath(session.path)
      setSessionsOpen(false)
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : String(e))
    }
  }, [agent])

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
            className="h-6 w-6 p-0 [&_svg:not([class*=size-])]:size-4"
            onClick={() => setSessionsOpen((open) => !open)}
            aria-pressed={sessionsOpen}
            aria-label={translate(locale, sessionsOpen ? 'ai.sessions.close' : 'ai.sessions.open')}
            title={translate(locale, sessionsOpen ? 'ai.sessions.close' : 'ai.sessions.open')}
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
        {sessionsOpen && (
          // Design system: sessions are a 228px column beside the transcript,
          // never a view that replaces it. Conversation owns the room.
          // 900px matches the design system's own breakpoint for `.ra-sessions`;
          // below it the transcript takes the whole panel.
          <div className="hidden w-[228px] shrink-0 border-r border-border min-[900px]:flex">
            <PrimeSessionList
              locale={locale}
              onSelectSession={(session) => void handleSelectSession(session)}
              onNewChat={handleNewChat}
              activeSessionPath={activeSessionPath}
              working={isActive}
            />
          </div>
        )}
      <div className="flex min-h-0 min-w-[55%] flex-1">
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
        onPromoteToVault={onPromoteToVault}
        onScrollStateChange={onMessageHistoryScrollStateChange}
        hasContext={hasContext}
      />
      </div>
      {notePane}
      </div>
      {isPrimeTarget && (
        <div style={{ padding: '0 12px 6px' }} className="flex items-center justify-between gap-2">
          <PrimeContextMeter stats={primeStats} locale={locale} />
          <Button
            variant="ghost"
            size="xs"
            onClick={handleOpenGoalDialog}
            data-testid="prime-goal-trigger"
          >
            <Target size={12} weight="regular" aria-hidden="true" />
            {translate(locale, 'ai.goal.trigger')}
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
        onStop={handleStop}
        onUnsupportedAiPaste={onUnsupportedAiPaste}
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
      onClose={onClose}
      onOpenNote={onOpenNote}
      onPromoteToVault={onPromoteToVault}
      onUnsupportedAiPaste={onUnsupportedAiPaste}
      defaultAiAgent={providedDefaultAiAgent}
      defaultAiTarget={defaultAiTarget}
      defaultAiAgentReadiness={defaultAiAgentReadiness}
      defaultAiAgentReady={providedDefaultAiAgentReady}
      locale={locale}
      activeEntry={activeEntry}
      entries={entries}
      targetId={defaultAiTarget?.id}
    />
  )
}
