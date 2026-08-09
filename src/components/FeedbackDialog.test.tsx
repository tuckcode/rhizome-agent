import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackDialog } from './FeedbackDialog'
import {
  RHIZOME_DOCS_URL,
  RHIZOME_PRODUCT_BOARD_URL,
} from '../constants/feedback'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { rememberFeedbackDialogOpener } from '../lib/feedbackDialogOpener'

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & {
  openExternalUrl: ReturnType<typeof vi.fn>
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders the contribution paths when open', () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel="alpha" />)
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
    expect(screen.getByText('Contribute to Rhizome')).toBeInTheDocument()
    expect(screen.getByText('Pick the path that fits what you want to do! Any type of help is appreciated')).toBeInTheDocument()
    expect(screen.getByText('About Rhizome')).toBeInTheDocument()
    expect(screen.getByText('Feature ideas')).toBeInTheDocument()
    expect(screen.queryByText('Discussions')).not.toBeInTheDocument()
    expect(screen.queryByText('Contribute code')).not.toBeInTheDocument()
    expect(screen.getByText('Report a bug')).toBeInTheDocument()
    expect(screen.getByText(/Rhizome Desktop is a personal, files-first knowledge/i)).toBeInTheDocument()
    expect(screen.getByText(/not open for outside contributions/i)).toBeInTheDocument()
    expect(screen.getByText('Track ideas and planned work as GitHub issues on the repo.')).toBeInTheDocument()
    expect(screen.getByText('Explain how to reproduce, what you expected, vs what happened. Attach the diagnostics please!')).toBeInTheDocument()
    expect(screen.queryByText(/Sanitized and optional/i)).not.toBeInTheDocument()
  })

  it('localizes the contribution dialog', () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" locale="zh-CN" releaseChannel="alpha" />)

    expect(screen.getByText('参与 Rhizome 贡献')).toBeInTheDocument()
    expect(screen.getByText('功能请求')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开产品看板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制已清理的诊断信息' })).toBeInTheDocument()
    expect(screen.queryByText('Contribute to Rhizome')).not.toBeInTheDocument()
    expect(screen.queryByText('Feature requests')).not.toBeInTheDocument()
  })

  it('focuses the primary CTA when opened', async () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel={null} />)
    const cta = screen.getByRole('button', { name: 'View the repo' })
    await waitFor(() => expect(cta).toHaveFocus())
  })

  it('opens the expected contribution links without closing the modal', async () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'View the repo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse GitHub Issues' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open GitHub Issues' }))

    await waitFor(() => expect(openExternalUrl).toHaveBeenNthCalledWith(1, RHIZOME_DOCS_URL))
    expect(openExternalUrl).toHaveBeenNthCalledWith(2, RHIZOME_PRODUCT_BOARD_URL)
    expect(openExternalUrl).toHaveBeenNthCalledWith(3, RHIZOME_PRODUCT_BOARD_URL)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument()
  })

  it('copies a sanitized diagnostic bundle', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel="alpha" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy sanitized diagnostics' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]?.[0]).toContain('Rhizome sanitized diagnostics')
    expect(writeText.mock.calls[0]?.[0]).toContain('Build: b281')
    expect(writeText.mock.calls[0]?.[0]).toContain('Release channel: alpha')
    expect(screen.getByText('Diagnostics copied.')).toBeInTheDocument()
  })

  it('shows a fallback message when a contribution link cannot be opened', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('blocked'))

    render(<FeedbackDialog open={true} onClose={vi.fn()} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse GitHub Issues' }))

    expect(await screen.findByText(/couldn’t open GitHub Issues automatically/i)).toBeInTheDocument()
    expect(screen.getByText(RHIZOME_PRODUCT_BOARD_URL)).toBeInTheDocument()
  })

  it('closes when pressing Escape', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when clicking the top-right Close control', () => {
    const onClose = vi.fn()
    render(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('reopens the command palette after closing when launched from it', () => {
    vi.useFakeTimers()

    const opener = document.createElement('input')
    opener.setAttribute('placeholder', 'Type a command...')
    document.body.appendChild(opener)
    rememberFeedbackDialogOpener(opener)

    const onClose = vi.fn()
    const handleReopen = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, handleReopen)

    const { rerender } = render(
      <FeedbackDialog open={false} onClose={onClose} buildNumber="b281" releaseChannel={null} />,
    )

    rerender(<FeedbackDialog open={true} onClose={onClose} buildNumber="b281" releaseChannel={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    vi.advanceTimersByTime(100)

    expect(onClose).toHaveBeenCalledOnce()
    expect(handleReopen).toHaveBeenCalledTimes(1)
    expect(handleReopen.mock.calls[0]?.[0]).toMatchObject({
      detail: APP_COMMAND_IDS.viewCommandPalette,
    })

    window.removeEventListener(APP_COMMAND_EVENT_NAME, handleReopen)
    opener.remove()
    vi.useRealTimers()
  })
})
