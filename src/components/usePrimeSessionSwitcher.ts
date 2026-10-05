import { startTransition, useCallback, useEffect, useState } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import {
  chatSessionsOpenDefault,
  readChatSessionsOpen,
  storedChatSessionsOpen,
} from '../lib/chatSessionsColumn'
import { callHost } from '../lib/callHost'
import {
  primeTranscriptToConversation,
  transcriptAlongBranch,
  type PrimeTranscriptItem,
} from '../lib/primeTranscriptToConversation'
import type { PrimeSessionTree } from '../lib/primeSessionTree'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'
import { useMenuBarSessionOpen } from '../hooks/useMenuBarSessionOpen'
import {
  trackPrimeSessionTreeNavigated,
  trackSessionTranscriptHitOpened,
} from '../lib/productAnalytics'
import {
  subscribeSessionTranscriptHitOpen,
  type SessionTranscriptHit,
} from '../lib/sessionTranscriptSearch'
import { translate, type AppLocale } from '../lib/i18n'
import type { useCliAiAgent } from '../hooks/useCliAiAgent'

type AiAgentBridge = ReturnType<typeof useCliAiAgent>

const SESSION_HELD_ELSEWHERE = 'already open in another Prime client'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The previous window can still hold the log for a moment after it closes.
 * One retry covers that handoff. If this host is already on the file, the
 * transcript is enough — switching again is what Prime refuses.
 */
async function switchPrimeSession(
  path: string,
  currentPath: string | null | undefined,
): Promise<void> {
  if (currentPath && currentPath === path) return
  try {
    await callHost<string>('switch_prime_session', { path })
  } catch (error) {
    if (!errorText(error).includes(SESSION_HELD_ELSEWHERE)) throw error
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    try {
      await callHost<string>('switch_prime_session', { path })
    } catch (retryError) {
      if (!errorText(retryError).includes(SESSION_HELD_ELSEWHERE)) throw retryError
      if (currentPath === path) return
      throw retryError
    }
  }
}

interface UsePrimeSessionSwitcherArgs {
  agent: AiAgentBridge
  locale: AppLocale
  vaultPath?: string | null
  sessionsAutoCollapsed: boolean
  refreshSessionTree: () => void
  /** The live host's current session, used as the branch-navigate fallback when no past session has been selected. */
  primeHostSessionPath: string | null | undefined
  /** Skip ensure-on-switch when Chat already has a live Prime host. */
  hostRunning?: boolean
}

interface UsePrimeSessionSwitcherResult {
  sessionsVisible: boolean
  toggleSessions: () => void
  /** Path of the session shown in the transcript, or `null` while on the live host session. */
  activeSessionPath: string | null
  /** Surfaced as a dismissible banner; also written to by command-menu actions (compact/export) that fail. */
  switchError: string | null
  reportSwitchError: (error: unknown) => void
  handleSelectSession: (session: PrimeSessionSummary) => Promise<void>
  /** Transcript item index to scroll to after a search hit, or null. */
  focusedTranscriptIndex: number | null
  /** Branch a new session from a past entry, then show the branch. */
  handleForkFromEntry: (entryId: string) => Promise<void>
  branchBusyId: string | null
  branchError: string | null
  /** Stay in this conversation and continue from an earlier fork (#17) — the log file is the same, only the leaf moves. */
  handleNavigateBranch: (targetId: string) => Promise<void>
}

/**
 * Owns which Prime session/branch the panel is showing and the actions that
 * change it: pick a past session, fork a new one from a replayed entry, or
 * move the live leaf to an earlier branch point. Grouped together because
 * all three write the same two pieces of state — `activeSessionPath` and the
 * transcript — and share one error surface.
 */
export function usePrimeSessionSwitcher({
  agent,
  locale,
  vaultPath,
  sessionsAutoCollapsed,
  refreshSessionTree,
  primeHostSessionPath,
  hostRunning = false,
}: UsePrimeSessionSwitcherArgs): UsePrimeSessionSwitcherResult {
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
  const [focusedTranscriptIndex, setFocusedTranscriptIndex] = useState<number | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const reportSwitchError = useCallback((error: unknown) => {
    setSwitchError(error instanceof Error ? error.message : String(error))
  }, [])

  const [branchBusyId, setBranchBusyId] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)

  /**
   * Switch the live host to a past session and rehydrate the transcript.
   *
   * The row highlight and the transcript both move immediately so the list
   * does not look stuck for the whole round trip. The host switch still
   * runs before the final transcript replace: if the host refuses (it will
   * not switch mid-turn), we restore the previous messages and path.
   */
  const handleSelectSession = useCallback(async (
    session: PrimeSessionSummary,
    options?: { messageIndex?: number },
  ) => {
    setSwitchError(null)
    setFocusedTranscriptIndex(null)
    const previousPath = activeSessionPath
    const previousMessages = [...agent.messages]
    // Highlight the row immediately. Clear the stale transcript in the same
    // click so the old conversation does not linger while the host round-trip
    // runs (session-switch beachball).
    setActiveSessionPath(session.path)
    agent.replaceMessages([])
    try {
      if (vaultPath && !hostRunning) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      await switchPrimeSession(session.path, primeHostSessionPath)
      const transcript = await callHost<PrimeTranscriptItem[]>('read_prime_session_transcript', {
        path: session.path,
      })
      startTransition(() => {
        agent.replaceMessages(primeTranscriptToConversation(transcript))
        if (typeof options?.messageIndex === 'number') {
          setFocusedTranscriptIndex(options.messageIndex)
        }
      })
      refreshSessionTree()
      // The column deliberately stays open. Closing it made sense when this
      // list was an overlay covering the conversation — dismissing it was how
      // you got back to the chat. It is a persistent sidebar now, and closing
      // it on select throws away the standing context you opened it for, then
      // makes you reopen it to pick a second session.
    } catch (e) {
      setActiveSessionPath(previousPath)
      setFocusedTranscriptIndex(null)
      agent.replaceMessages(previousMessages)
      reportSwitchError(e)
    }
  }, [activeSessionPath, agent, hostRunning, primeHostSessionPath, refreshSessionTree, reportSwitchError, vaultPath])

  const handleOpenTranscriptHit = useCallback((hit: SessionTranscriptHit) => {
    trackSessionTranscriptHitOpened(hit.role)
    void handleSelectSession(
      { id: hit.sessionId || hit.sessionPath, path: hit.sessionPath },
      { messageIndex: hit.messageIndex },
    )
  }, [handleSelectSession])

  useEffect(() => subscribeSessionTranscriptHitOpen(handleOpenTranscriptHit), [handleOpenTranscriptHit])

  // A roster row clicked in the menu bar lands here (#13). Reuses the same
  // switch path as the in-app session list so there is one way to change
  // sessions, not two that can drift.
  const handleOpenSessionFromMenuBar = useCallback((sessionPath: string) => {
    void handleSelectSession({ id: sessionPath, path: sessionPath })
  }, [handleSelectSession])
  useMenuBarSessionOpen(handleOpenSessionFromMenuBar)

  /**
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
      reportSwitchError(e)
    }
  }, [agent, locale, refreshSessionTree, reportSwitchError])

  /**
   * Not a session switch: the log file is the same, the leaf moves. The
   * on-disk jsonl still has every sibling, so the transcript is filtered to
   * the ancestry of the new leaf rather than replaying the abandoned turn.
   */
  const handleNavigateBranch = useCallback(async (targetId: string) => {
    setBranchError(null)
    setBranchBusyId(targetId)
    try {
      const next = await callHost<PrimeSessionTree>('navigate_prime_session_tree', { targetId })
      const path = activeSessionPath ?? primeHostSessionPath
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
  }, [activeSessionPath, agent, primeHostSessionPath, refreshSessionTree])

  return {
    sessionsVisible,
    toggleSessions,
    activeSessionPath,
    switchError,
    reportSwitchError,
    handleSelectSession,
    focusedTranscriptIndex,
    handleForkFromEntry,
    branchBusyId,
    branchError,
    handleNavigateBranch,
  }
}
