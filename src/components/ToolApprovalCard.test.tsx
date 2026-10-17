import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolApprovalCard } from './ToolApprovalCard'

const OPTIONS = [
  { id: 'allow_once', label: 'Allow once' },
  { id: 'allow_session', label: 'Allow for session' },
  { id: 'deny', label: 'Deny' },
]

describe('ToolApprovalCard', () => {
  it('shows the path and a readable edit diff', () => {
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
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('-draft')
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('+ready')
  })

  it('titles a new file as create and shows the full content', () => {
    render(
      <ToolApprovalCard
        tool="write_file"
        path="notes/fresh.md"
        preview={'--- /dev/null\n+++ notes/fresh.md\n@@ -0,0 +1,1 @@\n+hello vault\n'}
        options={OPTIONS}
        onReply={vi.fn()}
      />,
    )
    expect(screen.getByText('Create file')).toBeInTheDocument()
    expect(screen.getByTestId('approval-diff')).toHaveTextContent('+hello vault')
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
    fireEvent.click(screen.getByRole('button', { name: 'Allow for session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(onReply).toHaveBeenCalledWith('allow_once')
    expect(onReply).toHaveBeenCalledWith('allow_session')
    expect(onReply).toHaveBeenCalledWith('deny')
  })
})
