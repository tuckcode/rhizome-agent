import { AiPanel } from './AiPanel'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'
import { ChatComposerDeck } from './ChatComposerDeck'
import { vaultLabelFromPath } from '../lib/primeSubheadLabels'
import { primeModelLabel, usePrimeHostStatus } from '../hooks/usePrimeHostStatus'
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
 * filling everything under it. There is no note list and no editor, which is
 * the point — the vault is reachable from the rail when you want it.
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
  onOpenNote,
  onPromoteToVault,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  onUnsupportedAiPaste,
  onExit,
}: ChatHomeProps) {
  const isPrimeTarget = defaultAiTarget?.kind !== 'api_model' && defaultAiAgent === 'prime'
  const primeHost = usePrimeHostStatus(isPrimeTarget)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="chat-home">
      {isPrimeTarget ? (
        <PrimeSessionSubhead
          locale={locale}
          live={Boolean(primeHost?.running)}
          sessionId={primeHost?.sessionId ?? null}
          model={primeModelLabel(primeHost)}
          vaultPath={vaultPath}
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
          onOpenNote={onOpenNote}
          onPromoteToVault={onPromoteToVault}
          onFileCreated={onFileCreated}
          onFileModified={onFileModified}
          onVaultChanged={onVaultChanged}
          onUnsupportedAiPaste={onUnsupportedAiPaste}
          showHeader={false}
          composerControls={
            isPrimeTarget ? (
              <ChatComposerDeck
                locale={locale}
                modelLabel={primeModelLabel(primeHost)}
                vaultLabel={vaultLabelFromPath(vaultPath)}
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
