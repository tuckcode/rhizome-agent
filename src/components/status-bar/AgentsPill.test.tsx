import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentsPill } from './AgentsPill'
import type { RhizomeJob } from '../../hooks/useRhizomeJobs'

const job: RhizomeJob = {
  id: 'job-1',
  name: 'rhizome_repo_research',
  startedAt: 0,
  label: 'Generate → architecture',
}

describe('AgentsPill (wave 5.4b §2.6)', () => {
  it('reads idle when no agent job is running', () => {
    render(<AgentsPill jobs={[]} onCancelJob={vi.fn()} />)

    const pill = screen.getByTestId('status-agents-pill')
    expect(pill).toHaveTextContent('Agents idle')
    expect(pill).toHaveAttribute('data-agents-state', 'idle')
  })

  it('names the running job when an agent is working', () => {
    render(<AgentsPill jobs={[job]} onCancelJob={vi.fn()} />)

    const pill = screen.getByTestId('status-agents-pill')
    expect(pill).toHaveTextContent('Generate → architecture')
    expect(pill).toHaveAttribute('data-agents-state', 'working')
  })

  it('counts the jobs when more than one agent is working', () => {
    render(<AgentsPill jobs={[job, { ...job, id: 'job-2' }]} onCancelJob={vi.fn()} />)

    expect(screen.getByTestId('status-agents-pill')).toHaveTextContent('2 agents working')
  })

  it('lists running jobs in its dropdown and cancels them', () => {
    const onCancelJob = vi.fn()
    render(<AgentsPill jobs={[job]} onCancelJob={onCancelJob} />)

    fireEvent.click(screen.getByTestId('status-agents-pill'))
    const popup = screen.getByTestId('status-agents-popup')
    expect(popup).toHaveTextContent('Generate → architecture')

    fireEvent.click(screen.getByTestId('status-agents-cancel-job-1'))

    expect(onCancelJob).toHaveBeenCalledWith('job-1')
  })

  it('shows an empty state in the dropdown when nothing is running', () => {
    render(<AgentsPill jobs={[]} onCancelJob={vi.fn()} />)

    fireEvent.click(screen.getByTestId('status-agents-pill'))

    expect(screen.getByTestId('status-agents-popup')).toHaveTextContent('No agents running')
  })

  it('closes the dropdown on a second click', () => {
    render(<AgentsPill jobs={[]} onCancelJob={vi.fn()} />)

    fireEvent.click(screen.getByTestId('status-agents-pill'))
    expect(screen.getByTestId('status-agents-popup')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('status-agents-pill'))
    expect(screen.queryByTestId('status-agents-popup')).not.toBeInTheDocument()
  })
})
