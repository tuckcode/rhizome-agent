import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WikilinkSuggestionMenu, type WikilinkSuggestionItem } from './WikilinkSuggestionMenu'

const item: WikilinkSuggestionItem = {
  title: 'Alpha',
  path: '/vault/alpha.md',
  onItemClick: vi.fn(),
}

describe('WikilinkSuggestionMenu', () => {
  it('runs the item click once when the controller callback invokes the item action', () => {
    const itemClick = vi.fn()
    const controllerClick = vi.fn((clickedItem: WikilinkSuggestionItem) => clickedItem.onItemClick())

    render(
      <WikilinkSuggestionMenu
        items={[{ ...item, onItemClick: itemClick }]}
        loadingState="loaded"
        selectedIndex={0}
        onItemClick={controllerClick}
      />,
    )

    fireEvent.mouseDown(screen.getByText('Alpha'))

    expect(controllerClick).toHaveBeenCalledOnce()
    expect(controllerClick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alpha' }))
    expect(itemClick).toHaveBeenCalledOnce()
  })

  it('falls back to the item click handler when the controller callback only closes the menu', () => {
    const controllerClick = vi.fn()
    const itemClick = vi.fn()

    render(
      <WikilinkSuggestionMenu
        items={[{ ...item, onItemClick: itemClick }]}
        loadingState="loaded"
        selectedIndex={0}
        onItemClick={controllerClick}
      />,
    )

    fireEvent.mouseDown(screen.getByText('Alpha'))

    expect(controllerClick).toHaveBeenCalledOnce()
    expect(itemClick).toHaveBeenCalledOnce()
  })

  it('falls back to the item click handler when no controller callback is supplied', () => {
    const itemClick = vi.fn()

    render(
      <WikilinkSuggestionMenu
        items={[{ ...item, onItemClick: itemClick }]}
        loadingState="loaded"
        selectedIndex={0}
      />,
    )

    fireEvent.mouseDown(screen.getByText('Alpha'))

    expect(itemClick).toHaveBeenCalledOnce()
  })
})
