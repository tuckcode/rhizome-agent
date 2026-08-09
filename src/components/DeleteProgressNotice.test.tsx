import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteProgressNotice } from './DeleteProgressNotice'

describe('DeleteProgressNotice', () => {
  it('renders nothing when no delete is in progress', () => {
    render(<DeleteProgressNotice count={0} />)
    expect(screen.queryByTestId('delete-progress-notice')).not.toBeInTheDocument()
  })

  it('renders the singular progress message', () => {
    render(<DeleteProgressNotice count={1} />)
    expect(screen.getByTestId('delete-progress-notice')).toHaveTextContent('Deleting note...')
  })

  it('renders the plural progress message', () => {
    render(<DeleteProgressNotice count={3} />)
    expect(screen.getByTestId('delete-progress-notice')).toHaveTextContent('Deleting 3 notes...')
  })
})
