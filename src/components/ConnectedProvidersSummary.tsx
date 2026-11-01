import { useEffect, useState } from 'react'
import type { AiAgentsStatus } from '../lib/aiAgents'
import { normalizeAiModelProviders, type AiModelProvider } from '../lib/aiTargets'
import { buildConnectedRows, type ConnectedRow } from '../lib/connectedProviders'
import {
  cachedProviderModelLabels,
  forgetListedProviderModels,
  listAiModelProviderModels,
  providerListFailure,
  providersToListLive,
} from '../lib/listProviderModels'
import type { createTranslator } from '../lib/i18n'
import {
  connectionErrorMessage,
  connectionStatusMessageKey,
} from '../lib/providerConnection'
import { cn } from '@/lib/utils'
import { openExternalUrl } from '../utils/url'
import { trackEvent } from '../lib/telemetry'
import { saveAiModelProviderApiKey, testAiModelProvider } from '../utils/aiProviderSecrets'
import { Button } from './ui/button'
import { Input } from './ui/input'

type Translate = ReturnType<typeof createTranslator>

interface ConnectedProvidersSummaryProps {
  t: Translate
  agents: AiAgentsStatus
  providers: AiModelProvider[]
  onChange: (providers: AiModelProvider[]) => void
  onOpen: (row: ConnectedRow) => void
  focusRowId?: string | null
  onFocusConsumed?: () => void
}

export function ConnectedProvidersSummary({
  t,
  agents,
  providers,
  onChange,
  onOpen,
  focusRowId,
  onFocusConsumed,
}: ConnectedProvidersSummaryProps) {
  const [probe, setProbe] = useState(0)
  const [, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      providersToListLive(providers).map((provider) => listAiModelProviderModels(provider).catch(() => [])),
    ).finally(() => {
      if (!cancelled) setRevision((value) => value + 1)
    })
    return () => {
      cancelled = true
    }
  }, [providers, probe])

  const rows = buildConnectedRows({
    agents,
    providers,
    failureFor: (provider) => providerListFailure(provider),
    modelsFor: (provider) => {
      if (providerListFailure(provider)) return []
      return cachedProviderModelLabels(provider)
    },
  })

  useEffect(() => {
    if (!focusRowId) return
    // Settings scrolls the AI section to start ~50ms after open; wait past that
    // so Add key still lands on the provider key field (#283).
    const focusTimer = window.setTimeout(() => {
      const row = document.getElementById(focusRowId)
      row?.scrollIntoView({ block: 'center' })
      const field = document.querySelector<HTMLInputElement>(
        `[data-key-for="${CSS.escape(focusRowId)}"]`,
      )
      field?.focus()
      setHighlightRowId(focusRowId)
      onFocusConsumed?.()
    }, 120)
    return () => window.clearTimeout(focusTimer)
  }, [focusRowId, onFocusConsumed])

  useEffect(() => {
    if (!highlightRowId) return
    const clearTimer = window.setTimeout(() => setHighlightRowId(null), 1600)
    return () => window.clearTimeout(clearTimer)
  }, [highlightRowId])

  const retry = async (row: ConnectedRow) => {
    if (!row.provider) return
    forgetListedProviderModels(row.provider)
    setProbe((value) => value + 1)
  }

  const testConnection = async (row: ConnectedRow) => {
    const provider = row.provider
    if (!provider) return
    const secret = drafts[row.id]?.trim() ?? ''
    if (row.status === 'needs_key' && !secret) return
    setBusyId(row.id)
    setErrors((current) => ({ ...current, [row.id]: '' }))
    try {
      const modelId = provider.models[0]?.id
      if (!modelId) throw new Error('Add a model id first.')
      await testAiModelProvider(provider, modelId, secret || null)
      if (secret) {
        const saved = providerWithLocalKey(provider)
        await saveAiModelProviderApiKey(saved.id, secret)
        const rest = providers.filter((item) => item.id.trim().toLowerCase() !== saved.id)
        onChange(normalizeAiModelProviders([...rest, saved]))
      }
      forgetListedProviderModels(provider)
      trackEvent('provider_connection_tested', { provider_kind: provider.kind, outcome: 'success' })
      setDrafts((current) => ({ ...current, [row.id]: '' }))
      setProbe((value) => value + 1)
    } catch (error) {
      trackEvent('provider_connection_tested', { provider_kind: provider.kind, outcome: 'failed' })
      setErrors((current) => ({
        ...current,
        [row.id]: connectionErrorMessage(error, secret),
      }))
    } finally {
      setBusyId(null)
    }
  }

  const actionLabel = (row: ConnectedRow) => {
    if (row.action === 'install') return t('settings.connected.howToInstall')
    if (row.action === 'retry') return t('settings.connected.retry')
    if (row.action === 'open') return t('settings.connected.manage')
    return t('settings.connected.addKey')
  }

  const statusClass = (status: ConnectedRow['status']) => {
    if (status === 'ready') return 'bg-[var(--feedback-success-bg)] text-feedback-success-text'
    if (status === 'needs_key' || status === 'load_failed' || status === 'no_models') {
      return 'bg-[var(--feedback-warning-bg)] text-[var(--feedback-warning-text)]'
    }
    return 'bg-muted text-muted-foreground'
  }

  const statusText = (row: ConnectedRow) => {
    // Agents use a custom "Not installed" label on not_running; keep that.
    if (row.kind === 'agent') return row.statusLabel
    const key = connectionStatusMessageKey(row.status)
    return key ? t(key) : row.statusLabel
  }

  return (
    <div
      id="connected-providers"
      className="rounded-md border border-border bg-card p-3"
      data-testid="settings-connected-summary"
    >
      <div className="text-sm font-medium text-foreground">{t('settings.connected.title')}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('settings.connected.description')}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => {
          const secret = drafts[row.id] ?? ''
          return (
            <li
              key={row.id}
              id={row.rowId}
              data-testid={`settings-connected-row-${row.id}`}
              data-status={row.status}
              data-highlighted={highlightRowId === row.rowId ? 'true' : undefined}
              className={cn(
                'rounded-md border border-border bg-background px-3 py-2 transition-shadow',
                highlightRowId === row.rowId && 'ring-2 ring-[var(--feedback-warning-text)] ring-offset-2 ring-offset-background',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{row.name}</div>
                  <div data-testid={`settings-connected-status-${row.id}`}>
                    <span className={cn('inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium', statusClass(row.status))}>
                      {statusText(row)}
                    </span>
                  </div>
                  {row.models.length > 0 ? (
                    <div className="mt-1 text-xs text-foreground" data-testid={`settings-connected-models-${row.id}`}>
                      {row.models.join(', ')}
                    </div>
                  ) : null}
                </div>
                {row.action === 'none' || row.action === 'add_key' ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={`settings-connected-action-${row.id}`}
                  onClick={() => {
                    if (row.action === 'retry' && row.provider) {
                      void retry(row)
                      return
                    }
                    if (row.action === 'install' && row.installUrl) {
                      void openExternalUrl(row.installUrl)
                      return
                    }
                    onOpen({ ...row, rowId: row.targetRowId })
                  }}
                >
                  {actionLabel(row)}
                </Button>
                )}
              </div>
              {row.showKeyField ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={secret}
                    placeholder={t('settings.connected.keyPlaceholder')}
                    aria-label={`${row.name} API key`}
                    data-key-for={row.rowId}
                    data-testid={`settings-connected-key-${row.id}`}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((current) => ({ ...current, [row.id]: value }))
                    }}
                    className="h-8 max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid={`settings-connected-test-${row.id}`}
                    disabled={busyId === row.id || (row.status === 'needs_key' && secret.trim() === '')}
                    onClick={() => { void testConnection(row) }}
                  >
                    {busyId === row.id ? t('settings.connected.testing') : t('settings.connected.saveAndTest')}
                  </Button>
                </div>
              ) : null}
              {errors[row.id] ? (
                <p role="alert" className="mt-1 text-xs text-destructive">{errors[row.id]}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function providerWithLocalKey(provider: AiModelProvider): AiModelProvider {
  const [saved] = normalizeAiModelProviders([{
    ...provider,
    api_key_storage: 'local_file',
    api_key_env_var: null,
  }])
  return saved ?? { ...provider, api_key_storage: 'local_file', api_key_env_var: null }
}
