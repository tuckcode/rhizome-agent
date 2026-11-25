import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetClaudeCodeEngineForTests } from '../lib/claudeCodeEngine'
import { ClaudeCodeEngineSettingsSection } from './ClaudeCodeEngineSettingsSection'

const host = vi.hoisted(() => ({
  calls: [] as string[],
  status: { installed: true, version: '2.1.325 (Claude Code)', loggedIn: false, authMethod: null } as unknown,
}))

vi.mock('../lib/callHost', () => ({
  callHost: vi.fn(async (cmd: string) => {
    host.calls.push(cmd)
    return host.status
  }),
}))

const tracked = vi.hoisted(() => ({ events: [] as Array<[string, unknown]> }))
vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn((name: string, props: unknown) => {
    tracked.events.push([name, props])
  }),
}))

afterEach(() => {
  resetClaudeCodeEngineForTests()
  host.calls = []
  tracked.events = []
})

describe('ClaudeCodeEngineSettingsSection', () => {
  it('is off by default, asks Claude Code nothing, and still states whose product it is', () => {
    render(<ClaudeCodeEngineSettingsSection enabled={false} onEnabledChange={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Run chats with your installed Claude Code' })).not.toBeChecked()
    expect(screen.queryByTestId('settings-claude-code-engine-status')).toBeNull()
    expect(screen.getByTestId('settings-claude-code-engine-notes')).toHaveTextContent(
      "Claude Code is Anthropic's product. Anthropic does not make or endorse Rhizome.",
    )
    expect(host.calls).toEqual([])
  })

  it('turns on through the switch and tracks only the switch position', () => {
    const onEnabledChange = vi.fn()
    render(<ClaudeCodeEngineSettingsSection enabled={false} onEnabledChange={onEnabledChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Run chats with your installed Claude Code' }))
    expect(onEnabledChange).toHaveBeenCalledWith(true)
    expect(tracked.events).toEqual([['claude_code_engine_toggled', { enabled: 'on' }]])
  })

  it('shows terminal text, not a sign-in button, when Claude Code is signed out', async () => {
    render(<ClaudeCodeEngineSettingsSection enabled onEnabledChange={vi.fn()} />)
    const status = screen.getByTestId('settings-claude-code-engine-status')
    await waitFor(() => expect(status).toHaveTextContent('Run claude auth login in your terminal'))
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).toBeNull()
    fireEvent.click(screen.getByTestId('settings-claude-code-engine-check'))
    await waitFor(() => expect(host.calls).toHaveLength(2))
  })
})
