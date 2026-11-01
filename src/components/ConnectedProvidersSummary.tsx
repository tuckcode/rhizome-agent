import { useEffect, useMemo, useState } from 'react'
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
import { connectionErrorMessage, connectionStatusMessageKey } from '../lib/providerConnection'
import { providerListSectionLabel, type ProviderListSection } from '../lib/providerListOrder'
import { useOauthAccounts, type OauthAccounts } from '../lib/useOauthAccounts'
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
  /** Shared oauth state from Settings so picker sign-in/out stay in sync. */
  oauth?: OauthAccounts
}

const SECTION_ORDER: ProviderListSection[] = [
  'accounts',
  'api_keys',
  'local',
  'free',
  'not_installed',
]

export function ConnectedProvidersSummary(props: ConnectedProvidersSummaryProps) {
  if (props.oauth) return <ConnectedProvidersSummaryBody {...props} oauth={props.oauth} />
  return <ConnectedProvidersSummaryWithOauth {...props} />
}

function ConnectedProvidersSummaryWithOauth(props: ConnectedProvidersSummaryProps) {
  const oauth = useOauthAccounts()
  return <ConnectedProvidersSummaryBody {...props} oauth={oauth} />
}

function ConnectedProvidersSummaryBody({
  t,
  agents,
  providers,
  onChange,
  onOpen,
  focusRowId,
  onFocusConsumed,
  oauth,
}: ConnectedProvidersSummaryProps & { oauth: OauthAccounts }) {
  const [probe, setProbe] = useState(0)
  const [, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notInstalledOpen, setNotInstalledOpen] = useState(false)
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null)
  const [managingIds, setManagingIds] = useState<Record<string, boolean>>({})

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
    oauthByProvider: oauth.oauthByProvider,
  })

  const sections = useMemo(() => {
    const map = new Map<ProviderListSection, ConnectedRow[]>()
    for (const section of SECTION_ORDER) map.set(section, [])
    for (const row of rows) {
      const list = map.get(row.section) ?? []
      list.push(row)
      map.set(row.section, list)
    }
    return SECTION_ORDER
      .map((section) => ({ section, rows: map.get(section) ?? [] }))
      .filter((entry) => entry.rows.length > 0)
  }, [rows])

  useEffect(() => {
    if (!focusRowId) return
    // Ready key rows hide the paste field behind Manage — expand so focus can land.
    const focused = rows.find((row) => row.rowId === focusRowId)
    if (focused?.showKeyField && focused.status === 'ready') {
      setManagingIds((current) => ({ ...current, [focused.id]: true }))
    }
    // Settings scrolls the AI section ~50ms after open. Retry until the key
    // field is mounted (or ~1s elapses) so Add key does not race that scroll (#283).
    let cancelled = false
    let frame = 0
    const startedAt = performance.now()
    const FOCUS_RETRY_CAP_MS = 1000

    const finish = (field: HTMLInputElement | null) => {
      if (cancelled) return
      const row = document.getElementById(focusRowId)
      row?.scrollIntoView({ block: 'center' })
      if (field) {
        field.focus()
      }
      setHighlightRowId(focusRowId)
      onFocusConsumed?.()
    }

    const tryFocus = () => {
      if (cancelled) return
      const field = document.querySelector<HTMLInputElement>(
        `[data-key-for="${CSS.escape(focusRowId)}"]`,
      )
      if (field) {
        finish(field)
        return
      }
      if (performance.now() - startedAt >= FOCUS_RETRY_CAP_MS) {
        finish(null)
        return
      }
      frame = window.requestAnimationFrame(() => {
        tryFocus()
      })
    }

    frame = window.requestAnimationFrame(() => {
      tryFocus()
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [focusRowId, onFocusConsumed, rows])

  useEffect(() => {
    if (!highlightRowId) return
    const clearTimer = window.setTimeout(() => {
      setHighlightRowId(null)
    }, 1600)
    return () => {
      window.clearTimeout(clearTimer)
    }
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
    // Accounts keep their own "Needs sign-in" / Ready labels.
    if (row.kind === 'agent' || row.kind === 'account') return row.statusLabel
    const key = connectionStatusMessageKey(row.status)
    return key ? t(key) : row.statusLabel
  }

  const renderRow = (row: ConnectedRow) => {
    const secret = drafts[row.id] ?? ''
    const account = row.kind === 'account' ? row.account : null
    const accountBusy = account ? oauth.busyProvider === account.id : false
    const keyReadyCollapsed = Boolean(
      row.showKeyField && row.status === 'ready' && !managingIds[row.id],
    )
    const showKeyControls = Boolean(row.showKeyField && !keyReadyCollapsed)

    return (
      <li
        key={row.id}
        id={row.rowId}
        data-testid={`settings-connected-row-${row.id}`}
        data-status={row.status}
        data-section={row.section}
        data-highlighted={highlightRowId === row.rowId ? 'true' : undefined}
        className={cn(
          'rounded-md border border-border bg-background px-3 py-2',
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
            {row.accountEmail ? (
              <div className="mt-1 text-xs text-foreground" data-testid={`settings-connected-email-${row.id}`}>
                {row.accountEmail}
              </div>
            ) : null}
            {row.models.length > 0 ? (
              <div className="mt-1 text-xs text-foreground" data-testid={`settings-connected-models-${row.id}`}>
                {row.models.join(', ')}
              </div>
            ) : null}
          </div>
          {row.kind === 'account' && account ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {row.status === 'ready' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid={`settings-connected-sign-out-${row.id}`}
                  disabled={accountBusy}
                  onClick={() => { void oauth.signOut(account.id) }}
                >
                  {accountBusy ? 'Signing out…' : 'Sign out'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid={`settings-connected-sign-in-${row.id}`}
                    disabled={accountBusy}
                    onClick={() => { void oauth.signIn(account.id) }}
                  >
                    {accountBusy && oauth.signingIn ? 'Waiting for browser…' : account.signInLabel}
                  </Button>
                  {oauth.signingIn && oauth.busyProvider === account.id ? (
                    <button
                      type="button"
                      className="text-[11px] text-[var(--link-color)] underline-offset-2 hover:underline"
                      data-testid={`settings-connected-cancel-${row.id}`}
                      onClick={() => { void oauth.cancel() }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : row.action === 'none' || row.action === 'add_key' || (row.showKeyField && row.status === 'ready') ? null : (
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
        {keyReadyCollapsed ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={`settings-connected-manage-${row.id}`}
              onClick={() => setManagingIds((current) => ({ ...current, [row.id]: true }))}
            >
              {t('settings.connected.manage')}
            </Button>
          </div>
        ) : null}
        {showKeyControls ? (
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
        {account && oauth.errorByProvider[account.id] ? (
          <p role="alert" className="mt-1 text-xs text-destructive">{oauth.errorByProvider[account.id]}</p>
        ) : null}
      </li>
    )
  }

  return (
    <div
      id="connected-providers"
      className="rounded-md border border-border bg-card p-3"
      data-testid="settings-connected-summary"
    >
      <p className="text-xs leading-5 text-muted-foreground">{t('settings.connected.description')}</p>
      <div className="mt-3 flex flex-col gap-4">
        {sections.map(({ section, rows: sectionRows }) => {
          if (section === 'not_installed') {
            return (
              <div key={section} data-testid="settings-connected-not-installed">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  aria-expanded={notInstalledOpen}
                  data-testid="settings-connected-not-installed-toggle"
                  onClick={() => { setNotInstalledOpen((value) => !value) }}
                >
                  <span>{providerListSectionLabel('not_installed')} ({sectionRows.length})</span>
                  <span aria-hidden="true">{notInstalledOpen ? '▾' : '▸'}</span>
                </button>
                {notInstalledOpen ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {sectionRows.map(renderRow)}
                  </ul>
                ) : null}
              </div>
            )
          }
          return (
            <div key={section} data-testid={`settings-connected-section-${section}`}>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {providerListSectionLabel(section)}
              </div>
              <ul className="flex flex-col gap-2">
                {sectionRows.map(renderRow)}
              </ul>
            </div>
          )
        })}
      </div>
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
