import { describe, expect, it, vi } from 'vitest'
import { notifyNativeTurnAccepted, setNativeTurnAcceptedHandler } from './nativeTurnAccepted'

describe('native turn accepted handlers', () => {
  it('clears only the panel that accepted the turn', () => {
    const first = vi.fn()
    const second = vi.fn()
    setNativeTurnAcceptedHandler('panel-a', first)
    setNativeTurnAcceptedHandler('panel-b', second)
    notifyNativeTurnAccepted('panel-a')
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
    setNativeTurnAcceptedHandler('panel-a', null)
    notifyNativeTurnAccepted('panel-a')
    expect(first).toHaveBeenCalledOnce()
    notifyNativeTurnAccepted('panel-b')
    expect(second).toHaveBeenCalledOnce()
  })
})
