import { useEffect, useId, useState } from 'react'
import { trackEvent } from '../lib/telemetry'
import { saveAiModelProviderApiKey } from '../utils/aiProviderSecrets'
import {
  accountIdKeyFor,
  OWN_ENDPOINT_ROUTE_ID,
  getFreeTierOverview,
  saveFreeTierSettings,
  settingsFromOverview,
  type EndpointChoice,
  type FreeTierOverview,
  type FreeTierProviderRow,
  type FreeTierSettings as FreeTierSettingsValue,
} from '../utils/freeTierSettings'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'

/**
 * Free-tier providers for "Free tier (auto)" (step 3b, ADR-0182).
 *
 * Keys go to the OS keychain through the same command as every other
 * provider key. The fallback order is fixed by ADR-0182 decision 5, so it
 * is shown and cannot be changed here.
 */
export function FreeTierSettings() {
  const state = useFreeTierSettings()
  const { overview, error } = state
  if (!overview) {
    return error ? <ErrorLine error={error} /> : null
  }
  return (
    <div data-testid="free-tier-settings" className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
      <div>
        <div className="text-sm font-medium text-foreground">Free tier (auto)</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          Native Chat can try these free providers in order and move to the next one when a provider fails
          or runs out of free use. Each needs its own key. Keys are kept in this computer's keychain.
        </div>
      </div>
      {overview.providers.map((row) => (
        <ProviderRow key={row.id} row={row} onToggle={state.requestToggle} onSaveSecret={state.saveSecret} />
      ))}
      <OwnEndpointRow
        value={overview.ownEndpoint}
        choices={overview.endpointChoices}
        onChange={state.setOwnEndpoint}
      />
      <StrictModeRow strict={overview.strict} onChange={state.setStrict} />
      <FallbackOrder overview={overview} />
      {overview.usable ? null : (
        <div className="text-xs text-muted-foreground">
          Add a key to at least one provider to use Free tier (auto).
        </div>
      )}
      {error ? <ErrorLine error={error} /> : null}
      <OptInConfirmDialog row={state.pendingOptIn} onCancel={state.cancelOptIn} onConfirm={state.confirmOptIn} />
    </div>
  )
}

/** Loads the overview and owns every change to it. */
function useFreeTierSettings() {
  const [overview, setOverview] = useState<FreeTierOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingOptIn, setPendingOptIn] = useState<FreeTierProviderRow | null>(null)

  useEffect(() => {
    let cancelled = false
    getFreeTierOverview().then(
      (loaded) => {
        if (!cancelled) setOverview(loaded)
      },
      (loadError: unknown) => {
        if (!cancelled) setError(messageOf(loadError))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  /** Applies one change. The returned promise never rejects: errors show in the card. */
  const run = (work: () => Promise<FreeTierOverview>): Promise<void> =>
    work().then(
      (next) => {
        setOverview(next)
        setError(null)
      },
      (workError: unknown) => {
        setError(messageOf(workError))
      },
    )

  const setEnabled = (row: FreeTierProviderRow, enabled: boolean) => {
    if (!overview) return
    trackEvent('free_tier_provider_toggled', { provider_id: row.id, enabled: enabled ? 1 : 0 })
    run(() => saveFreeTierSettings(withProvider(settingsFromOverview(overview), row, enabled)))
  }

  return {
    overview,
    error,
    pendingOptIn,
    requestToggle: (row: FreeTierProviderRow, enabled: boolean) => {
      if (enabled && !row.defaultOn && row.billingWarning) setPendingOptIn(row)
      else setEnabled(row, enabled)
    },
    cancelOptIn: () => {
      setPendingOptIn(null)
    },
    confirmOptIn: () => {
      const row = pendingOptIn
      setPendingOptIn(null)
      if (row) setEnabled(row, true)
    },
    setStrict: (strict: boolean) => {
      if (!overview) return
      trackEvent('free_tier_strict_toggled', { enabled: strict ? 1 : 0 })
      run(() => saveFreeTierSettings({ ...settingsFromOverview(overview), strict }))
    },
    setOwnEndpoint: (ownEndpoint: string | null) => {
      if (!overview) return
      trackEvent('free_tier_own_endpoint_set', { chosen: ownEndpoint ? 1 : 0 })
      run(() => saveFreeTierSettings({ ...settingsFromOverview(overview), ownEndpoint }))
    },
    saveSecret: (account: string, value: string) =>
      run(async () => {
        await saveAiModelProviderApiKey(account, value.trim())
        return getFreeTierOverview()
      }),
  }
}

/** The settings with one provider switched on or off. */
function withProvider(current: FreeTierSettingsValue, row: FreeTierProviderRow, enabled: boolean): FreeTierSettingsValue {
  const others = (ids: string[]) => ids.filter((id) => id !== row.id)
  if (row.defaultOn) {
    return { ...current, disabled: enabled ? others(current.disabled) : [...others(current.disabled), row.id] }
  }
  return { ...current, optIn: enabled ? [...others(current.optIn), row.id] : others(current.optIn) }
}

/** Radix Select cannot use an empty value, so "None" has its own. */
const NO_OWN_ENDPOINT = 'none'

function OwnEndpointRow({
  value,
  choices,
  onChange,
}: {
  value: string | null
  choices: EndpointChoice[]
  onChange: (ownEndpoint: string | null) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-medium text-foreground">Own endpoint</div>
        <div className="text-xs leading-5 text-muted-foreground">
          {choices.length > 0
            ? 'Tried last, after the free providers. It needs no key unless you saved one for it.'
            : 'Add a local or OpenAI-compatible provider above to pick it here.'}
        </div>
      </div>
      <Select
        value={value ?? NO_OWN_ENDPOINT}
        onValueChange={(next) => {
          onChange(next === NO_OWN_ENDPOINT ? null : next)
        }}
      >
        <SelectTrigger aria-label="Own endpoint" className="h-7 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_OWN_ENDPOINT}>None</SelectItem>
          {choices.map((choice) => (
            <SelectItem key={choice.id} value={choice.id}>{choice.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function StrictModeRow({ strict, onChange }: { strict: boolean; onChange: (strict: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-medium text-foreground">Strict mode</div>
        <div className="text-xs leading-5 text-muted-foreground">
          Use only providers that document a hard stop at the free limit (Groq today), plus your own endpoint.
        </div>
      </div>
      <Switch aria-label="Strict mode" checked={strict} onCheckedChange={onChange} />
    </div>
  )
}

/** Read-only (ADR-0182 decision 5). */
function FallbackOrder({ overview }: { overview: FreeTierOverview }) {
  const nameOf = (id: string) => {
    if (id === OWN_ENDPOINT_ROUTE_ID) {
      return overview.endpointChoices.find((choice) => choice.id === overview.ownEndpoint)?.name ?? 'Own endpoint'
    }
    return overview.providers.find((row) => row.id === id)?.name ?? id
  }
  return (
    <div>
      <div className="text-xs font-medium text-foreground">Fallback order</div>
      {overview.routeOrder.length > 0 ? (
        <ol data-testid="free-tier-route-order" className="mt-1 list-decimal pl-5 text-xs leading-5 text-muted-foreground">
          {overview.routeOrder.map((id) => (
            <li key={id}>{nameOf(id)}</li>
          ))}
        </ol>
      ) : (
        <div data-testid="free-tier-route-order" className="mt-1 text-xs text-muted-foreground">
          No provider is on.
        </div>
      )}
      <div className="mt-1 text-xs leading-5 text-muted-foreground">The order is fixed.</div>
    </div>
  )
}

function OptInConfirmDialog({
  row,
  onCancel,
  onConfirm,
}: {
  row: FreeTierProviderRow | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent data-testid="free-tier-opt-in-confirm">
        <DialogHeader>
          <DialogTitle>Turn on {row?.name}?</DialogTitle>
          <DialogDescription>{row?.billingWarning}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ErrorLine({ error }: { error: string }) {
  return <p role="alert" className="text-xs text-destructive">{error}</p>
}

function ProviderRow({
  row,
  onToggle,
  onSaveSecret,
}: {
  row: FreeTierProviderRow
  onToggle: (row: FreeTierProviderRow, enabled: boolean) => void
  onSaveSecret: (account: string, value: string) => Promise<void>
}) {
  return (
    <div data-testid={`free-tier-row-${row.id}`} className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-muted-foreground">{row.defaultOn ? 'Default on' : 'Opt-in'}</span>
          <span className="text-muted-foreground">{row.hasKey ? 'Key saved' : 'No key'}</span>
        </div>
        <Switch
          aria-label={`Use ${row.name}`}
          checked={row.enabled}
          onCheckedChange={(enabled) => {
            onToggle(row, enabled)
          }}
        />
      </div>
      <SecretField
        label={`${row.name} API key`}
        buttonLabel="Save key"
        secret
        onSave={(value) => onSaveSecret(row.id, value)}
      />
      {row.needsAccountId ? (
        <SecretField
          label={`${row.name} account ID`}
          buttonLabel="Save account ID"
          onSave={(value) => onSaveSecret(accountIdKeyFor(row.id), value)}
        />
      ) : null}
    </div>
  )
}

function SecretField({
  label,
  buttonLabel,
  secret = false,
  onSave,
}: {
  label: string
  buttonLabel: string
  secret?: boolean
  onSave: (value: string) => Promise<void>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const submit = () => {
    onSave(value).then(
      () => {
        setValue('')
      },
      () => undefined,
    )
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Input
        id={id}
        type={secret ? 'password' : 'text'}
        placeholder={label}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
        }}
        className="h-7 text-xs"
      />
      <Button type="button" size="sm" variant="outline" disabled={!value.trim()} onClick={submit}>
        {buttonLabel}
      </Button>
    </div>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
