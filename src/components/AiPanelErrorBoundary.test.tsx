import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelErrorBoundary } from './AiPanelErrorBoundary'

/** A null host status used to throw on `.modelName` and unmount the whole app. */
function ChatPanelOnStatus({ status }: { status: { modelName?: string | null } | null }) {
  const host = status as { modelName: string }
  return <p>{host.modelName.trim()}</p>
}

describe('AiPanelErrorBoundary', () => {
  it('keeps the page when a bad status payload throws in the chat panel', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <div>
        <p>All notes</p>
        <AiPanelErrorBoundary>
          <ChatPanelOnStatus status={null} />
        </AiPanelErrorBoundary>
      </div>,
    )

    expect(screen.getByText('All notes')).toBeInTheDocument()
    expect(screen.getByText('The chat panel hit a bad status, and the rest of the app is still there.')).toBeInTheDocument()
    expect(document.body).not.toBeEmptyDOMElement()

    consoleError.mockRestore()
  })

  it('wraps AiPanelView in AiWorkspace', () => {
    const source = readFileSync(`${process.cwd()}/src/components/AiWorkspace.tsx`, 'utf8')
    const wrapped = /<AiPanelErrorBoundary>\s*<AiPanelView[\s\S]*?\/>\s*<\/AiPanelErrorBoundary>/

    expect(source).toMatch(wrapped)
  })
})
