import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetListProviderModelsCache } from '../lib/listProviderModels'
import { publishClaudeCodeEngineEnabled, resetClaudeCodeEngineForTests } from '../lib/claudeCodeEngine'
import { NativeChatModelPicker } from './NativeChatModelPicker'

const host = vi.hoisted(() => ({
  calls: [] as string[],
  status: { installed: true, version: '2.1.325 (Claude Code)', loggedIn: true, authMethod: 'claude.ai' } as unknown,
}))

vi.mock('../lib/callHost', () => ({
  callHost: vi.fn(async (cmd: string) => {
    host.calls.push(cmd)
    if (cmd === 'get_claude_code_engine_status') return host.status
    if (cmd === 'native_model_vision') return 'unknown'
    if (cmd.startsWith('oauth_')) {
      return { provider: 'openai', enabled: false, signed_in: false, usable: false, email: null, revoked: true }
    }
    return []
  }),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackRhizomeModelChanged: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>)
}

function openMenu() {
  fireEvent.pointerDown(
    screen.getByTestId('native-chat-model-trigger'),
    new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
  )
}

afterEach(() => {
  resetClaudeCodeEngineForTests()
  resetListProviderModelsCache()
  host.calls = []
  host.status = { installed: true, version: '2.1.325 (Claude Code)', loggedIn: true, authMethod: 'claude.ai' }
})

describe('NativeChatModelPicker with Claude Code', () => {
  it('offers no Claude Code row and asks nothing while Settings has it off', async () => {
    render(<NativeChatModelPicker value={null} onChange={vi.fn()} />)
    openMenu()
    await screen.findByTestId('native-chat-model-menu')
    expect(screen.queryByTestId('native-chat-model-claude-code')).toBeNull()
    expect(host.calls).not.toContain('get_claude_code_engine_status')
  })

  it('lets a new chat pick a signed-in Claude Code', async () => {
    act(() => publishClaudeCodeEngineEnabled(true))
    const onChange = vi.fn()
    render(<NativeChatModelPicker value={null} onChange={onChange} />)
    openMenu()
    const row = await screen.findByTestId('native-chat-model-claude-code')
    await waitFor(() => expect(row).not.toHaveAttribute('aria-disabled'))
    expect(row).toHaveTextContent('Claude Code')
    fireEvent.click(row)
    expect(onChange).toHaveBeenCalledWith('agent:claude_code')
  })

  it('keeps a signed-out Claude Code unpickable and points at the terminal', async () => {
    host.status = { installed: true, version: '2.1.325', loggedIn: false, authMethod: null }
    act(() => publishClaudeCodeEngineEnabled(true))
    const onChange = vi.fn()
    render(<NativeChatModelPicker value={null} onChange={onChange} />)
    openMenu()
    const status = await screen.findByTestId('native-chat-model-claude-code-status')
    await waitFor(() => expect(status).toHaveTextContent('Run claude auth login in your terminal'))
    const row = screen.getByTestId('native-chat-model-claude-code')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(row)
    expect(onChange).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('native-chat-model-claude-code-group')).queryByRole('button')).toBeNull()
  })

  it('shows a Claude Code pick by its plain name and a neutral terminal icon', () => {
    act(() => publishClaudeCodeEngineEnabled(true))
    render(<NativeChatModelPicker variant="chip" value="agent:claude_code" onChange={vi.fn()} />)
    expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Claude Code')
    expect(screen.getByTestId('native-chat-model-claude-code-icon')).toBeInTheDocument()
    expect(screen.getByTestId('native-chat-model-trigger')).toHaveAccessibleName('Claude Code')
  })
})
