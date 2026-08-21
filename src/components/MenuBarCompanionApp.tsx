import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createTranslator, DEFAULT_APP_LOCALE } from '../lib/i18n'
import { isTauri } from '../mock-tauri'
import { useMenuBarCompanionVault } from '../hooks/useMenuBarCompanionVault'
import { useMenuBarRunningSessions } from '../hooks/useMenuBarRunningSessions'
import { rosterActivityMessageKey, type RunningSessionRow } from '../lib/primeRunningSessions'
import { buildCaptureNote } from '../utils/menuBarCapture'
import { trackMenuBarSessionOpened } from '../lib/productAnalytics'

/**
 * Menu-bar companion popover. Capture writes a real note to the active
 * vault's Inbox; the activity feed reads the vault's recent events.
 *
 * Note: this is a small frameless launcher popover, not the main app surface.
 * It deliberately uses raw `<input>`/`<button>` rather than the shadcn/ui
 * components AGENTS.md mandates for the main UI — a documented exception for
 * this compact chrome. Revisit if the popover grows into a real form surface.
 */
export function MenuBarCompanionApp() {
  const t = useMemo(() => createTranslator(DEFAULT_APP_LOCALE), [])
  const [capture, setCapture] = useState('')
  const [pickingType, setPickingType] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const { activeVaultPath, vaultLabel, activity, refresh } = useMenuBarCompanionVault()
  const running = useMenuBarRunningSessions()
  const { setPolling } = running

  useEffect(() => {
    document.body.classList.add('menu-bar-companion')
    return () => {
      document.body.classList.remove('menu-bar-companion')
    }
  }, [])

  // Dismiss when the popover loses focus (click outside → hide); refresh on show.
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          refresh()
          setPolling(true)
        } else {
          setPolling(false)
          void Promise.resolve(invoke('hide_menu_bar_companion')).catch(() => {})
        }
      })
      .then((fn) => {
        unlisten = fn
      })
    return () => {
      unlisten?.()
    }
  }, [refresh, setPolling])

  const hide = useCallback(() => {
    if (!isTauri()) return
    void Promise.resolve(invoke('hide_menu_bar_companion')).catch(() => {})
  }, [])

  const openMain = useCallback((sessionFile?: string) => {
    if (!isTauri()) return
    // Called with no argument by the plain "Open Rhizome" action; the roster
    // rows pass the session to land on.
    const open = sessionFile
      ? invoke('open_main_from_menu_bar_companion', { sessionFile })
      : invoke('open_main_from_menu_bar_companion')
    void Promise.resolve(open).catch(() => {})
  }, [])

  const saveCapture = useCallback(() => {
    const note = buildCaptureNote(capture, selectedType, new Date().toISOString())
    if (!note || !activeVaultPath || !isTauri()) return
    void Promise.resolve(
      invoke('create_note_content', {
        path: note.path,
        content: note.content,
        vaultPath: activeVaultPath,
      }),
    )
      .then(() =>
        invoke('call_rhizome_tool', {
          name: 'rhizome_append_event',
          args: {
            vaultPath: activeVaultPath,
            type: 'capture',
            trigger: 'menu_bar',
            artifact_path: note.path,
          },
        }),
      )
      .then(() => {
        setCapture('')
        setSelectedType(null)
        setPickingType(false)
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 1500)
        refresh()
      })
      .catch(() => {})
  }, [capture, selectedType, activeVaultPath, refresh])

  const distillClipboard = useCallback(() => {
    if (!activeVaultPath || !isTauri()) return
    void Promise.resolve(invoke<string>('read_text_from_clipboard'))
      .then((text) => {
        const trimmed = (text ?? '').trim()
        if (!trimmed) return
        const jobId = crypto.randomUUID()
        return invoke('start_rhizome_job', {
          jobId,
          name: 'rhizome_distill',
          args: {
            text: trimmed,
            vaultPath: activeVaultPath,
            project: '',
            trigger: 'menu_bar',
          },
        }).then(() => {
          setSavedFlash(true)
          window.setTimeout(() => setSavedFlash(false), 1500)
          // Activity will refresh when the job finishes; poll once shortly after.
          window.setTimeout(() => refresh(), 2500)
        })
      })
      .catch(() => {})
  }, [activeVaultPath, refresh])

  const onCaptureKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        setPickingType(true)
        return
      }
      if (event.key === 'Escape') {
        if (pickingType) {
          setPickingType(false)
          return
        }
        hide()
        return
      }
      if (event.key === 'Enter' && capture.trim()) {
        event.preventDefault()
        saveCapture()
      }
    },
    [capture, hide, pickingType, saveCapture],
  )

  const types = [
    'Note',
    'Project',
    'Task',
    'Person',
    'Event',
    'Topic',
    'Operation',
    'Responsibility',
  ] as const

  return (
    <div
      className="menu-bar-companion-root flex h-screen w-screen items-stretch justify-center bg-transparent p-0"
      data-testid="menu-bar-companion"
      data-state={pickingType ? 'picking-type' : 'idle'}
    >
      <div className="menu-bar-companion-popover flex w-[360px] flex-col overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--surface-popover,var(--background))] text-[13px] text-[var(--text-primary,var(--foreground))] shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <div className="border-b border-[var(--border-subtle,var(--border))] px-3.5 pb-2.5 pt-3">
          <input
            autoFocus
            className="w-full rounded-[10px] border border-[var(--border-input,var(--border))] bg-[var(--surface-input,var(--background))] px-3 py-2 text-[13px] text-[var(--text-primary,var(--foreground))] outline-none placeholder:italic placeholder:text-[var(--text-faint,var(--muted-foreground))] focus:border-[var(--border-focus,var(--ring))] focus:shadow-[0_0_0_3px_var(--accent-blue-light,rgba(111,227,160,0.14))]"
            data-testid="menu-bar-companion-capture"
            placeholder={t('menuBarCompanion.capturePlaceholder')}
            spellCheck={false}
            value={capture}
            onChange={(event) => setCapture(event.target.value)}
            onKeyDown={onCaptureKeyDown}
          />
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] tracking-wide text-[var(--text-muted,var(--muted-foreground))]">
            <span data-testid="menu-bar-companion-hint">
              {savedFlash ? t('menuBarCompanion.captureSaved') : t('menuBarCompanion.captureHint')}
            </span>
            <span data-testid="menu-bar-companion-char-count">{capture.length}</span>
          </div>
        </div>

        {pickingType ? (
          <div
            className="flex flex-wrap gap-1 border-b border-[var(--border-subtle,var(--border))] px-3.5 py-2"
            data-testid="menu-bar-companion-type-picker"
            role="listbox"
            aria-label={t('menuBarCompanion.typePickerLabel')}
          >
            {types.map((type) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={selectedType === type}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                  selectedType === type
                    ? 'border-[var(--accent-blue,var(--primary))] bg-[var(--accent-blue-light,var(--accent))] text-[var(--accent-blue,var(--primary))]'
                    : 'border-[var(--border-default,var(--border))] bg-[var(--surface-button,var(--muted))] text-[var(--text-secondary,var(--muted-foreground))]'
                }`}
                onClick={() => {
                  setSelectedType(type)
                  setPickingType(false)
                }}
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}

        <div className="py-1.5">
          <CompanionAction
            testId="menu-bar-companion-distill"
            label={t('menuBarCompanion.distillClipboard')}
            shortcut="⌥V"
            onClick={() => {
              distillClipboard()
            }}
          />
          <CompanionAction
            testId="menu-bar-companion-search"
            label={t('menuBarCompanion.searchVault')}
            shortcut="⌥F"
            onClick={() => {
              openMain()
            }}
          />
        </div>

        {running.rows.length > 0 ? (
          <>
            <div className="border-t border-[var(--border-subtle,var(--border))] px-3.5 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary,var(--muted-foreground))]">
              {t('menuBarCompanion.running')}
            </div>
            <ul className="flex flex-col px-1.5 py-0.5" data-testid="menu-bar-companion-running">
              {running.rows.map((row) => (
                <RunningSessionItem
                  key={row.id}
                  row={row}
                  subagentLabel={
                    row.subagentCount === 1
                      ? t('menuBarCompanion.runningSubagent')
                      : t('menuBarCompanion.runningSubagents', { count: row.subagentCount })
                  }
                  openLabel={t('menuBarCompanion.runningOpenSession')}
                  // Prose from the daemon is passed through untranslated; a
                  // status is copy we own, so it goes through the locale file.
                  activityLabel={
                    row.activity.kind === 'summary'
                      ? row.activity.text
                      : t(rosterActivityMessageKey(row.activity.key))
                  }
                  onOpen={() => {
                    trackMenuBarSessionOpened({
                      working: row.working,
                      subagentCount: row.subagentCount,
                      visibleCount: running.rows.length,
                    })
                    openMain(row.sessionFile)
                  }}
                />
              ))}
            </ul>
            {running.overflow > 0 ? (
              <div
                className="px-3.5 pb-1.5 font-mono text-[10.5px] text-[var(--text-muted,var(--muted-foreground))]"
                data-testid="menu-bar-companion-running-overflow"
              >
                {t('menuBarCompanion.runningMore', { count: running.overflow })}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="border-t border-[var(--border-subtle,var(--border))] px-3.5 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary,var(--muted-foreground))]">
          {t('menuBarCompanion.networkActivity')}
        </div>
        {activity.length === 0 ? (
          <div
            className="px-3.5 py-3 text-[12.5px] text-[var(--text-muted,var(--muted-foreground))]"
            data-testid="menu-bar-companion-activity-empty"
          >
            {t('menuBarCompanion.activityEmpty')}
          </div>
        ) : (
          <ul className="flex flex-col px-3.5 py-1" data-testid="menu-bar-companion-activity">
            {activity.map((row, i) => (
              <li
                key={`${row.when}-${i}`}
                className="flex items-baseline gap-1.5 border-b border-[var(--border-subtle,var(--border))] py-1 text-[12px] last:border-b-0"
              >
                <span className="font-mono text-[var(--accent-orange,var(--primary))]">{row.verb}</span>
                <span className="flex-1 truncate font-medium text-[var(--text-primary,var(--foreground))]">
                  {row.target}
                </span>
                {row.source ? (
                  <span
                    data-testid="menu-bar-companion-activity-source"
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary,var(--muted-foreground))]"
                  >
                    {row.source}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-[var(--border-subtle,var(--border))] px-3.5 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary,var(--muted-foreground))]">
          {t('menuBarCompanion.vault')}
        </div>
        <div
          className="flex flex-col gap-0.5 px-3.5 pb-2.5 pt-2 text-[12px] text-[var(--text-secondary,var(--muted-foreground))]"
          data-testid="menu-bar-companion-vault-row"
        >
          <span className="font-medium text-[var(--text-primary,var(--foreground))]">
            {vaultLabel ?? t('menuBarCompanion.vaultUnset')}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--text-muted,var(--muted-foreground))]">
            {activeVaultPath
              ? activity.length > 0
                ? t('menuBarCompanion.vaultMetaActivity', {
                    when: (activity[0].when.slice(0, 10) || '—'),
                  })
                : t('menuBarCompanion.vaultMetaQuiet')
              : t('menuBarCompanion.vaultMetaUnset')}
          </span>
        </div>

        <div className="border-t border-[var(--border-subtle,var(--border))] bg-[var(--surface-panel,var(--muted))] py-1.5">
          <CompanionAction
            testId="menu-bar-companion-open-main"
            label={t('menuBarCompanion.openRhizome')}
            shortcut="⌥R"
            accent
            onClick={() => openMain()}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * One running session. Subagents are a count, never a nested list — a tree in
 * a 360px popover is unreadable, and the full picture belongs in the main
 * window (#13).
 */
function RunningSessionItem({
  row,
  subagentLabel,
  openLabel,
  activityLabel,
  onOpen,
}: {
  row: RunningSessionRow
  subagentLabel: string
  openLabel: string
  activityLabel: string
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type="button"
        title={openLabel}
        aria-label={openLabel}
        data-testid="menu-bar-companion-running-row"
        data-session-id={row.id}
        className="flex w-full flex-col gap-0.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--state-hover,var(--accent))]"
        onClick={onOpen}
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            data-testid="menu-bar-companion-running-dot"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              row.working
                ? 'bg-[var(--accent-green,var(--primary))]'
                : 'bg-[var(--text-tertiary,var(--muted-foreground))]'
            }`}
          />
          <span className="flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary,var(--foreground))]">
            {row.title}
          </span>
          {row.subagentCount > 0 ? (
            <span
              data-testid="menu-bar-companion-running-subagents"
              className="shrink-0 rounded-full bg-[var(--surface-button,var(--muted))] px-1.5 font-mono text-[10px] text-[var(--text-secondary,var(--muted-foreground))]"
            >
              {subagentLabel}
            </span>
          ) : null}
        </span>
        <span className="truncate pl-3 font-mono text-[10.5px] text-[var(--text-muted,var(--muted-foreground))]">
          {activityLabel}
        </span>
      </button>
    </li>
  )
}

function CompanionAction({
  label,
  shortcut,
  onClick,
  testId,
  accent = false,
}: {
  label: string
  shortcut: string
  onClick: () => void
  testId: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left text-[13px] text-[var(--text-primary,var(--foreground))] transition-colors hover:bg-[var(--state-hover,var(--accent))]"
      onClick={onClick}
    >
      <span className={`flex-1 ${accent ? 'text-[var(--accent-blue,var(--primary))]' : ''}`}>
        {label}
      </span>
      <span className="font-mono text-[11px] text-[var(--text-muted,var(--muted-foreground))]">
        {shortcut}
      </span>
    </button>
  )
}
