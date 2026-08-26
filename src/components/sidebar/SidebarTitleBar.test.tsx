import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarTitleBar } from './SidebarSections'

function renderTitleBar(overrides: Partial<ComponentProps<typeof SidebarTitleBar>> = {}) {
  return render(<SidebarTitleBar {...overrides} />, { wrapper: TooltipProvider })
}

describe('SidebarTitleBar', () => {
  it('renders sidebar and history controls with shortcut tooltips', () => {
    const onCollapse = vi.fn()
    const onGoBack = vi.fn()
    const onGoForward = vi.fn()

    renderTitleBar({
      onCollapse,
      onGoBack,
      onGoForward,
      canGoBack: true,
      canGoForward: false,
    })

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    const back = screen.getByRole('button', { name: 'Go Back' })
    const forward = screen.getByRole('button', { name: 'Go Forward' })

    expect(collapse).toHaveAttribute('title', expect.stringMatching(/^Collapse sidebar \((⌘|Ctrl\+)2\)$/))
    expect(back).toHaveAttribute('title', expect.stringMatching(/^Go Back \((⌘←|Ctrl\+Left)\)$/))
    expect(forward).toHaveAttribute('title', expect.stringMatching(/^Go Forward \((⌘→|Ctrl\+Right)\)$/))
    expect(forward).toBeDisabled()

    fireEvent.click(collapse)
    fireEvent.click(back)
    fireEvent.click(forward)

    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onGoBack).toHaveBeenCalledTimes(1)
    expect(onGoForward).not.toHaveBeenCalled()
  })

  it('omits controls when sidebar callbacks are absent', () => {
    renderTitleBar()

    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go Forward' })).not.toBeInTheDocument()
  })

  it('renders the lowercase rhizome wordmark next to the brand mark', () => {
    renderTitleBar()

    const lockup = screen.getByTestId('brand-lockup')
    expect(lockup.textContent).toBe('rhizome')
    expect(lockup.querySelector('[data-testid="brand-mark"]')).toBeInTheDocument()
  })
  it('drops the traffic-light gutter when docked right', () => {
    // The 90px left inset exists only to clear the macOS traffic lights. On
    // the trailing edge they are the command rail's problem, and the inset is
    // just dead space pushing the controls into the middle of the bar.
    const { container } = renderTitleBar({ onCollapse: vi.fn(), dock: 'right' })
    const bar = container.firstChild as HTMLElement
    expect(bar.style.paddingLeft).toBe('8px')
  })

  it('does not reserve a traffic-light gutter in a browser preview', () => {
    const { container } = renderTitleBar({ onCollapse: vi.fn(), dock: 'left' })
    const bar = container.firstChild as HTMLElement
    expect(bar.style.paddingLeft).toBe('8px')
  })

  it('mirrors the collapse glyph so it points at the edge it closes toward', () => {
    renderTitleBar({ onCollapse: vi.fn(), dock: 'right' })
    const svg = screen.getByRole('button', { name: 'Collapse sidebar' }).querySelector('svg')
    expect(svg).toHaveAttribute('transform', 'scale(-1, 1)')
  })
})
