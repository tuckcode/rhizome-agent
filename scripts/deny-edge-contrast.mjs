// Contrast of the danger-card Deny edge against the card, in every theme.
// Start a Vite server first, for example `pnpm exec vite --port 4178`.
// Usage: node scripts/deny-edge-contrast.mjs [css-color] [base-url]
// The default color is the one ToolApprovalCard uses for the danger Deny edge.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const edge = process.argv[2] ?? 'color-mix(in srgb, var(--foreground) 85%, var(--card))'
const base = process.argv[3] ?? 'http://localhost:4178/scripts/audit-chat-shots.html'
// Each named theme block opens with its selector and then its color-scheme.
const named = [...readFileSync('src/themes.css', 'utf8')
  .matchAll(/^:root\[data-color-theme="([^"]+)"\][^{]*\{\s*color-scheme:\s*(dark|light)/gm)]
  .map((match) => ({ name: match[1], dark: match[2] === 'dark' }))
const themes = [
  { name: 'graphite', dark: true, colorTheme: null },
  { name: 'earth-light', dark: false, colorTheme: null },
  ...named.map((theme) => ({ ...theme, colorTheme: theme.name })),
]

function channels(value) {
  const srgb = value.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/)
  if (srgb) return srgb.slice(1, 4).map((part) => Number(part) * 255)
  const rgb = value.match(/rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/)
  if (rgb) return rgb.slice(1, 4).map(Number)
  throw new Error(`Cannot read color ${value}`)
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(base, { waitUntil: 'networkidle' })
const rows = []
for (const theme of themes) {
  const read = await page.evaluate(({ theme, edge }) => {
    const root = document.documentElement
    root.classList.toggle('dark', theme.dark)
    root.dataset.theme = theme.dark ? 'dark' : 'light'
    if (theme.colorTheme) root.dataset.colorTheme = theme.colorTheme
    else root.removeAttribute('data-color-theme')
    const probe = document.createElement('div')
    probe.style.background = 'var(--card)'
    probe.style.borderColor = edge
    probe.style.borderStyle = 'solid'
    document.body.appendChild(probe)
    const style = getComputedStyle(probe)
    const result = { card: style.backgroundColor, edge: style.borderTopColor }
    probe.remove()
    return result
  }, { theme, edge })
  rows.push({ theme: theme.name, ratio: contrast(channels(read.card), channels(read.edge)) })
}
await browser.close()

rows.sort((a, b) => a.ratio - b.ratio)
for (const row of rows) console.log(`${row.theme.padEnd(18)} ${row.ratio.toFixed(2)}:1`)
console.log(`min ${rows[0].theme} ${rows[0].ratio.toFixed(2)}:1`)
process.exitCode = rows[0].ratio >= 3 ? 0 : 1
