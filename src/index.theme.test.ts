import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Regression guard for the Rhizome default-theme redesign: the two
// first-party default theme blocks in index.css must keep the Rhizome
// green accent, not silently regress back to Tolaria blue (#155DFF light /
// #78A4FF dark). Structure-insensitive: matches the theme block by its
// selector, not by line number, so unrelated edits to the file don't break it.
const css = readFileSync(join(__dirname, 'index.css'), 'utf-8')

function extractAccentBlue(blockSelectorRegex: RegExp): string {
  const blockMatch = blockSelectorRegex.exec(css)
  expect(blockMatch).not.toBeNull()
  const blockStart = blockMatch!.index + blockMatch![0].length
  const blockEnd = css.indexOf('\n}', blockStart)
  const block = css.slice(blockStart, blockEnd)
  const accentMatch = /--accent-blue:\s*(#[0-9A-Fa-f]{6})/.exec(block)
  expect(accentMatch).not.toBeNull()
  return accentMatch![1]
}

describe('index.css default theme tokens', () => {
  it('keeps the Rhizome green accent in the default light theme', () => {
    const lightBlock = /:root,\s*\n\[data-theme="light"\]\s*\{/
    expect(extractAccentBlue(lightBlock).toUpperCase()).toBe('#2E6B4F')
  })

  it('keeps the Rhizome phosphor-mint accent in the default dark theme', () => {
    const darkBlock = /:root\.dark,\s*\n\[data-theme="dark"\]\s*\{/
    expect(extractAccentBlue(darkBlock).toUpperCase()).toBe('#6FE3A0')
  })
})

describe('theme picker swatch stays in sync with the default theme tokens', () => {
  // The Rhizome chip in Settings → Appearance is a static hex tuple in
  // themeMode.ts — it does not read CSS variables. This guard failed silently
  // during the ledger/mycelium redesign (chip previewed Tolaria white/blue
  // while clicking applied sage/forest). Keep the tuple pinned to the
  // light-theme tokens: [--surface-sidebar, --surface-app, --accent-blue].
  it('Rhizome swatch tuple matches the light-theme surface and accent tokens', () => {
    const themeModeTs = readFileSync(join(__dirname, 'lib', 'themeMode.ts'), 'utf-8')
    const swatchMatch =
      /slug:\s*'rhizome'[^}]*swatch:\s*\[\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})'\s*\]/.exec(
        themeModeTs,
      )
    expect(swatchMatch).not.toBeNull()
    const [, sidebar, app, accent] = swatchMatch!
    expect(sidebar.toUpperCase()).toBe('#E9ECE5')
    expect(app.toUpperCase()).toBe('#EFF1EC')
    expect(accent.toUpperCase()).toBe('#2E6B4F')
  })
})
