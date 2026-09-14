import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AboutSettingsSection } from './AboutSettingsSection'
import { createTranslator } from '../lib/i18n'

const t = createTranslator('en')

describe('AboutSettingsSection', () => {
  it('shows the organic banner at the source 2:1 size and keeps Contribute and Docs', () => {
    const onOpenFeedback = vi.fn()
    const onOpenDocs = vi.fn()
    render(
      <AboutSettingsSection t={t} onOpenFeedback={onOpenFeedback} onOpenDocs={onOpenDocs} />,
    )

    const banner = screen.getByRole('img', {
      name: 'Rhizome Agent. Your work. Your memory. Chat with Prime. Keep what matters.',
    })
    expect(banner).toHaveAttribute('width', '1774')
    expect(banner).toHaveAttribute('height', '887')
    expect(banner).toHaveClass('w-full')
    expect(banner.getAttribute('src') ?? '').toMatch(/rhizome-organic-hero/)

    expect(screen.getByTestId('settings-about-contribute')).toBeInTheDocument()
    expect(screen.getByTestId('settings-about-docs')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('settings-about-contribute-open'))
    expect(onOpenFeedback).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('settings-about-docs-open'))
    expect(onOpenDocs).toHaveBeenCalledOnce()
  })

  it('does not render Contribute or Docs when those actions are missing', () => {
    render(<AboutSettingsSection t={t} />)

    expect(screen.getByRole('img', { name: /Your work\. Your memory/ })).toBeInTheDocument()
    expect(screen.queryByTestId('settings-about-contribute')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-about-docs')).not.toBeInTheDocument()
  })
})
