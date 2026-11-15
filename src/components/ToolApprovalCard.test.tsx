import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolApprovalCard } from './ToolApprovalCard'

const writeClipboardText = vi.fn()
const trackEvent = vi.fn()

vi.mock('../lib/telemetry', () => ({
  trackEvent: (name: string, properties?: Record<string, string | number>) => trackEvent(name, properties),
}))

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: (text: string) => writeClipboardText(text),
}))

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

describe('ToolApprovalCard', () => {
  it('shows the path and a readable edit diff without file headers', () => {
    render(
      <ToolApprovalCard
        tool="edit_file"
        path="notes/plan.md"
        preview={'--- notes/plan.md\n+++ notes/plan.md\n@@ -1,1 +1,1 @@\n-draft\n+ready\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('approval-path')).toHaveTextContent('notes/plan.md')
    expect(screen.getByText('Edit file')).toBeInTheDocument()
    expect(screen.getByTestId('approval-status')).toHaveTextContent('Needs approval')
    expect(screen.getByTestId('approval-status').className).toContain('text-[var(--warn-text)]')
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('@@ -1,1 +1,1 @@')
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('-draft')
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('+ready')
    expect(screen.getByTestId('approval-diff')).not.toHaveTextContent('--- notes/plan.md')
    expect(screen.queryByText('ASK')).not.toBeInTheDocument()
  })

  it('titles a new file as create and labels it under the path', () => {
    render(
      <ToolApprovalCard
        tool="write_file"
        path="notes/fresh.md"
        created
        preview={'--- /dev/null\n+++ notes/fresh.md\n@@ -0,0 +1,1 @@\n+hello vault\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByText('Create file')).toBeInTheDocument()
    expect(screen.getByTestId('approval-new-file')).toHaveTextContent('New file')
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('+hello vault')
    expect(screen.queryByTestId('approval-overwrite')).not.toBeInTheDocument()
  })

  it('warns when write_file replaces the whole file', () => {
    render(
      <ToolApprovalCard
        tool="write_file"
        path="notes/weekly-review.md"
        overwrite
        preview={'@@ -1,2 +1,1 @@\n-old\n+new\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByText('Write file')).toBeInTheDocument()
    expect(screen.getByTestId('tool-approval-card')).toHaveAttribute('data-risk', 'caution')
    expect(screen.getByTestId('approval-risk')).toHaveTextContent('Replaces the whole file.')
  })

  it('makes Allow once the filled primary action', () => {
    render(
      <ToolApprovalCard
        tool="write_file"
        path="a.md"
        created
        preview={'@@ -0,0 +1,1 @@\n+x\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Allow once' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Allow this file for the session' })).toHaveClass('border')
    expect(screen.getByRole('button', { name: 'Deny' })).not.toHaveClass('bg-primary')
  })

  it('gives Allow once a ring-offset against the card', () => {
    render(
      <ToolApprovalCard
        tool="write_file"
        path="a.md"
        created
        preview={'@@ -0,0 +1,1 @@\n+x\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    const allowOnce = screen.getByTestId('approval-allow_once')
    expect(allowOnce.className).toContain('focus-visible:ring-offset-2')
    expect(allowOnce.className).toContain('focus-visible:ring-offset-card')
  })

  it('offers Show all when the diff body overflows', () => {
    const long = ['@@ -1,20 +1,20 @@', ...Array.from({ length: 20 }, (_, i) => `+line${i}`)].join('\n')
    render(
      <ToolApprovalCard
        tool="edit_file"
        path="notes/weekly-review.md"
        preview={long}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('approval-show-all')).toHaveTextContent('Show all')
    fireEvent.click(screen.getByTestId('approval-show-all'))
    expect(screen.queryByTestId('approval-show-all')).not.toBeInTheDocument()
  })

  it('opens a collapsed overwrite at the hunk row with added lines still visible', () => {
    const preview = [
      '--- notes/weekly-review.md',
      '+++ notes/weekly-review.md',
      '@@ -1,40 +1,3 @@',
      ...Array.from({ length: 40 }, (_, i) => `-old line ${i}`),
      '+MALICIOUS',
      '+rm -rf ~',
      '+rewritten body',
    ].join('\n')
    render(
      <ToolApprovalCard
        tool="write_file"
        path="notes/weekly-review.md"
        overwrite
        preview={preview}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    const body = screen.getByTestId('approval-diff')
    const rows = [...body.querySelectorAll('[data-diff-kind]')]
    expect(body.scrollTop).toBe(0)
    expect(body).toHaveClass('overflow-auto')
    expect(rows[0]).toHaveAttribute('data-diff-kind', 'hunk')
    expect(rows[0]).toHaveTextContent('@@ -1,40 +1,3 @@')
    expect(screen.queryByTestId('approval-diff-fade-top')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-diff-fade')).toBeInTheDocument()
    expect(screen.getByTestId('approval-show-all')).toHaveTextContent('Show all 44 lines')
    fireEvent.click(screen.getByTestId('approval-show-all'))
    expect(screen.queryByTestId('approval-show-all')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('-old line 39')
    expect(screen.getByTestId('approval-diff')).toHaveClass('overflow-auto')
  })

  it('toggles the top fade after the collapsed diff is scrolled', () => {
    const long = ['@@ -1,40 +1,40 @@', ...Array.from({ length: 40 }, (_, i) => `+line${i}`)].join('\n')
    render(
      <ToolApprovalCard
        tool="edit_file"
        path="notes/weekly-review.md"
        preview={long}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    const body = screen.getByTestId('approval-diff')
    expect(body.scrollTop).toBe(0)
    expect(screen.queryByTestId('approval-diff-fade-top')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-diff-fade')).toBeInTheDocument()

    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 400 })
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 200 })
    body.scrollTop = 80
    fireEvent.scroll(body)
    expect(screen.getByTestId('approval-diff-fade-top')).toBeInTheDocument()
    expect(screen.getByTestId('approval-diff-fade')).toBeInTheDocument()

    body.scrollTop = 200
    fireEvent.scroll(body)
    expect(screen.getByTestId('approval-diff-fade-top')).toBeInTheDocument()
    expect(screen.queryByTestId('approval-diff-fade')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-show-all')).toBeInTheDocument()
  })

  it('does not autofocus Allow once so Enter does not approve', () => {
    const onReply = vi.fn()
    render(
      <ToolApprovalCard
        tool="write_file"
        path="a.md"
        created
        preview={'@@ -0,0 +1,1 @@\n+x\n'}
        options={OPTIONS}
        onReply={onReply}
      />,
    )
    expect(screen.getByRole('button', { name: 'Allow once' })).not.toHaveFocus()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(onReply).not.toHaveBeenCalled()
  })

  it('shows structural notes outside the collapse allowance', () => {
    const preview = ['@@ -1,1 +1,1 @@', '-old', '+new'].join('\n')
    render(
      <ToolApprovalCard
        tool="edit_file"
        path="a.md"
        preview={preview}
        notes={['Line endings change: CRLF → LF', '… 2 more hunks / 4 more lines not shown']}
        capped
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    const notes = screen.getByTestId('approval-notes')
    expect(notes).toHaveTextContent('Line endings change: CRLF → LF')
    expect(notes).toHaveTextContent('… 2 more hunks / 4 more lines not shown')
    expect(screen.getByTestId('approval-diff')).not.toHaveTextContent('Line endings change')
  })

  it('labels a capped preview as Show full preview', () => {
    const long = ['@@ -1,20 +1,20 @@', ...Array.from({ length: 20 }, (_, i) => `+line${i}`)].join('\n')
    render(
      <ToolApprovalCard
        tool="edit_file"
        path="notes/weekly-review.md"
        preview={long}
        capped
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('approval-show-all')).toHaveTextContent('Show full preview')
  })

  it('shows a Run command card with the bash command block', () => {
    render(
      <ToolApprovalCard
        tool="bash"
        command={'rg TODO wiki/\n  --glob "!archive/**"'}
        timeoutSecs={30}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByText('Run command')).toBeInTheDocument()
    expect(screen.getByTestId('approval-command')).toHaveTextContent('rg TODO wiki/')
    expect(screen.getByTestId('approval-command')).toHaveClass('font-mono')
    expect(screen.getByTestId('approval-vault-note')).toHaveTextContent(
      'Runs in your vault folder. Output is shown when it finishes.',
    )
    expect(screen.getByTestId('approval-timeout')).toHaveTextContent('Stops after 30 seconds.')
    expect(screen.queryByTestId('approval-diff')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow once' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Allow once' }).className).toContain('ring-offset-2')
    expect(screen.getByRole('button', { name: 'Allow once' }).className).toContain('ring-offset-card')
    expect(screen.getByTestId('approval-command')).toHaveClass('break-words')
    expect(screen.getByTestId('approval-command')).not.toHaveClass('break-all')
    expect(screen.queryByRole('button', { name: 'Allow for session' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deny' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeInTheDocument()
  })

  it('shows the default timeout when timeout_secs is unset', () => {
    render(
      <ToolApprovalCard
        tool="bash"
        command="ls"
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByText('Run command')).toBeInTheDocument()
    expect(screen.getByTestId('approval-command')).toHaveTextContent('ls')
    expect(screen.getByTestId('approval-timeout')).toHaveTextContent('Stops after 60 seconds.')
  })

  it('marks newlines and hidden characters, and copies the exact raw string', () => {
    writeClipboardText.mockResolvedValue(undefined)
    const command = "echo hi\nworld\u001b[31m\u200B\u202E"
    render(
      <ToolApprovalCard
        tool="bash"
        command={command}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('command-newline')).toHaveTextContent('⏎')
    expect(screen.getByTestId('approval-command')).toHaveTextContent('\\u{001B}')
    expect(screen.getByTestId('approval-command')).toHaveTextContent('\\u{200B}')
    expect(screen.getByTestId('approval-command')).toHaveTextContent('\\u{202E}')
    expect(screen.getByTestId('tool-approval-card')).toHaveAttribute('data-risk', 'danger')
    expect(screen.getByTestId('approval-risk')).toHaveTextContent(
      'Contains hidden or control characters.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))
    expect(writeClipboardText).toHaveBeenCalledWith(command)
  })

  it('copies a command with leading and trailing whitespace exactly', () => {
    writeClipboardText.mockResolvedValue(undefined)
    const command = '  echo hi  '
    render(
      <ToolApprovalCard
        tool="bash"
        command={command}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('approval-command').textContent).toBe(command)
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))
    expect(writeClipboardText).toHaveBeenCalledWith(command)
  })

  it('does not treat Claude Code Bash as the native bash card', () => {
    render(
      <ToolApprovalCard
        tool="Bash"
        command="ls"
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.queryByText('Run command')).not.toBeInTheDocument()
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.queryByTestId('approval-vault-note')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow for session' })).toBeInTheDocument()
  })

  it('sends allow once, allow for session, and deny', () => {
    const onReply = vi.fn()
    render(
      <ToolApprovalCard
        tool="write_file"
        path="a.md"
        preview={'--- /dev/null\n+++ a.md\n+x\n'}
        options={OPTIONS}
        onReply={onReply}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    fireEvent.click(screen.getByRole('button', { name: 'Allow this file for the session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(onReply).toHaveBeenCalledWith('allow_once')
    expect(onReply).toHaveBeenCalledWith('allow_session')
    expect(onReply).toHaveBeenCalledWith('deny')
  })
  it('gives a routine command a plain card with no risk line', () => {
    render(
      <ToolApprovalCard tool="bash" command="echo SAFE" options={OPTIONS} onReply={vi.fn()} />,
    )
    expect(screen.getByTestId('tool-approval-card')).toHaveAttribute('data-risk', 'routine')
    expect(screen.queryByTestId('approval-risk')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow once' })).toHaveClass('bg-primary')
  })

  it('names the effect of a caution command and keeps Allow once primary', () => {
    render(
      <ToolApprovalCard
        tool="bash"
        command="curl https://example.com"
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByTestId('tool-approval-card')).toHaveAttribute('data-risk', 'caution')
    expect(screen.getByTestId('approval-risk')).toHaveTextContent('Uses the network.')
    expect(screen.getByRole('button', { name: 'Allow once' })).toHaveClass('bg-primary')
  })

  it('marks a destructive command as danger and removes the primary fill from Allow once', () => {
    render(
      <ToolApprovalCard tool="bash" command="rm -rf ~/EVIL" options={OPTIONS} onReply={vi.fn()} />,
    )
    const card = screen.getByTestId('tool-approval-card')
    expect(card).toHaveAttribute('data-risk', 'danger')
    expect(card).toHaveClass('border-destructive')
    expect(screen.getByTestId('approval-status')).toHaveTextContent('Destructive')
    expect(screen.getByTestId('approval-risk')).toHaveTextContent('Deletes files. This cannot be undone.')
    const allow = screen.getByRole('button', { name: 'Allow once' })
    expect(allow).not.toHaveClass('bg-primary')
    expect(allow).not.toHaveClass('bg-background')
    expect(allow).toHaveClass('bg-transparent', 'border', 'border-destructive', 'text-danger-text')
    const deny = screen.getByRole('button', { name: 'Deny' })
    expect(deny).toHaveClass('bg-secondary', 'border', 'border-input')
  })

  it('puts Deny before Allow once on a danger card, so Tab reaches Deny first', () => {
    render(
      <ToolApprovalCard tool="bash" command="rm -rf build" options={OPTIONS} onReply={vi.fn()} />,
    )
    const buttons = screen.getAllByRole('button').filter((button) => /^approval-(allow_once|deny)$/.test(button.dataset.testid ?? ''))
    expect(buttons.map((button) => button.dataset.testid)).toEqual(['approval-deny', 'approval-allow_once'])
  })

  it('keeps the engine order when the card is not danger', () => {
    render(
      <ToolApprovalCard tool="bash" command="curl https://example.com" options={OPTIONS} onReply={vi.fn()} />,
    )
    const buttons = screen.getAllByRole('button').filter((button) => /^approval-(allow_once|deny)$/.test(button.dataset.testid ?? ''))
    expect(buttons.map((button) => button.dataset.testid)).toEqual(['approval-allow_once', 'approval-deny'])
  })

  it('says a command reaches outside the vault instead of running in it', () => {
    const { unmount } = render(
      <ToolApprovalCard tool="bash" command="rm -rf ~/x" options={OPTIONS} onReply={vi.fn()} />,
    )
    expect(screen.getByTestId('approval-vault-note')).toHaveTextContent('Starts in your vault folder and reaches outside it.')
    unmount()
    render(<ToolApprovalCard tool="bash" command="rm -rf build" options={OPTIONS} onReply={vi.fn()} />)
    expect(screen.getByTestId('approval-vault-note')).toHaveTextContent('Runs in your vault folder.')
  })

  it('still sends allow once from a danger card', () => {
    const onReply = vi.fn()
    render(
      <ToolApprovalCard tool="bash" command="rm -rf ~/EVIL" options={OPTIONS} onReply={onReply} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    expect(onReply).toHaveBeenCalledWith('allow_once')
  })

  it('reports the reply with the tool, the risk tier and the choice only', () => {
    trackEvent.mockClear()
    render(
      <ToolApprovalCard tool="bash" command="rm -rf ~/EVIL" options={OPTIONS} onReply={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(trackEvent).toHaveBeenCalledWith('tool_approval_replied', {
      tool: 'bash',
      risk: 'danger',
      choice: 'deny',
      surface: 'card',
    })
  })
})
