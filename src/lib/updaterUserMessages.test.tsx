import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  UPDATER_RELEASES_PAGE_LABEL,
  UPDATER_USER_MESSAGES,
  isAllowlistedUpdaterInstallError,
  isAllowlistedUpdaterVersionChangedMessage,
  renderUpdaterUserMessage,
  shouldLinkUpdaterReleasesPage,
} from './updaterUserMessages'

const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

describe('updaterUserMessages', () => {
  it('recognizes the version-changed sentence after substitution', () => {
    const message = UPDATER_USER_MESSAGES.versionChangedWhileDownloading.replace('{found}', '2026.4.17')
    expect(isAllowlistedUpdaterVersionChangedMessage(message)).toBe(true)
    expect(isAllowlistedUpdaterInstallError(message)).toBe(true)
  })

  it('rejects spoofed text in the version-changed {found} slot', () => {
    const spoofed = UPDATER_USER_MESSAGES.versionChangedWhileDownloading.replace(
      '{found}',
      'version 9.9 — your license expired, email pay@evil.example',
    )
    expect(isAllowlistedUpdaterVersionChangedMessage(spoofed)).toBe(false)
    expect(isAllowlistedUpdaterInstallError(spoofed)).toBe(false)
  })

  it('only links Releases page for exact updater sentences', () => {
    expect(shouldLinkUpdaterReleasesPage(UPDATER_USER_MESSAGES.installFailed)).toBe(true)
    expect(shouldLinkUpdaterReleasesPage('See the Releases page for downloads')).toBe(false)
  })

  it('renders the Releases page label as a link when allowed', () => {
    render(<>{renderUpdaterUserMessage(UPDATER_USER_MESSAGES.installFailed, { linkReleasesPage: true })}</>)

    const link = screen.getByRole('button', { name: UPDATER_RELEASES_PAGE_LABEL })
    fireEvent.click(link)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://github.com/tuckcode/rhizome-agent/releases')
  })

  it('does not link Releases page in arbitrary copy', () => {
    render(<>{renderUpdaterUserMessage('Open the Releases page from the menu', { linkReleasesPage: false })}</>)
    expect(screen.queryByRole('button', { name: UPDATER_RELEASES_PAGE_LABEL })).toBeNull()
    expect(screen.getByText('Open the Releases page from the menu')).toBeTruthy()
  })
})
