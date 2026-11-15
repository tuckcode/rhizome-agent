import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiMessage } from './AiMessage'

const pendingBash = { tool: 'bash', toolId: 't1', label: 'bash', status: 'pending' as const, input: '{"command":"pnpm test"}' }

describe('AiMessage and the run status line', () => {
  it('hides the typing dots while a tool waits for approval', () => {
    const { container } = render(
      <AiMessage
        userMessage="Run the tests"
        isStreaming
        actions={[{
          ...pendingBash,
          approval: {
            promptId: 'p1',
            args: 'pnpm test',
            options: [{ id: 'allow_once', label: 'Allow once' }, { id: 'deny', label: 'Deny' }],
          },
        }]}
      />,
    )
    expect(container.querySelector('.typing-dot')).toBeNull()
  })

  it('keeps the typing dots while a tool runs without approval', () => {
    const { container } = render(<AiMessage userMessage="Run the tests" isStreaming actions={[pendingBash]} />)
    expect(container.querySelector('.typing-dot')).toBeTruthy()
  })

  it('words the in-thread Continue like the status line', () => {
    const onContinue = vi.fn()
    render(
      <AiMessage
        userMessage="Refactor"
        actions={[]}
        response="I reached the step limit."
        messageId="m1"
        capped={{ steps: 12, max_steps: 50 }}
        onContinue={onContinue}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue for 50 more steps' }))
    expect(onContinue).toHaveBeenCalledWith('m1')
  })
})
