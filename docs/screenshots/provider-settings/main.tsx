import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import { TooltipProvider } from '../../../src/components/ui/tooltip'
import { SettingsPanel } from '../../../src/components/SettingsPanel'
import { NativeChatModelPicker } from '../../../src/components/NativeChatModelPicker'
import { noteAiAgentsChecked } from '../../../src/lib/aiAgentsCheckedAt'
import {
  createAiAgentAvailability,
  createMissingAiAgentsStatus,
} from '../../../src/lib/aiAgents'
import { SETTINGS_SECTION_IDS } from '../../../src/components/settingsSectionIds'
import type { Settings } from '../../../src/types'
import type { AiModelProvider } from '../../../src/lib/aiTargets'

const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') === 'earth' ? 'earth' : 'graphite'
const view = params.get('view') ?? 'settings'

if (view === 'checking') {
  ;(window as Window & { __RHIZOME_HOLD_MODEL_LIST__?: boolean }).__RHIZOME_HOLD_MODEL_LIST__ = true
}

if (theme === 'earth') {
  document.documentElement.setAttribute('data-theme', 'light')
  document.documentElement.removeAttribute('data-color-theme')
} else {
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.removeAttribute('data-color-theme')
}
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'

const capabilities = {
  streaming: false,
  tools: false,
  vision: true,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

const scrub: AiModelProvider = {
  id: 'scrub-test',
  name: 'Scrub test',
  kind: 'open_ai_compatible',
  base_url: 'https://scrub.example/v1',
  api_key_storage: 'local_file',
  models: [{ id: 'm', display_name: 'm', capabilities }],
}

const settings = {
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
  theme_mode: theme === 'earth' ? 'light' : 'dark',
  ui_language: null,
  date_display_format: null,
  default_ai_agent: null,
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  ai_model_providers: view === 'timeout' ? [scrub] : null,
  native_chat_target: 'free_tier_auto',
} as Settings

if (view === 'settings' || view === 'settings-top' || view === 'checking') {
  noteAiAgentsChecked(Date.now())
}

const agents = {
  ...createMissingAiAgentsStatus(),
  claude_code: createAiAgentAvailability('installed', '2.1.289 (Claude Code)'),
  codex: createAiAgentAvailability('installed', 'codex-cli 0.157.1'),
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-app)', padding: 24 }}>
      {children}
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('missing root')

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      {view === 'picker' || view === 'timeout' ? (
        <Frame>
          <NativeChatModelPicker
            variant="chip"
            value="free_tier_auto"
            providers={view === 'timeout' ? [scrub] : []}
            onChange={() => {}}
            onOpenProviders={() => {}}
          />
        </Frame>
      ) : (
        <SettingsPanel
          open
          settings={settings}
          aiAgentsStatus={agents}
          initialSectionId={SETTINGS_SECTION_IDS.ai}
          onSave={() => {}}
          onClose={() => {}}
          onCopyMcpConfig={() => {}}
        />
      )}
    </TooltipProvider>
  </StrictMode>,
)

if (view === 'picker' || view === 'timeout') {
  window.setTimeout(() => {
    window.dispatchEvent(new Event('rhizome-open-model-picker'))
  }, 300)
}
