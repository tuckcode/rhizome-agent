import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsPanel } from './SettingsPanel'
import type { Settings } from '../types'

const emptySettings: Settings = {
  auto_pull_interval_minutes: null,
  git_enabled: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  automatic_update_checks_enabled: null,
  theme_mode: null,
  ui_language: null,
  date_display_format: null,
  default_ai_agent: null,
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
}

describe('Chat engine picker', () => {
  it('does not render a Settings engine switch', () => {
    render(
      <TooltipProvider>
        <SettingsPanel open={true} settings={emptySettings} onSave={vi.fn()} onClose={vi.fn()} />
      </TooltipProvider>,
    )

    expect(screen.queryByTestId('settings-chat-engine')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Chat engine' })).not.toBeInTheDocument()
    expect(screen.queryByText('Advanced Prime engine')).not.toBeInTheDocument()
    expect(screen.getByTestId('native-chat-model-picker')).toBeInTheDocument()
  })
})
