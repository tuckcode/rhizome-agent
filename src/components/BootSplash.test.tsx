import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BootSplash } from './BootSplash'

describe('BootSplash', () => {
  it('announces loading so cold launch is not an empty window', () => {
    render(<BootSplash />)
    expect(screen.getByTestId('boot-splash')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: 'Loading Rhizome' })).toBeInTheDocument()
    const card = screen.getByTestId('boot-splash-card')
    expect(card).toContainElement(screen.getByText('Starting…'))
    expect(card).toContainElement(screen.getByText('rhizome'))
  })
})
