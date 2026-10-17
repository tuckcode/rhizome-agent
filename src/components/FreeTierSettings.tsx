import { useEffect, useId, useRef, useState } from 'react'
import { trackEvent } from '../lib/telemetry'
import {
  accountIdKeyFor,
  deleteFreeTierSecret,
  OWN_ENDPOINT_ROUTE_ID,
  getFreeTierOverview,
  saveFreeTierSecret,
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
import { FREE_TIER_AUTO_LABEL } from '../lib/nativeChatTargets'

/**
 * Free-tier providers for Taproot (step 3b, ADR-0182).
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
        <div className="text-sm font-medium text-foreground">{FREE_TIER_AUTO_LABEL}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          Native Chat can try these free providers in order and move to the next one when a provider fails
          or runs out of free use. Each needs its own key. Keys are kept in this computer's keychain.
        </div>
      </div>
      {overview.providers.map((row) => (
        <ProviderRow
          key={row.id}
          row={row}
          busy={state.busy}
          onToggle={state.requestToggle}
          onSaveSecret={state.saveSecret}
          onDeleteSecret={state.deleteSecret}
        />
      ))}
      <OwnEndpointRow
        value={overview.ownEndpoint}
        model={overview.ownEndpointModel}
        choices={overview.endpointChoices}
        busy={state.busy}
        onChange={state.setOwnEndpoint}
        onModelChange={state.setOwnEndpointModel}
      />
      <StrictModeRow strict={overview.strict} busy={state.busy} onChange={state.setStrict} />
      <FallbackOrder overview={overview} />
      {overview.usable ? null : (
        <div className="text-xs text-muted-foreground">
          Add a key to at least one provider to use {FREE_TIER_AUTO_LABEL}.
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
  const [busy, setBusy] = useState(false)
  // Each save starts from the overview it read, so a second save during the
  // first would undo it. The ref blocks a second change in the same tick,
  // before `busy` has re-rendered the controls as disabled.
  const saving = useRef(false)

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

  /**
   * Applies one change, one at a time. Resolves true when it saved. Never
   * rejects: errors show in the card. A change while one runs is dropped.
   */
  const run = async (work: () => Promise<FreeTierOverview>): Promise<boolean> => {
    if (saving.current) return false
    saving.current = true
    setBusy(true)
    try {
      setOverview(await work())
      setError(null)
      return true
    } catch (workError: unknown) {
      setError(messageOf(workError))
      return false
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  /** Saves settings derived from the current overview, then reports the event. */
  const save = (change: (current: FreeTierSettingsValue) => FreeTierSettingsValue, onSaved: () => void) => {
    if (!overview) return
    void run(() => saveFreeTierSettings(change(settingsFromOverview(overview)))).then((saved) => {
      if (saved) onSaved()
    })
  }

  const setEnabled = (row: FreeTierProviderRow, enabled: boolean) => {
    save(
      (current) => withProvider(current, row, enabled),
      () => {
        trackEvent('free_tier_provider_toggled', { provider_id: row.id, enabled: enabled ? 1 : 0 })
      },
    )
  }

  return {
    overview,
    error,
    busy,
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
      save(
        (current) => ({ ...current, strict }),
        () => {
          trackEvent('free_tier_strict_toggled', { enabled: strict ? 1 : 0 })
        },
      )
    },
    setOwnEndpoint: (ownEndpoint: string | null) => {
      save(
        (current) => ({ ...current, ownEndpoint, ownEndpointModel: null }),
        () => {
          trackEvent('free_tier_own_endpoint_set', { chosen: ownEndpoint ? 1 : 0 })
        },
      )
    },
    setOwnEndpointModel: (ownEndpointModel: string) => {
      save(
        (current) => ({ ...current, ownEndpointModel }),
        () => undefined,
      )
    },
    saveSecret: (account: string, value: string) =>
      run(async () => {
        await saveFreeTierSecret(account, value.trim())
        return getFreeTierOverview()
      }),
    deleteSecret: (account: string) =>
      run(async () => {
        await deleteFreeTierSecret(account)
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
  model,
  choices,
  busy,
  onChange,
  onModelChange,
}: {
  value: string | null
  model: string | null
  choices: EndpointChoice[]
  busy: boolean
  onChange: (ownEndpoint: string | null) => void
  onModelChange: (model: string) => void
}) {
  const labelId = useId()
  const modelLabelId = useId()
  const chosen = choices.find((choice) => choice.id === value)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div id={labelId} className="text-xs font-medium text-foreground">Own endpoint</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {choices.length > 0
              ? 'Tried last, after the free providers. It uses the key you set for it in the provider above, if any.'
              : 'Add a local or OpenAI-compatible provider above to pick it here.'}
          </div>
        </div>
        <Select
          value={value ?? NO_OWN_ENDPOINT}
          disabled={busy}
          onValueChange={(next) => {
            onChange(next === NO_OWN_ENDPOINT ? null : next)
          }}
        >
          <SelectTrigger aria-labelledby={labelId} className="h-7 w-48 text-xs">
            <SelectValue placeholder="Pick an endpoint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_OWN_ENDPOINT}>None</SelectItem>
            {choices.map((choice) => (
              <SelectItem key={choice.id} value={choice.id}>{choice.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {chosen && chosen.models.length > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <div id={modelLabelId} className="text-xs font-medium text-foreground">Own endpoint model</div>
          <Select
            value={model ?? chosen.models[0]}
            disabled={busy}
            onValueChange={onModelChange}
          >
            <SelectTrigger aria-labelledby={modelLabelId} className="h-7 w-48 text-xs">
              <SelectValue placeholder="Pick a model" />
            </SelectTrigger>
            <SelectContent>
              {chosen.models.map((id) => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

function StrictModeRow({
  strict,
  busy,
  onChange,
}: {
  strict: boolean
  busy: boolean
  onChange: (strict: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-medium text-foreground">Strict mode</div>
        <div className="text-xs leading-5 text-muted-foreground">
          Use only providers that document a hard stop at the free limit (Groq today), plus your own endpoint.
        </div>
      </div>
      <Switch aria-label="Strict mode" checked={strict} disabled={busy} onCheckedChange={onChange} />
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

function keyStatus(row: FreeTierProviderRow): string {
  if (row.keyError) return 'Keychain error'
  return row.hasKey ? 'Key saved' : 'No key'
}

function ProviderRow({
  row,
  busy,
  onToggle,
  onSaveSecret,
  onDeleteSecret,
}: {
  row: FreeTierProviderRow
  busy: boolean
  onToggle: (row: FreeTierProviderRow, enabled: boolean) => void
  onSaveSecret: (account: string, value: string) => Promise<boolean>
  onDeleteSecret: (account: string) => Promise<boolean>
}) {
  return (
    <div data-testid={`free-tier-row-${row.id}`} className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-muted-foreground">{row.defaultOn ? 'Default on' : 'Opt-in'}</span>
          <span className={row.keyError ? 'text-destructive' : 'text-muted-foreground'}>{keyStatus(row)}</span>
          {row.needsAccountId ? (
            <span className="text-muted-foreground">{row.hasAccountId ? 'Account ID saved' : 'No account ID'}</span>
          ) : null}
        </div>
        <Switch
          aria-label={`Use ${row.name}`}
          checked={row.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => {
            onToggle(row, enabled)
          }}
        />
      </div>
      {row.keyError ? <ErrorLine error={row.keyError} /> : null}
      <SecretField
        label={`${row.name} API key`}
        buttonLabel="Save key"
        secret
        busy={busy}
        onSave={(value) => onSaveSecret(row.id, value)}
        onRemove={row.hasKey ? () => onDeleteSecret(row.id) : undefined}
        removeLabel="Remove key"
      />
      {row.needsAccountId ? (
        <SecretField
          label={`${row.name} account ID`}
          buttonLabel="Save account ID"
          busy={busy}
          onSave={(value) => onSaveSecret(accountIdKeyFor(row.id), value)}
          onRemove={row.hasAccountId ? () => onDeleteSecret(accountIdKeyFor(row.id)) : undefined}
          removeLabel="Remove account ID"
        />
      ) : null}
    </div>
  )
}

function SecretField({
  label,
  buttonLabel,
  removeLabel,
  secret = false,
  busy,
  onSave,
  onRemove,
}: {
  label: string
  buttonLabel: string
  removeLabel: string
  secret?: boolean
  busy: boolean
  onSave: (value: string) => Promise<boolean>
  /** Shown only when something is saved. */
  onRemove?: () => Promise<boolean>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const submit = () => {
    void onSave(value).then((saved) => {
      // Keep the text after a failed save, so the user can retry.
      if (saved) setValue('')
    })
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
      <Button type="button" size="sm" variant="outline" disabled={busy || !value.trim()} onClick={submit}>
        {buttonLabel}
      </Button>
      {onRemove ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void onRemove()}>
          {removeLabel}
        </Button>
      ) : null}
    </div>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
