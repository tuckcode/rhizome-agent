import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDragRegion } from './useDragRegion'

const { invoke, startDragging } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}))

function DragRegionHarness() {
  const { dragRegionRef } = useDragRegion<HTMLDivElement>()

  return (
    <div data-testid="drag-surface" ref={dragRegionRef}>
      <div data-testid="no-drag-card" data-no-drag>
        <button type="button">Action</button>
      </div>
      <div role="menu" aria-label="Note actions">
        <button type="button" role="menuitem">Delete this note</button>
      </div>
    </div>
  )
}

function pressBackground(target: HTMLElement, extra: MouseEventInit = {}) {
  fireEvent.mouseDown(target, { button: 0, clientX: 10, clientY: 10, ...extra })
}

describe('useDragRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not start dragging until the pointer moves', () => {
    render(<DragRegionHarness />)

    pressBackground(screen.getByTestId('drag-surface'))

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('starts dragging after the pointer moves past the drag threshold', () => {
    render(<DragRegionHarness />)

    pressBackground(screen.getByTestId('drag-surface'))
    fireEvent.mouseMove(window, { clientX: 18, clientY: 10 })

    expect(startDragging).toHaveBeenCalledOnce()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('runs the native title-bar action on a double-click', () => {
    render(<DragRegionHarness />)

    pressBackground(screen.getByTestId('drag-surface'), { detail: 2 })

    expect(invoke).toHaveBeenCalledWith('perform_current_window_titlebar_double_click')
    expect(startDragging).not.toHaveBeenCalled()
  })

  it('detects a repeated background press even when native dragging resets click detail', () => {
    let currentTime = 1_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<DragRegionHarness />)

    const surface = screen.getByTestId('drag-surface')
    pressBackground(surface, { detail: 1 })
    currentTime = 1_200
    pressBackground(surface, { detail: 1 })

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith('perform_current_window_titlebar_double_click')
    now.mockRestore()
  })

  it('does not treat a same-tick duplicate press as a title-bar double-click', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    render(<DragRegionHarness />)

    const surface = screen.getByTestId('drag-surface')
    pressBackground(surface, { detail: 1 })
    pressBackground(surface, { detail: 1 })

    expect(invoke).not.toHaveBeenCalled()
    expect(startDragging).not.toHaveBeenCalled()
    now.mockRestore()
  })

  it('ignores a second title-bar action that arrives during the lock window', () => {
    let currentTime = 1_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<DragRegionHarness />)

    const surface = screen.getByTestId('drag-surface')
    pressBackground(surface, { detail: 2 })
    currentTime = 1_120
    pressBackground(surface, { detail: 2 })

    expect(invoke).toHaveBeenCalledOnce()
    now.mockRestore()
  })

  it('does not start dragging from no-drag containers', () => {
    render(<DragRegionHarness />)

    pressBackground(screen.getByTestId('no-drag-card'))
    fireEvent.mouseMove(window, { clientX: 18, clientY: 10 })

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('does not start dragging from interactive descendants', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Action' }), { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 18, clientY: 10 })

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('does not start dragging from menu items rendered inside drag surfaces', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Delete this note' }), { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 18, clientY: 10 })

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('ignores non-primary mouse buttons', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByTestId('drag-surface'), { button: 1, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 18, clientY: 10 })

    expect(startDragging).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })
})
