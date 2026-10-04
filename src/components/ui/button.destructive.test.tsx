import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('destructive button contrast', () => {
  it('keeps an opaque destructive background in the application dark theme', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button.className).toContain('bg-destructive')
    expect(button.className).toContain('text-destructive-foreground')
    const usesTranslucentDestructive = button.className.split(/\s+/).some((token) => (
      token.includes('destructive') && token.includes('60')
    ))
    expect(usesTranslucentDestructive).toBe(false)
    expect(button.className).toContain('hover:bg-destructive/95')
    expect(button.className).toContain('disabled:opacity-50')
  })
})
