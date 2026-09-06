import { useEffect, useRef, useState, useMemo } from 'react'
import { AiPanel } from './AiPanel'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'
import { AgentActivityBand } from './AgentActivityBand'
import { RlmFamilyBand } from './RlmFamilyBand'
import { ChatComposerDeck } from './ChatComposerDeck'
import { ChatPreflightBanner } from './ChatPreflightBanner'
import { AgentsPill } from './status-bar/AgentsPill'
import { useRhizomeJobs } from '../hooks/useRhizomeJobs'
import { ChatNotePane } from './ChatNotePane'
import { useChatNoteContent } from '../hooks/useChatNoteContent'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { resolveChatOpenNote } from '../utils/resolveChatOpenNote'
import { agentTargets, type AiTarget } from '../lib/aiTargets'
import type { AiAgentId, AiAgentReadiness } from '../lib/aiAgents'
import type { AppLocale } from '../lib/i18n'
import type { VaultEntry } from '../types'

interface ChatHomeProps {
  locale: AppLocale
  defaultAiAgent: AiAgentId
  defaultAiTarget?: AiTarget | null
  defaultAiAgentReadiness: AiAgentReadiness
  defaultAiAgentReady: boolean
  vaultPath: string
  vaultPaths: string[]
  entries: VaultEntry[]
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string) => void
  onFileCreated?: (path: string) => void
  onFileModified?: (path: string) => void
  onVaultChanged?: () => void
  onUnsupportedAiPaste?: (message: string) => void
  sessionsAutoCollapsed?: boolean
  /** Expanded Command Rail slot, if this shell has the rail enabled. */
  sessionsRailSlot?: HTMLElement | null
  /** Where "close" goes when chat owns the window — back to the vault. */
  onExit: () => void
  /** Reveals the existing Notes workspace after leaving a note preview. */
  onShowNotes?: () => void
  /** Open Mycelium on this Prime session only (#22). */
  onOpenSessionFootprint?: (sessionPath: string) => void
  /** Lets the shell make room for Chat's secondary note pane at narrow widths. */
  onNotePaneOpenChange?: (open: boolean) => void
  /**
   * A note handed to Chat from outside — the vault's "Ask the agent about this
   * note". Carries an id so asking about the *same* note twice still reopens
   * it after the user has closed the pane.
   */
  requestedNote?: { path: string; label: string; requestId: number } | null
}

/**
 * Chat as the center canvas (ADR-0166). Sessions stay a left column inside
 * this surface; Inbox opens one Notes panel with navigation above its list.
 * Open-note is a secondary pane, not an editor takeover.
 */
export default function ChatHome({
  locale,
  defaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReadiness,
  defaultAiAgentReady,
  vaultPath,
  vaultPaths,
  entries,
  onPromoteToVault,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  onUnsupportedAiPaste,
  sessionsAutoCollapsed = false,
  sessionsRailSlot,
  onExit,
  onShowNotes,
  onOpenSessionFootprint,
  onNotePaneOpenChange,
  requestedNote,
}: ChatHomeProps) {
  // Chat is Prime's home canvas (ADR-0166). A direct API model chosen as the
  // global default must not strip Prime chrome or route chat away from Prime.
  const isPrimeChat = defaultAiAgent === 'prime'
  const chatTarget = useMemo((): AiTarget | undefined => {
    if (!isPrimeChat) return defaultAiTarget ?? undefined
    if (defaultAiTarget?.kind === 'api_model') {
      return agentTargets().find((target) => target.kind === 'agent' && target.agent === 'prime')
    }
    return defaultAiTarget ?? undefined
  }, [defaultAiTarget, isPrimeChat])
  const isPrimeTarget = isPrimeChat && chatTarget?.kind !== 'api_model'
  const primeHost = usePrimeHostStatus(isPrimeTarget, vaultPath)
  const newChatRef = useRef<(() => void) | null>(null)
  const [openNote, setOpenNote] = useState<{ path: string; label: string } | null>(null)
  const [notePaneCollapsed, setNotePaneCollapsed] = useState(false)
  // One read of the open note, shared by the pane and the agent. Chat used to
  // pass nothing to `AiPanel`, so a note open on screen was invisible to the
  // model — "summarise this" had no "this".
  // An incoming request wins over whatever is open. Keyed on `requestId`, not
  // the path, so asking about the same note twice reopens it rather than
  // silently doing nothing.
  //
  // Adjusted during render rather than in an effect: this is state derived
  // from a prop, and React's own guidance is to set it here. An effect would
  // render once with the stale note before correcting itself.
  const [lastRequestId, setLastRequestId] = useState<number | null>(null)
  if (requestedNote && requestedNote.requestId !== lastRequestId) {
    setLastRequestId(requestedNote.requestId)
    setOpenNote({ path: requestedNote.path, label: requestedNote.label })
    setNotePaneCollapsed(false)
  }
  const notePaneOpen = openNote !== null
  useEffect(() => {
    onNotePaneOpenChange?.(notePaneOpen)
    return () => {
      if (notePaneOpen) onNotePaneOpenChange?.(false)
    }
  }, [notePaneOpen, onNotePaneOpenChange])
  const openNoteContent = useChatNoteContent(openNote?.path, vaultPath)
  // Bounds, not decoration: below ~260px the note is unreadable, and past
  // ~880px the conversation it sits beside stops being the point.
  const notePaneWidth = usePanelWidth(APP_STORAGE_KEYS.chatNotePaneWidth, 448, 260, 880)
  const openNoteEntry = openNote
    ? entries.find((entry) => entry.path === openNote.path) ?? null
    : null
  const rhizomeJobs = useRhizomeJobs()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="chat-home">
      {isPrimeTarget ? (
        <PrimeSessionSubhead
          locale={locale}
          live={Boolean(primeHost?.running)}
          sessionId={primeHost?.sessionId ?? null}
          vaultPath={vaultPath}
          startedAt={primeHost?.startedAt ?? null}
          problem={primeHost?.problem ?? null}
          onNewChat={() => newChatRef.current?.()}
          onOpenFootprint={
            onOpenSessionFootprint && primeHost?.sessionPath
              ? () => onOpenSessionFootprint(primeHost.sessionPath as string)
              : undefined
          }
        />
      ) : null}
      <AgentActivityBand locale={locale} enabled={isPrimeTarget} />
      <RlmFamilyBand
        locale={locale}
        enabled={isPrimeTarget}
        liveSessionId={primeHost?.sessionId ?? null}
      />
      <div className="flex min-h-0 flex-1">
        <AiPanel
          locale={locale}
          defaultAiAgent={defaultAiAgent}
          defaultAiTarget={chatTarget}
          defaultAiAgentReadiness={defaultAiAgentReadiness}
          defaultAiAgentReady={defaultAiAgentReady}
          vaultPath={vaultPath}
          vaultPaths={vaultPaths}
          entries={entries}
          activeEntry={openNoteEntry}
          activeNoteContent={openNoteContent.body}
          onOpenNote={(target) => {
            const resolved = resolveChatOpenNote(target, vaultPath, entries)
            if (resolved) {
              setOpenNote(resolved)
              setNotePaneCollapsed(false)
            }
          }}
          onPromoteToVault={onPromoteToVault}
          onFileCreated={onFileCreated}
          onFileModified={onFileModified}
          onVaultChanged={onVaultChanged}
          onUnsupportedAiPaste={onUnsupportedAiPaste}
          showHeader={false}
          sessionsAutoCollapsed={sessionsAutoCollapsed}
          sessionsRailSlot={sessionsRailSlot}
          forkTargetsPrimeEntry
          newChatRef={newChatRef}
          onOpenMycelium={onOpenSessionFootprint}
          notePane={
            openNote ? notePaneCollapsed ? (
              <div
                aria-hidden="true"
                data-testid="chat-note-hover-edge"
                className="flex w-7 shrink-0 cursor-pointer items-center justify-center border-l border-border bg-background text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                style={{ writingMode: 'vertical-rl' }}
                onMouseEnter={() => setNotePaneCollapsed(false)}
              >
                Inbox
              </div>
            ) : (
              <div
                data-testid="chat-note-hover-region"
                className="flex min-h-0 shrink-0"
                onMouseLeave={() => setNotePaneCollapsed(true)}
              >
              <ChatNotePane
                locale={locale}
                label={openNote.label}
                width={notePaneWidth.width}
                onResize={notePaneWidth.resizeBy}
                body={openNoteContent.body}
                error={openNoteContent.error}
                loading={openNoteContent.loading}
                onBackToNotes={() => {
                  setOpenNote(null)
                  setNotePaneCollapsed(false)
                  onShowNotes?.()
                }}
                onClose={() => {
                  setOpenNote(null)
                  setNotePaneCollapsed(false)
                }}
                onOpenNote={(target) => {
                  const resolved = resolveChatOpenNote(target, vaultPath, entries)
                  if (resolved) {
                    setOpenNote(resolved)
                    setNotePaneCollapsed(false)
                  }
                }}
              />
              </div>
            ) : null
          }
          composerControls={
            isPrimeTarget ? (
              <>
              {/* Above the pills, not below: a reason the turn will fail is
                  worth more than the controls it sits over. */}
              <ChatPreflightBanner
                locale={locale}
                vaultPath={vaultPath}
                provider={primeHost?.modelProvider ?? null}
              />
              <ChatComposerDeck
                locale={locale}
                vaultPath={vaultPath}
                contextLabel={openNote ? openNote.label.split('/').filter(Boolean).at(-1) ?? openNote.label : null}
                onCloseContext={() => {
                  setOpenNote(null)
                  setNotePaneCollapsed(false)
                }}
                skillsLabel="rhizome-vault"
                model={primeModelLabel(primeHost)}
                thinkingLevel={primeHost?.thinkingLevel ?? null}
                activity={
                  <AgentsPill
                    jobs={rhizomeJobs.activeJobs}
                    onCancelJob={rhizomeJobs.cancelJob}
                    locale={locale}
                  />
                }
              />
              </>
            ) : undefined
          }
          onClose={onExit}
        />
      </div>
    </div>
  )
}
