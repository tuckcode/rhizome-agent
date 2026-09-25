import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChatEngineUpdateBanner } from './ChatEngineUpdateBanner'
import type { PrimeUpdateStatus } from '../hooks/usePrimeUpdate'

const available: PrimeUpdateStatus = {
  state: 'available',
  version: '0.9.5',
  notes: '- notes',
  url: 'https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.9.5',
}

describe('ChatEngineUpdateBanner', () => {
  it('stays hidden when no Chat engine update is offered', () => {
    render(<ChatEngineUpdateBanner status={{ state: 'idle' }} onUpdate={vi.fn()} />)
    expect(screen.queryByTestId('chat-engine-update-banner')).not.toBeInTheDocument()
  })

  it('shows the offered version and Update now without a second click to reveal it', () => {
    const onUpdate = vi.fn()
    render(<ChatEngineUpdateBanner status={available} onUpdate={onUpdate} />)

    expect(screen.getByTestId('chat-engine-update-banner')).toHaveTextContent('Chat engine 0.9.5')
    expect(screen.queryByText('dev')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('hides the offer after Not now, until the offered version changes', () => {
    const { rerender } = render(<ChatEngineUpdateBanner status={available} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByTestId('chat-engine-update-banner')).not.toBeInTheDocument()

    rerender(<ChatEngineUpdateBanner status={{ ...available, version: '0.9.6' }} onUpdate={vi.fn()} />)
    expect(screen.getByTestId('chat-engine-update-banner')).toHaveTextContent('Chat engine 0.9.6')
  })
})
