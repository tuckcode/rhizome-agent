import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatEngineSettings } from './ChatEngineSettings'

describe('ChatEngineSettings', () => {
  it('explains which engine new chats use and when Prime falls back', () => {
    render(<ChatEngineSettings engine="prime" onChange={vi.fn()} />)

    const row = screen.getByTestId('settings-chat-engine')
    expect(row).toHaveTextContent("New chats use Prime unless you turn this on for Rhizome's engine")
    expect(row).toHaveTextContent(
      'Prime chats fall back to Rhizome only after we know Prime is not installed',
    )
    expect(row).toHaveTextContent('an open chat stays on the engine it started on')
  })
})
