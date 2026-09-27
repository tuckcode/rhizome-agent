import { useCallback, useEffect, useMemo, useState } from 'react'
import { callHost } from '../lib/callHost'
import { loadPrimeModelCatalog, onPrimeModelCatalogReset } from '../lib/primeModelCatalog'
import { trackPrimeDefaultModelChanged } from '../lib/productAnalytics'
import { filterModels, findModel, modelKey, type PrimeModel } from '../lib/primeModels'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

/**
 * Pick the model Chat uses, from Settings (#45).
 *
 * The switch is the existing `set_prime_model` command — the same call the
 * Chat menu makes. This does not write a second credential store, and it
 * does not invent a provider connection.
 */

interface HostModelStatus {
  modelProvider?: string | null
  modelId?: string | null
}

interface ReadyCatalog {
  models: PrimeModel[]
  selectedKey: string | null
}

interface PrimeDefaultModelSectionProps {
  vaultPath?: string | null
}

export function PrimeDefaultModelSection({ vaultPath }: PrimeDefaultModelSectionProps) {
  const [ready, setReady] = useState<ReadyCatalog | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (cancelled: () => boolean) => {
    let listed: PrimeModel[] = []
    try {
      listed = await loadPrimeModelCatalog()
    } catch {
      listed = []
    }
    let selectedKey: string | null = null
    try {
      const status = await callHost<HostModelStatus>('get_prime_session_host_status')
      const current = findModel(listed, status.modelProvider, status.modelId)
      selectedKey = current ? modelKey(current) : null
    } catch {
      selectedKey = null
    }
    if (!cancelled()) setReady({ models: listed, selectedKey })
  }, [])

  useEffect(() => {
    let cancelled = false
    const idle = window.setTimeout(() => {
      void load(() => cancelled)
    }, 0)
    const stop = onPrimeModelCatalogReset(() => {
      void load(() => cancelled)
    })
    return () => {
      cancelled = true
      window.clearTimeout(idle)
      stop()
    }
  }, [load])

  const options = useMemo(() => {
    if (!ready) return []
    const matched = filterModels(ready.models, query)
    if (!ready.selectedKey) return matched
    if (matched.some((model) => modelKey(model) === ready.selectedKey)) return matched
    const selected = ready.models.find((model) => modelKey(model) === ready.selectedKey)
    return selected ? [selected, ...matched] : matched
  }, [query, ready])

  const choose = useCallback(
    async (key: string) => {
      const model = ready?.models.find((entry) => modelKey(entry) === key)
      if (!model || !ready) return
      const previous = ready.selectedKey
      setReady({ ...ready, selectedKey: key })
      setError(null)
      try {
        const vault = vaultPath?.trim()
        if (vault) await callHost('ensure_prime_session_host', { vaultPath: vault })
        await callHost('set_prime_model', { provider: model.provider, modelId: model.id })
        trackPrimeDefaultModelChanged(model.id)
      } catch (e) {
        setReady({ ...ready, selectedKey: previous })
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [ready, vaultPath],
  )

  return (
    <div className="flex flex-col gap-1.5" data-testid="prime-default-model">
      <div className="text-[11px] font-medium text-foreground">Default model</div>
      <p className="text-[11px] text-muted-foreground">
        The model Chat uses now. Choosing one switches Prime the same way the Chat menu does.
      </p>
      {ready === null ? (
        <div className="text-[11px] text-muted-foreground">Loading models…</div>
      ) : ready.models.length === 0 ? (
        <div className="text-[11px] text-muted-foreground" data-testid="prime-default-model-empty">
          No models are available.
        </div>
      ) : (
        <>
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter models"
            aria-label="Filter models"
            data-testid="prime-default-model-filter"
            className="h-8 text-[11px]"
          />
          <Select value={ready.selectedKey ?? undefined} onValueChange={(key) => void choose(key)}>
            <SelectTrigger
              className="w-full"
              aria-label="Default model"
              data-testid="prime-default-model-select"
            >
              <SelectValue placeholder="Choose a model" />
            </SelectTrigger>
            <SelectContent position="popper">
              {options.map((model) => {
                const key = modelKey(model)
                const label = model.name?.trim() || model.id
                return (
                  <SelectItem key={key} value={key}>
                    {label} · {model.provider}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </>
      )}
      {error ? (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
