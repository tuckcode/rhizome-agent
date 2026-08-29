import { useCallback } from 'react'
import { callHost } from '../lib/callHost'
import { usePrimeCommandMenu } from '../hooks/usePrimeCommandMenu'
import { type CommandMenuAction, type CommandMenuEntry } from '../lib/primeCommandMenu'
import { trackPrimeCommandRun } from '../lib/productAnalytics'
import { translate, type AppLocale } from '../lib/i18n'
import type { useCliAiAgent } from '../hooks/useCliAiAgent'

type AiAgentBridge = ReturnType<typeof useCliAiAgent>

interface UsePrimeCommandActionsArgs {
  isPrimeTarget: boolean
  primeSessionId: string | null | undefined
  primeSessionPath: string | null | undefined
  locale: AppLocale
  agent: AiAgentBridge
  setInput: (value: string) => void
  handleForkFromEntry: (entryId: string) => Promise<void>
  reportError: (error: unknown) => void
}

interface UsePrimeCommandActionsResult {
  commandEntries: CommandMenuEntry[]
  commandDisabled: Record<string, string>
  handleCommandAction: (action: CommandMenuAction, nextValue: string) => Promise<void>
}

/**
 * The `/` command menu's entries and what running one of them does.
 *
 * `fork` delegates to the session switcher's `handleForkFromEntry` — the
 * command menu is one of two ways to trigger a fork (the other is the
 * message-level fork button), and both must go through the same code path
 * so the branch tree cannot drift between them.
 */
export function usePrimeCommandActions({
  isPrimeTarget,
  primeSessionId,
  primeSessionPath,
  locale,
  agent,
  setInput,
  handleForkFromEntry,
  reportError,
}: UsePrimeCommandActionsArgs): UsePrimeCommandActionsResult {
  const commandEntries = usePrimeCommandMenu(isPrimeTarget, primeSessionId ?? null)
  const latestPrimeEntryId = [...agent.messages].reverse().find((message) => message.primeEntryId)?.primeEntryId

  const commandDisabled = {
    ...(latestPrimeEntryId ? {} : { fork: translate(locale, 'ai.command.forkNeedsEntry') }),
    // Export reads the session log off disk, so it needs one to exist.
    ...(primeSessionPath ? {} : { export: translate(locale, 'ai.command.exportNeedsSession') }),
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
        reportError(e)
      }
      return
    }
    if (action.name === 'export') {
      if (!primeSessionPath) return
      try {
        const path = await callHost<string>('export_prime_session', {
          sessionPath: primeSessionPath,
        })
        agent.addLocalMarker(translate(locale, 'ai.command.exported', { path }))
      } catch (e) {
        reportError(e)
      }
    }
  }, [agent, handleForkFromEntry, latestPrimeEntryId, locale, primeSessionPath, reportError, setInput])

  return { commandEntries: localizedCommands, commandDisabled, handleCommandAction }
}
