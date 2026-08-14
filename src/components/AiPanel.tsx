import { useCallback, useState, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import {
  AiPanelComposer,
  AiPanelHeader,
  AiPanelMessageHistory,
} from './AiPanelChrome'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate } from '../lib/i18n'
import PrimeSessionList from './PrimeSessionList'
import { primeTranscriptToConversation, type PrimeTranscriptItem } from '../lib/primeTranscriptToConversation'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'
import { isTauri, mockInvoke } from '../mock-tauri'
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
import { usePrimeSessionStats } from '../hooks/usePrimeSessionStats'
import { PrimeContextMeter } from './PrimeContextMeter'
import { ChatComposerFoot } from './ChatComposerFoot'
import { lastToolName } from '../utils/lastToolName'

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
  /** Chips rendered in the composer's control row (Frame A's control deck). */
  composerControls?: ReactNode
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
  onForkMessage?: (messageId: string) => void
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
  onForkMessage,
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
      <AiPanelMessageHistory
        agentLabel={view.agentLabel}
        agentReadiness={view.defaultAiAgentReadiness}
        locale={locale}
        messages={agent.messages}
        isActive={isActive}
        onForkMessage={onForkMessage}
        onOpenNote={onOpenNote}
        onNavigateWikilink={handleNavigateWikilink}
        onRegenerateMessage={agent.regenerateMessage}
        onPromoteToVault={onPromoteToVault}
        onScrollStateChange={onMessageHistoryScrollStateChange}
        hasContext={hasContext}
      />
      </div>
      {isPrimeTarget && (
        <div style={{ padding: '0 12px 6px' }}>
          <PrimeContextMeter stats={primeStats} locale={locale} />
        </div>
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
      />
    </AiPanelFrame>
  )
}

export function AiPanel({
  onClose,
  showHeader,
  composerControls,
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

  return (
    <AiPanelView
      controller={controller}
      showHeader={showHeader}
      composerControls={composerControls}
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
