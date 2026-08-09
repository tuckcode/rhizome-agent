import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictNoteBanner } from './ConflictNoteBanner'

describe('ConflictNoteBanner', () => {
  it('renders conflict message', () => {
    render(<ConflictNoteBanner onKeepMine={vi.fn()} onKeepTheirs={vi.fn()} />)
    expect(screen.getByText('This note has a merge conflict')).toBeInTheDocument()
  })

  it('calls onKeepMine when clicking Keep mine button', () => {
    const onKeepMine = vi.fn()
    render(<ConflictNoteBanner onKeepMine={onKeepMine} onKeepTheirs={vi.fn()} />)
    fireEvent.click(screen.getByTestId('conflict-keep-mine-btn'))
    expect(onKeepMine).toHaveBeenCalledOnce()
  })

  it('calls onKeepTheirs when clicking Keep theirs button', () => {
    const onKeepTheirs = vi.fn()
    render(<ConflictNoteBanner onKeepMine={vi.fn()} onKeepTheirs={onKeepTheirs} />)
    fireEvent.click(screen.getByTestId('conflict-keep-theirs-btn'))
    expect(onKeepTheirs).toHaveBeenCalledOnce()
  })

  it('has the correct test id', () => {
    render(<ConflictNoteBanner onKeepMine={vi.fn()} onKeepTheirs={vi.fn()} />)
    expect(screen.getByTestId('conflict-note-banner')).toBeInTheDocument()
  })
})
