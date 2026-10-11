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

  it('paints the splash card from the Earth palette', () => {
    expect(splashCss).toMatch(/\.boot-splash-card\s*\{[^}]*background:\s*#16170F/)
    expect(splashCss).toMatch(/\.boot-splash-card\s*\{[^}]*border:\s*1px solid #2A281D/)
    expect(splashCss).toMatch(/\[data-theme="light"\] \.boot-splash-card\s*\{[^}]*background:\s*#F8F5EE/)
    expect(splashCss).toMatch(/\[data-theme="dark"\] \.boot-splash-card\s*\{[^}]*background:\s*#16170F/)
    expect(splashCss).toMatch(/\[data-theme="dark"\] \.boot-splash-card\s*\{[^}]*border-color:\s*#2A281D/)
    expect(splashCss).not.toContain('#F7F8F5')
    expect(splashCss).not.toContain('#151A12')
    expect(splashCss).not.toContain('#3b9e83')
    expect(splashCss).toContain('var(--primary, #2C6A4D)')
  })

  it('exposes the local JetBrains face to the bootstrap stylesheet', () => {
    const face = splashCss.slice(splashCss.indexOf('@font-face'), splashCss.indexOf('.boot-splash {'))
    expect(face).toMatch(/font-family:\s*'JetBrains Mono'/)
    expect(face).toContain("url('../assets/fonts/jetbrains-mono-600-latin.woff2')")
    expect(face).not.toMatch(/url\(\s*['"]?https?:/)
  })
})
