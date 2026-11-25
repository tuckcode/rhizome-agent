import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShellCompactLayout } from './useShellCompactLayout'

type Callback = (entries: Array<{ contentRect: { width: number } }>) => void
const observed: Element[] = []

class FakeResizeObserver {
  private readonly cb: Callback
  constructor(cb: Callback) {
    this.cb = cb
  }
  observe(element: Element) {
    observed.push(element)
    this.cb([{ contentRect: { width: 1280 } }])
  }
  disconnect() {}
}

afterEach(() => {
  observed.length = 0
  vi.unstubAllGlobals()
})

function Harness() {
  const [shell, setShell] = useState(false)
  const { shellRef, width } = useShellCompactLayout(true, true)
  // The startup screen renders first; the shell mounts later while `enabled` stays true.
  return (
    <>
      <button type="button" onClick={() => setShell(true)}>show</button>
      <output data-testid="width">{String(width)}</output>
      {shell ? <div ref={shellRef} /> : <p>starting</p>}
    </>
  )
}

describe('useShellCompactLayout', () => {
  it('measures a shell that mounts after the hook is enabled', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    render(<Harness />)
    expect(observed).toHaveLength(0)
    fireEvent.click(screen.getByText('show'))
    expect(observed).toHaveLength(1)
    expect(screen.getByTestId('width')).toHaveTextContent('1280')
  })
})
