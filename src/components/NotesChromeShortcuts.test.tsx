import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { trackEvent } from '../lib/telemetry'
import {
  NOTES_CHROME_EVENT,
  NotesChromeShortcuts,
  consumePendingConnectionsView,
  resetNotesChromePendingForTests,
} from './NotesChromeShortcuts'

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

afterEach(() => {
  resetNotesChromePendingForTests()
  vi.mocked(trackEvent).mockClear()
})

describe('NotesChromeShortcuts', () => {
  it('renders Research, Settings, Mycelium, and Wiki Graph as icon-only buttons', () => {
    render(<NotesChromeShortcuts />)

    const group = screen.getByRole('group', { name: 'Workspace shortcuts' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open the Research panel' })).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Open settings' })).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Mycelium' })).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Wiki Graph' })).toHaveTextContent('')
  })

  it('dispatches Settings through the existing app-settings command', () => {
    const listener = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, listener)

    try {
      render(<NotesChromeShortcuts />)
      fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
      expect((listener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe(APP_COMMAND_IDS.appSettings)
      expect(trackEvent).toHaveBeenCalledWith('notes_chrome_shortcut', { destination: 'settings' })
    } finally {
      window.removeEventListener(APP_COMMAND_EVENT_NAME, listener)
    }
  })

  it('asks StatusBar to open Research without a new App.tsx prop', () => {
    const listener = vi.fn()
    window.addEventListener(NOTES_CHROME_EVENT, listener)

    try {
      render(<NotesChromeShortcuts />)
      fireEvent.click(screen.getByRole('button', { name: 'Open the Research panel' }))
      expect((listener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe('research')
    } finally {
      window.removeEventListener(NOTES_CHROME_EVENT, listener)
    }
  })

  it('opens Wiki Graph through the existing status-bar graph handler', () => {
    const listener = vi.fn()
    window.addEventListener(NOTES_CHROME_EVENT, listener)

    try {
      render(<NotesChromeShortcuts />)
      fireEvent.click(screen.getByRole('button', { name: 'Wiki Graph' }))
      expect((listener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe('graph')
    } finally {
      window.removeEventListener(NOTES_CHROME_EVENT, listener)
    }
  })

  it('switches to Changes then opens Mycelium so the docked panel can mount', () => {
    const commandListener = vi.fn()
    const chromeListener = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, commandListener)
    window.addEventListener(NOTES_CHROME_EVENT, chromeListener)

    try {
      render(<NotesChromeShortcuts />)
      fireEvent.click(screen.getByRole('button', { name: 'Mycelium' }))
      expect((commandListener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe(APP_COMMAND_IDS.goChanges)
      expect((chromeListener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe('mycelium')
      expect(consumePendingConnectionsView()).toBe('mycelium')
    } finally {
      window.removeEventListener(APP_COMMAND_EVENT_NAME, commandListener)
      window.removeEventListener(NOTES_CHROME_EVENT, chromeListener)
    }
  })
})
