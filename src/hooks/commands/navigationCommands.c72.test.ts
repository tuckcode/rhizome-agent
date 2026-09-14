import { describe, expect, it, vi } from 'vitest'
import en from '../../lib/locales/en.json'
import { buildNavigationCommands } from './navigationCommands'

describe('C72 Inbox folder name', () => {
  it('keeps Go to Inbox as the folder jump, not a Notes-panel toggle', () => {
    const onSelect = vi.fn()
    const commands = buildNavigationCommands({
      onQuickOpen: vi.fn(),
      onSelect,
      showInbox: true,
    })
    const inbox = commands.find((command) => command.id === 'go-inbox')
    expect(inbox?.label).toBe('Go to Inbox')
    expect(en['command.navigation.goInbox']).toBe('Go to Inbox')
    expect(en['menu.go.inbox']).toBe('Inbox')
    inbox?.execute()
    expect(onSelect).toHaveBeenCalledWith({ kind: 'filter', filter: 'inbox' })
  })
})
