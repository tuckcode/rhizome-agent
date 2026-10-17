import { describe, expect, it } from 'vitest'
import type { Settings } from '../types'
import { settingsAfterUseRhizome } from './settingsAfterUseRhizome'

const baseSettings: Settings = {
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
  color_theme: null,
  accent_color: null,
  ui_language: null,
  date_display_format: null,
  timezone: null,
  note_width_mode: null,
  sidebar_type_pluralization_enabled: null,
  default_ai_agent: 'prime',
  default_ai_target: null,
  agent_memory_vault_path: null,
  ai_model_providers: null,
  ai_workspace_conversations: [
    { id: 'codex-chat', title: 'Codex notes', target_id: 'agent:codex', archived: false },
    { id: 'other-chat', title: 'Other', target_id: 'agent:claude_code', archived: false },
  ],
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  multi_workspace_enabled: null,
  agent_profile: null,
}

describe('settingsAfterUseRhizome', () => {
  it('persists Rhizome as the default chat target without touching distill\'s agent', () => {
    const next = settingsAfterUseRhizome(baseSettings, 'agent:prime', 'codex-chat')

    expect(next.default_ai_target).toBe('agent:prime')
    expect(next.default_ai_agent).toBe('prime')
    expect(next.ai_workspace_conversations?.find((conversation) => conversation.id === 'codex-chat')?.target_id)
      .toBe('agent:prime')
    expect(next.ai_workspace_conversations?.find((conversation) => conversation.id === 'other-chat')?.target_id)
      .toBe('agent:claude_code')
  })

  it('leaves conversation targets alone when no chat is active', () => {
    const next = settingsAfterUseRhizome(baseSettings, 'agent:prime', null)

    expect(next.default_ai_target).toBe('agent:prime')
    expect(next.default_ai_agent).toBe('prime')
    expect(next.ai_workspace_conversations).toEqual(baseSettings.ai_workspace_conversations)
  })

  it('upserts an unsaved active conversation so reopen keeps Rhizome', () => {
    const settings = { ...baseSettings, ai_workspace_conversations: null }
    const next = settingsAfterUseRhizome(settings, 'agent:prime', 'unsaved-codex')

    expect(next.default_ai_target).toBe('agent:prime')
    expect(next.default_ai_agent).toBe('prime')
    expect(next.ai_workspace_conversations).toEqual([
      { id: 'unsaved-codex', title: 'AI Chat', target_id: 'agent:prime', archived: false },
    ])
  })
})
