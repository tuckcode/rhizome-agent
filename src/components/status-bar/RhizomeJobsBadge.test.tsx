import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Deliberately does NOT mock useDismissibleLayer — this is a regression test
// for a real signature mismatch (object literal passed where the hook takes
// three positional args) that shipped past both `tsc --noEmit` and every
// other status-bar test, which all mock this hook away.

vi.mock('@/components/ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    onKeyDown,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} onKeyDown={onKeyDown} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

import { RhizomeJobsBadge } from './StatusBarBadges'
import type { RhizomeJob } from '../../hooks/useRhizomeJobs'

const jobs: RhizomeJob[] = [
  { id: 'job-1', name: 'rhizome_repo_research', startedAt: 0, label: 'Generate → architecture' },
]

describe('RhizomeJobsBadge', () => {
  it('renders nothing when there are no active jobs', () => {
    const { container } = render(<RhizomeJobsBadge jobs={[]} onCancelJob={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the popover on click without crashing (real useDismissibleLayer wiring)', () => {
    render(<RhizomeJobsBadge jobs={jobs} onCancelJob={vi.fn()} />)

    expect(screen.queryByTestId('rhizome-jobs-popup')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('status-rhizome-jobs'))
    expect(screen.getByTestId('rhizome-jobs-popup')).toBeInTheDocument()
    expect(screen.getByText('Generate → architecture')).toBeInTheDocument()
  })

  it('calls onCancelJob with the job id when Cancel is clicked', () => {
    const onCancelJob = vi.fn()
    render(<RhizomeJobsBadge jobs={jobs} onCancelJob={onCancelJob} />)

    fireEvent.click(screen.getByTestId('status-rhizome-jobs'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancelJob).toHaveBeenCalledWith('job-1')
  })

  it('dismisses the popover on an outside click (real useDismissibleLayer behavior)', () => {
    render(<RhizomeJobsBadge jobs={jobs} onCancelJob={vi.fn()} />)

    fireEvent.click(screen.getByTestId('status-rhizome-jobs'))
    expect(screen.getByTestId('rhizome-jobs-popup')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('rhizome-jobs-popup')).not.toBeInTheDocument()
  })
})
