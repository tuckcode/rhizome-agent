import { useEffect } from 'react'
import {
  applyAppearanceToDocument,
  colorThemePolarity,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_THEME_MODE,
  normalizeAccentColor,
  normalizeColorTheme,
  readStoredAccentColor,
  readStoredColorTheme,
  readStoredThemeMode,
  resolveStoredColorTheme,
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

function resolveRuntimeColorTheme(
  colorTheme: string | null | undefined,
  themeMode: ThemeMode,
): { colorTheme: string; persistColor: boolean } {
  const fromSettings = normalizeColorTheme(colorTheme)
  if (fromSettings) return { colorTheme: fromSettings, persistColor: true }
  if (typeof window === 'undefined') {
    return { colorTheme: resolveStoredColorTheme(null, themeMode), persistColor: false }
  }
  const stored = readStoredColorTheme(window.localStorage)
  return {
    colorTheme: resolveStoredColorTheme(stored, themeMode, currentMatchMedia()),
    persistColor: stored !== null,
  }
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

function writeAppearanceMirror(
  themeMode: ThemeMode,
  colorTheme: string,
  accentColor: AccentColor,
  persistColor: boolean,
): void {
  if (typeof window === 'undefined') return
  writeStoredThemeMode(window.localStorage, themeMode)
  if (persistColor) writeStoredColorTheme(window.localStorage, colorTheme)
  writeStoredAccentColor(window.localStorage, accentColor)
}

function applySelectedAppearance(
  themeMode: ThemeMode,
  colorTheme: string,
  accentColor: AccentColor,
  persistColor: boolean,
): void {
  const resolvedMode = applyAppearanceToDocument(
    document,
    { mode: themeMode, colorTheme, accentColor },
    currentMatchMedia(),
  )
  writeAppearanceMirror(themeMode, colorTheme, accentColor, persistColor)
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
  persistColor: boolean,
): () => void {
  const handleSystemThemeChange = () => {
    const nextColor = persistColor
      ? colorTheme
      : resolveStoredColorTheme(null, 'system', currentMatchMedia())
    applySelectedAppearance('system', nextColor, accentColor, persistColor)
  }

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
 * omitting them infers from the saved mode (Graphite only when nothing is
 * saved; Light stays Earth; System follows the OS). Earth (`rhizome`) is
 * the only slug that follows Light/Dark/Match system.
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
    const resolvedColor = resolveRuntimeColorTheme(colorTheme, selectedMode)
    const selectedAccentColor = resolveRuntimeAccentColor(accentColor)
    applySelectedAppearance(
      selectedMode,
      resolvedColor.colorTheme,
      selectedAccentColor,
      resolvedColor.persistColor,
    )

    if (selectedMode !== 'system') return
    if (resolvedColor.persistColor && colorThemePolarity(resolvedColor.colorTheme) !== null) return
    const mediaQueryList = getSystemThemeMediaQueryList()
    return mediaQueryList
      ? subscribeSystemThemeChanges(
        mediaQueryList,
        resolvedColor.colorTheme,
        selectedAccentColor,
        resolvedColor.persistColor,
      )
      : undefined
  }, [loaded, themeMode, colorTheme, accentColor])
}
