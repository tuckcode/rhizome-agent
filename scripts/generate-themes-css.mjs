#!/usr/bin/env node
// Generates src/themes.css — one token block per fixed color theme, derived
// from the 12-channel palettes in the brand handoff
// (design_handoff_rhizome_brand_shell/"Rhizome Style Sheets.dc.html", THEMES
// array — copied verbatim below). The default "rhizome" theme is NOT here:
// it is the hand-tuned light/dark contract in index.css.
//
// Derivation rules mirror the existing light/dark blocks: hover ≈ bg mixed
// 7% toward fg, selected ≈ bg mixed 14% toward accent, soft accents at 15%
// alpha (the design docs use hex+'26'). Only semantic tokens are emitted —
// every shadcn/compat alias in index.css resolves through var() and follows.
//
// Run: node scripts/generate-themes-css.mjs   (rewrites src/themes.css)

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const THEMES = [
  { slug: 'dracula', name: 'Dracula', dark: true, bg: '#282A36', panel: '#21222C', fg: '#F8F8F2', heading: '#F8F8F2', muted: '#6272A4', border: '#44475A', accent: '#BD93F9', onAccent: '#282A36', green: '#50FA7B', yellow: '#F1FA8C', red: '#FF5555', purple: '#FF79C6' },
  { slug: 'nord', name: 'Nord', dark: true, bg: '#2E3440', panel: '#3B4252', fg: '#D8DEE9', heading: '#ECEFF4', muted: '#7B88A1', border: '#434C5E', accent: '#88C0D0', onAccent: '#2E3440', green: '#A3BE8C', yellow: '#EBCB8B', red: '#BF616A', purple: '#B48EAD' },
  { slug: 'gruvbox-dark', name: 'Gruvbox Dark', dark: true, bg: '#282828', panel: '#32302F', fg: '#EBDBB2', heading: '#FBF1C7', muted: '#928374', border: '#504945', accent: '#FE8019', onAccent: '#282828', green: '#B8BB26', yellow: '#FABD2F', red: '#FB4934', purple: '#D3869B' },
  { slug: 'gruvbox-light', name: 'Gruvbox Light', dark: false, bg: '#FBF1C7', panel: '#F2E5BC', fg: '#3C3836', heading: '#282828', muted: '#7C6F64', border: '#D5C4A1', accent: '#D65D0E', onAccent: '#FBF1C7', green: '#79740E', yellow: '#B57614', red: '#9D0006', purple: '#8F3F71' },
  { slug: 'solarized-light', name: 'Solarized Light', dark: false, bg: '#FDF6E3', panel: '#EEE8D5', fg: '#657B83', heading: '#073642', muted: '#93A1A1', border: '#DFD8C3', accent: '#268BD2', onAccent: '#FDF6E3', green: '#859900', yellow: '#B58900', red: '#DC322F', purple: '#6C71C4' },
  { slug: 'solarized-dark', name: 'Solarized Dark', dark: true, bg: '#002B36', panel: '#073642', fg: '#839496', heading: '#EEE8D5', muted: '#586E75', border: '#0F3E4C', accent: '#268BD2', onAccent: '#FDF6E3', green: '#859900', yellow: '#B58900', red: '#DC322F', purple: '#6C71C4' },
  { slug: 'catppuccin-mocha', name: 'Catppuccin Mocha', dark: true, bg: '#1E1E2E', panel: '#181825', fg: '#CDD6F4', heading: '#CDD6F4', muted: '#7F849C', border: '#313244', accent: '#CBA6F7', onAccent: '#1E1E2E', green: '#A6E3A1', yellow: '#F9E2AF', red: '#F38BA8', purple: '#F5C2E7' },
  { slug: 'catppuccin-latte', name: 'Catppuccin Latte', dark: false, bg: '#EFF1F5', panel: '#E6E9EF', fg: '#4C4F69', heading: '#4C4F69', muted: '#7C7F93', border: '#CCD0DA', accent: '#8839EF', onAccent: '#FFFFFF', green: '#40A02B', yellow: '#DF8E1D', red: '#D20F39', purple: '#EA76CB' },
  { slug: 'tokyo-night', name: 'Tokyo Night', dark: true, bg: '#1A1B26', panel: '#16161E', fg: '#A9B1D6', heading: '#C0CAF5', muted: '#565F89', border: '#292E42', accent: '#7AA2F7', onAccent: '#1A1B26', green: '#9ECE6A', yellow: '#E0AF68', red: '#F7768E', purple: '#BB9AF7' },
  { slug: 'one-dark', name: 'One Dark', dark: true, bg: '#282C34', panel: '#21252B', fg: '#ABB2BF', heading: '#DCDFE4', muted: '#5C6370', border: '#3E4451', accent: '#61AFEF', onAccent: '#282C34', green: '#98C379', yellow: '#E5C07B', red: '#E06C75', purple: '#C678DD' },
  { slug: 'rose-pine', name: 'Rosé Pine', dark: true, bg: '#191724', panel: '#1F1D2E', fg: '#E0DEF4', heading: '#E0DEF4', muted: '#908CAA', border: '#26233A', accent: '#C4A7E7', onAccent: '#191724', green: '#9CCFD8', yellow: '#F6C177', red: '#EB6F92', purple: '#EBBCBA' },
  { slug: 'github-light', name: 'GitHub Light', dark: false, bg: '#FFFFFF', panel: '#F6F8FA', fg: '#1F2328', heading: '#1F2328', muted: '#656D76', border: '#D0D7DE', accent: '#0969DA', onAccent: '#FFFFFF', green: '#1A7F37', yellow: '#9A6700', red: '#CF222E', purple: '#8250DF' },
  { slug: 'everforest', name: 'Everforest', dark: true, bg: '#2D353B', panel: '#232A2E', fg: '#D3C6AA', heading: '#D3C6AA', muted: '#859289', border: '#475258', accent: '#A7C080', onAccent: '#2D353B', green: '#83C092', yellow: '#DBBC7F', red: '#E67E80', purple: '#D699B6' },
  { slug: 'monokai-pro', name: 'Monokai Pro', dark: true, bg: '#2D2A2E', panel: '#221F22', fg: '#FCFCFA', heading: '#FCFCFA', muted: '#939293', border: '#403E41', accent: '#FFD866', onAccent: '#2D2A2E', green: '#A9DC76', yellow: '#FC9867', red: '#FF6188', purple: '#AB9DF2' },
]

const hex2rgb = (h) => {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
const rgb2hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0').toUpperCase()).join('')
const mix = (a, b, t) => {
  const [ar, ag, ab] = hex2rgb(a)
  const [br, bg2, bb] = hex2rgb(b)
  return rgb2hex(ar + (br - ar) * t, ag + (bg2 - ag) * t, ab + (bb - ab) * t)
}
const alpha = (h, a) => {
  const [r, g, b] = hex2rgb(h)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function themeBlock(t) {
  const white = '#FFFFFF'
  const black = '#000000'
  const popover = t.dark ? mix(t.bg, white, 0.05) : mix(t.bg, white, 0.5)
  const card = t.dark ? mix(t.bg, white, 0.03) : mix(t.bg, white, 0.3)
  const button = mix(t.bg, t.fg, 0.09)
  const hover = mix(t.bg, t.fg, 0.07)
  const hoverSubtle = mix(t.bg, t.fg, 0.04)
  const selected = mix(t.bg, t.accent, 0.14)
  const selectedStrong = mix(t.bg, t.accent, 0.2)
  const accentHover = mix(t.accent, t.dark ? white : black, 0.15)
  const secondaryText = mix(t.fg, t.muted, 0.4)
  const faint = mix(t.muted, t.bg, 0.3)
  const borderStrong = mix(t.border, t.fg, 0.15)
  const warningText = t.dark ? t.yellow : mix(t.yellow, black, 0.25)

  const lines = [
    `  color-scheme: ${t.dark ? 'dark' : 'light'};`,
    '',
    `  --surface-app: ${t.bg};`,
    `  --surface-sidebar: ${t.panel};`,
    `  --surface-panel: ${card};`,
    `  --surface-card: ${card};`,
    `  --surface-popover: ${popover};`,
    `  --surface-input: ${t.bg};`,
    `  --surface-button: ${button};`,
    `  --surface-dialog: ${popover};`,
    `  --surface-editor: ${t.bg};`,
    `  --surface-overlay: ${t.dark ? 'rgba(8, 8, 7, 0.58)' : 'rgba(0, 0, 0, 0.3)'};`,
    '',
    `  --text-primary: ${t.fg};`,
    `  --text-secondary: ${secondaryText};`,
    `  --text-tertiary: ${mix(t.fg, t.muted, 0.7)};`,
    `  --text-muted: ${t.muted};`,
    `  --text-faint: ${faint};`,
    `  --text-heading: ${t.heading};`,
    `  --text-inverse: ${t.onAccent};`,
    '',
    `  --border-default: ${t.border};`,
    `  --border-subtle: ${mix(t.border, t.bg, 0.35)};`,
    `  --border-strong: ${borderStrong};`,
    `  --border-input: ${t.border};`,
    `  --border-dialog: ${t.border};`,
    `  --border-focus: ${t.accent};`,
    '',
    `  --state-hover: ${hover};`,
    `  --state-hover-subtle: ${hoverSubtle};`,
    `  --state-selected: ${selected};`,
    `  --state-selected-strong: ${selectedStrong};`,
    `  --state-active: ${selected};`,
    `  --state-focus-ring: ${t.accent};`,
    `  --state-drag-target: ${alpha(t.accent, 0.18)};`,
    `  --state-disabled: ${hoverSubtle};`,
    '',
    `  --accent-blue: ${t.accent};`,
    `  --accent-blue-bg: ${alpha(t.accent, 0.15)};`,
    `  --accent-blue-hover: ${accentHover};`,
    `  --accent-blue-light: ${alpha(t.accent, 0.12)};`,
    `  --accent-green: ${t.green};`,
    `  --accent-green-light: ${alpha(t.green, 0.15)};`,
    `  --accent-red: ${t.red};`,
    `  --accent-red-light: ${alpha(t.red, 0.15)};`,
    `  --accent-purple: ${t.purple};`,
    `  --accent-purple-light: ${alpha(t.purple, 0.15)};`,
    `  --accent-yellow: ${t.yellow};`,
    `  --accent-yellow-light: ${alpha(t.yellow, 0.15)};`,
    '',
    `  --feedback-warning-text: ${warningText};`,
    `  --feedback-warning-bg: ${alpha(t.yellow, 0.16)};`,
    `  --feedback-warning-border: ${t.yellow};`,
    '',
    `  --syntax-heading: ${t.accent};`,
    `  --syntax-link: ${t.accent};`,
  ]

  // Both selector forms: the plain one for light-polarity themes, and the
  // `.dark`-qualified one so dark-polarity themes outrank `:root.dark`
  // (specificity (0,3,0) > (0,2,0)) no matter the import order.
  return [
    `/* --- ${t.name} --- */`,
    `:root[data-color-theme="${t.slug}"],`,
    `:root.dark[data-color-theme="${t.slug}"] {`,
    ...lines,
    '}',
  ].join('\n')
}

const header = `/* AUTO-GENERATED by scripts/generate-themes-css.mjs — do not edit by hand.
   Fixed color themes from the brand handoff. The default "rhizome" theme is
   the light/dark contract in index.css (no data-color-theme attribute). */
`

const css = header + '\n' + THEMES.map(themeBlock).join('\n\n') + '\n'
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'themes.css')
writeFileSync(out, css)
console.log(`Wrote ${out} (${THEMES.length} themes)`)
