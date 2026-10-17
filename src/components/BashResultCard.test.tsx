import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BashResultCard } from './BashResultCard'

const JSON_RESULT = JSON.stringify({
  stdout: 'hello vault\n',
  stderr: 'note: slow\n',
  exit_code: 0,
})

describe('BashResultCard', () => {
  it('shows a collapsed row with the truncated command and exit 0', () => {
    render(
      <BashResultCard
        command="ls -la"
        input='{"command":"ls -la"}'
        output={JSON_RESULT}
        status="done"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('Ran')
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('ls -la')
    expect(screen.getByTestId('bash-result-exit')).toHaveTextContent('exit 0')
    expect(screen.getByTestId('bash-result-exit')).not.toHaveClass('text-[var(--danger-text)]')
    expect(screen.queryByTestId('bash-result-stdout')).not.toBeInTheDocument()
  })

  it('marks a failed exit in the danger token', () => {
    render(
      <BashResultCard
        command="false"
        output={JSON.stringify({ stdout: '', stderr: 'failed', exit_code: 2 })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-exit')).toHaveTextContent('exit 2')
    expect(screen.getByTestId('bash-result-exit').className).toContain('danger-text')
  })

  it('shows timed out instead of an exit code', () => {
    render(
      <BashResultCard
        command="sleep 999"
        output={JSON.stringify({ stdout: '', stderr: '', timed_out: true, exit_code: 124 })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('timed out')
    expect(screen.queryByTestId('bash-result-exit')).not.toBeInTheDocument()
  })

  it('shows stopped when the run was cancelled', () => {
    render(
      <BashResultCard
        command="npm test"
        output={JSON.stringify({ stdout: '…', cancelled: true })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('stopped')
  })

  it('expands to stdout and labelled stderr', () => {
    const onToggle = vi.fn()
    render(
      <BashResultCard
        command="ls"
        output={JSON_RESULT}
        status="done"
        expanded
        onToggle={onToggle}
      />,
    )
    expect(screen.getByTestId('bash-result-stdout')).toHaveTextContent('hello vault')
    expect(screen.getByTestId('bash-result-stdout')).toHaveClass('font-mono')
    expect(screen.getByTestId('bash-result-stderr')).toHaveTextContent('note: slow')
    expect(screen.getByTestId('bash-result-stderr-label')).toHaveTextContent('stderr')
    fireEvent.click(screen.getByTestId('bash-result-header'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('notes when truncated output keeps the start and end', () => {
    render(
      <BashResultCard
        command="cat big.log"
        output={JSON.stringify({
          stdout: 'HEAD\n…\nTAIL',
          stderr: '',
          exit_code: 0,
          truncated: true,
        })}
        status="done"
        expanded
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-trimmed')).toHaveTextContent(
      'Output trimmed (start and end shown)',
    )
  })
})
