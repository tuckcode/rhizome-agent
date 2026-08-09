import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BridgeTokenRow } from './BridgeTokenRow'
import { createTranslator } from '../lib/i18n'

const TOKEN = 'deadbeefdeadbeefdeadbeefdeadbeef'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))

const mockIsTauri = vi.fn(() => true)
vi.mock('../mock-tauri', () => ({ isTauri: () => mockIsTauri() }))

const mockWriteClipboardText = vi.fn()
vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: (...args: unknown[]) => mockWriteClipboardText(...args),
}))

const mockTrack = vi.fn()
vi.mock('../lib/productAnalytics', () => ({
  trackBridgeTokenCopied: () => mockTrack(),
}))

const t = createTranslator('en')

function renderRow() {
  return render(<BridgeTokenRow t={t} />)
}

describe('BridgeTokenRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(true)
    mockInvoke.mockResolvedValue({ bridge_token: TOKEN })
    mockWriteClipboardText.mockResolvedValue(undefined)
  })

  it('asks for nothing outside the desktop app', () => {
    mockIsTauri.mockReturnValue(false)
    const { container } = renderRow()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('never renders the token until the user asks for it', async () => {
    renderRow()
    await waitFor(() => expect(screen.getByTestId('bridge-token-value')).toBeInTheDocument())

    expect(screen.getByTestId('bridge-token-value').textContent).not.toContain(TOKEN)
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument()
  })

  it('reveals the token on request and hides it again', async () => {
    renderRow()
    await waitFor(() => expect(screen.getByTestId('bridge-token-reveal')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('bridge-token-reveal'))
    expect(screen.getByTestId('bridge-token-value').textContent).toBe(TOKEN)

    fireEvent.click(screen.getByTestId('bridge-token-reveal'))
    expect(screen.getByTestId('bridge-token-value').textContent).not.toContain(TOKEN)
  })

  it('copies the real token even while it is masked', async () => {
    renderRow()
    await waitFor(() => expect(screen.getByTestId('bridge-token-copy')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('bridge-token-copy'))

    expect(mockWriteClipboardText).toHaveBeenCalledWith(TOKEN)
    // Tracked only after the copy actually resolves — a failed copy is not
    // a pairing attempt worth counting.
    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('bridge-token-status').textContent).toBe(
      t('settings.bridgeToken.copied'),
    )
  })

  it('reports a copy failure instead of claiming success', async () => {
    mockWriteClipboardText.mockRejectedValue(new Error('no clipboard'))
    renderRow()
    await waitFor(() => expect(screen.getByTestId('bridge-token-copy')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('bridge-token-copy'))

    await waitFor(() => {
      expect(screen.getByTestId('bridge-token-status').textContent).toBe(
        t('settings.bridgeToken.copyFailed'),
      )
    })
  })

  it('renders nothing when the app has no token yet', async () => {
    mockInvoke.mockResolvedValue({ bridge_token: null })
    const { container } = renderRow()
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when settings cannot be read', async () => {
    mockInvoke.mockRejectedValue(new Error('nope'))
    const { container } = renderRow()
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
