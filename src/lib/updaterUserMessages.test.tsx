import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  UPDATER_RELEASES_PAGE_LABEL,
  UPDATER_USER_MESSAGES,
  isAllowlistedUpdaterInstallError,
  isAllowlistedUpdaterVersionChangedMessage,
  renderUpdaterUserMessage,
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

  it('renders the Releases page label as a link', () => {
    render(<>{renderUpdaterUserMessage(UPDATER_USER_MESSAGES.installFailed)}</>)

    const link = screen.getByRole('button', { name: UPDATER_RELEASES_PAGE_LABEL })
    fireEvent.click(link)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://github.com/tuckcode/rhizome-agent/releases')
  })
})
