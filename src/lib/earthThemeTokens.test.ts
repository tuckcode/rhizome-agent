import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHAT_FOCUS_RING_CLASS } from './chatFocusRing'
import { COLOR_THEMES, DEFAULT_COLOR_THEME, DEFAULT_THEME_MODE } from './themeMode'

const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
const themesCss = readFileSync(join(process.cwd(), 'src/themes.css'), 'utf8')
const generator = readFileSync(join(process.cwd(), 'scripts/generate-themes-css.mjs'), 'utf8')
const sheetSelectionChrome = readFileSync(join(process.cwd(), 'src/utils/sheetSelectionChrome.ts'), 'utf8')
const blockReorder = readFileSync(join(process.cwd(), 'src/components/rhizomeBlockReorder.ts'), 'utf8')

function themeBlock(css: string, header: string): string {
  const start = css.indexOf(header)
  expect(start).toBeGreaterThan(-1)
  const next = css.indexOf('\n:root', start + header.length)
  const end = next === -1 ? css.indexOf('\n@theme', start) : next
  return css.slice(start, end === -1 ? undefined : end)
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  expect(match?.[1], name).toBeTruthy()
  return (match?.[1] ?? '').trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const scaled = channel / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

const EARTH_DARK = {
  '--surface-app': '#0F110C',
  '--surface-editor': '#0F110C',
  '--surface-sidebar': '#121410',
  '--surface-panel': '#16170F',
  '--surface-card': '#16170F',
  '--surface-popover': '#1C1D14',
  '--surface-input': '#0F110C',
  '--surface-button': '#23231A',
  '--surface-dialog': '#19190F',
  '--text-primary': '#E9E8DC',
  '--text-secondary': '#BDBAA8',
  '--text-tertiary': '#A8A592',
  '--text-muted': '#999784',
  '--text-faint': '#8F8D7B',
  '--text-heading': '#F4F2E8',
  '--text-inverse': '#0F110C',
  '--border-default': '#2A281D',
  '--border-subtle': '#1F1E16',
  '--border-strong': '#3B3828',
  '--border-input': '#75705C',
  '--border-dialog': '#3B3828',
  '--border-focus': 'var(--accent-blue)',
  '--state-hover': '#1C1D14',
  '--state-hover-subtle': '#16170F',
  '--state-selected': '#1A2619',
  '--state-selected-strong': '#1C291B',
  '--state-active': '#1C291B',
  '--state-focus-ring': 'var(--accent-blue)',
  '--state-drag-target': 'rgba(111, 227, 160, 0.18)',
  '--state-disabled': '#15160F',
  '--accent-blue': '#6FE3A0',
  '--accent-blue-hover': '#8FEBB4',
  '--accent-blue-bg': 'rgba(111, 227, 160, 0.18)',
  '--accent-blue-light': 'rgba(111, 227, 160, 0.14)',
  '--accent-green': '#9BCF7E',
  '--accent-green-light': 'rgba(155, 207, 126, 0.14)',
  '--accent-orange': '#E9B04F',
  '--accent-orange-light': 'rgba(233, 176, 79, 0.13)',
  '--accent-red': '#EE8B7E',
  '--accent-red-light': 'rgba(238, 139, 126, 0.12)',
  '--ok-text': '#9BCF7E',
  '--danger-text': '#EE8B7E',
  '--warn-text': '#E9B04F',
  '--syntax-highlight-comment': '#88917B',
} as const

const EARTH_LIGHT = {
  '--surface-app': '#F1ECE2',
  '--surface-editor': '#F1ECE2',
  '--surface-sidebar': '#ECE6DA',
  '--surface-panel': '#F8F5EE',
  '--surface-card': '#F8F5EE',
  '--surface-popover': '#FCFAF6',
  '--surface-input': '#FCFAF6',
  '--surface-button': '#E7E0D2',
  '--surface-dialog': '#FAF7F1',
  '--text-primary': '#2A251E',
  '--text-secondary': '#4E473C',
  '--text-tertiary': '#575043',
  '--text-muted': '#625A4D',
  '--text-faint': '#6B6354',
  '--text-heading': '#1E1A15',
  '--text-inverse': '#F8F5EE',
  '--border-default': '#DDD4C3',
  '--border-subtle': '#E6DFD1',
  '--border-strong': '#C8BDA8',
  '--border-input': '#857B66',
  '--border-dialog': '#C8BDA8',
  '--border-focus': 'var(--accent-blue)',
  '--state-hover': '#EAE3D6',
  '--state-hover-subtle': '#EEE9DF',
  '--state-selected': '#E1E6DA',
  '--state-selected-strong': '#DCE3D5',
  '--state-active': '#DCE3D5',
  '--state-focus-ring': 'var(--accent-blue)',
  '--state-drag-target': 'rgba(44, 106, 77, 0.11)',
  '--state-disabled': '#EEE9DF',
  '--accent-blue': '#2C6A4D',
  '--accent-blue-hover': '#22573F',
  '--accent-blue-bg': 'rgba(44, 106, 77, 0.11)',
  '--accent-blue-light': 'rgba(44, 106, 77, 0.11)',
  '--accent-green': '#3D6A1E',
  '--accent-green-light': 'rgba(61, 106, 30, 0.10)',
  '--accent-orange': '#8A5208',
  '--accent-orange-light': '#F3E4C4',
  '--accent-red': '#A3342A',
  '--accent-red-light': 'rgba(163, 52, 42, 0.09)',
  '--accent-purple': '#714EB2',
  '--accent-yellow': '#795F19',
  '--accent-teal': '#286C68',
  '--accent-pink': '#A13F6E',
  '--accent-gray': '#5C6557',
  '--ok-text': '#3D6A1E',
  '--danger-text': '#A3342A',
  '--warn-text': '#8A5208',
  '--syntax-monospace': '#9E4A27',
  '--syntax-frontmatter-key': '#9E4A27',
  '--syntax-muted': '#5C6454',
  '--syntax-highlight-comment': '#5D6556',
  '--syntax-highlight-number': '#2C6977',
  '--syntax-highlight-type': '#90511E',
  '--diff-added-text': '#296E46',
  '--diff-removed-text': '#AD3B31',
} as const

const LOAM = {
  '--surface-app': '#15110C',
  '--surface-editor': '#15110C',
  '--surface-sidebar': '#19150F',
  '--surface-panel': '#1D1811',
  '--surface-card': '#1D1811',
  '--surface-popover': '#241E15',
  '--surface-input': '#15110C',
  '--surface-button': '#2B2419',
  '--surface-dialog': '#211B13',
  '--text-primary': '#EDE6D8',
  '--text-secondary': '#C6BBA6',
  '--text-tertiary': '#B2A791',
  '--text-muted': '#A3987F',
  '--text-faint': '#998D74',
  '--text-heading': '#F7F1E5',
  '--text-inverse': '#15110C',
  '--border-default': '#352C20',
  '--border-subtle': '#272017',
  '--border-strong': '#4A3D2C',
  '--border-input': '#8A7A62',
  '--border-dialog': '#4A3D2C',
  '--border-focus': 'var(--accent-blue)',
  '--state-hover': '#241E15',
  '--state-hover-subtle': '#1D1811',
  '--state-selected': '#1F2719',
  '--state-selected-strong': '#212A1A',
  '--state-active': '#212A1A',
  '--state-focus-ring': 'var(--accent-blue)',
  '--state-drag-target': 'rgba(111, 227, 160, 0.18)',
  '--state-disabled': '#1A1610',
  '--accent-blue': '#6FE3A0',
  '--accent-blue-hover': '#8FEBB4',
  '--accent-blue-bg': 'rgba(111, 227, 160, 0.18)',
  '--accent-blue-light': 'rgba(111, 227, 160, 0.14)',
  '--accent-green': '#A6D282',
  '--accent-green-light': 'rgba(166, 210, 130, 0.13)',
  '--accent-orange': '#EDB451',
  '--accent-orange-light': 'rgba(237, 180, 81, 0.13)',
  '--accent-red': '#F2917F',
  '--accent-red-light': 'rgba(242, 145, 127, 0.12)',
  '--ok-text': '#A6D282',
  '--danger-text': '#F2917F',
  '--warn-text': '#EDB451',
  '--syntax-highlight-comment': '#86917A',
} as const

const TEXT_TOKENS = [
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-muted',
  '--text-faint',
  '--text-heading',
  '--ok-text',
  '--danger-text',
  '--warn-text',
  '--accent-blue',
] as const

const SURFACES = [
  '--surface-app',
  '--surface-panel',
  '--surface-popover',
  '--surface-button',
  '--surface-sidebar',
  '--state-selected-strong',
] as const

function expectTokens(block: string, expected: Record<string, string>): void {
  for (const [name, value] of Object.entries(expected)) {
    expect(token(block, name), name).toBe(value)
  }
}

function expectReadableText(block: string): void {
  for (const textName of TEXT_TOKENS) {
    const foreground = token(block, textName)
    for (const surfaceName of SURFACES) {
      const background = token(block, surfaceName)
      expect(
        contrastRatio(foreground, background),
        `${textName} on ${surfaceName}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }

  const inputBorder = token(block, '--border-input')
  for (const surfaceName of ['--surface-app', '--surface-panel', '--surface-button'] as const) {
    expect(
      contrastRatio(inputBorder, token(block, surfaceName)),
      `--border-input on ${surfaceName}`,
    ).toBeGreaterThanOrEqual(3)
  }
}

describe('Earth theme tokens', () => {
  const light = themeBlock(indexCss, ':root,\n[data-theme="light"]')
  const dark = themeBlock(indexCss, ':root.dark,\n[data-theme="dark"]')
  const loam = themeBlock(
    themesCss,
    ':root[data-color-theme="loam"],\n:root.dark[data-color-theme="loam"]',
  )

  it('keeps rhizome as the default color theme and adds Loam', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark')
    expect(DEFAULT_COLOR_THEME).toBe('rhizome')
    const loamTheme = COLOR_THEMES.find((theme) => theme.slug === 'loam')
    expect(loamTheme).toEqual({
      slug: 'loam',
      name: 'Loam',
      polarity: 'dark',
      swatch: ['#15110C', '#1D1811', '#6FE3A0'],
    })
  })

  it('writes Earth light values into the default light contract', () => {
    expectTokens(light, EARTH_LIGHT)
    expect(token(light, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(light, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(light, '--feedback-warning-text')).toBe('var(--warn-text)')
  })

  it('writes Earth dark values into the default dark contract', () => {
    expectTokens(dark, EARTH_DARK)
    expect(token(dark, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(dark, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(dark, '--feedback-warning-text')).toBe('var(--warn-text)')
  })

  it('writes Loam as a generated fixed theme', () => {
    expect(generator).toContain("slug: 'loam'")
    expectTokens(loam, LOAM)
    expect(token(loam, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(loam, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(loam, '--feedback-warning-text')).toBe('var(--warn-text)')
  })

  it('keeps every Earth and Loam text pair at 4.5:1 or better', () => {
    expectReadableText(light)
    expectReadableText(dark)
    expectReadableText(loam)
  })

  it('keeps muted text at 4.5:1 on --state-selected-strong in all three themes', () => {
    for (const block of [light, dark, loam]) {
      expect(
        contrastRatio(token(block, '--text-muted'), token(block, '--state-selected-strong')),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('dims Loam faint below muted while staying at 4.5:1 on every Loam surface', () => {
    const faint = token(loam, '--text-faint')
    const muted = token(loam, '--text-muted')
    expect(faint).not.toBe(muted)
    expect(relativeLuminance(faint)).toBeLessThan(relativeLuminance(muted))
    for (const surfaceName of SURFACES) {
      expect(
        contrastRatio(faint, token(loam, surfaceName)),
        `--text-faint on ${surfaceName}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives Loam --border-input margin above 3:1 on the selected row', () => {
    expect(
      contrastRatio(token(loam, '--border-input'), token(loam, '--state-selected-strong')),
    ).toBeGreaterThanOrEqual(3.3)
  })

  it('keeps Earth dark comment color at 4.5:1 on the selected row', () => {
    expect(
      contrastRatio(token(dark, '--syntax-highlight-comment'), token(dark, '--state-selected-strong')),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('prints muted-on-selected-strong in contrast_check.py for every Earth scheme', () => {
    const checker = readFileSync(join(process.cwd(), 'scripts/contrast_check.py'), 'utf8')
    expect(checker).toContain("'--state-selected-strong'")
    const output = execFileSync(
      'python3',
      ['docs/design/earth-theme/contrast_check.py', 'docs/design/earth-theme/colors_and_type.css'],
      { encoding: 'utf8' },
    )
    const lines = [...output.matchAll(/--muted on --state-selected-strong: ([0-9.]+)/g)].map((match) => Number(match[1]))
    expect(lines).toHaveLength(3)
    for (const ratio of lines) {
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('takes the 2px focus ring from each theme accent token at 3:1', () => {
    expect(CHAT_FOCUS_RING_CLASS).toContain('outline-2')
    expect(CHAT_FOCUS_RING_CLASS).toContain('var(--state-focus-ring)')
    expect(CHAT_FOCUS_RING_CLASS).not.toMatch(/#[0-9A-Fa-f]{3,8}/)
    for (const block of [light, dark, loam]) {
      expect(token(block, '--state-focus-ring')).toBe('var(--accent-blue)')
      expect(token(block, '--border-focus')).toBe('var(--accent-blue)')
      const ring = token(block, '--accent-blue')
      for (const surfaceName of SURFACES) {
        expect(
          contrastRatio(ring, token(block, surfaceName)),
          `--focus-ring on ${surfaceName}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('prints focus-ring on --bg in contrast_check.py for every Earth scheme', () => {
    const checker = readFileSync(join(process.cwd(), 'scripts/contrast_check.py'), 'utf8')
    expect(checker).toContain('--focus-ring on --bg')
    const output = execFileSync(
      'python3',
      ['docs/design/earth-theme/contrast_check.py', 'docs/design/earth-theme/colors_and_type.css'],
      { encoding: 'utf8' },
    )
    const lines = [...output.matchAll(/--focus-ring on --bg: ([0-9.]+)/g)].map((match) => Number(match[1]))
    expect(lines).toHaveLength(3)
    for (const ratio of lines) {
      expect(ratio).toBeGreaterThanOrEqual(3)
    }
  })

  it('defaults contrast_check.py to the shipped Earth and Loam CSS', () => {
    const checker = readFileSync(join(process.cwd(), 'scripts/contrast_check.py'), 'utf8')
    expect(checker).toContain('src/index.css')
    expect(checker).toContain('src/themes.css')
    let output = ''
    try {
      output = execFileSync('python3', ['scripts/contrast_check.py'], { encoding: 'utf8' })
    } catch (error) {
      output = (error as { stdout?: string }).stdout ?? ''
    }
    expect(output).toContain('kind=app')
    expect(output).toContain('src/index.css')
    expect(output).toContain('src/themes.css')
    expect(output).toContain('== Earth dark')
    expect(output).toContain('== Earth light')
    expect(output).toContain('== Loam')
    expect(output).toMatch(/--text-muted on --state-selected-strong: [0-9.]+/)
    expect(output).toMatch(/--border-input on --surface-app: [0-9.]+/)
    expect(output).toMatch(/--focus-ring on --bg: [0-9.]+/)
    const failLines = output.split('\n').filter((line) => line.startsWith('FAIL '))
    for (const line of failLines) {
      expect(line).toMatch(/^FAIL (Earth dark|Earth light|Loam)\s{2}--[\w-]+ on \S+\s{2}[0-9.]+\s{2}\((text|non-text) /)
    }
  })

  it('fails contrast_check.py when a theme token is unparseable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contrast-unparseable-'))
    const css = join(dir, 'theme.css')
    writeFileSync(
      css,
      [
        ':root, [data-theme="dark"] {',
        '  --surface-app: #0F110C;',
        '  --text-primary: #E9E8DC;',
        '  --text-muted: oklch(0.55 0.04 120);',
        '}',
        '',
      ].join('\n'),
    )
    let output = ''
    let status = 0
    try {
      output = execFileSync('python3', ['scripts/contrast_check.py', css], { encoding: 'utf8' })
    } catch (error) {
      const err = error as { stdout?: string; status?: number }
      output = err.stdout ?? ''
      status = err.status ?? 1
    }
    expect(status).toBe(1)
    expect(output).toMatch(
      /FAIL Earth dark {2}--text-muted {2}unparseable {2}oklch\(0\.55 0\.04 120\)/,
    )
  })

  it('keeps Earth light type and syntax accents readable on paper surfaces', () => {
    const extras = [
      '--accent-purple',
      '--accent-yellow',
      '--accent-teal',
      '--accent-pink',
      '--accent-gray',
      '--syntax-monospace',
      '--syntax-muted',
      '--syntax-highlight-comment',
      '--syntax-highlight-number',
      '--syntax-highlight-type',
      '--diff-added-text',
      '--diff-removed-text',
    ]
    for (const textName of extras) {
      const foreground = token(light, textName)
      for (const surfaceName of SURFACES) {
        expect(
          contrastRatio(foreground, token(light, surfaceName)),
          `${textName} on ${surfaceName}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('replaces leftover Tolaria blues on sheet selection and block reorder with Earth tokens', () => {
    expect(sheetSelectionChrome).toContain("SHEET_SELECTION_ACCENT_FALLBACK = '#2C6A4D'")
    expect(sheetSelectionChrome).not.toContain('#155DFF')
    expect(blockReorder).not.toContain('21, 93, 255')
    expect(blockReorder).toContain('var(--accent-blue-light)')
    expect(blockReorder).toContain('var(--accent-blue-bg)')
  })
})
