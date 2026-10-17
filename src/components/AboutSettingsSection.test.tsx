import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AboutSettingsSection } from './AboutSettingsSection'
import { RHIZOME_DOCS_URL } from '../constants/feedback'
import { createTranslator } from '../lib/i18n'

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & {
  openExternalUrl: ReturnType<typeof vi.fn>
}

const t = createTranslator('en')
const RHIZOME_LICENSE_URL = `${RHIZOME_DOCS_URL}/blob/main/LICENSE`
const TOLARIA_SOURCE_URL = 'https://github.com/refactoringhq/tolaria'

describe('AboutSettingsSection', () => {
  it('shows the organic banner at the source 2:1 size and keeps Contribute and Docs', () => {
    const onOpenFeedback = vi.fn()
    const onOpenDocs = vi.fn()
    render(
      <AboutSettingsSection t={t} onOpenFeedback={onOpenFeedback} onOpenDocs={onOpenDocs} />,
    )

    const banner = screen.getByRole('img', {
      name: 'Rhizome',
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

    expect(screen.getByRole('img', { name: 'Rhizome' })).toBeInTheDocument()
    expect(screen.queryByTestId('settings-about-contribute')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-about-docs')).not.toBeInTheDocument()
  })

  it('shows the AGPL notice, Tolaria credit, and legal links', () => {
    openExternalUrl.mockClear()
    render(<AboutSettingsSection t={t} />)

    const legal = screen.getByTestId('settings-about-legal')
    expect(legal).toHaveTextContent(
      'Rhizome is free software under the GNU AGPL v3.0 or later, with no warranty.',
    )
    expect(legal).toHaveTextContent(
      'A modified version of Tolaria by Luca Rossi (AGPL-3.0).',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    expect(openExternalUrl).toHaveBeenCalledWith(RHIZOME_DOCS_URL)
    fireEvent.click(screen.getByRole('button', { name: 'License' }))
    expect(openExternalUrl).toHaveBeenCalledWith(RHIZOME_LICENSE_URL)
    fireEvent.click(screen.getByRole('button', { name: 'Tolaria' }))
    expect(openExternalUrl).toHaveBeenCalledWith(TOLARIA_SOURCE_URL)
  })
})
