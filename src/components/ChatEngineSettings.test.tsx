import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatEngineSettings } from './ChatEngineSettings'

describe('ChatEngineSettings', () => {
  it('explains which engine new chats use and when Prime falls back', () => {
    render(<ChatEngineSettings engine="prime" onChange={vi.fn()} />)

    const row = screen.getByTestId('settings-chat-engine')
    expect(row).toHaveTextContent("On: new chats use Rhizome's engine")
    expect(row).toHaveTextContent(
      "Off: new chats use Prime, and they switch to Rhizome's engine if Prime isn't installed",
    )
    expect(row).toHaveTextContent('An open chat stays on the engine it started with')
    expect(row).toHaveTextContent('Changes apply to new chats.')
  })
})
