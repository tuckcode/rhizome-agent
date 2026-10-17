import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { normalizeStoredAiAgent } from '../lib/aiAgents'
import {
  migrateRemovedHarnessSettings,
  removedHarnessSettingsNeedPersist,
} from '../lib/migrateRemovedHarnessChoices'
import { normalizeAiModelProviders } from '../lib/aiTargets'
import { shouldHideGitignoredFiles } from '../lib/gitignoredVisibility'
import {
  notifyGitignoredVisibilityChanged,
  TOGGLE_GITIGNORED_VISIBILITY_EVENT,
} from '../lib/gitignoredVisibilityEvents'
import { serializeUiLanguagePreference } from '../lib/i18n'
import { trackAccentColorChanged, trackColorThemeChanged, trackThemeModeChanged } from '../lib/productAnalytics'
import { normalizeReleaseChannel, serializeReleaseChannel } from '../lib/releaseChannel'
import { normalizeDateDisplayFormat, normalizeDisplayTimeZone } from '../utils/dateDisplay'
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_THEME,
  DEFAULT_THEME_MODE,
  normalizeAccentColor,
  normalizeColorTheme,
  normalizeThemeMode,
  type ThemeMode,
} from '../lib/themeMode'
import type { Settings } from '../types'
import { normalizeNoteWidthMode } from '../utils/noteWidth'

async function invokeNativeIfAvailable<T>(command: string, tauriArgs: Record<string, unknown>): Promise<T | undefined> {
  try {
    return await invoke<T>(command, tauriArgs)
  } catch (err) {
    if (isTauri()) throw err
    return undefined
  }
}

async function tauriCall<T>(command: string, tauriArgs: Record<string, unknown>, mockArgs?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(command, tauriArgs)

  const nativeResult = await invokeNativeIfAvailable<T>(command, tauriArgs)
  if (nativeResult !== undefined) return nativeResult

  return mockInvoke<T>(command, mockArgs ?? tauriArgs)
}

const EMPTY_SETTINGS: Settings = {
  auto_pull_interval_minutes: null,
  git_enabled: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  automatic_update_checks_enabled: null,
  theme_mode: null,
  color_theme: null,
  accent_color: null,
  ui_language: null,
  date_display_format: null,
  timezone: null,
  note_width_mode: null,
  sidebar_type_pluralization_enabled: null,
  default_ai_agent: null,
  default_ai_target: null,
  agent_memory_vault_path: null,
  ai_model_providers: null,
  ai_workspace_conversations: null,
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  multi_workspace_enabled: null,
  agent_profile: null,
}

function normalizeSettings(settings: Settings): Settings {
  const aiModelProviders = normalizeAiModelProviders(settings.ai_model_providers)

  return migrateRemovedHarnessSettings({
    ...settings,
    git_enabled: settings.git_enabled ?? null,
    release_channel: serializeReleaseChannel(
      normalizeReleaseChannel(settings.release_channel),
    ),
    automatic_update_checks_enabled: settings.automatic_update_checks_enabled ?? null,
    theme_mode: normalizeThemeMode(settings.theme_mode),
    color_theme: normalizeColorTheme(settings.color_theme),
    accent_color: normalizeAccentColor(settings.accent_color),
    ui_language: serializeUiLanguagePreference(settings.ui_language),
    date_display_format: normalizeDateDisplayFormat(settings.date_display_format),
    timezone: normalizeDisplayTimeZone(settings.timezone),
    note_width_mode: normalizeNoteWidthMode(settings.note_width_mode),
    sidebar_type_pluralization_enabled: settings.sidebar_type_pluralization_enabled ?? null,
    default_ai_agent: normalizeStoredAiAgent(settings.default_ai_agent),
    default_ai_target: settings.default_ai_target?.trim() || null,
    agent_memory_vault_path: settings.agent_memory_vault_path?.trim() || null,
    ai_model_providers: aiModelProviders.length > 0 ? aiModelProviders : null,
    ai_workspace_conversations: normalizeAiWorkspaceConversations(settings.ai_workspace_conversations),
    hide_gitignored_files: settings.hide_gitignored_files ?? null,
    block_secret_files: settings.block_secret_files ?? null,
    all_notes_show_pdfs: settings.all_notes_show_pdfs ?? null,
    all_notes_show_images: settings.all_notes_show_images ?? null,
    all_notes_show_unsupported: settings.all_notes_show_unsupported ?? null,
    multi_workspace_enabled: settings.multi_workspace_enabled ?? null,
    agent_profile: settings.agent_profile?.trim() || null,
    chat_engine: settings.chat_engine ?? null,
  })
}

function normalizeAiWorkspaceConversations(settings: Settings['ai_workspace_conversations']) {
  const conversations = (settings ?? []).map((conversation) => ({
    archived: conversation.archived === true,
    id: conversation.id.trim(),
    target_id: conversation.target_id?.trim() || null,
    title: conversation.title.trim(),
  })).filter((conversation) => conversation.id && conversation.title)

  return conversations.length > 0 ? conversations : null
}

function effectiveThemeMode(settings: Settings): ThemeMode {
  return normalizeThemeMode(settings.theme_mode) ?? DEFAULT_THEME_MODE
}

function effectiveColorTheme(settings: Settings): string {
  return normalizeColorTheme(settings.color_theme) ?? DEFAULT_COLOR_THEME
}

function effectiveAccentColor(settings: Settings): string {
  return normalizeAccentColor(settings.accent_color) ?? DEFAULT_ACCENT_COLOR
}

function loadErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  const located = text.match(/\bline (\d+) column (\d+)/i)
  if (located) return `parse error at line ${located[1]} column ${located[2]}`
  if (/parse|serde|json|expected/i.test(text)) return 'parse error'
  return 'load failed'
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const settingsRef = useRef(settings)
  const loadOkRef = useRef(false)
  const loadedRef = useRef(false)
  const loadEpoch = useRef(0)
  const retryInFlight = useRef(false)

  const loadSettings = useCallback(async (): Promise<Settings | null> => {
    const epoch = ++loadEpoch.current
    try {
      const raw = await tauriCall<Settings>('get_settings', {})
      if (epoch !== loadEpoch.current) {
        return loadOkRef.current ? settingsRef.current : null
      }
      const normalized = normalizeSettings(raw)
      settingsRef.current = normalized
      loadOkRef.current = true
      setLoadError(null)
      setSettings(normalized)
      if (removedHarnessSettingsNeedPersist(raw, normalized)) {
        if (epoch !== loadEpoch.current) return normalized
        try {
          await tauriCall<null>('save_settings', { settings: normalized })
        } catch (persistErr) {
          console.warn('Failed to persist harness migration:', persistErr)
        }
      }
      return normalized
    } catch (err) {
      const detail = loadErrorMessage(err)
      console.warn('Failed to load settings:', detail)
      if (epoch === loadEpoch.current) setLoadError(detail)
      return null
    } finally {
      loadedRef.current = true
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const retryFailedLoad = () => {
      if (loadOkRef.current || !loadedRef.current || retryInFlight.current) return
      retryInFlight.current = true
      void loadSettings().finally(() => {
        retryInFlight.current = false
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') retryFailedLoad()
    }
    window.addEventListener('focus', retryFailedLoad)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', retryFailedLoad)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadSettings])

  const writeSettings = useCallback(async (newSettings: Settings) => {
    loadEpoch.current += 1
    const previous = settingsRef.current
    const previousHideGitignored = shouldHideGitignoredFiles(previous)
    const previousThemeMode = effectiveThemeMode(previous)
    const previousColorTheme = effectiveColorTheme(previous)
    const previousAccentColor = effectiveAccentColor(previous)
    const normalizedSettings = normalizeSettings(newSettings)
    // Optimistic local state so theme/UI prefs flip immediately; disk write follows.
    settingsRef.current = normalizedSettings
    setSettings(normalizedSettings)
    try {
      await tauriCall<null>('save_settings', { settings: normalizedSettings })
      const nextThemeMode = effectiveThemeMode(normalizedSettings)
      if (previousThemeMode !== nextThemeMode) {
        trackThemeModeChanged(nextThemeMode)
      }
      const nextColorTheme = effectiveColorTheme(normalizedSettings)
      if (previousColorTheme !== nextColorTheme) {
        trackColorThemeChanged(nextColorTheme)
      }
      const nextAccentColor = effectiveAccentColor(normalizedSettings)
      if (previousAccentColor !== nextAccentColor) {
        trackAccentColorChanged(nextAccentColor)
      }
      const nextHideGitignored = shouldHideGitignoredFiles(normalizedSettings)
      if (previousHideGitignored !== nextHideGitignored) {
        notifyGitignoredVisibilityChanged(nextHideGitignored)
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
      settingsRef.current = previous
      setSettings(previous)
    }
  }, [])

  const saveSettings = useCallback(async (newSettings: Settings) => {
    if (!loadOkRef.current) {
      const disk = await loadSettings()
      if (!disk || !loadOkRef.current) {
        console.warn('[settings] Did not save settings. The settings file still failed to load.')
        return
      }
      // The caller built this object from the empty in-memory settings.
      // Writing it would replace the file with form defaults. Show disk instead.
      console.warn('[settings] Did not save settings. The file loaded on retry, so this change was dropped.')
      return
    }
    await writeSettings(newSettings)
  }, [loadSettings, writeSettings])

  const saveSettingsPatch = useCallback(async (patch: Partial<Settings>) => {
    if (!loadOkRef.current) {
      const disk = await loadSettings()
      if (!disk || !loadOkRef.current) {
        console.warn('[settings] Did not save settings. The settings file still failed to load.')
        return
      }
    }
    await writeSettings({ ...settingsRef.current, ...patch })
  }, [loadSettings, writeSettings])

  const saveNativeChatTarget = useCallback(async (target: string) => {
    await saveSettingsPatch({ native_chat_target: target })
  }, [saveSettingsPatch])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleToggleGitignoredVisibility = () => {
      void saveSettings({
        ...settings,
        hide_gitignored_files: !shouldHideGitignoredFiles(settings),
      })
    }

    window.addEventListener(TOGGLE_GITIGNORED_VISIBILITY_EVENT, handleToggleGitignoredVisibility)
    return () => {
      window.removeEventListener(TOGGLE_GITIGNORED_VISIBILITY_EVENT, handleToggleGitignoredVisibility)
    }
  }, [saveSettings, settings])

  return { settings, loaded, loadError, saveSettings, saveSettingsPatch, saveNativeChatTarget }
}
