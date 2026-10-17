import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Settings } from '../types'
import { SettingsPanel } from './SettingsPanel'
import { useSettings } from '../hooks/useSettings'

vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const conversations = [{ archived: false, id: 'keep', title: 'Kept', target_id: 'codex' }]
const DISK = {
  auto_pull_interval_minutes: 15,
  git_enabled: false,
  theme_mode: 'dark',
  accent_color: 'blue',
  analytics_enabled: true,
  telemetry_consent: true,
  crash_reporting_enabled: true,
  anonymous_id: 'anon-1',
  ai_workspace_conversations: conversations,
  note_width_mode: 'wide',
  chat_engine: 'native',
  native_chat_target: 'openai/gpt-4.1-mini',
} as unknown as Settings

const state = vi.hoisted(() => ({
  failing: true,
  store: {} as Settings,
  saves: [] as Settings[],
  invokeFn: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (command: string, args?: Record<string, unknown>) => state.invokeFn(command, args),
}))

function Harness() {
  const { settings, loadError, saveSettingsPatch } = useSettings()
  return (
    <SettingsPanel
      open={true}
      settings={settings}
      loadError={loadError}
      onSave={() => { throw new Error('full settings save') }}
      onSavePatch={(patch) => { void saveSettingsPatch(patch) }}
      onClose={() => {}}
    />
  )
}

function expectDiskIntact() {
  expect(state.store.auto_pull_interval_minutes).toBe(15)
  expect(state.store.git_enabled).toBe(false)
  expect(state.store.theme_mode).toBe('dark')
  expect(state.store.analytics_enabled).toBe(true)
  expect(state.store.telemetry_consent).toBe(true)
  expect(state.store.ai_workspace_conversations).toEqual(conversations)
}

beforeEach(() => {
  state.store = { ...DISK, ai_workspace_conversations: conversations.map((item) => ({ ...item })) }
  state.failing = true
  state.saves.length = 0
  state.invokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'get_settings') {
      return state.failing ? Promise.reject(new Error('parse')) : Promise.resolve({ ...state.store })
    }
    if (cmd === 'save_settings') {
      state.store = { ...(args as { settings: Settings }).settings }
      state.saves.push(state.store)
      return Promise.resolve(null)
    }
    return Promise.resolve(null)
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
  HTMLElement.prototype.hasPointerCapture ??= () => false
  HTMLElement.prototype.setPointerCapture ??= () => {}
  HTMLElement.prototype.releasePointerCapture ??= () => {}
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('SettingsPanel after a failed settings load', () => {
  it('does not write form defaults after an accent click and a footer save', async () => {
    render(<Harness />)
    await waitFor(() => expect(state.invokeFn).toHaveBeenCalledWith('get_settings', {}))
    await act(async () => { await Promise.resolve() })
    state.failing = false
    await act(async () => { fireEvent.click(screen.getByTestId('settings-accent-green')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    await act(async () => { fireEvent.click(screen.getByTestId('settings-save')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expectDiskIntact()
  })

  it('does not write form defaults when a draft edit is followed by a focus retry and Save', async () => {
    render(<Harness />)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    await act(async () => { fireEvent.click(screen.getByTestId('settings-accent-green')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    state.failing = false
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    await act(async () => { fireEvent.click(screen.getByTestId('settings-save')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expectDiskIntact()
  })

  it('leaves disk unchanged when an untouched panel saves after a focus retry', async () => {
    render(<Harness />)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    state.failing = false
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    await act(async () => { fireEvent.click(screen.getByTestId('settings-save')) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expectDiskIntact()
  })
})
