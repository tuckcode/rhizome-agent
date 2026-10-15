import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS } from '../constants/appStorage'

export const THEME_MODE_STORAGE_KEY = APP_STORAGE_KEYS.theme
export const LEGACY_THEME_MODE_STORAGE_KEY = LEGACY_APP_STORAGE_KEYS.theme
export const DEFAULT_THEME_MODE = 'dark'
export const SYSTEM_THEME_MODE = 'system'
export const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const RESOLVED_THEME_MODES = new Set(['light', 'dark'])
const THEME_MODES = new Set([...RESOLVED_THEME_MODES, SYSTEM_THEME_MODE])

export type ResolvedThemeMode = 'light' | 'dark'
export type ThemeMode = ResolvedThemeMode | typeof SYSTEM_THEME_MODE

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>
type ThemeDocument = Pick<Document, 'documentElement'>
type ThemeMatchMedia = Window['matchMedia']

export function normalizeThemeMode(value: unknown): ThemeMode | null {
  return typeof value === 'string' && THEME_MODES.has(value) ? value as ThemeMode : null
}

export function normalizeResolvedThemeMode(value: unknown): ResolvedThemeMode | null {
  const mode = normalizeThemeMode(value)
  return mode === 'light' || mode === 'dark' ? mode : null
}

function resolveMatchMedia(matchMedia?: ThemeMatchMedia): ThemeMatchMedia | null {
  if (matchMedia) return matchMedia
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia.bind(window)
}

export function resolveSystemThemeMode(matchMedia?: ThemeMatchMedia): ResolvedThemeMode {
  const resolvedMatchMedia = resolveMatchMedia(matchMedia)
  if (!resolvedMatchMedia) return DEFAULT_THEME_MODE

  try {
    return resolvedMatchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export function resolveThemeMode(value: unknown, matchMedia?: ThemeMatchMedia): ResolvedThemeMode {
  const mode = normalizeThemeMode(value)
  if (mode === SYSTEM_THEME_MODE) return resolveSystemThemeMode(matchMedia)
  return mode ?? DEFAULT_THEME_MODE
}

function safeGetThemeMode(storage: ThemeStorage, key: string): ThemeMode | null {
  try {
    return normalizeThemeMode(storage.getItem(key))
  } catch {
    return null
  }
}

function safeSetThemeMode(storage: ThemeStorage, key: string, mode: ThemeMode): void {
  try {
    storage.setItem(key, mode)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readStoredThemeMode(storage: ThemeStorage): ThemeMode | null {
  const storedMode = safeGetThemeMode(storage, THEME_MODE_STORAGE_KEY)
  if (storedMode) return storedMode

  const legacyMode = safeGetThemeMode(storage, LEGACY_THEME_MODE_STORAGE_KEY)
  if (!legacyMode) return null

  safeSetThemeMode(storage, THEME_MODE_STORAGE_KEY, legacyMode)
  return legacyMode
}

export function writeStoredThemeMode(storage: ThemeStorage, mode: ThemeMode): void {
  safeSetThemeMode(storage, THEME_MODE_STORAGE_KEY, mode)
}

export function applyThemeModeToDocument(documentObject: ThemeDocument, mode: ResolvedThemeMode): void {
  const root = documentObject.documentElement
  root.setAttribute('data-theme', mode)
  root.classList.toggle('dark', mode === 'dark')
}

export function applyThemeSelectionToDocument(
  documentObject: ThemeDocument,
  mode: ThemeMode,
  matchMedia?: ThemeMatchMedia,
): ResolvedThemeMode {
  const resolvedMode = resolveThemeMode(mode, matchMedia)
  applyThemeModeToDocument(documentObject, resolvedMode)
  return resolvedMode
}

export function applyStoredThemeMode(
  documentObject: ThemeDocument,
  storage: ThemeStorage,
  matchMedia?: ThemeMatchMedia,
): ResolvedThemeMode {
  const mode = readStoredThemeMode(storage) ?? DEFAULT_THEME_MODE
  return applyThemeSelectionToDocument(documentObject, mode, matchMedia)
}

/**
 * Color skin when the user never stored one.
 * No saved color → Graphite in dark (fresh install and existing dark-mode
 * users who never picked a skin). Saved light → Earth. Saved system follows
 * the OS (dark may resolve to Graphite; light stays Earth light). An explicit
 * stored slug always wins. Does not write the inferred slug.
 */
export function resolveStoredColorTheme(
  storedColor: string | null,
  storedMode: ThemeMode | null,
  matchMedia?: ThemeMatchMedia,
): string {
  if (storedColor) return storedColor
  if (storedMode === 'light') return DUAL_MODE_COLOR_THEME
  if (storedMode === 'system') {
    return resolveSystemThemeMode(matchMedia) === 'light' ? DUAL_MODE_COLOR_THEME : DEFAULT_COLOR_THEME
  }
  return DEFAULT_COLOR_THEME
}

export function readStoredAppearance(
  storage: ThemeStorage,
  matchMedia?: ThemeMatchMedia,
): AppearanceSelection {
  const storedMode = readStoredThemeMode(storage)
  return {
    mode: storedMode ?? DEFAULT_THEME_MODE,
    colorTheme: resolveStoredColorTheme(readStoredColorTheme(storage), storedMode, matchMedia),
    accentColor: readStoredAccentColor(storage) ?? DEFAULT_ACCENT_COLOR,
  }
}

// ── Color themes and accent ──────────────────────────────────────────────────
// The default `graphite` theme is the warm-neutral overlay in index.css
// (`:root.dark:not([data-color-theme])`) on the shared Earth dark base.
// Earth lives on slug `rhizome`: light is the default light contract, dark
// is `:root.dark[data-color-theme="rhizome"]`. No saved color starts in
// Graphite (fresh install and unsaved dark). Saved Light stays Earth light.
// Saved System follows the OS. A stored `rhizome` / Loam / Mycelium /
// community slug is kept. Loam and Mycelium are optional dark skins. Other
// fixed themes (from the brand handoff) are single-polarity skins in
// themes.css; picking one pins the resolved mode to its polarity. The
// accent swap only applies on the default theme — fixed themes own their
// accent. Earth still follows the Light/Dark/Match system toggle.

export const COLOR_THEME_STORAGE_KEY = 'rhizome-color-theme'
export const DARK_PARTNER_STORAGE_KEY = 'rhizome-dark-partner'
export const ACCENT_COLOR_STORAGE_KEY = 'rhizome-accent'
/** Prior generation ("tolaria", the pre-rename product name). See ADR-0162. */
export const LEGACY_COLOR_THEME_STORAGE_KEY = 'tolaria-color-theme'
export const LEGACY_ACCENT_COLOR_STORAGE_KEY = 'tolaria-accent'
export const DEFAULT_COLOR_THEME = 'graphite'
/** Earth light/dark — the only slug that follows the mode toggle. */
export const DUAL_MODE_COLOR_THEME = 'rhizome'
export const DEFAULT_ACCENT_COLOR = 'blue'

export interface ColorThemeDefinition {
  slug: string
  /** Display name (brand handoff naming — not localized, these are proper nouns). */
  name: string
  /** null → follows the Light/Dark/System mode toggle. */
  polarity: ResolvedThemeMode | null
  /** Picker chip swatch: [panel, bg, accent]. */
  swatch: [string, string, string]
}

export const COLOR_THEMES: readonly ColorThemeDefinition[] = [
  { slug: 'graphite', name: 'Graphite', polarity: 'dark', swatch: ['#171614', '#131210', '#76EAA7'] },
  { slug: 'rhizome', name: 'Earth', polarity: null, swatch: ['#ECE6DA', '#F1ECE2', '#2C6A4D'] },
  { slug: 'loam', name: 'Loam', polarity: 'dark', swatch: ['#15110C', '#1D1811', '#6FE3A0'] },
  { slug: 'mycelium', name: 'Mycelium', polarity: 'dark', swatch: ['#10150E', '#0E120C', '#6FE3A0'] },
  { slug: 'dracula', name: 'Dracula', polarity: 'dark', swatch: ['#21222C', '#282A36', '#BD93F9'] },
  { slug: 'nord', name: 'Nord', polarity: 'dark', swatch: ['#3B4252', '#2E3440', '#88C0D0'] },
  { slug: 'gruvbox-dark', name: 'Gruvbox dark', polarity: 'dark', swatch: ['#32302F', '#282828', '#FE8019'] },
  { slug: 'gruvbox-light', name: 'Gruvbox light', polarity: 'light', swatch: ['#F2E5BC', '#FBF1C7', '#D65D0E'] },
  { slug: 'solarized-light', name: 'Solarized light', polarity: 'light', swatch: ['#EEE8D5', '#FDF6E3', '#268BD2'] },
  { slug: 'solarized-dark', name: 'Solarized dark', polarity: 'dark', swatch: ['#073642', '#002B36', '#268BD2'] },
  { slug: 'catppuccin-mocha', name: 'Catppuccin mocha', polarity: 'dark', swatch: ['#181825', '#1E1E2E', '#CBA6F7'] },
  { slug: 'catppuccin-latte', name: 'Catppuccin latte', polarity: 'light', swatch: ['#E6E9EF', '#EFF1F5', '#8839EF'] },
  { slug: 'tokyo-night', name: 'Tokyo night', polarity: 'dark', swatch: ['#16161E', '#1A1B26', '#7AA2F7'] },
  { slug: 'one-dark', name: 'One dark', polarity: 'dark', swatch: ['#21252B', '#282C34', '#61AFEF'] },
  { slug: 'rose-pine', name: 'Rosé pine', polarity: 'dark', swatch: ['#1F1D2E', '#191724', '#C4A7E7'] },
  { slug: 'github-light', name: 'GitHub light', polarity: 'light', swatch: ['#F6F8FA', '#FFFFFF', '#0969DA'] },
  { slug: 'everforest', name: 'Everforest', polarity: 'dark', swatch: ['#232A2E', '#2D353B', '#A7C080'] },
  { slug: 'monokai-pro', name: 'Monokai pro', polarity: 'dark', swatch: ['#221F22', '#2D2A2E', '#FFD866'] },
] as const

// Matches AccentColorPicker / ACCENT_COLOR_PICKER_KEYS in utils/typeColors.ts
// exactly — reusing that existing swatch picker per AGENTS.md.
export const ACCENT_COLOR_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'] as const
export type AccentColor = (typeof ACCENT_COLOR_KEYS)[number]

const COLOR_THEME_SLUGS = new Set(COLOR_THEMES.map((theme) => theme.slug))
const ACCENT_COLOR_SET = new Set<string>(ACCENT_COLOR_KEYS)

export function normalizeColorTheme(value: unknown): string | null {
  return typeof value === 'string' && COLOR_THEME_SLUGS.has(value) ? value : null
}

export function normalizeAccentColor(value: unknown): AccentColor | null {
  return typeof value === 'string' && ACCENT_COLOR_SET.has(value) ? (value as AccentColor) : null
}

export function colorThemePolarity(theme: string): ResolvedThemeMode | null {
  return COLOR_THEMES.find((candidate) => candidate.slug === theme)?.polarity ?? null
}

function safeGetItem(storage: ThemeStorage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(storage: ThemeStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readStoredColorTheme(storage: ThemeStorage): string | null {
  const stored = normalizeColorTheme(safeGetItem(storage, COLOR_THEME_STORAGE_KEY))
  if (stored) return stored

  const legacy = normalizeColorTheme(safeGetItem(storage, LEGACY_COLOR_THEME_STORAGE_KEY))
  if (!legacy) return null

  safeSetItem(storage, COLOR_THEME_STORAGE_KEY, legacy)
  return legacy
}

export function writeStoredColorTheme(storage: ThemeStorage, theme: string): void {
  safeSetItem(storage, COLOR_THEME_STORAGE_KEY, theme)
}

export function readStoredAccentColor(storage: ThemeStorage): AccentColor | null {
  const stored = normalizeAccentColor(safeGetItem(storage, ACCENT_COLOR_STORAGE_KEY))
  if (stored) return stored

  const legacy = normalizeAccentColor(safeGetItem(storage, LEGACY_ACCENT_COLOR_STORAGE_KEY))
  if (!legacy) return null

  safeSetItem(storage, ACCENT_COLOR_STORAGE_KEY, legacy)
  return legacy
}

export function writeStoredAccentColor(storage: ThemeStorage, accent: AccentColor): void {
  safeSetItem(storage, ACCENT_COLOR_STORAGE_KEY, accent)
}

export interface AppearanceSelection {
  mode: ThemeMode
  colorTheme: string
  accentColor: AccentColor
}

/**
 * Apply the full appearance selection: color theme attribute, accent
 * attribute (default theme only), and the resolved light/dark mode — pinned
 * to the theme's polarity for fixed themes, mode-toggle-driven for Earth.
 * Returns the resolved mode.
 */
export function applyAppearanceToDocument(
  documentObject: ThemeDocument,
  selection: AppearanceSelection,
  matchMedia?: ThemeMatchMedia,
): ResolvedThemeMode {
  const root = documentObject.documentElement
  const colorTheme = normalizeColorTheme(selection.colorTheme) ?? DEFAULT_COLOR_THEME
  const accent = normalizeAccentColor(selection.accentColor) ?? DEFAULT_ACCENT_COLOR

  if (colorTheme === DEFAULT_COLOR_THEME) {
    root.removeAttribute('data-color-theme')
  } else {
    root.setAttribute('data-color-theme', colorTheme)
  }

  if (colorTheme === DEFAULT_COLOR_THEME && accent !== DEFAULT_ACCENT_COLOR) {
    root.setAttribute('data-accent', accent)
  } else {
    root.removeAttribute('data-accent')
  }

  const resolvedMode = colorThemePolarity(colorTheme) ?? resolveThemeMode(selection.mode, matchMedia)
  applyThemeModeToDocument(documentObject, resolvedMode)
  return resolvedMode
}

/** First React paint. Same key order as the HTML bootstrap in index.html. */
export function applyStoredAppearance(
  documentObject: ThemeDocument,
  storage: ThemeStorage,
  matchMedia?: ThemeMatchMedia,
): ResolvedThemeMode {
  return applyAppearanceToDocument(documentObject, readStoredAppearance(storage, matchMedia), matchMedia)
}

/**
 * Next appearance patch for the status-bar light/dark toggle.
 * Fixed color themes pin polarity, so a bare theme_mode flip is a no-op —
 * leave the pinned skin for Earth so the mode change takes effect.
 * Graphite (and other dark-pinned skins) remember themselves as the dark
 * partner so the next press returns there instead of Earth dark.
 */
export function buildStatusBarThemeTogglePatch(
  documentThemeMode: ResolvedThemeMode,
  colorTheme: string | null | undefined,
  darkPartner?: string | null,
): { theme_mode: ResolvedThemeMode; color_theme?: string; dark_partner?: string | null } {
  const selectedColorTheme = normalizeColorTheme(colorTheme) ?? DEFAULT_COLOR_THEME
  if (documentThemeMode === 'dark') {
    if (colorThemePolarity(selectedColorTheme) === 'dark') {
      return { theme_mode: 'light', color_theme: DUAL_MODE_COLOR_THEME, dark_partner: selectedColorTheme }
    }
    return { theme_mode: 'light', dark_partner: null }
  }
  const partner = normalizeColorTheme(darkPartner)
  if (partner && colorThemePolarity(partner) === 'dark') {
    return { theme_mode: 'dark', color_theme: partner, dark_partner: null }
  }
  if (colorThemePolarity(selectedColorTheme)) {
    return { theme_mode: 'dark', color_theme: DUAL_MODE_COLOR_THEME, dark_partner: null }
  }
  return { theme_mode: 'dark' }
}

export interface AppearancePickerOption {
  id: string
  name: string
  colorTheme: string
  mode?: ResolvedThemeMode
  swatch: [string, string, string]
}

const EARTH_DARK_SWATCH: [string, string, string] = ['#121410', '#0F110C', '#7DF0AE']
const EARTH_LIGHT_SWATCH: [string, string, string] = ['#ECE6DA', '#F1ECE2', '#2C6A4D']

/** Product chips first (Graphite, Earth dark, Earth light, Loam, Mycelium), then community skins. */
export function appearancePickerOptions(): AppearancePickerOption[] {
  const bySlug = new Map(COLOR_THEMES.map((theme) => [theme.slug, theme]))
  const product: AppearancePickerOption[] = [
    { id: 'graphite', name: 'Graphite', colorTheme: 'graphite', swatch: bySlug.get('graphite')!.swatch },
    { id: 'earth-dark', name: 'Earth dark', colorTheme: DUAL_MODE_COLOR_THEME, mode: 'dark', swatch: EARTH_DARK_SWATCH },
    { id: 'earth-light', name: 'Earth light', colorTheme: DUAL_MODE_COLOR_THEME, mode: 'light', swatch: EARTH_LIGHT_SWATCH },
    { id: 'loam', name: 'Loam', colorTheme: 'loam', swatch: bySlug.get('loam')!.swatch },
    { id: 'mycelium', name: 'Mycelium', colorTheme: 'mycelium', swatch: bySlug.get('mycelium')!.swatch },
  ]
  const productThemes = new Set(product.map((option) => option.colorTheme))
  const rest = COLOR_THEMES.filter((theme) => !productThemes.has(theme.slug)).map((theme) => ({
    id: theme.slug,
    name: theme.name,
    colorTheme: theme.slug,
    swatch: theme.swatch,
  }))
  return [...product, ...rest]
}

export function isAppearancePickerOptionSelected(
  option: AppearancePickerOption,
  colorTheme: string,
  resolvedMode: ResolvedThemeMode,
): boolean {
  if (!colorTheme) {
    if (resolvedMode === 'dark') return option.id === 'graphite'
    if (resolvedMode === 'light') return option.id === 'earth-light'
    return false
  }
  if (option.colorTheme !== colorTheme) return false
  if (!option.mode) return true
  return resolvedMode === option.mode
}
