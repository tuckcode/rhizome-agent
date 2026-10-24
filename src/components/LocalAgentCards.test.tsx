import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { noteAiAgentsChecked, resetAiAgentsCheckedAt } from '../lib/aiAgentsCheckedAt'
import { createAiAgentAvailability, createMissingAiAgentsStatus } from '../lib/aiAgents'
import { createTranslator } from '../lib/i18n'
import { LocalAgentCards } from './LocalAgentCards'

beforeEach(() => {
  resetAiAgentsCheckedAt()
})

describe('LocalAgentCards', () => {
  it('shows the agent logos and does not stamp Last checked at mount', () => {
    const agents = {
      ...createMissingAiAgentsStatus(),
      claude_code: createAiAgentAvailability('installed', '2.1.289 (Claude Code)'),
    }
    render(
      <LocalAgentCards
        t={createTranslator('en')}
        aiAgentsStatus={agents}
        onCopyMcpConfig={() => {}}
      />,
    )

    expect(screen.getByTestId('settings-agent-card-claude_code').querySelector('img')).toHaveAttribute(
      'src',
      '/ai-agent-icons/claude-code.svg',
    )
    expect(screen.getByTestId('settings-agent-card-codex').querySelector('img')).toHaveAttribute(
      'src',
      '/ai-agent-icons/codex.svg',
    )
    expect(screen.getByTestId('settings-agent-card-codex').querySelector('img')).toHaveClass('agent-mark-invert')
    expect(screen.getByTestId('settings-agent-card-opencode').querySelector('img')).toHaveClass('agent-mark-invert')
    expect(screen.queryByTestId('settings-agents-last-checked')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('settings-agents-refresh'))
    return screen.findByTestId('settings-agents-last-checked').then((node) => {
      expect(node).toHaveTextContent('Last checked just now')
    })
  })

  it('shows the probe time, not the moment the cards mounted', () => {
    noteAiAgentsChecked(Date.now() - 5 * 60_000)
    render(
      <LocalAgentCards
        t={createTranslator('en')}
        aiAgentsStatus={createMissingAiAgentsStatus()}
      />,
    )
    expect(screen.getByTestId('settings-agents-last-checked')).toHaveTextContent('Last checked 5 min ago')
  })
})
