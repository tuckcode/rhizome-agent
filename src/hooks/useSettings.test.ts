import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import type { Settings } from '../types'
import {
  GITIGNORED_VISIBILITY_CHANGED_EVENT,
  TOGGLE_GITIGNORED_VISIBILITY_EVENT,
} from '../lib/gitignoredVisibilityEvents'
import { readChatEngine } from '../lib/chatEngine'
import { settingsAfterUseRhizome } from '../lib/settingsAfterUseRhizome'
import { useSettings } from './useSettings'

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}))

const defaultSettings: Settings = {
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
  multi_workspace_enabled: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  agent_profile: null,
  agent_max_steps: null,
}

const savedSettings: Settings = {
  auto_pull_interval_minutes: 15,
  git_enabled: null,
  autogit_enabled: true,
  autogit_idle_threshold_seconds: 90,
  autogit_inactive_threshold_seconds: 30,
  auto_advance_inbox_after_organize: true,
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
  multi_workspace_enabled: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  agent_profile: null,
  agent_max_steps: null,
}

let mockSettingsStore: Settings = { ...defaultSettings }

function settingsInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  if (cmd === 'get_settings') return Promise.resolve({ ...mockSettingsStore })
  if (cmd === 'save_settings') {
    mockSettingsStore = { ...(args as { settings: Settings }).settings }
    return Promise.resolve(null)
  }
  return Promise.resolve(null)
}

const mockInvokeFn = vi.fn(settingsInvoke)

function savedChatTarget(): Settings {
  return {
    ...savedSettings,
    theme_mode: 'dark',
    chat_engine: 'native',
    native_chat_target: 'openai/gpt-4.1-mini',
  }
}

function declineTelemetry(settings: Settings): Settings {
  return {
    ...settings,
    telemetry_consent: false,
    crash_reporting_enabled: false,
    analytics_enabled: false,
    anonymous_id: null,
  }
}

function saveSettingsCalls() {
  return mockInvokeFn.mock.calls.filter((call) => call[0] === 'save_settings')
}

const nativeInvoke = vi.mocked(invoke)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: trackEventMock,
}))

async function renderLoadedSettings(): Promise<Settings> {
  const { result } = renderHook(() => useSettings())

  await waitFor(() => {
    expect(result.current.loaded).toBe(true)
  })

  return result.current.settings
}

function changedSettings(): Settings {
  return {
    auto_pull_interval_minutes: null,
    git_enabled: null,
    autogit_enabled: false,
    autogit_idle_threshold_seconds: 120,
    autogit_inactive_threshold_seconds: 45,
    auto_advance_inbox_after_organize: false,
    telemetry_consent: null,
    crash_reporting_enabled: null,
    analytics_enabled: null,
    anonymous_id: null,
    release_channel: null,
    automatic_update_checks_enabled: false,
    theme_mode: null,
    color_theme: null,
    accent_color: null,
    ui_language: 'zh-CN',
    date_display_format: 'iso',
    timezone: null,
    note_width_mode: 'wide',
    sidebar_type_pluralization_enabled: false,
    default_ai_agent: null,
    default_ai_target: null,
    agent_memory_vault_path: null,
    ai_model_providers: null,
    ai_workspace_conversations: null,
    hide_gitignored_files: false,
    block_secret_files: null,
    multi_workspace_enabled: null,
    all_notes_show_pdfs: true,
    all_notes_show_images: false,
    all_notes_show_unsupported: true,
    agent_profile: null,
    chat_engine: 'native',
    agent_max_steps: null,
  }
}

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockReset()
    mockInvokeFn.mockImplementation(settingsInvoke)
    trackEventMock.mockClear()
    mockSettingsStore = { ...defaultSettings }
    nativeInvoke.mockResolvedValue(undefined)
  })

  it('returns empty settings initially', () => {
    mockInvokeFn.mockImplementationOnce(() => new Promise(() => {}))

    const { result, unmount } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual(defaultSettings)
    expect(result.current.loaded).toBe(false)
    unmount()
  })

  it('reads the chat engine as native when settings fail to load', async () => {
    mockInvokeFn.mockImplementationOnce((cmd: string) => {
      if (cmd === 'get_settings') return Promise.reject(new Error('disk'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(readChatEngine(result.current.settings.chat_engine)).toBe('native')
  })

  it('writes leftover Prime/Hermes engine choices to native once', async () => {
    mockSettingsStore = {
      ...savedSettings,
      chat_engine: 'prime',
      default_ai_agent: 'hermes',
      default_ai_target: 'agent:pi',
    }
    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.settings.chat_engine).toBe('native')
    expect(result.current.settings.default_ai_agent).toBe('hermes')
    expect(result.current.settings.default_ai_target).toBeNull()
    expect(mockInvokeFn).toHaveBeenCalledWith('save_settings', {
      settings: expect.objectContaining({
        chat_engine: 'native',
        default_ai_agent: 'hermes',
        default_ai_target: null,
      }),
    })
  })

  it('leaves a persisted Rhizome target on disk', async () => {
    mockSettingsStore = {
      ...savedSettings,
      chat_engine: 'native',
      default_ai_agent: 'prime',
      default_ai_target: 'agent:prime',
    }
    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.settings.default_ai_agent).toBe('prime')
    expect(result.current.settings.default_ai_target).toBe('agent:prime')
    expect(mockInvokeFn).not.toHaveBeenCalledWith('save_settings', expect.anything())
  })

  it('leaves default_ai_agent prime on disk', async () => {
    mockSettingsStore = {
      ...savedSettings,
      chat_engine: 'native',
      default_ai_agent: 'prime',
    }
    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.settings.default_ai_agent).toBe('prime')
    expect(mockInvokeFn).not.toHaveBeenCalledWith('save_settings', expect.anything())
  })

  it('loads settings from backend on mount', async () => {
    mockSettingsStore = { ...savedSettings }
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.settings.auto_pull_interval_minutes).toBe(15)
    expect(mockInvokeFn).toHaveBeenCalledWith('get_settings', {})
  })

  it('loads settings from native invoke when Tauri globals are not detectable', async () => {
    nativeInvoke.mockResolvedValueOnce({ ...savedSettings, ui_language: 'zh-Hans' })

    const settings = await renderLoadedSettings()

    expect(settings.ui_language).toBe('zh-CN')
    expect(mockInvokeFn).not.toHaveBeenCalledWith('get_settings', {})
  })

  it('normalizes a legacy beta release channel back to stable on load', async () => {
    mockSettingsStore = {
      ...savedSettings,
      release_channel: 'beta',
    }

    const settings = await renderLoadedSettings()
    expect(settings.release_channel).toBeNull()
  })

  it('normalizes unsupported language preferences on load', async () => {
    mockSettingsStore = {
      ...savedSettings,
      ui_language: 'xx-ZZ' as Settings['ui_language'],
    }

    const settings = await renderLoadedSettings()
    expect(settings.ui_language).toBeNull()
  })

  it('normalizes unsupported note width modes on load', async () => {
    mockSettingsStore = {
      ...savedSettings,
      note_width_mode: 'expanded' as Settings['note_width_mode'],
    }

    const settings = await renderLoadedSettings()
    expect(settings.note_width_mode).toBeNull()
  })

  it('normalizes unsupported date display formats on load', async () => {
    mockSettingsStore = {
      ...savedSettings,
      date_display_format: 'long' as Settings['date_display_format'],
    }

    const settings = await renderLoadedSettings()
    expect(settings.date_display_format).toBeNull()
  })

  it('saves settings via backend', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    const newSettings = changedSettings()

    await act(async () => {
      await result.current.saveSettings(newSettings)
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('save_settings', { settings: newSettings })
    expect(result.current.settings).toEqual(newSettings)
  })

  it('round-trips an IANA timezone and drops an offset', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    await act(async () => {
      await result.current.saveSettings({ ...defaultSettings, timezone: 'America/Chicago' })
    })
    expect(result.current.settings.timezone).toBe('America/Chicago')

    await act(async () => {
      await result.current.saveSettings({ ...defaultSettings, timezone: 'UTC-6' })
    })
    expect(result.current.settings.timezone).toBeNull()
  })

  it('tracks theme mode changes after settings save succeeds', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    await act(async () => {
      await result.current.saveSettings({
        ...defaultSettings,
        theme_mode: 'system',
      })
    })

    expect(trackEventMock).toHaveBeenCalledWith('theme_mode_changed', { mode: 'system' })
  })

  it('preserves the Gitignored files visibility preference', async () => {
    mockSettingsStore = {
      ...savedSettings,
      hide_gitignored_files: false,
    }

    const settings = await renderLoadedSettings()

    expect(settings.hide_gitignored_files).toBe(false)
  })

  it('preserves All Notes file visibility preferences', async () => {
    mockSettingsStore = {
      ...savedSettings,
      all_notes_show_pdfs: true,
      all_notes_show_images: false,
      all_notes_show_unsupported: true,
    }

    const settings = await renderLoadedSettings()

    expect(settings.all_notes_show_pdfs).toBe(true)
    expect(settings.all_notes_show_images).toBe(false)
    expect(settings.all_notes_show_unsupported).toBe(true)
  })

  it('toggles Gitignored file visibility from the command event', async () => {
    const listener = vi.fn()
    window.addEventListener(GITIGNORED_VISIBILITY_CHANGED_EVENT, listener)
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    await act(async () => {
      window.dispatchEvent(new CustomEvent(TOGGLE_GITIGNORED_VISIBILITY_EVENT))
    })

    await waitFor(() => {
      expect(result.current.settings.hide_gitignored_files).toBe(false)
    })
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(GITIGNORED_VISIBILITY_CHANGED_EVENT, listener)
  })

  it('saves settings through native invoke when Tauri globals are not detectable', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    const newSettings = changedSettings()

    vi.clearAllMocks()
    nativeInvoke.mockResolvedValueOnce(null)

    await act(async () => {
      await result.current.saveSettings(newSettings)
    })

    expect(nativeInvoke).toHaveBeenCalledWith('save_settings', { settings: newSettings })
    expect(mockInvokeFn).not.toHaveBeenCalled()
    expect(result.current.settings).toEqual(newSettings)
  })

  it('handles load error gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockImplementationOnce(() => Promise.reject(new Error('no config')))

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    // Should fall back to empty settings
    expect(result.current.settings).toEqual(defaultSettings)
    warnSpy.mockRestore()
  })

  it('handles save error gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    mockInvokeFn.mockImplementationOnce(() => Promise.reject(new Error('write failed')))

    await act(async () => {
      await result.current.saveSettings(savedSettings)
    })

    // Settings should not have changed on error. Load already migrated
    // a missing chat_engine to native in memory.
    expect(result.current.settings).toEqual({
      ...defaultSettings,
      chat_engine: 'native',
    })
    errorSpy.mockRestore()
  })

  it('applies settings optimistically before save_settings resolves', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    let resolveSave: ((value: null) => void) | undefined
    mockInvokeFn.mockImplementationOnce(
      () => new Promise<null>((resolve) => {
        resolveSave = resolve
      }),
    )

    act(() => {
      void result.current.saveSettings({
        ...defaultSettings,
        theme_mode: 'dark',
      })
    })

    await waitFor(() => {
      expect(result.current.settings.theme_mode).toBe('dark')
    })

    await act(async () => {
      resolveSave?.(null)
    })
  })

  it('does not overwrite stored settings when a save follows a failed load', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSettingsStore = {
      ...savedChatTarget(),
      chat_engine: 'prime',
      telemetry_consent: null,
    }
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_settings') return Promise.reject(new Error('disk'))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.loadError).toBe('load failed')

    await act(async () => {
      await result.current.saveSettings(declineTelemetry(result.current.settings))
    })

    expect(saveSettingsCalls()).toHaveLength(0)
    expect(mockSettingsStore.native_chat_target).toBe('openai/gpt-4.1-mini')
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.chat_engine).toBe('prime')
    expect(mockSettingsStore.telemetry_consent).toBeNull()
    warnSpy.mockRestore()
  })

  it('saves a native chat target change after settings load', async () => {
    mockSettingsStore = savedChatTarget()
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
      expect(result.current.loadError).toBeNull()
    })

    await act(async () => {
      await result.current.saveNativeChatTarget('groq/llama-3.3-70b')
    })

    expect(mockSettingsStore.native_chat_target).toBe('groq/llama-3.3-70b')
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.chat_engine).toBe('native')
    expect(mockSettingsStore.auto_pull_interval_minutes).toBe(15)
  })

  it('merges one target change onto disk when the first load fails and the retry works', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSettingsStore = savedChatTarget()
    let getSettingsFails = true
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings' && getSettingsFails) return Promise.reject(new Error('disk'))
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })
    expect(result.current.loadError).toBe('load failed')

    getSettingsFails = false
    await act(async () => {
      await result.current.saveNativeChatTarget('groq/llama-3.3-70b')
    })

    expect(saveSettingsCalls()).toHaveLength(1)
    expect(mockSettingsStore.native_chat_target).toBe('groq/llama-3.3-70b')
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.chat_engine).toBe('native')
    expect(mockSettingsStore.auto_pull_interval_minutes).toBe(15)
    expect(result.current.loadError).toBeNull()
    warnSpy.mockRestore()
  })

  it('merges a declined telemetry choice onto disk after the load retry works', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSettingsStore = {
      ...savedChatTarget(),
      telemetry_consent: null,
    }
    let getSettingsFails = true
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings' && getSettingsFails) return Promise.reject(new Error('disk'))
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('load failed')
    })

    getSettingsFails = false
    await act(async () => {
      await result.current.saveSettingsPatch({
        telemetry_consent: false,
        crash_reporting_enabled: false,
        analytics_enabled: false,
        anonymous_id: null,
      })
    })

    expect(saveSettingsCalls()).toHaveLength(1)
    expect(mockSettingsStore.telemetry_consent).toBe(false)
    expect(mockSettingsStore.crash_reporting_enabled).toBe(false)
    expect(mockSettingsStore.analytics_enabled).toBe(false)
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.native_chat_target).toBe('openai/gpt-4.1-mini')
    expect(mockSettingsStore.auto_pull_interval_minutes).toBe(15)
    warnSpy.mockRestore()
  })

  it('does not let a stale settings load persist the harness migration', async () => {
    const resolvers: Array<(value: Settings) => void> = []
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings') {
        return new Promise<Settings>((resolve) => {
          resolvers.push(resolve)
        })
      }
      return settingsInvoke(cmd, args)
    })

    const disk: Settings = {
      ...savedSettings,
      chat_engine: 'prime',
      theme_mode: 'dark',
      native_chat_target: 'openai/gpt-4.1-mini',
    }
    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(resolvers).toHaveLength(1)
    })

    let saveDone: Promise<void> = Promise.resolve()
    act(() => {
      saveDone = result.current.saveNativeChatTarget('groq/llama-3.3-70b')
    })
    await waitFor(() => {
      expect(resolvers).toHaveLength(2)
    })

    await act(async () => {
      resolvers[1]({ ...disk })
      await saveDone
    })
    const writesAfterFreshLoad = saveSettingsCalls().length
    expect(writesAfterFreshLoad).toBeGreaterThan(0)
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.native_chat_target).toBe('groq/llama-3.3-70b')

    await act(async () => {
      resolvers[0]({ ...disk, theme_mode: 'light' })
      await Promise.resolve()
    })

    expect(saveSettingsCalls()).toHaveLength(writesAfterFreshLoad)
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.native_chat_target).toBe('groq/llama-3.3-70b')
  })

  it('drops a full settings-panel save after a failed load recovers, and leaves every other field', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const conversations = [
      { archived: false, id: 'keep-me', title: 'Kept chat', target_id: 'codex' },
    ]
    const disk: Settings = {
      ...savedChatTarget(),
      accent_color: 'blue',
      analytics_enabled: true,
      auto_pull_interval_minutes: 15,
      git_enabled: false,
      telemetry_consent: true,
      theme_mode: 'dark',
      ai_workspace_conversations: conversations,
    }
    mockSettingsStore = disk
    let getSettingsFails = true
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings' && getSettingsFails) return Promise.reject(new Error('disk'))
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('load failed')
    })

    getSettingsFails = false
    const panelSave: Settings = {
      ...result.current.settings,
      accent_color: 'green',
      analytics_enabled: false,
      auto_pull_interval_minutes: 5,
      git_enabled: true,
      telemetry_consent: false,
      theme_mode: 'light',
      ai_workspace_conversations: [
        { archived: false, id: 'new', title: 'AI Chat', target_id: 'agent:prime' },
      ],
    }
    await act(async () => {
      await result.current.saveSettings(panelSave)
    })

    expect(saveSettingsCalls()).toHaveLength(0)
    expect(mockSettingsStore.accent_color).toBe('blue')
    expect(mockSettingsStore.analytics_enabled).toBe(true)
    expect(mockSettingsStore.auto_pull_interval_minutes).toBe(15)
    expect(mockSettingsStore.git_enabled).toBe(false)
    expect(mockSettingsStore.telemetry_consent).toBe(true)
    expect(mockSettingsStore.theme_mode).toBe('dark')
    expect(mockSettingsStore.ai_workspace_conversations).toEqual(conversations)
    expect(result.current.settings.accent_color).toBe('blue')
    expect(result.current.settings.theme_mode).toBe('dark')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[settings] Did not save settings'))
    warnSpy.mockRestore()
  })

  it('keeps the stored conversation list when Use Rhizome saves after a recovered load', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const conversations = [
      { archived: false, id: 'codex-chat', title: 'Codex', target_id: 'codex' },
      { archived: false, id: 'other', title: 'Other', target_id: 'claude_code' },
    ]
    mockSettingsStore = {
      ...savedChatTarget(),
      default_ai_target: 'codex',
      ai_workspace_conversations: conversations,
    }
    let getSettingsFails = true
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings' && getSettingsFails) return Promise.reject(new Error('disk'))
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('load failed')
    })

    getSettingsFails = false
    const fromEmptyMemory = settingsAfterUseRhizome(result.current.settings, 'agent:prime', 'codex-chat')
    await act(async () => {
      await result.current.saveSettings(fromEmptyMemory)
    })

    expect(saveSettingsCalls()).toHaveLength(0)
    expect(mockSettingsStore.ai_workspace_conversations).toEqual(conversations)
    expect(mockSettingsStore.default_ai_target).toBe('codex')
    expect(result.current.settings.ai_workspace_conversations).toEqual(conversations)
    warnSpy.mockRestore()
  })

  it('reloads a fixed settings file when the window regains focus', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSettingsStore = savedChatTarget()
    let getSettingsFails = true
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings' && getSettingsFails) return Promise.reject(new Error('disk'))
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('load failed')
    })

    getSettingsFails = false
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => {
      expect(result.current.loadError).toBeNull()
    })

    expect(result.current.settings.theme_mode).toBe('dark')
    expect(result.current.settings.native_chat_target).toBe('openai/gpt-4.1-mini')
    expect(saveSettingsCalls()).toHaveLength(0)
    warnSpy.mockRestore()
  })

  it('logs a parse location without the raw settings text', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockImplementation((cmd: string) => {
      if (cmd === 'get_settings') {
        return Promise.reject(new Error('Failed to parse settings at line 4 column 8: secret "sk-live-token"'))
      }
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('parse error at line 4 column 8')
    })

    expect(warnSpy).toHaveBeenCalledWith('Failed to load settings:', 'parse error at line 4 column 8')
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('sk-live-token')
    warnSpy.mockRestore()
  })

  it('reloads once when focus and visibility change together', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockSettingsStore = savedChatTarget()
    let reads = 0
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_settings') {
        reads += 1
        if (reads === 1) return Promise.reject(new Error('parse error at line 2 column 1'))
        return settingsInvoke(cmd, args)
      }
      return settingsInvoke(cmd, args)
    })

    const { result } = renderHook(() => useSettings())
    await waitFor(() => {
      expect(result.current.loadError).toBe('parse error at line 2 column 1')
    })
    const readsAfterFailure = reads

    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => {
      expect(result.current.loadError).toBeNull()
    })

    expect(reads - readsAfterFailure).toBe(1)
    expect(result.current.settings.theme_mode).toBe('dark')
    warnSpy.mockRestore()
  })
})
