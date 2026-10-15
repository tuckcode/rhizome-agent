import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

function bootAppearanceScript(): string {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  const marker = '/* rhizome-boot-appearance */'
  const markerAt = html.indexOf(marker)
  const start = html.lastIndexOf('(function () {', markerAt)
  const end = html.indexOf('})();', markerAt)
  if (start < 0 || end < 0) throw new Error('boot appearance script was not found')
  return html.slice(start, end + '})();'.length)
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: matches && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
}

function paint(storage: Record<string, string>, prefersDark = false) {
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-color-theme')
  document.documentElement.removeAttribute('data-accent')
  localStorage.clear()
  for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
  installMatchMedia(prefersDark)
  const run = new Function(bootAppearanceScript())
  run()
}

describe('HTML boot appearance', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('paints the current dark key before React', () => {
    paint({ 'rhizome-theme': 'dark' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('falls back to the legacy key and copies it forward', () => {
    paint({ 'tolaria-theme': 'dark', 'tolaria-color-theme': 'nord', 'tolaria-accent': 'purple' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'nord')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(localStorage.getItem('rhizome-theme')).toBe('dark')
    expect(localStorage.getItem('rhizome-color-theme')).toBe('nord')
    expect(localStorage.getItem('rhizome-accent')).toBe('purple')
  })

  it('keeps the current key when it conflicts with the legacy key', () => {
    paint({
      'rhizome-theme': 'light',
      'tolaria-theme': 'dark',
      'rhizome-color-theme': 'rhizome',
      'tolaria-color-theme': 'dracula',
      'rhizome-accent': 'green',
      'tolaria-accent': 'purple',
    }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveAttribute('data-accent')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('resolves system mode and a named dark theme', () => {
    paint({ 'rhizome-theme': 'system' }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    paint({ 'rhizome-theme': 'light', 'rhizome-color-theme': 'catppuccin-mocha' }, false)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'catppuccin-mocha')
  })

  it('pins Loam to dark before React even when the mode toggle says light', () => {
    paint({ 'rhizome-theme': 'light', 'rhizome-color-theme': 'loam' }, false)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'loam')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('starts a fresh install in Graphite when nothing is saved', () => {
    paint({})
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toMatch(/:root\s*\{[^}]*background:\s*#131210/)
    expect(html).toMatch(/:root\s*\{[^}]*--primary:\s*#76EAA7/)
    expect(html).toMatch(/:root\[data-theme="dark"\]:not\(\[data-color-theme\]\)\s*\{[^}]*--primary:\s*#76EAA7/)
    expect(html).toMatch(/normalizeTheme\(value\) \|\| 'dark'/)
  })

  it('keeps saved Light as Earth light on first paint', () => {
    paint({ 'rhizome-theme': 'light' }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('rhizome-color-theme')).toBeNull()
  })

  it('lets saved System follow the OS on first paint', () => {
    paint({ 'rhizome-theme': 'system' }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(localStorage.getItem('rhizome-color-theme')).toBeNull()

    paint({ 'rhizome-theme': 'system' }, false)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
  })

  it('maps stored Graphite through Dark/Light/System instead of pinning Light', () => {
    paint({ 'rhizome-theme': 'light', 'rhizome-color-theme': 'graphite' }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
    expect(document.documentElement).not.toHaveClass('dark')

    paint({ 'rhizome-theme': 'system', 'rhizome-color-theme': 'graphite' }, false)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
  })

  it('keeps unsaved dark on Graphite on first paint', () => {
    paint({ 'rhizome-theme': 'dark' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(localStorage.getItem('rhizome-color-theme')).toBeNull()
  })

  it('keeps saved Earth dark on first paint', () => {
    paint({ 'rhizome-theme': 'dark', 'rhizome-color-theme': 'rhizome' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
  })

  it('keeps a stored Earth pick on first paint', () => {
    paint({ 'rhizome-theme': 'dark', 'rhizome-color-theme': 'rhizome' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'rhizome')
  })

  it('gives Loam and Mycelium their own first-paint backgrounds so relaunch does not flash Graphite', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toMatch(/\[data-color-theme="loam"\][^{]*\{[^}]*background:\s*#15110C/)
    expect(html).toMatch(/:root\[data-color-theme="loam"\]\s*\{[^}]*--primary:\s*#6FE3A0/)
    expect(html).toMatch(/\[data-color-theme="mycelium"\][^{]*\{[^}]*background:\s*#0E120C/)
    expect(html).toMatch(/:root\[data-color-theme="mycelium"\]\s*\{[^}]*--primary:\s*#6FE3A0/)
    expect(html).not.toMatch(/:root\[data-theme="dark"\][^{]*\{[^}]*background:\s*#15110C/)
    expect(html).not.toContain('#38A169')
    expect(html).not.toContain('#3b9e83')
  })

  it('ignores invalid values and still paints when storage throws', () => {
    paint({ 'rhizome-theme': 'sepia', 'rhizome-color-theme': 'nope', 'rhizome-accent': 'nope' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).not.toHaveAttribute('data-accent')

    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = function getItem() {
      throw new Error('blocked')
    }
    try {
      document.documentElement.setAttribute('data-theme', 'dark')
      const run = new Function(bootAppearanceScript())
      run()
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    } finally {
      Storage.prototype.getItem = originalGetItem
    }
  })
})
