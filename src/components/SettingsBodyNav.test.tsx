import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsBodyNav } from './SettingsBodyNav'
import { SETTINGS_SECTION_IDS } from './settingsSectionIds'

/**
 * Browser preview, 2026-09-26: picking About (the last section) stopped
 * short, because Packages loads its catalog lazily while the smooth scroll
 * passes it and the content above About grows. The nav keeps the picked
 * heading at the top while content settles, until the user scrolls.
 */
describe('SettingsBodyNav keeps the picked section at the top', () => {
  const observers: Array<() => void> = []

  afterEach(() => {
    observers.length = 0
    vi.unstubAllGlobals()
  })

  function renderWithSection() {
    vi.stubGlobal('ResizeObserver', class {
      live = true
      constructor(callback: () => void) {
        observers.push(() => { if (this.live) callback() })
      }
      observe() {}
      disconnect() { this.live = false }
    })
    render(
      <div>
        <SettingsBodyNav t={(key) => key} />
        <div className="overflow-auto" data-testid="scroll">
          <section id={SETTINGS_SECTION_IDS.about}>About</section>
        </div>
      </div>,
    )
    const section = document.getElementById(SETTINGS_SECTION_IDS.about)!
    const scrollIntoView = vi.fn()
    section.scrollIntoView = scrollIntoView
    return { scrollIntoView }
  }

  it('re-aligns the heading when content above it grows', () => {
    const { scrollIntoView } = renderWithSection()
    fireEvent.click(screen.getByTestId(`settings-nav-${SETTINGS_SECTION_IDS.about}`))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })

    observers.forEach((fire) => fire())
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' })
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('stops following once the user scrolls', () => {
    const { scrollIntoView } = renderWithSection()
    fireEvent.click(screen.getByTestId(`settings-nav-${SETTINGS_SECTION_IDS.about}`))
    fireEvent.wheel(screen.getByTestId('scroll'))

    observers.forEach((fire) => fire())
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
