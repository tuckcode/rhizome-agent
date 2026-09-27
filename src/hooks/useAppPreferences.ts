import { createContext, createElement, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { Settings } from '../types'
import {
  applyAppearanceToDocument,
  buildStatusBarThemeTogglePatch,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_THEME,
  normalizeAccentColor,
  normalizeColorTheme,
  writeStoredAccentColor,
  writeStoredColorTheme,
  writeStoredThemeMode,
  type ThemeMode,
} from '../lib/themeMode'
import {
  SYSTEM_UI_LANGUAGE,
  getBrowserLanguagePreferences,
  resolveEffectiveLocale,
  serializeUiLanguagePreference,
  type UiLanguagePreference,
} from '../lib/i18n'
import {
  bindDisplayTimeZone,
  DEFAULT_DATE_DISPLAY_FORMAT,
  normalizeDateDisplayFormat,
  normalizeDisplayTimeZone,
  type DateDisplayFormat,
} from '../utils/dateDisplay'
import { resolveAllNotesFileVisibility } from '../utils/allNotesFileVisibility'
import { syncAppIconThemeMode } from '../lib/appIconTheme'
import { useAiAgentPreferences } from './useAiAgentPreferences'
import type { AiAgentsStatus } from '../lib/aiAgents'
import { useDocumentThemeMode } from './useDocumentThemeMode'
import { useTelemetry } from './useTelemetry'
import { useThemeMode } from './useThemeMode'

interface AppPreferencesConfig {
  aiAgentsStatus: AiAgentsStatus
  onToast: (message: string | null) => void
  saveSettings: (settings: Settings) => void | Promise<void>
  settings: Settings
  settingsLoaded: boolean
}

interface AppPreferenceValues {
  dateDisplayFormat: DateDisplayFormat
  displayTimeZone: string | null
}

const DEFAULT_APP_PREFERENCES: AppPreferenceValues = {
  dateDisplayFormat: DEFAULT_DATE_DISPLAY_FORMAT,
  displayTimeZone: null,
}

const AppPreferencesContext = createContext<AppPreferenceValues>(DEFAULT_APP_PREFERENCES)

export function AppPreferencesProvider({
  children,
  dateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  displayTimeZone = null,
}: {
  children: ReactNode
  dateDisplayFormat?: DateDisplayFormat
  displayTimeZone?: string | null
}) {
  const zone = normalizeDisplayTimeZone(displayTimeZone)
  bindDisplayTimeZone(zone)
  useEffect(() => () => bindDisplayTimeZone(null), [])
  const value = useMemo(
    () => ({ dateDisplayFormat, displayTimeZone: zone }),
    [dateDisplayFormat, zone],
  )
  return createElement(AppPreferencesContext.Provider, { value }, children)
}

export function useDateDisplayFormat(): DateDisplayFormat {
  return useContext(AppPreferencesContext).dateDisplayFormat
}

export function useDisplayTimeZone(): string | null {
  return useContext(AppPreferencesContext).displayTimeZone
}

export function useAppPreferences({
  aiAgentsStatus,
  onToast,
  saveSettings,
  settings,
  settingsLoaded,
}: AppPreferencesConfig) {
  const systemLocale = useMemo(
    () => resolveEffectiveLocale(SYSTEM_UI_LANGUAGE, getBrowserLanguagePreferences()),
    [],
  )
  const appLocale = useMemo(
    () => resolveEffectiveLocale(settings.ui_language, [systemLocale]),
    [settings.ui_language, systemLocale],
  )
  const dateDisplayFormat = useMemo(
    () => normalizeDateDisplayFormat(settings.date_display_format) ?? DEFAULT_DATE_DISPLAY_FORMAT,
    [settings.date_display_format],
  )
  const displayTimeZone = useMemo(
    () => normalizeDisplayTimeZone(settings.timezone),
    [settings.timezone],
  )
  bindDisplayTimeZone(displayTimeZone)
  const allNotesFileVisibility = useMemo(
    () => resolveAllNotesFileVisibility(settings),
    [settings],
  )
  const selectedUiLanguage: UiLanguagePreference = settings.ui_language ?? SYSTEM_UI_LANGUAGE

  useEffect(() => {
    document.documentElement.lang = appLocale
  }, [appLocale])

  useThemeMode(settings.theme_mode, settingsLoaded, settings.color_theme, settings.accent_color)
  const documentThemeMode = useDocumentThemeMode()

  // Apply immediately (Settings does this). Waiting only on save_settings left the
  // status-bar toggle looking dead when persist lagged or failed.
  const applyAppearanceNow = useCallback((mode: ThemeMode, colorTheme: string | null | undefined, accentColor: Settings['accent_color']) => {
    if (typeof document === 'undefined') return
    const selectedColorTheme = normalizeColorTheme(colorTheme) ?? DEFAULT_COLOR_THEME
    const selectedAccent = normalizeAccentColor(accentColor) ?? DEFAULT_ACCENT_COLOR
    const matchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : undefined
    const resolved = applyAppearanceToDocument(
      document,
      { mode, colorTheme: selectedColorTheme, accentColor: selectedAccent },
      matchMedia,
    )
    if (typeof window !== 'undefined') {
      writeStoredThemeMode(window.localStorage, mode)
      writeStoredColorTheme(window.localStorage, selectedColorTheme)
      writeStoredAccentColor(window.localStorage, selectedAccent)
    }
    void syncAppIconThemeMode(resolved)
  }, [])

  const handleToggleThemeMode = useCallback(() => {
    const patch = buildStatusBarThemeTogglePatch(documentThemeMode, settings.color_theme)
    const nextSettings = { ...settings, ...patch }
    applyAppearanceNow(
      patch.theme_mode,
      patch.color_theme ?? settings.color_theme,
      settings.accent_color,
    )
    void saveSettings(nextSettings)
  }, [applyAppearanceNow, documentThemeMode, saveSettings, settings])
  const handleSetThemeMode = useCallback((theme_mode: ThemeMode) => {
    if (!settingsLoaded) return
    applyAppearanceNow(theme_mode, settings.color_theme, settings.accent_color)
    void saveSettings({ ...settings, theme_mode })
  }, [applyAppearanceNow, saveSettings, settings, settingsLoaded])
  const handleSetUiLanguage = useCallback((uiLanguage: UiLanguagePreference) => {
    void saveSettings({ ...settings, ui_language: serializeUiLanguagePreference(uiLanguage) })
  }, [saveSettings, settings])
  const aiAgentPreferences = useAiAgentPreferences({
    settings,
    settingsLoaded,
    saveSettings,
    aiAgentsStatus,
    onToast,
  })

  useTelemetry(settings, settingsLoaded)

  return {
    aiAgentPreferences,
    allNotesFileVisibility,
    appLocale,
    dateDisplayFormat,
    displayTimeZone,
    documentThemeMode,
    handleSetThemeMode,
    handleSetUiLanguage,
    handleToggleThemeMode,
    selectedUiLanguage,
    systemLocale,
  }
}
