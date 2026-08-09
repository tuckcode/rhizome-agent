import { describe, expect, it, vi } from 'vitest'
import {
  ACCENT_COLOR_STORAGE_KEY,
  applyAppearanceToDocument,
  applyStoredThemeMode,
  applyThemeModeToDocument,
  buildStatusBarThemeTogglePatch,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEMES,
  LEGACY_ACCENT_COLOR_STORAGE_KEY,
  LEGACY_COLOR_THEME_STORAGE_KEY,
  LEGACY_THEME_MODE_STORAGE_KEY,
  normalizeAccentColor,
  normalizeColorTheme,
  normalizeThemeMode,
  readStoredAccentColor,
  readStoredColorTheme,
  readStoredThemeMode,
  resolveThemeMode,
  THEME_MODE_STORAGE_KEY,
  writeStoredAccentColor,
  writeStoredColorTheme,
  writeStoredThemeMode,
} from './themeMode'

function makeStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
}

describe('themeMode', () => {
  it('normalizes only supported theme modes', () => {
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('system')).toBe('system')
    expect(resolveThemeMode('system', makeMatchMedia(true))).toBe('dark')
    expect(resolveThemeMode('system', makeMatchMedia(false))).toBe('light')
    expect(resolveThemeMode('sepia')).toBe('light')
  })

  it('reads and writes the current storage key', () => {
    const storage = makeStorage()

    writeStoredThemeMode(storage, 'system')

    expect(readStoredThemeMode(storage)).toBe('system')
    expect(storage.setItem).toHaveBeenCalledWith(THEME_MODE_STORAGE_KEY, 'system')
  })

  it('migrates the legacy storage key', () => {
    const storage = makeStorage({ [LEGACY_THEME_MODE_STORAGE_KEY]: 'dark' })

    expect(readStoredThemeMode(storage)).toBe('dark')
    expect(storage.setItem).toHaveBeenCalledWith(THEME_MODE_STORAGE_KEY, 'dark')
  })

  it('applies theme attributes and shadcn dark class', () => {
    applyThemeModeToDocument(document, 'dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')

    applyThemeModeToDocument(document, 'light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('bootstraps stored theme mode onto the document', () => {
    const storage = makeStorage({ [THEME_MODE_STORAGE_KEY]: 'dark' })

    expect(applyStoredThemeMode(document, storage)).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('bootstraps system mode to the current OS appearance without storing system in data-theme', () => {
    const storage = makeStorage({ [THEME_MODE_STORAGE_KEY]: 'system' })

    expect(applyStoredThemeMode(document, storage, makeMatchMedia(true))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
  })
})

describe('color themes and accent', () => {
  it('normalizes only known theme slugs and accent keys', () => {
    expect(normalizeColorTheme('rhizome')).toBe('rhizome')
    expect(normalizeColorTheme('tokyo-night')).toBe('tokyo-night')
    expect(normalizeColorTheme('Tokyo Night')).toBeNull()
    expect(normalizeColorTheme('hotdog-stand')).toBeNull()
    expect(normalizeAccentColor('green')).toBe('green')
    expect(normalizeAccentColor('magenta')).toBeNull()
  })

  it('the rhizome theme follows the mode toggle and clears theme/accent-default attributes', () => {
    const resolved = applyAppearanceToDocument(
      document,
      { mode: 'system', colorTheme: 'rhizome', accentColor: 'blue' },
      makeMatchMedia(true),
    )

    expect(resolved).toBe('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('a non-default accent applies only on the rhizome theme', () => {
    applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'rhizome', accentColor: 'green' })
    expect(document.documentElement).toHaveAttribute('data-accent', 'green')

    applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'dracula', accentColor: 'green' })
    expect(document.documentElement).not.toHaveAttribute('data-accent')
  })

  it('a fixed theme pins the resolved mode to its polarity regardless of the mode toggle', () => {
    // Dracula is dark even when the toggle says light.
    expect(
      applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'dracula', accentColor: 'blue' }),
    ).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'dracula')
    expect(document.documentElement).toHaveClass('dark')

    // GitHub Light is light even when the system resolves dark.
    expect(
      applyAppearanceToDocument(
        document,
        { mode: 'system', colorTheme: 'github-light', accentColor: 'blue' },
        makeMatchMedia(true),
      ),
    ).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'github-light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('every fixed theme declares a polarity and rhizome declares none', () => {
    for (const theme of COLOR_THEMES) {
      if (theme.slug === 'rhizome') {
        expect(theme.polarity).toBeNull()
      } else {
        expect(theme.polarity === 'light' || theme.polarity === 'dark').toBe(true)
      }
    }
  })

  it('round-trips stored color theme and accent, rejecting junk', () => {
    const storage = makeStorage({ [COLOR_THEME_STORAGE_KEY]: 'nord', [ACCENT_COLOR_STORAGE_KEY]: 'pink' })
    expect(readStoredColorTheme(storage)).toBe('nord')
    expect(readStoredAccentColor(storage)).toBe('pink')

    const junk = makeStorage({ [COLOR_THEME_STORAGE_KEY]: 'x', [ACCENT_COLOR_STORAGE_KEY]: 'y' })
    expect(readStoredColorTheme(junk)).toBeNull()
    expect(readStoredAccentColor(junk)).toBeNull()

    writeStoredColorTheme(storage, 'everforest')
    writeStoredAccentColor(storage, 'gray')
    expect(readStoredColorTheme(storage)).toBe('everforest')
    expect(readStoredAccentColor(storage)).toBe('gray')
  })

  it('reads the legacy color-theme/accent keys as a fallback when the current keys are absent', () => {
    const storage = makeStorage({
      [LEGACY_COLOR_THEME_STORAGE_KEY]: 'dracula',
      [LEGACY_ACCENT_COLOR_STORAGE_KEY]: 'purple',
    })

    expect(readStoredColorTheme(storage)).toBe('dracula')
    expect(readStoredAccentColor(storage)).toBe('purple')
    // The legacy value is copied forward onto the current key going forward.
    expect(storage.setItem).toHaveBeenCalledWith(COLOR_THEME_STORAGE_KEY, 'dracula')
    expect(storage.setItem).toHaveBeenCalledWith(ACCENT_COLOR_STORAGE_KEY, 'purple')
  })

  it('prefers the current color-theme/accent keys over the legacy keys when both are present', () => {
    const storage = makeStorage({
      [COLOR_THEME_STORAGE_KEY]: 'nord',
      [LEGACY_COLOR_THEME_STORAGE_KEY]: 'dracula',
      [ACCENT_COLOR_STORAGE_KEY]: 'green',
      [LEGACY_ACCENT_COLOR_STORAGE_KEY]: 'purple',
    })

    expect(readStoredColorTheme(storage)).toBe('nord')
    expect(readStoredAccentColor(storage)).toBe('green')
  })

  it('status-bar toggle flips mode on the default Rhizome theme', () => {
    expect(buildStatusBarThemeTogglePatch('light', 'rhizome')).toEqual({ theme_mode: 'dark' })
    expect(buildStatusBarThemeTogglePatch('dark', null)).toEqual({ theme_mode: 'light' })
  })

  it('status-bar toggle leaves a pinned color theme so mode can change', () => {
    expect(buildStatusBarThemeTogglePatch('dark', 'dracula')).toEqual({
      theme_mode: 'light',
      color_theme: 'rhizome',
    })
    expect(buildStatusBarThemeTogglePatch('light', 'github-light')).toEqual({
      theme_mode: 'dark',
      color_theme: 'rhizome',
    })
  })
})

function makeMatchMedia(matches: boolean): Window['matchMedia'] {
  return ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })) as Window['matchMedia']
}
