import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLockup, BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('renders the 3c Network geometry (matching the OS icon) with theme-reactive tokens', () => {
    const { container } = render(<BrandMark size={32} />)

    const svg = screen.getByTestId('brand-mark')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100')

    // 5 links + 6 nodes (core + 5 satellites, asymmetric: 4 diagonal + 1
    // vertical) per ADR 0157 — matches src-tauri/icons/icon-source.svg
    // geometry (color intentionally differs, see ADR 0157 update).
    expect(container.querySelectorAll('path')).toHaveLength(5)
    expect(container.querySelectorAll('circle')).toHaveLength(6)

    // Theme tokens, not hardcoded hex — the in-app mark must stay legible
    // against every theme's sidebar background (unlike the OS icon, which
    // has a fixed dark tile behind it and can safely use fixed color).
    // Core uses --primary (not --accent-blue) so it follows the Rhizome
    // theme's accent-color picker too, not just the 14 fixed-skin themes.
    const svgMarkup = container.innerHTML
    expect(svgMarkup).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(svgMarkup).toContain('var(--primary)')
    expect(svgMarkup).toContain('var(--text-primary)')
    expect(svgMarkup).toContain('var(--text-muted)')
  })

  it('locks the wordmark to lowercase JetBrains Mono regardless of context', () => {
    render(<BrandLockup />)

    const lockup = screen.getByTestId('brand-lockup')
    expect(lockup).toHaveTextContent('rhizome')
    // Exact lowercase — the brand never renders "Rhizome" in chrome.
    expect(lockup.textContent).toBe('rhizome')

    const word = lockup.querySelector('span > span, span span') as HTMLElement
    expect(word.style.fontFamily).toContain('JetBrains Mono')
    expect(word.style.fontWeight).toBe('600')
    expect(word.style.letterSpacing).toBe('-0.04em')
  })
})
