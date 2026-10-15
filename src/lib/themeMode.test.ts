import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ACCENT_COLOR_STORAGE_KEY,
  applyAppearanceToDocument,
  applyStoredAppearance,
  applyStoredThemeMode,
  readStoredAppearance,
  resolveStoredColorTheme,
  applyThemeModeToDocument,
  buildStatusBarThemeTogglePatch,
  DEFAULT_THEME_MODE,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEMES,
  appearancePickerOptions,
  isAppearancePickerOptionSelected,
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
    expect(resolveThemeMode('sepia')).toBe('dark')
  })

  it('starts a fresh install in Graphite when nothing is saved', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark')
    const storage = makeStorage()
    expect(readStoredThemeMode(storage)).toBeNull()
    expect(readStoredAppearance(storage).mode).toBe('dark')
    expect(readStoredAppearance(storage).colorTheme).toBe('graphite')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(false))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
  })

  it('keeps saved Light as Earth light instead of switching to Graphite', () => {
    const storage = makeStorage({ [THEME_MODE_STORAGE_KEY]: 'light' })
    expect(readStoredThemeMode(storage)).toBe('light')
    expect(readStoredColorTheme(storage)).toBeNull()
    expect(readStoredAppearance(storage).colorTheme).toBe('rhizome')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(true))).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(storage.getItem(COLOR_THEME_STORAGE_KEY)).toBeNull()
  })

  it('lets saved System follow the OS: dark may resolve to Graphite, light stays Earth', () => {
    const storage = makeStorage({ [THEME_MODE_STORAGE_KEY]: 'system' })
    expect(readStoredAppearance(storage, makeMatchMedia(true)).colorTheme).toBe('graphite')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(true))).toBe('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).toHaveClass('dark')

    expect(readStoredAppearance(storage, makeMatchMedia(false)).colorTheme).toBe('rhizome')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(false))).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(storage.getItem(COLOR_THEME_STORAGE_KEY)).toBeNull()
  })

  it('keeps saved Earth dark instead of switching to Graphite', () => {
    const storage = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'dark',
      [COLOR_THEME_STORAGE_KEY]: 'rhizome',
    })
    expect(readStoredAppearance(storage).colorTheme).toBe('rhizome')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(false))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('infers Graphite for unsaved dark and only Earth for saved light', () => {
    expect(resolveStoredColorTheme(null, null)).toBe('graphite')
    expect(resolveStoredColorTheme(null, 'dark')).toBe('graphite')
    expect(resolveStoredColorTheme(null, 'system', makeMatchMedia(true))).toBe('graphite')
    expect(resolveStoredColorTheme(null, 'light')).toBe('rhizome')
    expect(resolveStoredColorTheme('rhizome', 'light')).toBe('rhizome')
  })

  it('keeps an explicit Earth light pick instead of switching to Graphite', () => {
    const storage = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'light',
      [COLOR_THEME_STORAGE_KEY]: 'rhizome',
    })
    expect(applyStoredAppearance(document, storage, makeMatchMedia(true))).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveClass('dark')
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

  it('the default Graphite theme pins dark and clears the color-theme attribute', () => {
    const resolved = applyAppearanceToDocument(
      document,
      { mode: 'light', colorTheme: 'graphite', accentColor: 'blue' },
      makeMatchMedia(false),
    )

    expect(resolved).toBe('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('keeps an explicit Earth pick instead of switching to Graphite', () => {
    const storage = makeStorage({ [COLOR_THEME_STORAGE_KEY]: 'rhizome', [THEME_MODE_STORAGE_KEY]: 'dark' })
    expect(readStoredAppearance(storage).colorTheme).toBe('rhizome')
    expect(applyStoredAppearance(document, storage, makeMatchMedia(false))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('Earth follows the mode toggle and sets data-color-theme=rhizome', () => {
    const resolved = applyAppearanceToDocument(
      document,
      { mode: 'system', colorTheme: 'rhizome', accentColor: 'blue' },
      makeMatchMedia(true),
    )

    expect(resolved).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('a non-default accent applies only on the default Graphite theme', () => {
    applyAppearanceToDocument(document, { mode: 'dark', colorTheme: 'graphite', accentColor: 'green' })
    expect(document.documentElement).toHaveAttribute('data-accent', 'green')

    applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'rhizome', accentColor: 'green' })
    expect(document.documentElement).not.toHaveAttribute('data-accent')

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

  it('keeps every picker slug in the Rust settings allow-list', () => {
    const settingsRs = readFileSync(join(process.cwd(), 'src-tauri/src/settings.rs'), 'utf8')
    const block = settingsRs.match(/const SUPPORTED_COLOR_THEMES: &\[&str\] = &\[([\s\S]*?)\];/)
    expect(block).not.toBeNull()
    const allowed = new Set([...(block?.[1].matchAll(/"([^"]+)"/g) ?? [])].map((match) => match[1]))
    for (const theme of COLOR_THEMES) {
      expect(allowed.has(theme.slug), theme.slug).toBe(true)
    }
  })

  it('registers Mycelium as a selectable dark skin', () => {
    expect(normalizeColorTheme('mycelium')).toBe('mycelium')
    expect(COLOR_THEMES.find((theme) => theme.slug === 'mycelium')).toEqual({
      slug: 'mycelium',
      name: 'Mycelium',
      polarity: 'dark',
      swatch: ['#10150E', '#0E120C', '#6FE3A0'],
    })
    expect(
      applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'mycelium', accentColor: 'blue' }),
    ).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'mycelium')
  })

  it('lists Graphite, Earth dark, Earth light, Loam, and Mycelium first in the picker', () => {
    expect(appearancePickerOptions().slice(0, 5).map((option) => option.name)).toEqual([
      'Graphite',
      'Earth dark',
      'Earth light',
      'Loam',
      'Mycelium',
    ])
    expect(isAppearancePickerOptionSelected(
      appearancePickerOptions()[0]!,
      'graphite',
      'dark',
    )).toBe(true)
    expect(isAppearancePickerOptionSelected(
      appearancePickerOptions()[1]!,
      'rhizome',
      'dark',
    )).toBe(true)
    expect(isAppearancePickerOptionSelected(
      appearancePickerOptions()[1]!,
      'graphite',
      'dark',
    )).toBe(false)
    expect(isAppearancePickerOptionSelected(appearancePickerOptions()[0]!, '', 'dark')).toBe(true)
    expect(isAppearancePickerOptionSelected(appearancePickerOptions()[2]!, '', 'light')).toBe(true)
  })

  it('registers Loam as an optional warm dark theme', () => {
    expect(normalizeColorTheme('loam')).toBe('loam')
    expect(COLOR_THEMES.find((theme) => theme.slug === 'loam')).toEqual({
      slug: 'loam',
      name: 'Loam',
      polarity: 'dark',
      swatch: ['#15110C', '#1D1811', '#6FE3A0'],
    })
    expect(
      applyAppearanceToDocument(document, { mode: 'light', colorTheme: 'loam', accentColor: 'blue' }),
    ).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'loam')
    expect(document.documentElement).toHaveClass('dark')
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

  it('applies the current theme, named theme, and accent together', () => {
    const storage = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'light',
      [COLOR_THEME_STORAGE_KEY]: 'nord',
      [ACCENT_COLOR_STORAGE_KEY]: 'green',
    })

    expect(readStoredAppearance(storage)).toEqual({
      mode: 'light',
      colorTheme: 'nord',
      accentColor: 'green',
    })
    expect(applyStoredAppearance(document, storage, makeMatchMedia(false))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'nord')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(document.documentElement).toHaveClass('dark')

    const graphite = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'dark',
      [ACCENT_COLOR_STORAGE_KEY]: 'green',
    })
    expect(applyStoredAppearance(document, graphite, makeMatchMedia(false))).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-accent', 'green')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('uses Graphite defaults when storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage

    expect(applyStoredAppearance(document, storage)).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
  })

  it('prefers current keys over legacy keys and ignores invalid values', () => {
    const conflicting = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'dark',
      [LEGACY_THEME_MODE_STORAGE_KEY]: 'light',
      [COLOR_THEME_STORAGE_KEY]: 'github-light',
      [LEGACY_COLOR_THEME_STORAGE_KEY]: 'dracula',
      [ACCENT_COLOR_STORAGE_KEY]: 'pink',
      [LEGACY_ACCENT_COLOR_STORAGE_KEY]: 'green',
    })

    expect(applyStoredAppearance(document, conflicting, makeMatchMedia(true))).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'github-light')
    expect(document.documentElement).not.toHaveAttribute('data-accent')

    const invalid = makeStorage({
      [THEME_MODE_STORAGE_KEY]: 'sepia',
      [LEGACY_THEME_MODE_STORAGE_KEY]: 'system',
      [COLOR_THEME_STORAGE_KEY]: 'nope',
      [ACCENT_COLOR_STORAGE_KEY]: 'nope',
    })
    expect(readStoredAppearance(invalid)).toEqual({
      mode: 'system',
      colorTheme: 'graphite',
      accentColor: 'blue',
    })
    expect(applyStoredAppearance(document, invalid, makeMatchMedia(true))).toBe('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
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

  it('status-bar toggle flips mode on Earth and leaves Graphite for Earth light', () => {
    expect(buildStatusBarThemeTogglePatch('light', 'rhizome')).toEqual({ theme_mode: 'dark' })
    expect(buildStatusBarThemeTogglePatch('dark', 'graphite')).toEqual({
      theme_mode: 'light',
      color_theme: 'rhizome',
      dark_partner: 'graphite',
    })
  })

  it('status-bar toggle remembers Graphite as the dark partner', () => {
    expect(buildStatusBarThemeTogglePatch('dark', 'graphite')).toEqual({
      theme_mode: 'light',
      color_theme: 'rhizome',
      dark_partner: 'graphite',
    })
    expect(buildStatusBarThemeTogglePatch('light', 'rhizome', 'graphite')).toEqual({
      theme_mode: 'dark',
      color_theme: 'graphite',
      dark_partner: null,
    })
  })

  it('status-bar toggle leaves a pinned color theme so mode can change', () => {
    expect(buildStatusBarThemeTogglePatch('dark', 'dracula')).toEqual({
      theme_mode: 'light',
      color_theme: 'rhizome',
      dark_partner: 'dracula',
    })
    expect(buildStatusBarThemeTogglePatch('light', 'github-light')).toEqual({
      theme_mode: 'dark',
      color_theme: 'rhizome',
      dark_partner: null,
    })
  })

  it('shows community theme names in sentence case', () => {
    expect(COLOR_THEMES.find((theme) => theme.slug === 'gruvbox-dark')?.name).toBe('Gruvbox dark')
    expect(COLOR_THEMES.find((theme) => theme.slug === 'github-light')?.name).toBe('GitHub light')
    expect(COLOR_THEMES.find((theme) => theme.slug === 'tokyo-night')?.name).toBe('Tokyo night')
    expect(appearancePickerOptions().map((option) => option.name).join(' ')).not.toMatch(/\sDark\b|\sLight\b|\sNight\b/)
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
