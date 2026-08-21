import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfettiCannon } from './ConfettiCannon'
import { readConfettiColors } from '../lib/confettiColors'

describe('ConfettiCannon', () => {
  it('is invisible to assistive tech and never takes the pointer', () => {
    render(<ConfettiCannon fireKey={0} />)

    const canvas = screen.getByTestId('confetti-cannon')
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(canvas.className).toContain('pointer-events-none')
  })

  /**
   * A window that celebrates the moment it opens has celebrated nothing. The
   * key counts real events, so zero must stay silent.
   */
  it('does not fire on mount', () => {
    expect(() => render(<ConfettiCannon fireKey={0} />)).not.toThrow()
  })

  it('survives an engine with no canvas support rather than taking the window down', () => {
    // jsdom has no 2D context and no OffscreenCanvas: this render exercises
    // exactly the unsupported-engine path.
    expect(() => render(<ConfettiCannon fireKey={3} />)).not.toThrow()
  })

  it('stays mounted but silent when disabled', () => {
    render(<ConfettiCannon fireKey={2} enabled={false} />)
    expect(screen.getByTestId('confetti-cannon')).toBeInTheDocument()
  })
})

describe('colours', () => {
  it('falls back to a readable palette when the theme yields nothing', () => {
    expect(readConfettiColors(null).length).toBeGreaterThan(0)
  })

  it('prefers the theme tokens when they are set', () => {
    const host = document.createElement('div')
    host.style.setProperty('--accent-blue', '#0000ff')
    host.style.setProperty('--accent-green', '#00ff00')
    document.body.append(host)

    expect(readConfettiColors(host)).toEqual(['#0000ff', '#00ff00'])

    host.remove()
  })
})

describe('reduced motion', () => {
  it('never builds a renderer when the system asks for less motion', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal('matchMedia', matchMedia)
    Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true })

    render(<ConfettiCannon fireKey={5} />)

    // The canvas stays in the tree — it is inert, not conditionally mounted,
    // so turning the preference off does not require a remount.
    expect(screen.getByTestId('confetti-cannon')).toBeInTheDocument()
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')

    vi.unstubAllGlobals()
  })
})
