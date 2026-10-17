import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolApprovalCard } from './ToolApprovalCard'

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
    expect(screen.getByTestId('approval-overwrite')).toHaveTextContent('Replaces the whole file')
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
    expect(screen.getByRole('button', { name: 'Allow for session' })).toHaveClass('border')
    expect(screen.getByRole('button', { name: 'Deny' })).not.toHaveClass('bg-primary')
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
