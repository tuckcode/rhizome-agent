import { useCallback, useEffect, useId, useState } from 'react'
import { trackEvent } from '../lib/telemetry'
import { saveAiModelProviderApiKey } from '../utils/aiProviderSecrets'
import {
  accountIdKeyFor,
  getFreeTierOverview,
  saveFreeTierSettings,
  settingsFromOverview,
  type FreeTierOverview,
  type FreeTierProviderRow,
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
import { Switch } from './ui/switch'

/**
 * Free-tier providers for "Free tier (auto)" (step 3b, ADR-0182).
 *
 * Keys go to the OS keychain through the same command as every other
 * provider key. The fallback order is fixed by ADR-0182 decision 5, so it
 * is shown and cannot be changed here.
 */
export function FreeTierSettings() {
  const [overview, setOverview] = useState<FreeTierOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingOptIn, setPendingOptIn] = useState<FreeTierProviderRow | null>(null)

  const reload = useCallback(async () => {
    try {
      setOverview(await getFreeTierOverview())
      setError(null)
    } catch (loadError) {
      setError(messageOf(loadError))
    }
  }, [])

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

  if (!overview) {
    return error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null
  }

  const save = async (next: ReturnType<typeof settingsFromOverview>) => {
    try {
      setOverview(await saveFreeTierSettings(next))
      setError(null)
    } catch (saveError) {
      setError(messageOf(saveError))
    }
  }

  const setEnabled = async (row: FreeTierProviderRow, enabled: boolean) => {
    const current = settingsFromOverview(overview)
    const others = (ids: string[]) => ids.filter((id) => id !== row.id)
    const next = row.defaultOn
      ? { ...current, disabled: enabled ? others(current.disabled) : [...others(current.disabled), row.id] }
      : { ...current, optIn: enabled ? [...others(current.optIn), row.id] : others(current.optIn) }
    trackEvent('free_tier_provider_toggled', { provider_id: row.id, enabled: enabled ? 1 : 0 })
    await save(next)
  }

  const requestToggle = (row: FreeTierProviderRow, enabled: boolean) => {
    if (enabled && !row.defaultOn && row.billingWarning) {
      setPendingOptIn(row)
      return
    }
    void setEnabled(row, enabled)
  }

  const confirmOptIn = () => {
    const row = pendingOptIn
    setPendingOptIn(null)
    if (row) void setEnabled(row, true)
  }

  const setStrict = (strict: boolean) => {
    trackEvent('free_tier_strict_toggled', { enabled: strict ? 1 : 0 })
    void save({ ...settingsFromOverview(overview), strict })
  }

  const saveSecret = async (account: string, value: string) => {
    try {
      await saveAiModelProviderApiKey(account, value.trim())
      await reload()
    } catch (saveError) {
      setError(messageOf(saveError))
    }
  }

  const nameOf = (id: string) => overview.providers.find((row) => row.id === id)?.name ?? id

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
        <ProviderRow key={row.id} row={row} onToggle={requestToggle} onSaveSecret={saveSecret} />
      ))}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-foreground">Strict mode</div>
          <div className="text-xs leading-5 text-muted-foreground">
            Use only providers that document a hard stop at the free limit (Groq today), plus your own endpoint.
          </div>
        </div>
        <Switch aria-label="Strict mode" checked={overview.strict} onCheckedChange={setStrict} />
      </div>

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

      {overview.usable ? null : (
        <div className="text-xs text-muted-foreground">
          Add a key to at least one provider to use Free tier (auto).
        </div>
      )}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

      <Dialog open={pendingOptIn !== null} onOpenChange={(open) => { if (!open) setPendingOptIn(null) }}>
        <DialogContent data-testid="free-tier-opt-in-confirm">
          <DialogHeader>
            <DialogTitle>Turn on {pendingOptIn?.name}?</DialogTitle>
            <DialogDescription>{pendingOptIn?.billingWarning}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingOptIn(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmOptIn}>
              Turn on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
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
          onCheckedChange={(enabled) => onToggle(row, enabled)}
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
  const submit = async () => {
    await onSave(value)
    setValue('')
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Input
        id={id}
        type={secret ? 'password' : 'text'}
        placeholder={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-7 text-xs"
      />
      <Button type="button" size="sm" variant="outline" disabled={!value.trim()} onClick={() => void submit()}>
        {buttonLabel}
      </Button>
    </div>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
