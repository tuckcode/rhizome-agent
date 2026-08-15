import { useRef, useState } from 'react'
import { AiPanel } from './AiPanel'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'
import { ChatComposerDeck } from './ChatComposerDeck'
import { ChatNotePane } from './ChatNotePane'
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
  entries: VaultEntry[]
  onOpenNote?: (path: string) => void
  onPromoteToVault?: (text: string) => void
  onFileCreated?: (path: string) => void
  onFileModified?: (path: string) => void
  onVaultChanged?: () => void
  onUnsupportedAiPaste?: (message: string) => void
  /** Where "close" goes when chat owns the window — back to the vault. */
  onExit: () => void
}

/**
 * Frame A — chat as the whole window.
 *
 * The conversation is the primary surface here rather than a panel beside an
 * editor: a telemetry subhead across the top, then the transcript and composer
 * filling everything under it. Open-note is a secondary pane (Frame B), not
 * an editor takeover — the vault is still a rail click away.
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
  onExit,
}: ChatHomeProps) {
  const isPrimeTarget = defaultAiTarget?.kind !== 'api_model' && defaultAiAgent === 'prime'
  const primeHost = usePrimeHostStatus(isPrimeTarget, vaultPath)
  const newChatRef = useRef<(() => void) | null>(null)
  const [openNote, setOpenNote] = useState<{ path: string; label: string } | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="chat-home">
      {isPrimeTarget ? (
        <PrimeSessionSubhead
          locale={locale}
          live={Boolean(primeHost?.running)}
          sessionId={primeHost?.sessionId ?? null}
          model={primeModelLabel(primeHost)}
          vaultPath={vaultPath}
          onNewChat={() => newChatRef.current?.()}
        />
      ) : null}
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
          forkTargetsPrimeEntry
          newChatRef={newChatRef}
          notePane={
            openNote ? (
              <ChatNotePane
                locale={locale}
                label={openNote.label}
                path={openNote.path}
                vaultPath={vaultPath}
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
              <ChatComposerDeck
                locale={locale}
                modelLabel={primeModelLabel(primeHost)}
                vaultLabel={vaultLabelFromPath(vaultPath)}
                vaultPath={vaultPath}
                contextLabel={openNote ? openNote.label.split('/').filter(Boolean).at(-1) ?? openNote.label : null}
                skillsLabel="rhizome-vault"
              />
            ) : undefined
          }
          onClose={onExit}
        />
      </div>
    </div>
  )
}
