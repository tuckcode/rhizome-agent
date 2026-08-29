import { useCallback, useEffect, useState } from 'react'
import { CircleNotch, CirclesThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { useDocumentThemeMode } from '../hooks/useDocumentThemeMode'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { ResizeHandle } from './ResizeHandle'

interface MyceliumViewProps {
  locale?: AppLocale
  onExit?: () => void
  /** When set, show this session only. Rail overview leaves it empty. */
  focusSessionPath?: string | null
}

interface SessionPick {
  name: string
  path: string
  mtimeMs?: number | null
}

interface SidecarStatus {
  url: string
  mode: string
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

export default function MyceliumView({
  locale = 'en',
  onExit,
  focusSessionPath = null,
}: MyceliumViewProps) {
  const t = createTranslator(locale)
  const themeMode = useDocumentThemeMode()
  const sessionOnly = Boolean(focusSessionPath)
  const sessionsWidth = usePanelWidth(APP_STORAGE_KEYS.myceliumSessionsWidth, 224, 180, 420)
  const [sessions, setSessions] = useState<SessionPick[]>([])
  const [selected, setSelected] = useState<SessionPick | null>(null)
  const [sidecar, setSidecar] = useState<SidecarStatus | null>(null)
  const [sidecarPath, setSidecarPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshSessions = useCallback(async () => {
    try {
      const listed = await call<SessionPick[]>('list_prime_sessions')
      setSessions(listed)
      setSelected((prev) => {
        if (focusSessionPath) {
          return listed.find((s) => s.path === focusSessionPath) ?? { name: focusSessionPath.split('/').pop() ?? 'session', path: focusSessionPath }
        }
        if (prev && listed.some((s) => s.path === prev.path)) return prev
        return listed[0] ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [focusSessionPath])

  const startSidecar = useCallback(async (path?: string | null) => {
    setBusy(true)
    setError(null)
    try {
      // The host fronts Mindwalk with a skin proxy; the theme rides along so
      // the embedded engine matches the app instead of flashing its own.
      const status = await call<SidecarStatus>('start_mindwalk_sidecar', {
        ...(path ? { path } : {}),
        theme: themeMode,
      })
      setSidecar(status)
      setSidecarPath(path ?? null)
    } catch (e) {
      setSidecar(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [themeMode])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    void startSidecar(focusSessionPath)
    return () => {
      void call('stop_mindwalk_sidecar').catch(() => {})
    }
  }, [focusSessionPath, startSidecar])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground" data-testid="mycelium-view">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <CirclesThree size={18} className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{t('mycelium.title')}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {sessionOnly ? t('mycelium.thisSessionSubtitle') : t('mycelium.overviewSubtitle')}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void startSidecar(sessionOnly ? focusSessionPath : sidecarPath)} disabled={busy}>
          {t('mycelium.retry')}
        </Button>
        {onExit ? (
          <Button type="button" variant="ghost" size="sm" onClick={onExit} data-testid="mycelium-close">
            {t('mycelium.close')}
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        {sessionOnly ? null : (
          <div
            className="relative flex shrink-0 flex-col border-r border-border"
            style={{ width: sessionsWidth.width }}
            data-testid="mycelium-overview-list"
          >
            <ResizeHandle
              onResize={(delta) => sessionsWidth.resizeBy(-delta)}
              placement="absolute"
              label={t('mycelium.sessions.resize')}
              testId="mycelium-sessions-resize"
            />
            <div className="border-b border-border px-3 py-2 text-[11px] font-medium text-muted-foreground">
              {t('mycelium.sessionsHeading')}
            </div>
            {sessions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground" data-testid="mycelium-no-session">
                {t('mycelium.noSession')}
              </div>
            ) : (
              <ul className="min-h-0 flex-1 overflow-auto divide-y divide-border">
                {sessions.map((s) => {
                  const active = selected?.path === s.path
                  return (
                    <li key={s.path}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
                        onClick={() => {
                          setSelected(s)
                          void startSidecar(s.path)
                        }}
                        data-testid="mycelium-session-row"
                      >
                        <span className="truncate font-medium">{s.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {sessionOnly ? (
            <div className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground" data-testid="mycelium-session-scope">
              {t('mycelium.thisSessionHint', { name: selected?.name ?? 'session' })}
            </div>
          ) : null}

          {error ? (
            <div className="m-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground" data-testid="mycelium-sidecar-error">
              <p>{error}</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => void startSidecar(sessionOnly ? focusSessionPath : sidecarPath)}>
                {t('mycelium.retry')}
              </Button>
            </div>
          ) : null}

          {busy && !sidecar ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground" data-testid="mycelium-loading">
              <CircleNotch className="mr-2 animate-spin" size={16} />
              {t('mycelium.starting')}
            </div>
          ) : null}

          {sidecar ? (
            <iframe
              title={t('mycelium.embedTitle')}
              src={sidecar.url}
              className="min-h-0 flex-1 border-0 bg-background"
              data-testid="mycelium-embed"
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground" data-testid="mycelium-attribution">
        {t('mycelium.attribution')}
      </div>
    </div>
  )
}
