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
      vaultPath="/Users/dtc/Documents/Rhizome Vault"
    />,
  )
}

describe('PrimeSessionSubhead window dragging', () => {
  it('avoids a second native drag marker beside the custom handler', () => {
    renderSubhead()

    expect(screen.getByTestId('prime-session-subhead')).not.toHaveAttribute('data-tauri-drag-region')
  })

  it('starts a window drag on mousedown', () => {
    renderSubhead()
    dragRegionMouseDown.mockClear()

    fireEvent.mouseDown(screen.getByTestId('prime-session-subhead'))

    expect(dragRegionMouseDown).toHaveBeenCalled()
  })
})
