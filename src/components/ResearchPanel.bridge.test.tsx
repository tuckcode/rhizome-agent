import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ResearchPanel } from './ResearchPanel'

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

    await waitFor(() => {
      expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Library scan error/i)).not.toBeInTheDocument()
    })

    expect(
      await screen.findByText('Paste a repo URL or pick a local folder to map it'),
    ).toBeInTheDocument()
  })
})
