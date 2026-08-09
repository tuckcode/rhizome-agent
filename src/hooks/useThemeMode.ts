import { useEffect } from 'react'
import {
  applyAppearanceToDocument,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_THEME,
  DEFAULT_THEME_MODE,
  normalizeAccentColor,
  normalizeColorTheme,
  readStoredAccentColor,
  readStoredColorTheme,
  readStoredThemeMode,
  SYSTEM_THEME_MEDIA_QUERY,
  writeStoredAccentColor,
  writeStoredColorTheme,
  writeStoredThemeMode,
  type AccentColor,
  type ThemeMode,
} from '../lib/themeMode'
import { syncAppIconThemeMode } from '../lib/appIconTheme'

function resolveRuntimeThemeMode(themeMode: ThemeMode | null | undefined): ThemeMode {
  if (themeMode) return themeMode
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  return readStoredThemeMode(window.localStorage) ?? DEFAULT_THEME_MODE
}

function resolveRuntimeColorTheme(colorTheme: string | null | undefined): string {
  const normalized = normalizeColorTheme(colorTheme)
  if (normalized) return normalized
  if (typeof window === 'undefined') return DEFAULT_COLOR_THEME
  return readStoredColorTheme(window.localStorage) ?? DEFAULT_COLOR_THEME
}

function resolveRuntimeAccentColor(accentColor: AccentColor | null | undefined): AccentColor {
  const normalized = normalizeAccentColor(accentColor)
  if (normalized) return normalized
  if (typeof window === 'undefined') return DEFAULT_ACCENT_COLOR
  return readStoredAccentColor(window.localStorage) ?? DEFAULT_ACCENT_COLOR
}

function currentMatchMedia(): Window['matchMedia'] | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : undefined
}

function writeAppearanceMirror(themeMode: ThemeMode, colorTheme: string, accentColor: AccentColor): void {
  if (typeof window === 'undefined') return
  writeStoredThemeMode(window.localStorage, themeMode)
  writeStoredColorTheme(window.localStorage, colorTheme)
  writeStoredAccentColor(window.localStorage, accentColor)
}

function applySelectedAppearance(themeMode: ThemeMode, colorTheme: string, accentColor: AccentColor): void {
  const resolvedMode = applyAppearanceToDocument(
    document,
    { mode: themeMode, colorTheme, accentColor },
    currentMatchMedia(),
  )
  writeAppearanceMirror(themeMode, colorTheme, accentColor)
  void syncAppIconThemeMode(resolvedMode)
}

function getSystemThemeMediaQueryList(): MediaQueryList | null {
  const matchMedia = currentMatchMedia()
  if (!matchMedia) return null

  try {
    return matchMedia(SYSTEM_THEME_MEDIA_QUERY)
  } catch {
    return null
  }
}

function subscribeSystemThemeChanges(
  mediaQueryList: MediaQueryList,
  colorTheme: string,
  accentColor: AccentColor,
): () => void {
  const handleSystemThemeChange = () => applySelectedAppearance('system', colorTheme, accentColor)

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handleSystemThemeChange)
    return () => mediaQueryList.removeEventListener('change', handleSystemThemeChange)
  }

  mediaQueryList.addListener(handleSystemThemeChange)
  return () => mediaQueryList.removeListener(handleSystemThemeChange)
}

/**
 * Applies the full appearance selection (light/dark/system mode, color
 * theme, accent) to the document. `colorTheme`/`accentColor` are optional —
 * omitting them (existing 2-arg call sites) behaves exactly as before this
 * was extended: the default `rhizome` theme, mode-toggle-driven.
 */
export function useThemeMode(
  themeMode: ThemeMode | null | undefined,
  loaded: boolean,
  colorTheme?: string | null,
  accentColor?: AccentColor | null,
): void {
  useEffect(() => {
    if (!loaded || typeof document === 'undefined') return

    const selectedMode = resolveRuntimeThemeMode(themeMode)
    const selectedColorTheme = resolveRuntimeColorTheme(colorTheme)
    const selectedAccentColor = resolveRuntimeAccentColor(accentColor)
    applySelectedAppearance(selectedMode, selectedColorTheme, selectedAccentColor)

    if (selectedMode !== 'system' || selectedColorTheme !== DEFAULT_COLOR_THEME) return
    const mediaQueryList = getSystemThemeMediaQueryList()
    return mediaQueryList
      ? subscribeSystemThemeChanges(mediaQueryList, selectedColorTheme, selectedAccentColor)
      : undefined
  }, [loaded, themeMode, colorTheme, accentColor])
}
