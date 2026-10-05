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
    expect(document.documentElement).not.toHaveAttribute('data-color-theme')
    expect(document.documentElement).toHaveAttribute('data-accent', 'green')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('resolves system mode and a named dark theme', () => {
    paint({ 'rhizome-theme': 'system' }, true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    paint({ 'rhizome-theme': 'light', 'rhizome-color-theme': 'catppuccin-mocha' }, false)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-color-theme', 'catppuccin-mocha')
  })

  it('ignores invalid values and still paints when storage throws', () => {
    paint({ 'rhizome-theme': 'sepia', 'rhizome-color-theme': 'nope', 'rhizome-accent': 'nope' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
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
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    } finally {
      Storage.prototype.getItem = originalGetItem
    }
  })
})
