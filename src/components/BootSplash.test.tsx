import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BootSplash } from './BootSplash'

const splashCss = readFileSync(join(process.cwd(), 'src/components/BootSplash.css'), 'utf8')

describe('BootSplash', () => {
  afterEach(() => {
    delete window.__rhizomeBootStartedAt
  })

  it('announces loading so cold launch is not an empty window', () => {
    render(<BootSplash />)
    expect(screen.getByTestId('boot-splash')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: 'Loading Rhizome' })).toBeInTheDocument()
    const card = screen.getByTestId('boot-splash-card')
    expect(card).toContainElement(screen.getByText('Starting…'))
    expect(card).toContainElement(screen.getByText('rhizome'))
  })

  it('starts the entrance at zero when no HTML splash has run', () => {
    render(<BootSplash />)
    expect(screen.getByTestId('boot-splash').style.getPropertyValue('--boot-elapsed')).toBe('0ms')
  })

  it('continues the HTML entrance instead of replaying it from zero', () => {
    window.__rhizomeBootStartedAt = performance.now() - 5_000
    render(<BootSplash />)
    const elapsed = Number.parseFloat(screen.getByTestId('boot-splash').style.getPropertyValue('--boot-elapsed'))
    expect(elapsed).toBeGreaterThanOrEqual(5_000)
    expect(splashCss).toContain('calc(120ms - var(--boot-elapsed, 0ms))')
    expect(splashCss).toContain('calc(720ms - var(--boot-elapsed, 0ms))')
  })

  it('paints the splash card from the Graphite palette by default', () => {
    expect(splashCss).toMatch(/\.boot-splash-card\s*\{[^}]*background:\s*#1C1B19/)
    expect(splashCss).toMatch(/\.boot-splash-card\s*\{[^}]*border:\s*1px solid #302F2D/)
    expect(splashCss).toMatch(/\[data-theme="light"\] \.boot-splash-card\s*\{[^}]*background:\s*#F8F5EE/)
    expect(splashCss).toMatch(/\[data-theme="dark"\] \.boot-splash-card\s*\{[^}]*background:\s*#1C1B19/)
    expect(splashCss).toMatch(/\[data-theme="dark"\] \.boot-splash-card\s*\{[^}]*border-color:\s*#302F2D/)
    expect(splashCss).toMatch(/\[data-color-theme="rhizome"\] \.boot-splash-card\s*\{[^}]*background:\s*#16170F/)
    expect(splashCss).toMatch(/\[data-color-theme="loam"\] \.boot-splash-card\s*\{[^}]*background:\s*#1D1811/)
    expect(splashCss).toMatch(/\[data-color-theme="mycelium"\] \.boot-splash-card\s*\{[^}]*background:\s*#151A12/)
    expect(splashCss).not.toContain('#F7F8F5')
    expect(splashCss).not.toContain('#3b9e83')
    expect(splashCss).toContain('var(--primary, #2C6A4D)')
  })

  it('exposes the local JetBrains face to the bootstrap stylesheet', () => {
    const face = splashCss.slice(splashCss.indexOf('@font-face'), splashCss.indexOf('.boot-splash {'))
    expect(face).toMatch(/font-family:\s*'JetBrains Mono'/)
    expect(face).toContain("url('../assets/fonts/jetbrains-mono-600-latin.woff2')")
    expect(face).not.toMatch(/url\(\s*['"]?https?:/)
  })

  it('keeps every arm visible when the user asks for reduced motion', () => {
    const noPref = mediaBlock(splashCss, 'prefers-reduced-motion: no-preference')
    const reduce = mediaBlock(splashCss, 'prefers-reduced-motion: reduce')
    expect(noPref).toContain('boot-branch-grow')
    expect(noPref).toContain('boot-node-grow')
    expect(noPref).toContain('path:nth-of-type(4)')
    expect(noPref).toContain('path:nth-of-type(5)')
    expect(noPref).toContain('circle:nth-of-type(5)')
    expect(noPref).toContain('circle:nth-of-type(6)')
    expect(reduce).toMatch(/animation:\s*none/)
    expect(reduce).not.toContain('opacity: 0')
    expect(splashCss).toMatch(/\.boot-splash path\s*\{[^}]*opacity:\s*0\.65/)
  })

  it('paused motion never holds the grow-in arms at the invisible first frame', () => {
    expect(splashCss).toContain('from { opacity: 0; transform: scale(0); }')
    expect(splashCss).toContain('animation-play-state: var(--boot-motion-state, running)')
    expect(splashCss).toMatch(/\[data-boot-motion="paused"\][^{]*path:nth-of-type\(4\)/)
    expect(splashCss).toMatch(/\[data-boot-motion="paused"\][^{]*path:nth-of-type\(5\)/)
    expect(splashCss).toMatch(/\[data-boot-motion="paused"\][^{]*circle:nth-of-type\(5\)/)
    expect(splashCss).toMatch(/\[data-boot-motion="paused"\][^{]*circle:nth-of-type\(6\)/)
    const pausedAt = splashCss.indexOf('[data-boot-motion="paused"]')
    expect(pausedAt).toBeGreaterThanOrEqual(0)
    const paused = braceBlock(splashCss, splashCss.indexOf('{', pausedAt))
    expect(paused).toMatch(/animation:\s*none/)
    expect(paused).not.toContain('opacity: 0')
  })
})

function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(`@media (${query})`)
  if (start < 0) throw new Error(`missing @media (${query})`)
  return braceBlock(css, css.indexOf('{', start))
}

function braceBlock(source: string, openAt: number): string {
  if (openAt < 0 || source[openAt] !== '{') throw new Error('missing opening brace')
  let depth = 0
  for (let index = openAt; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(openAt, index + 1)
    }
  }
  throw new Error('unclosed block')
}
