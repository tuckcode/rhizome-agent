import { useCallback, useEffect, useState } from 'react'
import { CircleNotch, Graph, ArrowSquareOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

interface MyceliumViewProps {
  locale?: AppLocale
  onExit?: () => void
}

interface SessionPick {
  name: string
  path: string
  mtimeMs?: number | null
}

interface WhichBinaryResult {
  found: boolean
  path?: string | null
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

export default function MyceliumView({ locale = 'en', onExit }: MyceliumViewProps) {
  const t = createTranslator(locale)
  const [sessions, setSessions] = useState<SessionPick[]>([])
  const [selected, setSelected] = useState<SessionPick | null>(null)
  const [mindwalkOk, setMindwalkOk] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const which = await call<WhichBinaryResult>('which_binary', { name: 'mindwalk' })
      setMindwalkOk(Boolean(which.found))
    } catch {
      setMindwalkOk(false)
    }
    try {
      const listed = await call<SessionPick[]>('list_prime_sessions')
      setSessions(listed)
      setSelected((prev) => {
        if (prev && listed.some((s) => s.path === prev.path)) return prev
        return listed[0] ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openBridged = useCallback(async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    setStatus(t('mycelium.bridging'))
    try {
      const out = await call<string>('bridge_and_open_prime_session', { path: selected.path })
      setStatus(`${t('mycelium.open')} · ${out.split('/').pop() ?? out}`)
    } catch (e) {
      setError(t('mycelium.error', { error: e instanceof Error ? e.message : String(e) }))
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }, [selected, t])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background" data-testid="mycelium-view">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Graph size={18} className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{t('mycelium.title')}</div>
          <div className="truncate text-[11px] text-muted-foreground">{t('mycelium.subtitle')}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void refresh()} disabled={busy}>
          {t('mycelium.refresh')}
        </Button>
        {onExit ? (
          <Button type="button" variant="ghost" size="sm" onClick={onExit} data-testid="mycelium-close">
            Close
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">{t('mycelium.hint')}</p>

        {mindwalkOk === false ? (
          <div
            className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
            data-testid="mycelium-missing-binary"
          >
            {t('mycelium.missingBinary')}
          </div>
        ) : null}

        {sessions.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
            data-testid="mycelium-no-session"
          >
            {t('mycelium.noSession')}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
            <ul className="divide-y divide-border">
              {sessions.map((s) => {
                const active = selected?.path === s.path
                return (
                  <li key={s.path}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
                      onClick={() => setSelected(s)}
                      data-testid="mycelium-session-row"
                    >
                      <span className="truncate font-medium">{s.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {error ? <div className="text-xs text-destructive" data-testid="mycelium-error">{error}</div> : null}
        {status ? <div className="text-xs text-muted-foreground" data-testid="mycelium-status">{status}</div> : null}

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={!selected || busy || mindwalkOk === false}
            onClick={() => void openBridged()}
            data-testid="mycelium-open"
          >
            {busy ? <CircleNotch className="animate-spin" size={14} /> : <ArrowSquareOut size={14} />}
            <span className="ml-1">{t('mycelium.open')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
