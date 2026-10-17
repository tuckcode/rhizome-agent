import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResearchPanel } from './ResearchPanel'
import { mockInvoke } from '../mock-tauri'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: () => {
    throw new TypeError("Cannot read properties of undefined (reading 'invoke')")
  },
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

describe('ResearchPanel without a Tauri bridge', () => {
  it('scans through the mock and does not surface a TypeError', async () => {
    const scan = mockInvoke<string>('call_rhizome_tool', {
      name: 'rhizome_scan_library',
      args: { vaultPath: '/vault' },
    })

    expect(() => {
      render(
        <ResearchPanel
          open={true}
          onClose={() => {}}
          vaultPath="/vault"
          onOpenNote={() => {}}
        />,
      )
    }).not.toThrow()

    const items = JSON.parse(await scan) as Array<{ title: string }>
    expect(items.some((item) => item.title === 'mock repo')).toBe(true)

    await waitFor(() => {
      expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Library scan error/i)).not.toBeInTheDocument()
    })

    expect(
      await screen.findByText('Paste a repo URL or pick a local folder to map it'),
    ).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('tab', { name: /library/i }), { button: 0, ctrlKey: false })
    expect(await screen.findByText('mock repo')).toBeInTheDocument()
  })
})
