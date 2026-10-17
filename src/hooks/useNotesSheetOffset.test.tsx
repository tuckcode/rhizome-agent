import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MACOS_TITLEBAR_HEIGHT } from '../components/MacOSTitlebar'
import { hasNativeMacosTrafficLights } from '../utils/trafficLights'
import {
  NOTES_SHEET_OFFSET_VAR,
  SHEET_OFFSET_BAND_ATTR,
  useNotesSheetOffset,
} from './useNotesSheetOffset'

vi.mock('../utils/trafficLights', () => ({
  hasNativeMacosTrafficLights: vi.fn(() => false),
}))

function OffsetOwner() {
  useNotesSheetOffset()
  return null
}

const resizeObservers: Array<{ fire: () => void }> = []

class FakeResizeObserver {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(this)
  }

  observe() {}

  unobserve() {}

  disconnect() {}

  fire() {
    this.callback([], this)
  }
}

function stubHeight(node: HTMLElement, height: number) {
  node.getBoundingClientRect = () => ({
    height,
    width: 100,
    top: 0,
    left: 0,
    bottom: height,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

afterEach(() => {
  document.documentElement.style.removeProperty(NOTES_SHEET_OFFSET_VAR)
  document.documentElement.style.removeProperty('--overlay-titlebar-height')
  vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(false)
  resizeObservers.length = 0
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

describe('useNotesSheetOffset', () => {
  it('shrinks the sheet offset when the content band shrinks', async () => {
    const band = document.createElement('div')
    band.setAttribute(SHEET_OFFSET_BAND_ATTR, 'content')
    stubHeight(band, 72)
    document.body.appendChild(band)

    render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('72px')
    expect(document.documentElement.style.getPropertyValue('--overlay-titlebar-height')).toBe('')

    stubHeight(band, 30)
    const observer = resizeObservers.at(-1)
    expect(observer).toBeDefined()
    observer?.fire()

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('30px')
    })
    band.remove()
  })

  it('does not measure when an unrelated node changes style or class', async () => {
    const band = document.createElement('div')
    band.setAttribute(SHEET_OFFSET_BAND_ATTR, 'content')
    stubHeight(band, 40)
    const textarea = document.createElement('textarea')
    document.body.append(band, textarea)

    const measure = vi.spyOn(band, 'getBoundingClientRect')
    render(<OffsetOwner />)
    const afterMount = measure.mock.calls.length
    expect(afterMount).toBeGreaterThan(0)

    for (let i = 0; i < 100; i += 1) {
      textarea.style.height = `${20 + i}px`
      textarea.className = i % 2 === 0 ? 'composer' : 'composer-tall'
    }
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(measure.mock.calls.length).toBe(afterMount)
    textarea.remove()
    band.remove()
  })

  it('clears the sheet offset when the owner unmounts', () => {
    const band = document.createElement('div')
    band.setAttribute(SHEET_OFFSET_BAND_ATTR, 'content')
    stubHeight(band, 40)
    document.body.appendChild(band)

    const view = render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('40px')

    view.unmount()
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe('')
    band.remove()
  })

  it('uses the native macOS title bar height when no band is on top', () => {
    vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(true)
    render(<OffsetOwner />)
    expect(document.documentElement.style.getPropertyValue(NOTES_SHEET_OFFSET_VAR)).toBe(
      `${MACOS_TITLEBAR_HEIGHT}px`,
    )
    expect(MACOS_TITLEBAR_HEIGHT).toBe(32)
  })
})
