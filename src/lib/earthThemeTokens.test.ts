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
const INK_GAP = JSON.parse(readFileSync(join(process.cwd(), 'scripts/ink-gap.json'), 'utf8')).INK_GAP as number
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

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function parseCssColor(value: string, base?: [number, number, number]): [number, number, number] {
  const raw = value.trim()
  if (raw.startsWith('#')) {
    return hexToRgb(raw)
  }
  const match = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
  expect(match, raw).toBeTruthy()
  const rgb: [number, number, number] = [
    Number(match?.[1]),
    Number(match?.[2]),
    Number(match?.[3]),
  ]
  const alpha = match?.[4] === undefined ? 1 : Number(match[4])
  if (alpha >= 1 || !base) {
    return rgb
  }
  return [
    Math.round(rgb[0] * alpha + base[0] * (1 - alpha)),
    Math.round(rgb[1] * alpha + base[1] * (1 - alpha)),
    Math.round(rgb[2] * alpha + base[2] * (1 - alpha)),
  ]
}

function contrastCss(foreground: string, background: string, base?: [number, number, number]): number {
  return contrastRatio(rgbToHex(parseCssColor(foreground)), rgbToHex(parseCssColor(background, base)))
}

const BANNER_TINT_ROLES = [
  ['info', ['--feedback-info-bg', '--accent-blue-light']],
  ['success', ['--feedback-success-bg', '--accent-green-light']],
  ['warning', ['--feedback-warning-bg', '--accent-orange-light']],
  ['error', ['--feedback-error-bg', '--accent-red-light']],
] as const

const DARK_SKIN_NAMES = [
  'Graphite',
  'Earth dark',
  'Loam',
  'Mycelium',
  'Dracula',
  'Nord',
  'Gruvbox dark',
  'Solarized dark',
  'Catppuccin mocha',
  'Tokyo night',
  'One dark',
  'Rosé pine',
  'Everforest',
  'Monokai pro',
] as const

function pickToken(tokens: Record<string, string>, names: readonly string[]): string | undefined {
  return names.find((name) => tokens[name]?.trim())
}

function resolveToken(tokens: Record<string, string>, name: string, seen = new Set<string>()): string {
  if (seen.has(name)) {
    return ''
  }
  seen.add(name)
  const value = (tokens[name] ?? '').trim()
  const match = value.match(/^var\((--[\w-]+)(?:,[^)]*)?\)$/)
  if (match) {
    return resolveToken(tokens, match[1], seen)
  }
  return value
}

function hslHueSat(hex: string): { hue: number; sat: number } {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) {
    return { hue: 0, sat: 0 }
  }
  const delta = max - min
  const sat = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === r) {
    hue = (g - b) / delta + (g < b ? 6 : 0)
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  return { hue: (hue / 6) * 360, sat }
}

const COMMUNITY_MUTED_SOURCE = {
  Dracula: '#6272A4',
  Nord: '#7B88A1',
  'Gruvbox dark': '#928374',
  'Solarized dark': '#586E75',
  'Catppuccin mocha': '#7F849C',
  'Tokyo night': '#565F89',
  'One dark': '#5C6370',
  'Rosé pine': '#908CAA',
  Everforest: '#859289',
  'Monokai pro': '#939293',
} as const

const GRAPHITE = {
  '--surface-app': '#131210',
  '--surface-editor': '#131210',
  '--surface-sidebar': '#171614',
  '--surface-panel': '#1C1B19',
  '--surface-card': '#1C1B19',
  '--surface-popover': '#22211F',
  '--surface-input': '#131210',
  '--surface-button': '#292826',
  '--surface-dialog': '#1F1E1C',
  '--text-primary': '#EEEDEB',
  '--text-secondary': '#C6C5C3',
  '--text-tertiary': '#AFAEAC',
  '--text-muted': '#A6A5A3',
  '--text-faint': '#9F9E9C',
  '--text-heading': '#F7F6F4',
  '--text-inverse': '#131210',
  '--border-default': '#302F2D',
  '--border-subtle': '#282725',
  '--border-strong': '#3F3E3C',
  '--border-input': '#7F7E7C',
  '--border-dialog': '#302F2D',
  '--border-focus': 'var(--accent-blue)',
  '--state-hover': '#242321',
  '--state-hover-subtle': '#1A1917',
  '--state-selected': '#202B23',
  '--state-selected-strong': '#26382C',
  '--state-active': '#26382C',
  '--state-focus-ring': 'var(--accent-blue)',
  '--state-drag-target': 'rgba(118, 234, 167, 0.18)',
  '--state-disabled': '#1A1917',
  '--accent-blue': '#76EAA7',
  '--accent-blue-hover': '#94F0BB',
  '--accent-blue-bg': 'rgba(118, 234, 167, 0.18)',
  '--accent-blue-light': 'rgba(118, 234, 167, 0.14)',
  '--accent-green': '#9BCF7E',
  '--accent-green-light': 'rgba(155, 207, 126, 0.16)',
  '--accent-orange': '#E9B04F',
  '--accent-orange-light': 'rgba(233, 176, 79, 0.14)',
  '--accent-red': '#EE8B7E',
  '--accent-red-light': 'rgba(238, 139, 126, 0.16)',
  '--ok-text': '#9BCF7E',
  '--danger-text': '#EE8B7E',
  '--warn-text': '#E9B04F',
} as const

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
  '--text-muted': '#9F9E8B',
  '--text-faint': '#9B9989',
  '--accent-purple': '#B4A0E8',
  '--accent-teal': '#64D1C8',
  '--accent-yellow': '#E4C97A',
  '--accent-pink': '#E594BB',
  '--accent-gray': '#9AA491',
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
  '--state-drag-target': 'rgba(125, 240, 174, 0.18)',
  '--state-disabled': '#15160F',
  '--accent-blue': '#7DF0AE',
  '--accent-blue-hover': '#9AF5C2',
  '--accent-blue-bg': 'rgba(125, 240, 174, 0.18)',
  '--accent-blue-light': 'rgba(125, 240, 174, 0.14)',
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
  '--text-muted': '#A79D85',
  '--text-faint': '#A29881',
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
  const graphite = themeBlock(indexCss, ':root.dark:not([data-color-theme]),\n[data-theme="dark"]:not([data-color-theme])')
  const dark = themeBlock(indexCss, ':root.dark[data-color-theme="rhizome"] {')
  const loam = themeBlock(
    themesCss,
    ':root[data-color-theme="loam"],\n:root.dark[data-color-theme="loam"]',
  )
  const mycelium = themeBlock(
    themesCss,
    ':root[data-color-theme="mycelium"],\n:root.dark[data-color-theme="mycelium"]',
  )

  it('keeps Graphite as the default color theme and keeps Earth, Loam, and Mycelium', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark')
    expect(DEFAULT_COLOR_THEME).toBe('graphite')
    expect(COLOR_THEMES.find((theme) => theme.slug === 'rhizome')?.name).toBe('Earth')
    const loamTheme = COLOR_THEMES.find((theme) => theme.slug === 'loam')
    expect(loamTheme).toEqual({
      slug: 'loam',
      name: 'Loam',
      polarity: 'dark',
      swatch: ['#15110C', '#1D1811', '#6FE3A0'],
    })
    expect(COLOR_THEMES.find((theme) => theme.slug === 'mycelium')?.swatch[1]).toBe('#0E120C')
  })

  it('writes Earth light values into the default light contract', () => {
    expectTokens(light, EARTH_LIGHT)
    expect(token(light, '--feedback-success-text')).toBe('var(--ok-text)')
    expect(token(light, '--feedback-error-text')).toBe('var(--danger-text)')
    expect(token(light, '--feedback-warning-text')).toBe('var(--warn-text)')
  })

  it('writes Graphite overlay tokens without replacing the shared dark base', () => {
    expect(indexCss).toMatch(/:root\.dark,\s*\n\[data-theme="dark"\] \{/)
    expectTokens(graphite, GRAPHITE)
    expect(token(graphite, '--feedback-success-text')).toBe('var(--accent-green)')
    expect(token(graphite, '--feedback-error-text')).toBe('var(--accent-red)')
    expect(token(graphite, '--editor-code-block-background')).toBe('#0D0D0B')
    expect(token(graphite, '--surface-overlay')).toBe('rgba(5, 5, 4, 0.6)')
    expect(graphite).not.toContain('--syntax-highlight-string')
    expect(graphite).not.toContain('--diff-added-text')
    const sharedDark = themeBlock(indexCss, ':root.dark,\n[data-theme="dark"]')
    expect(token(sharedDark, '--syntax-highlight-string')).toBe('#A5D8C8')
    expect(token(sharedDark, '--diff-added-text')).toBe('#6FE3A0')
    expect(token(sharedDark, '--shadow-dialog')).toBe('rgba(0, 0, 0, 0.45)')
  })

  it('resolves applied tokens per skin so no dark skin inherits light values', () => {
    const dump = JSON.parse(
      execFileSync('python3', ['scripts/contrast_check.py', '--dump-resolved'], { encoding: 'utf8' }),
    ) as Record<string, Record<string, string>>
    const light = dump['Earth light']
    expect(light['--syntax-highlight-string']).toBe('#23503C')
    expect(light['--surface-app']).toBe('#F1ECE2')
    const darkSkins = DARK_SKIN_NAMES
    for (const name of darkSkins) {
      const tokens = dump[name]
      expect(tokens, name).toBeTruthy()
      expect(tokens['--syntax-highlight-string'], `${name} string`).not.toBe(light['--syntax-highlight-string'])
      expect(tokens['--diff-added-text'], `${name} diff-added`).not.toBe(light['--diff-added-text'])
      expect(tokens['--diff-removed-text'], `${name} diff-removed`).not.toBe(light['--diff-removed-text'])
      expect(tokens['--surface-app'], `${name} bg`).not.toBe(light['--surface-app'])
      expect(tokens['--shadow-dialog'], `${name} shadow`).not.toBe(light['--shadow-dialog'])
      expect(tokens['--text-primary'], `${name} text`).not.toBe(light['--text-primary'])
    }
    expect(dump.Graphite['--accent-blue']).toBe('#76EAA7')
    expect(dump['Earth dark']['--accent-blue']).toBe('#7DF0AE')
    expect(dump.Loam['--syntax-highlight-string']).toBe('#A5D8C8')
    expect(dump.Dracula['--syntax-highlight-string']).toBe('#A5D8C8')
    for (const name of darkSkins) {
      const tokens = dump[name]
      const background = tokens['--surface-app']
      const panel = tokens['--surface-panel']
      const panelRgb = parseCssColor(panel, parseCssColor(background))
      for (const role of ['--syntax-highlight-string', '--diff-added-text', '--diff-removed-text'] as const) {
        expect(
          contrastRatio(tokens[role], background),
          `${name} ${role} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
      const selected = tokens['--state-selected']
      const selectedStrong = tokens['--state-selected-strong']
      for (const role of ['--text-primary', '--text-secondary', '--text-tertiary', '--text-faint', '--text-muted'] as const) {
        expect(
          contrastRatio(tokens[role], background),
          `${name} ${role} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens[role], selected),
          `${name} ${role} on selected-row`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens[role], selectedStrong),
          `${name} ${role} on selected-strong`,
        ).toBeGreaterThanOrEqual(4.5)
        for (const [label, aliases] of BANNER_TINT_ROLES) {
          const tintName = pickToken(tokens, aliases)
          expect(tintName, `${name} ${label} tint`).toBeTruthy()
          for (const [baseLabel, baseRgb] of [
            ['panel', panelRgb],
            ['app', parseCssColor(background)],
            ['sidebar', parseCssColor(tokens['--surface-sidebar'], parseCssColor(background))],
          ] as const) {
            expect(
              contrastCss(tokens[role], resolveToken(tokens, tintName!), baseRgb),
              `${name} ${role} on ${label}/${tintName}/${baseLabel}`,
            ).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    }
    expect(dump.Graphite['--text-muted']).toBe('#A6A5A3')
    expect(dump.Graphite['--text-faint']).toBe('#9F9E9C')
    expect(dump['Earth dark']['--text-muted']).toBe('#9F9E8B')
    expect(dump['Earth dark']['--text-faint']).toBe('#9B9989')
    expect(dump.Loam['--text-muted']).toBe('#A79D85')
    expect(dump.Loam['--text-faint']).toBe('#A29881')
    expect(dump.Mycelium['--text-muted']).toBe('#9AA48E')
    expect(dump.Mycelium['--text-faint']).toBe('#959F89')
    expect(generator).toContain('fitInkLadder')
    expect(generator).toContain('liftLightness')
    expect(generator).toContain('ink-gap.json')
    expect(readFileSync(join(process.cwd(), 'scripts/contrast_check.py'), 'utf8')).toContain('ink-gap.json')
    expect(INK_GAP).toBe(0.015)
    for (const [name, source] of Object.entries(COMMUNITY_MUTED_SOURCE)) {
      const sourceHs = hslHueSat(source)
      for (const role of ['--text-muted', '--text-faint'] as const) {
        const next = hslHueSat(dump[name][role])
        if (name === 'Everforest') {
          expect(next.sat, `${name} ${role} sat`).toBeGreaterThan(sourceHs.sat + 0.04)
          expect(next.sat, `${name} ${role} sat cap`).toBeLessThan(sourceHs.sat + 0.16)
        } else {
          expect(Math.abs(next.sat - sourceHs.sat), `${name} ${role} sat`).toBeLessThan(0.04)
        }
        if (sourceHs.sat < 0.02) {
          expect(next.sat, `${name} ${role} stays near-gray`).toBeLessThan(0.02)
          continue
        }
        const hueDelta = Math.min(Math.abs(next.hue - sourceHs.hue), 360 - Math.abs(next.hue - sourceHs.hue))
        expect(hueDelta, `${name} ${role} hue`).toBeLessThan(5)
      }
    }
    expect(dump.Dracula['--text-faint']).not.toBe('#B8C0D6')
    expect(dump.Everforest['--text-muted']).not.toBe('#BFC5C1')
    expect(dump.Everforest['--text-faint']).not.toBe('#BBC3BE')
    expect(relativeLuminance(dump['Solarized dark']['--text-primary'])).toBeGreaterThanOrEqual(
      relativeLuminance('#A5B2B3'),
    )
  })

  it('steps body text down through secondary, tertiary, muted, and faint on every dark skin', () => {
    const dump = JSON.parse(
      execFileSync('python3', ['scripts/contrast_check.py', '--dump-resolved'], { encoding: 'utf8' }),
    ) as Record<string, Record<string, string>>
    const ladder = [
      '--text-primary',
      '--text-secondary',
      '--text-tertiary',
      '--text-muted',
      '--text-faint',
    ] as const
    const extraSurfaces = [
      '--state-hover',
      '--surface-sidebar',
      '--surface-panel',
      '--state-selected-strong',
    ] as const
    for (const name of DARK_SKIN_NAMES) {
      const tokens = dump[name]
      const background = tokens['--surface-app']
      const panelRgb = parseCssColor(tokens['--surface-panel'], parseCssColor(background))
      const selected = tokens['--state-selected']
      const ys = ladder.map((role) => relativeLuminance(tokens[role]))
      for (let index = 0; index < ys.length - 1; index += 1) {
        expect(
          ys[index] - ys[index + 1],
          `${name} ${ladder[index]} above ${ladder[index + 1]}`,
        ).toBeGreaterThanOrEqual(INK_GAP)
      }
      for (const role of ladder) {
        expect(
          contrastRatio(tokens[role], background),
          `${name} ${role} on app`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens[role], selected),
          `${name} ${role} on .list-row-selected`,
        ).toBeGreaterThanOrEqual(4.5)
        for (const surfaceName of extraSurfaces) {
          expect(
            contrastRatio(tokens[role], tokens[surfaceName]),
            `${name} ${role} on ${surfaceName}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
        for (const [label, aliases] of BANNER_TINT_ROLES) {
          const tintName = pickToken(tokens, aliases)
          for (const [baseLabel, baseRgb] of [
            ['panel', panelRgb],
            ['app', parseCssColor(background)],
            ['sidebar', parseCssColor(tokens['--surface-sidebar'], parseCssColor(background))],
          ] as const) {
            expect(
              contrastCss(tokens[role], resolveToken(tokens, tintName!), baseRgb),
              `${name} ${role} on ${label}/${baseLabel}`,
            ).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    }
    expect(relativeLuminance(dump['Solarized dark']['--text-primary'])).toBeGreaterThanOrEqual(
      relativeLuminance('#A5B2B3'),
    )
    expect(
      contrastRatio(dump['Monokai pro']['--text-primary'], dump['Monokai pro']['--state-selected']),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(dump['Monokai pro']['--text-muted'], dump['Monokai pro']['--state-selected']),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps Graphite mint in the Graphite block and Earth accents on Earth', () => {
    expect(graphite).toContain(':not([data-color-theme])')
    expect(token(graphite, '--accent-blue')).toBe('#76EAA7')
    expect(token(dark, '--accent-blue')).toBe('#7DF0AE')
    expect(token(light, '--accent-blue')).toBe('#2C6A4D')
    expect(token(dark, '--accent-purple')).toBe('#B4A0E8')
    expect(token(dark, '--accent-teal')).toBe('#64D1C8')
    expect(token(light, '--accent-purple')).toBe('#714EB2')
    expect(token(light, '--accent-teal')).toBe('#286C68')
    expect(dark).not.toContain('#76EAA7')
    expect(light).not.toContain('#76EAA7')
  })

  it('writes Earth dark values onto the rhizome color-theme attribute', () => {
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

  it('restores Mycelium as a green-black skin', () => {
    expect(generator).toContain("slug: 'mycelium'")
    expect(token(mycelium, '--surface-app')).toBe('#0E120C')
    expect(token(mycelium, '--surface-panel')).toBe('#151A12')
    expect(token(mycelium, '--accent-blue')).toBe('#6FE3A0')
  })

  it('keeps Graphite, Earth, Loam, and Mycelium text pairs at 4.5:1 or better', () => {
    expectReadableText(light)
    expectReadableText(dark)
    expectReadableText(loam)
    expectReadableText(graphite)
    expectReadableText(mycelium)
  })

  it('uses one selected-row style: fill plus a 2px accent bar', () => {
    expect(indexCss).toContain('.list-row-selected')
    expect(indexCss).toMatch(/\.list-row-selected\s*\{\s*background-color:\s*var\(--state-selected\);\s*box-shadow:\s*inset 2px 0 0 var\(--accent-blue\);/)
    expect(readFileSync(join(process.cwd(), 'src/components/NoteItem.tsx'), 'utf8')).toContain('list-row-selected')
    expect(readFileSync(join(process.cwd(), 'src/components/folder-tree/FolderItemRow.tsx'), 'utf8')).toContain('list-row-selected')
    expect(readFileSync(join(process.cwd(), 'src/components/PrimeSessionList.tsx'), 'utf8')).toContain('list-row-selected')
  })

  it('keeps muted text at 4.5:1 on --state-selected-strong in all three themes', () => {
    for (const block of [light, dark, loam, graphite, mycelium]) {
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

  it('uses a solid 2px --state-focus-ring on shared UI controls', () => {
    for (const file of ['button.tsx', 'input.tsx', 'select.tsx', 'checkbox.tsx', 'badge.tsx']) {
      const source = readFileSync(join(process.cwd(), 'src/components/ui', file), 'utf8')
      expect(source).toContain('focus-visible:ring-2')
      expect(source).toContain('var(--state-focus-ring)')
      expect(source).not.toContain('focus-visible:ring-[3px]')
      expect(source).not.toContain('ring-ring/50')
    }
  })

  it('takes the 2px focus ring from each theme accent token at 3:1', () => {
    expect(CHAT_FOCUS_RING_CLASS).toContain('outline-2')
    expect(CHAT_FOCUS_RING_CLASS).toContain('var(--state-focus-ring)')
    expect(CHAT_FOCUS_RING_CLASS).not.toMatch(/#[0-9A-Fa-f]{3,8}/)
    for (const block of [light, dark, loam, graphite]) {
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
    expect(output).toContain('== Graphite')
    expect(output).toContain('== Earth dark')
    expect(output).toContain('== Earth light')
    expect(output).toContain('== Loam')
    expect(output).toContain('== Mycelium')
    expect(output).toContain('== dark faint/muted')
    expect(output).toContain('-- Graphite')
    expect(output).toContain('-- Earth dark')
    expect(output).toContain('-- Loam')
    expect(output).toContain('-- Mycelium')
    expect(output).toContain('-- Dracula')
    expect(output).toContain('-- Tokyo night')
    expect(output).toMatch(/--text-muted on --state-selected-strong: [0-9.]+/)
    expect(output).toMatch(/--border-input on --surface-app: [0-9.]+/)
    expect(output).toMatch(/--focus-ring on --bg: [0-9.]+/)
    expect(output).toMatch(/--text-faint on info\//)
    expect(output).toMatch(/--text-muted on error\//)
    expect(output).toMatch(/--text-faint on warning\/[^/\n]+\/--surface-app:/)
    expect(output).toMatch(/--text-faint on warning\/[^/\n]+\/--surface-sidebar:/)
    expect(output).toMatch(/-- Dracula[\s\S]*--text-faint /)
    expect(checker).toContain('panel_name, bg_name, sidebar_name')
    expect(output).toMatch(/ladder Y /)
    expect(output).toContain('== FAILING PAIRS')
    expect(output).toContain('(none)')
    const failLines = output.split('\n').filter((line) => line.startsWith('FAIL '))
    expect(failLines).toEqual([])
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
      /FAIL Graphite {2}--text-muted {2}unparseable {2}oklch\(0\.55 0\.04 120\)/,
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

  it('keeps leftover Earth dark accent copies in sync with --accent-blue', () => {
    const bootHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    const mycelium = readFileSync(join(process.cwd(), 'src-tauri/src/mycelium_skin.rs'), 'utf8')
    const companion = readFileSync(join(process.cwd(), 'src/components/MenuBarCompanionApp.tsx'), 'utf8')
    const darkBoot = bootHtml.slice(
      bootHtml.indexOf(':root[data-theme="dark"]'),
      bootHtml.indexOf(':root[data-color-theme="rhizome"]'),
    )
    expect(darkBoot).toContain('--primary: #76EAA7')
    expect(bootHtml).toContain(':root[data-color-theme="rhizome"]')
    expect(bootHtml).toMatch(/\[data-color-theme="rhizome"\][^{]*\{[^}]*--primary:\s*#7DF0AE/)
    expect(mycelium).toContain('--moss: #7DF0AE')
    expect(mycelium).toContain('--moon: #9AF5C2')
    expect(mycelium).toContain('--act-verify: #7DF0AE')
    expect(companion).toContain('rgba(125,240,174,0.14)')
    expect(companion).not.toContain('rgba(111,227,160,0.14)')
  })
})
