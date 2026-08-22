import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const dragRegionMouseDown = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useDragRegion', () => ({
  useDragRegion: () => ({ dragRegionRef: { current: null }, onMouseDown: dragRegionMouseDown }),
}))

import { PrimeSessionSubhead } from './PrimeSessionSubhead'

function renderSubhead() {
  return render(
    <PrimeSessionSubhead
      locale="en"
      live
      sessionId="sess_1036"
      model="Grok 4.6"
      thinkingLevel="medium"
      vaultPath="/Users/dtc/Documents/Rhizome Vault"
    />,
  )
}

describe('PrimeSessionSubhead window dragging', () => {
  it('is a drag region, because on Chat it is the topmost band', () => {
    renderSubhead()

    // Chat has no breadcrumb bar above it. Without this the window cannot be
    // moved from the Chat surface at all.
    expect(screen.getByTestId('prime-session-subhead')).toHaveAttribute('data-tauri-drag-region')
  })

  it('starts a window drag on mousedown', () => {
    renderSubhead()
    dragRegionMouseDown.mockClear()

    fireEvent.mouseDown(screen.getByTestId('prime-session-subhead'))

    expect(dragRegionMouseDown).toHaveBeenCalled()
  })
})
