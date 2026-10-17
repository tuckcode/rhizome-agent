import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BASH_RESULT_KIND } from '../lib/bashToolResult'
import { BashResultCard } from './BashResultCard'

function result(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    kind: BASH_RESULT_KIND,
    exit_code: 0,
    timed_out: false,
    stopped: false,
    stdout: 'hello vault\n',
    stderr: 'note: slow\n',
    stdout_truncated: false,
    stderr_truncated: false,
    ...over,
  })
}

describe('BashResultCard', () => {
  it('shows a collapsed row with the truncated command and exit 0', () => {
    render(
      <BashResultCard
        command="ls -la"
        output={result()}
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
        output={result({ stdout: '', stderr: 'failed', exit_code: 2 })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-exit')).toHaveTextContent('exit 2')
    expect(screen.getByTestId('bash-result-exit').className).toContain('danger-text')
  })

  it('shows timed out in the danger token instead of an exit code', () => {
    render(
      <BashResultCard
        command="sleep 999"
        output={result({ stdout: '', stderr: '', timed_out: true, exit_code: 124 })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-timed-out')).toHaveTextContent('timed out')
    expect(screen.getByTestId('bash-result-timed-out').className).toContain('danger-text')
    expect(screen.queryByTestId('bash-result-exit')).not.toBeInTheDocument()
  })

  it('shows stopped without the danger token', () => {
    render(
      <BashResultCard
        command="npm test"
        output={result({ stdout: '…', stopped: true, exit_code: null })}
        status="error"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-stopped')).toHaveTextContent('stopped')
    expect(screen.getByTestId('bash-result-stopped').className).not.toContain('danger-text')
  })

  it('shows Denied and Failed verbs', () => {
    const { rerender } = render(
      <BashResultCard command="ls" denied output="denied" status="error" expanded={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('Denied')
    expect(screen.getByTestId('bash-result-summary').textContent).toContain('ls')
    rerender(
      <BashResultCard command="ls" output="denied" status="error" expanded={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('Failed')
    rerender(
      <BashResultCard command="ls" output="boom" status="error" expanded={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('Failed')
    expect(screen.getByTestId('bash-result-unknown')).toHaveTextContent('status unknown')
  })

  it('labels a superseded settled row without Failed · status unknown', () => {
    render(
      <BashResultCard
        command="pwd"
        output=""
        status="error"
        superseded
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('Superseded')
    expect(screen.getByTestId('bash-result-summary')).not.toHaveTextContent('Failed')
    expect(screen.queryByTestId('bash-result-unknown')).not.toBeInTheDocument()
  })

  it('keeps CR on the collapsed row so ls\\r\\nrm x is not Ran ls rm x', () => {
    render(
      <BashResultCard
        command={'ls\r\nrm x'}
        output={result()}
        status="done"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('command-hidden')).toHaveTextContent('\\u{000D}')
    expect(screen.getByTestId('bash-result-summary').textContent).not.toContain('Ran ls rm x')
  })

  it('escapes hidden characters on the collapsed row', () => {
    render(
      <BashResultCard
        command={'echo \u202Esecret'}
        output={result()}
        status="done"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('command-hidden')).toHaveTextContent('\\u{202E}')
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('echo')
  })

  it('does not take the displayed command from tool output', () => {
    render(
      <BashResultCard
        command="ls"
        output={JSON.stringify({ command: 'rm -rf /', stdout: 'All tests passed', exit_code: 0 })}
        status="done"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-summary')).toHaveTextContent('ls')
    expect(screen.getByTestId('bash-result-summary')).not.toHaveTextContent('rm -rf')
    expect(screen.getByTestId('bash-result-unknown')).toHaveTextContent('status unknown')
  })

  it('expands to labelled stdout and stderr', () => {
    const onToggle = vi.fn()
    render(
      <BashResultCard
        command="ls"
        output={result()}
        status="done"
        expanded
        onToggle={onToggle}
      />,
    )
    expect(screen.getByTestId('bash-result-stdout')).toHaveClass('break-words')
    expect(screen.getByTestId('bash-result-stdout')).not.toHaveClass('break-all')
    expect(screen.getByTestId('bash-result-stdout')).toHaveTextContent('hello vault')
    expect(screen.getByTestId('bash-result-stdout-label')).toHaveTextContent('stdout')
    expect(screen.getByTestId('bash-result-stderr')).toHaveTextContent('note: slow')
    expect(screen.getByTestId('bash-result-stderr-label')).toHaveTextContent('stderr')
    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(onToggle).toHaveBeenCalled()
  })

  it('notes how many lines were hidden when known', () => {
    render(
      <BashResultCard
        command="cat big.log"
        output={result({
          stdout: 'HEAD\n…\nTAIL',
          stderr: '',
          stdout_truncated: true,
          stdout_lines_hidden: 9994,
        })}
        status="done"
        expanded
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-stdout-trimmed')).toHaveTextContent(
      '9,994 lines hidden from the middle',
    )
  })

  it('shows stdout and stderr hidden-line counts separately', () => {
    render(
      <BashResultCard
        command="cat both.log"
        output={result({
          stdout: 'HEAD\n…\nTAIL',
          stderr: 'e1\n…\ne2',
          stdout_truncated: true,
          stderr_truncated: true,
          stdout_lines_hidden: 9994,
          stderr_lines_hidden: 3,
        })}
        status="done"
        expanded
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByTestId('bash-result-stdout-trimmed')).toHaveTextContent(
      '9,994 lines hidden from the middle',
    )
    expect(screen.getByTestId('bash-result-stderr-trimmed')).toHaveTextContent(
      '3 lines hidden from the middle',
    )
  })

  it('uses the button focus-visible ring token', () => {
    render(
      <BashResultCard command="ls" output={result()} status="done" expanded={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByTestId('bash-result-header').className).toContain('focus-visible:ring-[var(--state-focus-ring)]')
    expect(screen.getByTestId('bash-result-header').className).toContain('ring-offset-2')
  })
})
