import { useEffect, useState } from 'react'
import { ArrowsClockwise, Copy } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  getAiAgentAvailability,
  getAiAgentDefinition,
  normalizeAiAgentsStatus,
  type AiAgentId,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import { formatLastChecked, normalizeAgentVersion } from '../lib/agentVersion'
import { callHost } from '../lib/callHost'
import { KEPT_EXTERNAL_AGENT_IDS } from '../lib/migrateRemovedHarnessChoices'
import type { createTranslator } from '../lib/i18n'
import { openExternalUrl } from '../utils/url'
import { AiAgentIcon } from './AiAgentIcon'
import { Button } from './ui/button'

type Translate = ReturnType<typeof createTranslator>

interface LocalAgentCardsProps {
  t: Translate
  aiAgentsStatus: AiAgentsStatus
  onCopyMcpConfig?: () => void
}

/**
 * Rhizome does not drive these CLIs as chat engines (ADR-0189), so the cards
 * do not offer Use in chat. Copy MCP config is the action for an installed agent.
 */
export function LocalAgentCards({ t, aiAgentsStatus, onCopyMcpConfig }: LocalAgentCardsProps) {
  const [statuses, setStatuses] = useState(aiAgentsStatus)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setStatuses(aiAgentsStatus)
  }, [aiAgentsStatus])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const checkAgain = async () => {
    setChecking(true)
    try {
      const payload = await callHost<Parameters<typeof normalizeAiAgentsStatus>[0]>('get_ai_agents_status')
      setStatuses(normalizeAiAgentsStatus(payload))
    } catch {
      setStatuses(normalizeAiAgentsStatus(null))
    } finally {
      setCheckedAt(Date.now())
      setNow(Date.now())
      setChecking(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3" data-testid="settings-cli-agent-status">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{t('settings.aiAgents.installedTitle')}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.aiAgents.installedDescription')}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {checkedAt !== null ? (
            <span className="text-[11px] text-muted-foreground" data-testid="settings-agents-last-checked">
              {formatLastChecked(checkedAt, now)}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={t('settings.aiAgents.refreshStatus')}
            data-testid="settings-agents-refresh"
            disabled={checking}
            onClick={() => { void checkAgain() }}
          >
            <ArrowsClockwise size={14} />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {KEPT_EXTERNAL_AGENT_IDS.map((id) => {
          const definition = getAiAgentDefinition(id as AiAgentId)
          const status = getAiAgentAvailability(statuses, definition.id)
          const installed = status.status === 'installed'
          const version = normalizeAgentVersion(status.version, definition.label)
          const actions = installed ? Boolean(onCopyMcpConfig) : true
          return (
            <div
              key={definition.id}
              id={`agent-row-${definition.id}`}
              data-testid={`settings-agent-card-${definition.id}`}
              className={cn(
                'rounded-md border border-border px-3 py-2',
                actions ? 'bg-background' : 'bg-transparent',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <AiAgentIcon agent={definition.id} size={16} />
                  <div className="truncate text-sm font-medium text-foreground">{definition.label}</div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                    installed
                      ? 'bg-[var(--feedback-success-bg)] text-feedback-success-text'
                      : 'bg-muted text-muted-foreground',
                  )}
                  data-testid={`settings-agent-badge-${definition.id}`}
                >
                  {installed ? t('settings.aiAgents.installedBadge') : t('settings.aiAgents.notInstalledBadge')}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground" data-testid={`settings-agent-version-${definition.id}`}>
                {installed
                  ? (version ?? t('settings.aiAgents.noVersion'))
                  : t('settings.aiAgents.installHint', { agent: definition.label })}
              </div>
              {installed && onCopyMcpConfig ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    aria-label={`${t('ai.panel.copyMcpConfig')} for ${definition.label}`}
                    data-testid={`settings-copy-mcp-config-${definition.id}`}
                    onClick={onCopyMcpConfig}
                  >
                    <Copy size={14} />
                    {t('ai.panel.copyMcpConfig')}
                  </Button>
                </div>
              ) : null}
              {installed ? null : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`settings-agent-install-${definition.id}`}
                    onClick={() => { void openExternalUrl(definition.installUrl) }}
                  >
                    {t('settings.aiAgents.howToInstall')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`settings-agent-recheck-${definition.id}`}
                    disabled={checking}
                    onClick={() => { void checkAgain() }}
                  >
                    {t('settings.aiAgents.checkAgain')}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
