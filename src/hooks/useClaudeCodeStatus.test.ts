import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useClaudeCodeStatus } from './useClaudeCodeStatus'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri') as { mockInvoke: ReturnType<typeof vi.fn> }

describe('useClaudeCodeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in checking state and resolves to installed', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_claude_cli') return Promise.resolve({ installed: true, version: '1.0.20' })
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useClaudeCodeStatus())

    expect(result.current.status).toBe('checking')

    await waitFor(() => {
      expect(result.current.status).toBe('installed')
      expect(result.current.version).toBe('1.0.20')
    })
  })

  it('resolves to missing when claude is not installed', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_claude_cli') return Promise.resolve({ installed: false, version: null })
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useClaudeCodeStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('missing')
      expect(result.current.version).toBeNull()
    })
  })

  it('resolves to missing on error', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_claude_cli') return Promise.reject(new Error('failed'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useClaudeCodeStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('missing')
    })
  })
})
