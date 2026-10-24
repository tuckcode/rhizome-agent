import { describe, expect, it } from 'vitest'
import type { Settings } from '../types'
import {
  migrateRemovedHarnessChoice,
  migrateRemovedHarnessSettings,
  migrateStoredAiAgent,
  migrateStoredAiTarget,
  migrateStoredChatEngine,
  removedHarnessSettingsNeedPersist,
} from './migrateRemovedHarnessChoices'

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
  color_theme: null,
  accent_color: null,
  ui_language: null,
  date_display_format: null,
  timezone: null,
  note_width_mode: null,
  sidebar_type_pluralization_enabled: null,
  default_ai_agent: null,
  default_ai_target: null,
  agent_memory_vault_path: null,
  ai_model_providers: null,
  ai_workspace_conversations: null,
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  multi_workspace_enabled: null,
  agent_profile: null,
}

describe('migrateRemovedHarnessChoice', () => {
  it.each([
    ['prime', 'native'],
    ['Prime', 'native'],
    ['hermes', 'native'],
    ['HERMES', 'native'],
    ['agent:pi', 'native'],
    ['pi', 'native'],
    ['agent:prime', 'native'],
    ['agent:hermes', 'native'],
    ['gemini', 'native'],
    ['agent:gemini', 'native'],
    ['bogus', 'native'],
    ['not-an-engine', 'native'],
    ['', 'native'],
    [null, 'native'],
    [undefined, 'native'],
    ['native', 'native'],
    ['agent:native', 'native'],
  ])('maps %p to native', (input, expected) => {
    expect(migrateRemovedHarnessChoice(input)).toBe(expected)
  })

  it('is idempotent for every legacy and garbage value', () => {
    const values = [
      'prime',
      'hermes',
      'agent:pi',
      'gemini',
      'bogus',
      'native',
      null,
      undefined,
      'codex',
      'claude_code',
      'agent:codex',
    ]
    for (const value of values) {
      const once = migrateRemovedHarnessChoice(value)
      expect(migrateRemovedHarnessChoice(once)).toBe(once)
    }
  })

  it('leaves Codex and Claude Code targets intact', () => {
    expect(migrateRemovedHarnessChoice('codex')).toBe('codex')
    expect(migrateRemovedHarnessChoice('claude_code')).toBe('claude_code')
    expect(migrateRemovedHarnessChoice('agent:codex')).toBe('agent:codex')
    expect(migrateRemovedHarnessChoice('agent:claude_code')).toBe('agent:claude_code')
    expect(migrateRemovedHarnessChoice('opencode')).toBe('opencode')
    expect(migrateRemovedHarnessChoice('antigravity')).toBe('antigravity')
    expect(migrateRemovedHarnessChoice('kiro')).toBe('kiro')
  })

  it('leaves model targets intact', () => {
    expect(migrateRemovedHarnessChoice('model:openai/gpt-4.1')).toBe('model:openai/gpt-4.1')
  })

  it('never throws on garbage', () => {
    expect(() => migrateRemovedHarnessChoice({ weird: true })).not.toThrow()
    expect(migrateRemovedHarnessChoice({ weird: true })).toBe('native')
    expect(migrateRemovedHarnessChoice(12)).toBe('native')
  })
})

describe('migrateRemovedHarnessSettings', () => {
  it('writes chat_engine native for every leftover engine value', () => {
    expect(migrateStoredChatEngine('prime')).toBe('native')
    expect(migrateStoredChatEngine('hermes')).toBe('native')
    expect(migrateStoredChatEngine(null)).toBe('native')
    expect(migrateStoredChatEngine('native')).toBe('native')
  })

  it('leaves default_ai_agent prime unchanged', () => {
    const raw: Settings = {
      ...emptySettings,
      chat_engine: 'native',
      default_ai_agent: 'prime',
    }
    const migrated = migrateRemovedHarnessSettings(raw)
    expect(migrated.default_ai_agent).toBe('prime')
    expect(removedHarnessSettingsNeedPersist(raw, migrated)).toBe(false)
  })

  it('returns a valid agent id for agent:codex', () => {
    expect(migrateStoredAiAgent('agent:codex')).toBe('codex')
    expect(migrateStoredAiAgent('codex')).toBe('codex')
    expect(migrateStoredAiAgent('prime')).toBe('prime')
    expect(migrateStoredAiAgent('hermes')).toBe('hermes')
    expect(migrateStoredAiAgent('pi')).toBe('prime')
    expect(migrateStoredAiAgent('gemini')).toBe('prime')
    expect(migrateStoredAiAgent('bogus')).toBeNull()
    expect(migrateStoredAiTarget('agent:prime')).toBe('agent:prime')
    expect(migrateStoredAiTarget('prime')).toBe('agent:prime')
    expect(migrateStoredAiTarget('agent:hermes')).toBe('agent:hermes')
    expect(migrateStoredAiTarget('agent:codex')).toBe('agent:codex')
    expect(migrateStoredAiTarget('model:openai/gpt-4.1')).toBe('model:openai/gpt-4.1')
  })

  it('writes migrated fields back and is a no-op the second time', () => {
    const raw: Settings = {
      ...emptySettings,
      chat_engine: 'prime',
      default_ai_agent: 'hermes',
      default_ai_target: 'agent:pi',
      ai_workspace_conversations: [
        { id: 'c1', title: 'Prime chat', target_id: 'agent:prime', archived: false },
        { id: 'c2', title: 'Codex chat', target_id: 'agent:codex', archived: false },
      ],
    }
    const once = migrateRemovedHarnessSettings(raw)
    expect(once.chat_engine).toBe('native')
    expect(once.default_ai_agent).toBe('hermes')
    expect(once.default_ai_target).toBeNull()
    expect(once.ai_workspace_conversations?.[0]?.target_id).toBe('agent:prime')
    expect(once.ai_workspace_conversations?.[1]?.target_id).toBe('agent:codex')
    expect(removedHarnessSettingsNeedPersist(raw, once)).toBe(true)

    const twice = migrateRemovedHarnessSettings(once)
    expect(twice).toEqual(once)
    expect(removedHarnessSettingsNeedPersist(once, twice)).toBe(false)
  })

  it('keeps a persisted Rhizome target through a later settings save', () => {
    const raw: Settings = {
      ...emptySettings,
      chat_engine: 'native',
      default_ai_agent: 'prime',
      default_ai_target: 'agent:prime',
      ai_workspace_conversations: [
        { id: 'c1', title: 'Rhizome chat', target_id: 'agent:prime', archived: false },
      ],
    }
    const migrated = migrateRemovedHarnessSettings(raw)
    expect(migrated.default_ai_agent).toBe('prime')
    expect(migrated.default_ai_target).toBe('agent:prime')
    expect(migrated.ai_workspace_conversations?.[0]?.target_id).toBe('agent:prime')
    expect(removedHarnessSettingsNeedPersist(raw, migrated)).toBe(false)
  })

  it('does not persist an already-native install', () => {
    const native: Settings = {
      ...emptySettings,
      chat_engine: 'native',
      default_ai_agent: null,
      default_ai_target: null,
    }
    const migrated = migrateRemovedHarnessSettings(native)
    expect(migrated.chat_engine).toBe('native')
    expect(removedHarnessSettingsNeedPersist(native, migrated)).toBe(false)
  })

  it('does not persist a fresh install with no chat_engine on disk', () => {
    const fresh = migrateRemovedHarnessSettings(emptySettings)
    expect(fresh.chat_engine).toBe('native')
    expect(removedHarnessSettingsNeedPersist(emptySettings, fresh)).toBe(false)
  })

  it('moves a saved Prime or Hermes engine to native once and leaves the chats', () => {
    for (const engine of ['prime', 'hermes'] as const) {
      const raw: Settings = {
        ...emptySettings,
        chat_engine: engine,
        default_ai_agent: engine,
        ai_workspace_conversations: [
          { id: 'c1', title: 'Kept chat', target_id: `agent:${engine}`, archived: false },
          { id: 'c2', title: 'Codex chat', target_id: 'agent:codex', archived: false },
        ],
      }
      const once = migrateRemovedHarnessSettings(raw)
      expect(once.chat_engine).toBe('native')
      expect(once.ai_workspace_conversations?.[0]?.target_id).toBe(`agent:${engine}`)
      expect(once.ai_workspace_conversations?.[1]?.target_id).toBe('agent:codex')
      expect(once.ai_workspace_conversations?.map((conversation) => conversation.id)).toEqual(['c1', 'c2'])
      expect(once.ai_workspace_conversations?.map((conversation) => conversation.title)).toEqual([
        'Kept chat',
        'Codex chat',
      ])
      expect(removedHarnessSettingsNeedPersist(raw, once)).toBe(true)

      const twice = migrateRemovedHarnessSettings(once)
      expect(twice).toEqual(once)
      expect(removedHarnessSettingsNeedPersist(once, twice)).toBe(false)
    }

    const native: Settings = {
      ...emptySettings,
      chat_engine: 'native',
      default_ai_agent: null,
      default_ai_target: null,
    }
    const migrated = migrateRemovedHarnessSettings(native)
    expect(migrated.chat_engine).toBe('native')
    expect(migrated.default_ai_agent).toBeNull()
    expect(removedHarnessSettingsNeedPersist(native, migrated)).toBe(false)
  })
})
