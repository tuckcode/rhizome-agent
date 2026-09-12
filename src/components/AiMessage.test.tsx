import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiMessage } from './AiMessage'

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid="markdown-content">{content}</div>,
}))

const writeClipboardText = vi.fn()
const trackVaultRetrievalSourceOpened = vi.fn()

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: (text: string) => writeClipboardText(text),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackVaultRetrievalSourceOpened: (sourceCount: number) => trackVaultRetrievalSourceOpened(sourceCount),
}))

describe('AiMessage', () => {
  beforeEach(() => {
    writeClipboardText.mockReset()
    writeClipboardText.mockResolvedValue(undefined)
    trackVaultRetrievalSourceOpened.mockReset()
  })

  it('renders a local marker as a system event, not a chat turn', () => {
    render(<AiMessage userMessage="" actions={[]} localMarker={'Compacted this conversation\nGoal'} />)
    const marker = screen.getByTestId('ai-local-marker')
    expect(marker).toHaveTextContent('Compacted this conversation')
    expect(marker).toHaveTextContent('Goal')
    expect(screen.queryByTestId('ai-message')).not.toBeInTheDocument()
  })

  it('renders user message', () => {
    render(<AiMessage userMessage="Hello AI" actions={[]} />)
    expect(screen.getByText('Hello AI')).toBeTruthy()
  })

  it('shows a clock under the ask when createdAtMs is set (C70)', () => {
    const createdAtMs = new Date(2026, 8, 6, 15, 35, 0).getTime()
    render(<AiMessage userMessage="Hello AI" actions={[]} createdAtMs={createdAtMs} />)
    const stamp = screen.getByTestId('message-timestamp')
    expect(stamp).toHaveTextContent('3:35p')
    expect(screen.queryByTestId('message-timestamp')).toBeTruthy()
  })

  it('omits the clock when there is no createdAtMs', () => {
    render(<AiMessage userMessage="Hello AI" actions={[]} />)
    expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument()
  })

  /**
   * A turn boundary has to be findable while scrolling past screens of answer.
   * The bubble used to be tinted with `--state-hover`, a hover affordance that
   * is deliberately almost invisible — so scrolling back to "where did I ask
   * this?" meant reading rather than scanning.
   *
   * Asserted on the right-edge rule specifically: the bubble is right-aligned,
   * so that edge sits at a fixed x and forms a rhythm down the margin. The
   * background tint alone is not what makes it scannable.
   */
  it('marks the user turn with an accent the eye can find while scrolling', () => {
    render(<AiMessage userMessage="Hello AI" actions={[]} />)

    // Read off the style attribute rather than `toHaveStyle`: jsdom does not
    // parse a shorthand whose value contains `var()`, so the assertion would
    // pass vacuously.
    const style = screen.getByText('Hello AI').getAttribute('style') ?? ''
    expect(style).toContain('border-right: 2px solid var(--accent-blue)')
    expect(style).toContain('background: var(--accent-blue-bg)')
  })

  it('keeps long user messages inside the chat column', () => {
    const longToken = 'https://example.com/'.padEnd(180, 'a')
    render(<AiMessage userMessage={longToken} actions={[]} />)

    const bubble = screen.getByText(longToken)
    expect(bubble).toHaveClass('min-w-0', 'max-w-[85%]', 'overflow-hidden')
    expect(bubble).toHaveStyle({ overflowWrap: 'anywhere' })
  })

  it('renders response as markdown', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Here is the **answer**" />)
    expect(screen.getByTestId('markdown-content')).toBeTruthy()
    expect(screen.getByText('Here is the **answer**')).toBeTruthy()
  })

  it('shows every completed vault note read beside the answer and opens it', () => {
    const onOpenNote = vi.fn()
    render(
      <AiMessage
        userMessage="What did I decide?"
        response="You chose the smaller launch."
        actions={[
          {
            tool: 'get_note',
            toolId: 'read-1',
            label: 'Read launch.md',
            path: 'projects/launch.md',
            status: 'done',
          },
          {
            tool: 'get_note',
            toolId: 'read-2',
            label: 'Read decisions.md',
            path: 'meta/decisions.md',
            status: 'done',
          },
        ]}
        onOpenNote={onOpenNote}
      />,
    )

    expect(screen.getByTestId('retrieved-note-sources')).toHaveTextContent('From your vault')
    expect(screen.getByRole('button', { name: 'Open projects/launch.md' })).toHaveAttribute('data-size', 'sm')
    expect(screen.getByRole('button', { name: 'Open meta/decisions.md' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Open meta/decisions.md' }))
    expect(onOpenNote).toHaveBeenCalledWith('meta/decisions.md')
    expect(trackVaultRetrievalSourceOpened).toHaveBeenCalledWith(2)
  })

  it('shows a note once when Prime read the same path more than once', () => {
    render(
      <AiMessage
        userMessage="Check that again"
        response="The decision still stands."
        actions={[
          {
            tool: 'get_note',
            toolId: 'read-1',
            label: 'Read decision.md',
            path: 'decisions/launch.md',
            status: 'done',
          },
          {
            tool: 'get_note',
            toolId: 'read-2',
            label: 'Read decision.md',
            path: 'decisions/launch.md',
            status: 'done',
          },
        ]}
        onOpenNote={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Open decisions/launch.md' })).toHaveLength(1)
  })

  it('keeps an absolute vault path out of the source label while opening the exact note', () => {
    const onOpenNote = vi.fn()
    render(
      <AiMessage
        userMessage="Read the plan"
        response="The plan is ready."
        actions={[{
          tool: 'get_note',
          toolId: 'read-absolute',
          label: 'Read plan.md',
          path: '/Users/luca/Laputa/projects/plan.md',
          status: 'done',
        }]}
        onOpenNote={onOpenNote}
      />,
    )

    const source = screen.getByRole('button', { name: 'Open plan.md' })
    expect(source).not.toHaveTextContent('/Users/luca/Laputa')
    fireEvent.click(source)
    expect(onOpenNote).toHaveBeenCalledWith('/Users/luca/Laputa/projects/plan.md')
  })

  it('does not claim a vault source unless a note read completed successfully', () => {
    render(
      <AiMessage
        userMessage="Find the launch plan"
        response="I could not verify it."
        actions={[
          { tool: 'search_notes', toolId: 'search', label: 'Searched', path: 'launch.md', status: 'done' },
          { tool: 'create_note', toolId: 'write', label: 'Created', path: 'new.md', status: 'done' },
          { tool: 'get_note', toolId: 'pending', label: 'Reading', path: 'pending.md', status: 'pending' },
          { tool: 'get_note', toolId: 'failed', label: 'Read failed', path: 'failed.md', status: 'error' },
          { tool: 'get_note', toolId: 'missing-path', label: 'Read', status: 'done' },
        ]}
        onOpenNote={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('retrieved-note-sources')).not.toBeInTheDocument()
  })

  it('constrains assistant responses to the available chat width', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.getByTestId('ai-response-block')).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden')
  })

  it('puts a find-aid dot on the latest assistant reply only', () => {
    const { rerender } = render(
      <AiMessage userMessage="Ask" actions={[]} response="Done" isLatestReply />,
    )
    expect(screen.getByTestId('latest-assistant-reply-marker')).toBeInTheDocument()

    rerender(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.queryByTestId('latest-assistant-reply-marker')).not.toBeInTheDocument()
  })

  it('keeps the find-aid on a streaming reply before text arrives', () => {
    render(<AiMessage userMessage="Ask" actions={[]} isStreaming isLatestReply />)
    expect(screen.getByTestId('latest-assistant-reply-marker')).toBeInTheDocument()
  })

  it('shows assistant message actions with response', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.getByTestId('ai-message-actions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Regenerate response' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy response' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save to vault' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fork chat from here' })).toBeTruthy()
  })

  it('localizes reasoning and tool use chrome', () => {
    render(
      <AiMessage
        userMessage="Fai qualcosa"
        locale="it-IT"
        reasoning="Sto pensando..."
        reasoningDone
        actions={[{ tool: 'search_notes', toolId: 't1', label: 'Cercato', status: 'done' }]}
      />,
    )

    expect(screen.getByRole('button', { name: /ragionamento/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /uso degli strumenti/i })).toBeTruthy()
  })

  it('shows reasoning expanded while streaming (reasoningDone=false)', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking about it..." reasoningDone={false} actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toBeTruthy()
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    expect(screen.getByText('Thinking about it...')).toBeTruthy()
  })

  it('auto-collapses reasoning when reasoningDone=true', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toBeTruthy()
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('expands collapsed reasoning on toggle click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    // Starts collapsed (reasoningDone=true)
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
  })

  it('reports the reasoning disclosure state to assistive tech', () => {
    // The tool-use toggle beside it already carries aria-expanded; this one is the
    // same disclosure pattern in the same file and was announced as a bare button.
    const { rerender } = render(
      <AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />
    )
    expect(screen.getByTestId('reasoning-toggle')).toHaveAttribute('aria-expanded', 'false')

    rerender(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone={false} actions={[]} />)
    expect(screen.getByTestId('reasoning-toggle')).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps reasoning collapsed after the turn finishes', () => {
    const { rerender } = render(
      <AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone={false} actions={[]} />
    )
    // Streaming: auto-expanded.
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()

    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.queryByTestId('reasoning-content')).toBeNull()

    // The turn finishes. A collapse the user asked for must survive it; the old
    // boolean override inverted against autoExpanded and re-opened the block here.
    rerender(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('keeps reasoning expanded after the turn finishes when the user opened it', () => {
    const { rerender } = render(
      <AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />
    )
    expect(screen.queryByTestId('reasoning-content')).toBeNull()

    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()

    rerender(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone actions={[]} />)
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
  })

  it('collapses expanded reasoning on toggle click', () => {
    render(<AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone={false} actions={[]} />)
    // Starts expanded (reasoningDone=false)
    expect(screen.getByTestId('reasoning-content')).toBeTruthy()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
  })

  it('shows glued thinking sentences as separate sentences when expanded', () => {
    render(
      <AiMessage
        userMessage="Ask"
        reasoning="The path is blocked.Next I will try another route."
        reasoningDone={false}
        actions={[]}
      />,
    )
    expect(screen.getByTestId('reasoning-content')).toHaveTextContent(
      'The path is blocked. Next I will try another route.',
    )
  })

  it('keeps thinking newlines in the expanded display source', () => {
    render(
      <AiMessage
        userMessage="Ask"
        reasoning={'First line\nSecond line'}
        reasoningDone={false}
        actions={[]}
      />,
    )
    const markdown = screen.getByTestId('reasoning-content').querySelector('[data-testid="markdown-content"]')
    expect(markdown?.textContent).toContain('First line')
    expect(markdown?.textContent).toContain('Second line')
    expect(markdown?.textContent).toContain('\n')
  })

  it('gives expanded thinking a taller scroll window than the old 200px cap', () => {
    render(
      <AiMessage userMessage="Ask" reasoning="Thinking..." reasoningDone={false} actions={[]} />,
    )
    const style = screen.getByTestId('reasoning-content').getAttribute('style') ?? ''
    expect(style).toContain('max-height: 280px')
    expect(style).toContain('overflow-y: auto')
  })

  it('collapses tool use by default and shows the live call count', () => {
    render(
      <AiMessage
        userMessage="Do something"
        actions={[
          { tool: 'create_note', toolId: 't1', label: 'Created test.md', status: 'done' },
          { tool: 'search_notes', toolId: 't2', label: 'Searched', status: 'pending' },
        ]}
      />,
    )
    expect(screen.getByTestId('tool-use-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('tool-use-count').textContent).toBe('2')
    expect(screen.getByTestId('tool-use-count')).toHaveAttribute('data-pending', 'true')
    expect(screen.queryByTestId('ai-action-card')).toBeNull()

    fireEvent.click(screen.getByTestId('tool-use-toggle'))

    expect(screen.getByTestId('tool-use-toggle')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByTestId('ai-action-card')).toHaveLength(2)
  })

  it('groups five identical tool names into one counted row', () => {
    render(
      <AiMessage
        userMessage="research"
        actions={Array.from({ length: 5 }, (_, index) => ({
          tool: 'ipython',
          toolId: `t${index}`,
          label: 'ipython',
          status: 'done' as const,
        }))}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-use-toggle'))
    expect(screen.getByTestId('tool-use-count').textContent).toBe('5')
    expect(screen.getAllByTestId('ai-action-card')).toHaveLength(1)
    expect(screen.getByText('ipython ×5')).toBeTruthy()
  })

  it('passes onOpenNote to action cards', () => {
    const onOpenNote = vi.fn()
    render(
      <AiMessage
        userMessage="Do"
        actions={[{ tool: 'create_note', toolId: 't1', label: 'Open', path: '/vault/note.md', status: 'done' }]}
        onOpenNote={onOpenNote}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-use-toggle'))
    fireEvent.click(screen.getByTestId('action-card-header'))
    expect(onOpenNote).toHaveBeenCalledWith('/vault/note.md')
  })

  it('shows streaming indicator when streaming without response', () => {
    const { container } = render(
      <AiMessage userMessage="Ask" actions={[]} isStreaming />,
    )
    expect(container.querySelector('.typing-dot')).toBeTruthy()
  })

  it('does not show streaming indicator when response is present', () => {
    const { container } = render(
      <AiMessage userMessage="Ask" actions={[]} response="Done" isStreaming />,
    )
    expect(container.querySelector('.typing-dot')).toBeNull()
  })

  it('runs assistant message actions', () => {
    const onRegenerate = vi.fn()
    const onFork = vi.fn()
    const onPromoteToVault = vi.fn()
    render(
      <AiMessage
        userMessage="Ask"
        actions={[]}
        messageId="message-1"
        // Hosts always supply this: the workspace passes the local id, ChatHome
        // passes Prime's entry id. Fork is disabled without it on purpose.
        forkTargetId="message-1"
        response="Done"
        onFork={onFork}
        onPromoteToVault={onPromoteToVault}
        onRegenerate={onRegenerate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save to vault' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fork chat from here' }))

    expect(onRegenerate).toHaveBeenCalledWith('message-1')
    expect(writeClipboardText).toHaveBeenCalledWith('Done')
    expect(onPromoteToVault).toHaveBeenCalledWith('Done')
    expect(onFork).toHaveBeenCalledWith('message-1')
  })

  it('disables save to vault when no promote handler is provided', () => {
    render(<AiMessage userMessage="Ask" actions={[]} response="Done" />)
    expect(screen.getByTestId('ai-message-save-to-vault')).toBeDisabled()
  })

  it('shows Save to vault as an icon control with full accessible name', () => {
    render(
      <AiMessage
        userMessage="Ask"
        actions={[]}
        response="Done"
        onPromoteToVault={vi.fn()}
      />,
    )

    const save = screen.getByRole('button', { name: 'Save to vault' })
    expect(save).toHaveAttribute('data-testid', 'ai-message-save-to-vault')
    expect(save).toBeVisible()
    expect(save).not.toHaveTextContent('Save to vault')
    expect(screen.getByTestId('ai-message-actions')).not.toHaveClass('opacity-0')
  })

  it('does not render reasoning block when no reasoning', () => {
    render(<AiMessage userMessage="Ask" actions={[]} />)
    expect(screen.queryByTestId('reasoning-toggle')).toBeNull()
  })

  it('does not render actions when empty array', () => {
    render(<AiMessage userMessage="Ask" actions={[]} />)
    expect(screen.queryByTestId('ai-action-card')).toBeNull()
  })

  it('renders reference pills in user bubble', () => {
    render(
      <AiMessage
        userMessage="Tell me about this"
        references={[
          { title: 'Marco', path: 'person/marco.md', type: 'Person' },
          { title: 'Project X', path: 'project/x.md', type: 'Project' },
        ]}
        actions={[]}
      />,
    )
    const pills = screen.getAllByTestId('message-reference-pill')
    expect(pills).toHaveLength(2)
    expect(pills[0].textContent).toBe('Marco')
    expect(pills[1].textContent).toBe('Project X')
  })

  it('does not render pills when no references', () => {
    render(<AiMessage userMessage="Hello" actions={[]} />)
    expect(screen.queryAllByTestId('message-reference-pill')).toHaveLength(0)
  })

  it('does not render pills when references array is empty', () => {
    render(<AiMessage userMessage="Hello" references={[]} actions={[]} />)
    expect(screen.queryAllByTestId('message-reference-pill')).toHaveLength(0)
  })

  it('calls onOpenNote when a reference pill is clicked', () => {
    const onOpenNote = vi.fn()
    render(
      <AiMessage
        userMessage="Check this"
        references={[{ title: 'Alpha', path: 'note/alpha.md', type: 'Note' }]}
        actions={[]}
        onOpenNote={onOpenNote}
      />,
    )
    fireEvent.click(screen.getByTestId('message-reference-pill'))
    expect(onOpenNote).toHaveBeenCalledWith('note/alpha.md')
  })

  it('expands and collapses action cards independently', () => {
    render(
      <AiMessage
        userMessage="Do"
        actions={[
          { tool: 'search_notes', toolId: 't1', label: 'Searched', status: 'done', input: '{"q":"test"}', output: 'Found 3' },
          { tool: 'create_note', toolId: 't2', label: 'Created', status: 'done', input: '{"title":"x"}' },
        ]}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-use-toggle'))
    const headers = screen.getAllByTestId('action-card-header')
    // Both collapsed initially
    expect(screen.queryByTestId('action-card-details')).toBeNull()
    // Expand first card
    fireEvent.click(headers[0])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(1)
    // Expand second card too
    fireEvent.click(headers[1])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(2)
    // Collapse first card
    fireEvent.click(headers[0])
    expect(screen.getAllByTestId('action-card-details')).toHaveLength(1)
  })

  describe('fork', () => {
    const props = { userMessage: 'q', response: 'a', actions: [] }

    /**
     * ChatHome forks the Prime session, which addresses entries by Prime's own
     * id. Only replayed turns carry one, so a live turn must not offer a
     * button that can only fail.
     */
    it('is disabled when there is no id to branch from', () => {
      render(<AiMessage {...props} messageId="local-1" onFork={vi.fn()} />)

      expect(screen.getByTestId('ai-message-fork')).toBeDisabled()
    })

    it('branches from the id its host chose, not the local message id', () => {
      const onFork = vi.fn()
      render(
        <AiMessage {...props} messageId="local-1" forkTargetId="entry-7" onFork={onFork} />,
      )

      fireEvent.click(screen.getByTestId('ai-message-fork'))

      expect(onFork).toHaveBeenCalledWith('entry-7')
    })

    it('stays disabled when the host offers no fork handler at all', () => {
      render(<AiMessage {...props} forkTargetId="entry-7" />)

      expect(screen.getByTestId('ai-message-fork')).toBeDisabled()
    })
  })
})
