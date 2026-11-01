/* eslint-disable react-refresh/only-export-components -- Vite review-shot harness */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/mock-tauri'
import { ConnectedProvidersSummary } from '../src/components/ConnectedProvidersSummary'
import { NativeChatModelPicker } from '../src/components/NativeChatModelPicker'
import { TooltipProvider } from '../src/components/ui/tooltip'
import { createMissingAiAgentsStatus } from '../src/lib/aiAgents'
import type { AiModelProvider } from '../src/lib/aiTargets'
import { createTranslator } from '../src/lib/i18n'
import { applyAppearanceToDocument } from '../src/lib/themeMode'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'
import './chatgpt-signin-shots.css'

type ShotTheme = 'graphite' | 'earth'
type ShotState = 'connected' | 'picker' | 'signed-in'

const capabilities = {
  streaming: true,
  tools: false,
  vision: false,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

const providers: AiModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'open_ai',
    api_key_storage: 'none',
    models: [{ id: 'gpt-4.1-mini', display_name: 'gpt-4.1-mini', capabilities }],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'ollama',
    api_key_storage: 'none',
    models: [{ id: 'llama3.2', display_name: 'llama3.2', capabilities }],
  },
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth' ? 'earth' : 'graphite') as ShotTheme
const state = (['connected', 'picker', 'signed-in'].includes(params.get('state') ?? '')
  ? params.get('state')!
  : 'connected') as ShotState

applyAppearanceToDocument(document, theme === 'graphite'
  ? { colorTheme: 'graphite', mode: 'dark', accentColor: 'mint' }
  : { colorTheme: 'rhizome', mode: 'light', accentColor: 'mint' })

document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const signedIn = state === 'signed-in'
const oauthStatus = {
  provider: 'openai',
  enabled: true,
  signed_in: signedIn,
  usable: signedIn,
  email: signedIn ? 'plus@example.com' : null,
  revoked: true,
}

if (typeof window !== 'undefined') {
  if (!window.__mockHandlers) window.__mockHandlers = {}
  window.__mockHandlers.oauth_status = () => oauthStatus
  window.__mockHandlers.oauth_sign_in = () => ({ ...oauthStatus, signed_in: true, usable: true, email: 'plus@example.com' })
  window.__mockHandlers.oauth_sign_out = () => ({ ...oauthStatus, signed_in: false, usable: false, email: null })
  window.__mockHandlers.oauth_cancel = () => null
  window.__mockHandlers.list_ai_model_provider_models = (args: { provider?: { kind?: string; id?: string } }) => {
    if (args?.provider?.kind === 'ollama') return ['llama3.2']
    if (args?.provider?.kind === 'open_ai') return ['gpt-4.1-mini']
    return []
  }
}

const agents = createMissingAiAgentsStatus()

const t = createTranslator('en')

function Shot() {
  useEffect(() => {
    if (state !== 'picker' && state !== 'signed-in') return
    const timer = window.setTimeout(() => {
      const trigger = document.querySelector('[data-testid="native-chat-model-trigger"]') as HTMLButtonElement | null
      trigger?.click()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <div
        data-testid="chatgpt-signin-shot"
        data-theme={theme}
        data-state={state}
        style={{ padding: 24, minHeight: '100vh', background: 'var(--surface-app)' }}
      >
        {state === 'connected' ? (
          <div
            className="overflow-hidden rounded-md border border-border bg-background"
            style={{ width: 420, padding: 16 }}
          >
            <div className="mb-3 text-[13px] font-medium text-foreground">Connected</div>
            <ConnectedProvidersSummary
              t={t}
              agents={agents}
              providers={providers}
              onChange={() => {}}
              onOpen={() => {}}
            />
          </div>
        ) : (
          <div style={{ width: 360 }}>
            <NativeChatModelPicker
              variant="chip"
              value={signedIn ? 'openai/gpt-4.1-mini' : 'ollama/llama3.2'}
              onChange={() => {}}
              providers={providers}
              onOpenProviders={() => {}}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<Shot />)
