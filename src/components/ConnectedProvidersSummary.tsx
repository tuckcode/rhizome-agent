import { useEffect, useState } from 'react'
import type { AiAgentsStatus } from '../lib/aiAgents'
import type { AiModelProvider } from '../lib/aiTargets'
import { buildConnectedRows, type ConnectedRow } from '../lib/connectedProviders'
import {
  cachedProviderModelLabels,
  forgetListedProviderModels,
  listAiModelProviderModels,
  providerListFailure,
  providersToListLive,
} from '../lib/listProviderModels'
import type { createTranslator } from '../lib/i18n'
import { connectionErrorMessage } from '../lib/providerConnection'
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
}

export function ConnectedProvidersSummary({
  t,
  agents,
  providers,
  onChange,
  onOpen,
  focusRowId,
}: ConnectedProvidersSummaryProps) {
  const [probe, setProbe] = useState(0)
  const [, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    document.getElementById(focusRowId)?.scrollIntoView({ block: 'nearest' })
    const field = document.querySelector<HTMLInputElement>(`[data-key-for="${CSS.escape(focusRowId)}"]`)
    field?.focus()
  }, [focusRowId, rows.length])

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
        await saveAiModelProviderApiKey(provider.id, secret)
        if (!providers.some((item) => item.id === provider.id)) {
          onChange([...providers, { ...provider, api_key_storage: 'local_file' }])
        }
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
    if (row.action === 'add_key') return t('settings.connected.addKey')
    if (row.action === 'retry') return t('settings.connected.retry')
    return t('settings.connected.open')
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
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{row.name}</div>
                  <div className="text-xs text-muted-foreground" data-testid={`settings-connected-status-${row.id}`}>
                    {row.statusLabel}
                  </div>
                  {row.models.length > 0 ? (
                    <div className="mt-1 text-xs text-foreground" data-testid={`settings-connected-models-${row.id}`}>
                      {row.models.join(', ')}
                    </div>
                  ) : null}
                </div>
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
                    if (row.action === 'add_key') {
                      document.querySelector<HTMLInputElement>(`[data-key-for="${CSS.escape(row.rowId)}"]`)?.focus()
                      return
                    }
                    onOpen(row)
                  }}
                >
                  {actionLabel(row)}
                </Button>
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
                    {busyId === row.id ? t('settings.connected.testing') : t('settings.connected.test')}
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
