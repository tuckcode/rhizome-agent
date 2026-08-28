import { useRef, useState } from 'react'
import { AiPanel } from './AiPanel'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'
import { AgentActivityBand } from './AgentActivityBand'
import { RlmFamilyBand } from './RlmFamilyBand'
import { ChatComposerDeck } from './ChatComposerDeck'
import { ChatPreflightBanner } from './ChatPreflightBanner'
import { ChatNotePane } from './ChatNotePane'
import { useChatNoteContent } from '../hooks/useChatNoteContent'
import { vaultLabelFromPath } from '../lib/primeSubheadLabels'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { resolveChatOpenNote } from '../utils/resolveChatOpenNote'
import type { AiAgentId, AiAgentReadiness } from '../lib/aiAgents'
import type { AiTarget } from '../lib/aiTargets'
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
  vaults?: { label: string; path: string }[]
  onSwitchVault?: (path: string) => void
  entries: VaultEntry[]
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string) => void
  onFileCreated?: (path: string) => void
  onFileModified?: (path: string) => void
  onVaultChanged?: () => void
  onUnsupportedAiPaste?: (message: string) => void
  sessionsAutoCollapsed?: boolean
  /** Where "close" goes when chat owns the window — back to the vault. */
  onExit: () => void
  /** Open Mycelium on this Prime session only (#22). */
  onOpenSessionFootprint?: (sessionPath: string) => void
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
  vaults,
  onSwitchVault,
  entries,
  onPromoteToVault,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  onUnsupportedAiPaste,
  sessionsAutoCollapsed = false,
  onExit,
  onOpenSessionFootprint,
}: ChatHomeProps) {
  const isPrimeTarget = defaultAiTarget?.kind !== 'api_model' && defaultAiAgent === 'prime'
  const primeHost = usePrimeHostStatus(isPrimeTarget, vaultPath)
  const newChatRef = useRef<(() => void) | null>(null)
  const [openNote, setOpenNote] = useState<{ path: string; label: string } | null>(null)
  // One read of the open note, shared by the pane and the agent. Chat used to
  // pass nothing to `AiPanel`, so a note open on screen was invisible to the
  // model — "summarise this" had no "this".
  const openNoteContent = useChatNoteContent(openNote?.path, vaultPath)
  const openNoteEntry = openNote
    ? entries.find((entry) => entry.path === openNote.path) ?? null
    : null

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
          defaultAiTarget={defaultAiTarget ?? undefined}
          defaultAiAgentReadiness={defaultAiAgentReadiness}
          defaultAiAgentReady={defaultAiAgentReady}
          vaultPath={vaultPath}
          vaultPaths={vaultPaths}
          entries={entries}
          activeEntry={openNoteEntry}
          activeNoteContent={openNoteContent.body}
          onOpenNote={(target) => {
            const resolved = resolveChatOpenNote(target, vaultPath, entries)
            if (resolved) setOpenNote(resolved)
          }}
          onPromoteToVault={onPromoteToVault}
          onFileCreated={onFileCreated}
          onFileModified={onFileModified}
          onVaultChanged={onVaultChanged}
          onUnsupportedAiPaste={onUnsupportedAiPaste}
          showHeader={false}
          sessionsAutoCollapsed={sessionsAutoCollapsed}
          forkTargetsPrimeEntry
          newChatRef={newChatRef}
          notePane={
            openNote ? (
              <ChatNotePane
                locale={locale}
                label={openNote.label}
                body={openNoteContent.body}
                error={openNoteContent.error}
                loading={openNoteContent.loading}
                onClose={() => setOpenNote(null)}
                onOpenNote={(target) => {
                  const resolved = resolveChatOpenNote(target, vaultPath, entries)
                  if (resolved) setOpenNote(resolved)
                }}
              />
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
                vaultLabel={vaultLabelFromPath(vaultPath)}
                vaultPath={vaultPath}
                vaults={vaults ?? vaultPaths.map((path) => ({
                  label: vaultLabelFromPath(path) ?? path,
                  path,
                }))}
                onSwitchVault={onSwitchVault}
                contextLabel={openNote ? openNote.label.split('/').filter(Boolean).at(-1) ?? openNote.label : null}
                skillsLabel="rhizome-vault"
                model={primeModelLabel(primeHost)}
                thinkingLevel={primeHost?.thinkingLevel ?? null}
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
