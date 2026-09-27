import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { hasNativeMacosTrafficLights } from '../utils/trafficLights'
import { MACOS_TITLEBAR_HEIGHT, MacOSTitlebar } from './MacOSTitlebar'

const { invoke, startDragging } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  startDragging: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/trafficLights', async () => {
  const actual = await vi.importActual<typeof import('../utils/trafficLights')>(
    '../utils/trafficLights',
  )
  return {
    ...actual,
    hasNativeMacosTrafficLights: vi.fn(),
  }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    startDragging,
  }),
}))

describe('MacOSTitlebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(true)
  })

  it('uses useDragRegion and never data-tauri-drag-region', () => {
    const source = readFileSync(`${process.cwd()}/src/components/MacOSTitlebar.tsx`, 'utf8')
    expect(source).toContain('useDragRegion')
    expect(source).not.toContain('data-tauri-drag-region')
  })

  it('is 32px tall so tao can seat traffic lights with y≈9', () => {
    expect(MACOS_TITLEBAR_HEIGHT).toBe(32)
    const conf = JSON.parse(
      readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'),
    ) as { app: { windows: Array<{ trafficLightPosition?: { y: number } }> } }
    expect(conf.app.windows[0]?.trafficLightPosition?.y).toBe(9)
  })

  it('does not render when native macOS traffic lights are absent', () => {
    vi.mocked(hasNativeMacosTrafficLights).mockReturnValue(false)

    render(<MacOSTitlebar />)

    expect(screen.queryByTestId('macos-titlebar')).toBeNull()
  })

  it('docks Command Palette on the right, clear of the traffic lights, and opens it through the shared command bus', () => {
    const received: string[] = []
    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      received.push(detail)
    }
    window.addEventListener(APP_COMMAND_EVENT_NAME, onCommand)

    render(<MacOSTitlebar />)

    const bar = screen.getByTestId('macos-titlebar')
    expect(bar).toHaveStyle({ height: `${MACOS_TITLEBAR_HEIGHT}px` })
    expect(bar.className).toContain('justify-end')
    fireEvent.click(screen.getByTestId('open-command-palette'))
    expect(received).toEqual([APP_COMMAND_IDS.viewCommandPalette])
    expect(screen.getByTestId('open-command-palette')).toHaveTextContent('Command Palette')

    window.removeEventListener(APP_COMMAND_EVENT_NAME, onCommand)
  })

  it('routes titlebar double-click through the shared drag-region command only once', () => {
    render(<MacOSTitlebar />)

    fireEvent.mouseDown(screen.getByTestId('macos-titlebar'), { button: 0, detail: 2 })

    expect(invoke).toHaveBeenCalledWith('perform_current_window_titlebar_double_click')
    expect(startDragging).not.toHaveBeenCalled()
  })
})
