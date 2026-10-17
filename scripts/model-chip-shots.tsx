/* eslint-disable react-refresh/only-export-components -- Vite review-shot harness, not app routes */
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { NativeChatModelPicker } from '../src/components/NativeChatModelPicker'
import { TooltipProvider } from '../src/components/ui/tooltip'
import { applyAppearanceToDocument } from '../src/lib/themeMode'
import type { AiModelProvider } from '../src/lib/aiTargets'
import '../src/index.css'
import '../src/themes.css'
import '../src/App.css'

type ShotTheme = 'graphite' | 'earth-light'
type ShotState = 'cases' | 'short' | 'long' | 'gemini'

const capabilities = {
  streaming: true,
  tools: false,
  vision: false,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

const providers: AiModelProvider[] = [
  {
    id: 'work-openai',
    name: 'Work OpenAI',
    kind: 'open_ai',
    api_key_storage: 'local_file',
    models: [{ id: 'gpt-4o', display_name: 'GPT-4o', capabilities }],
  },
  {
    id: 'northwind',
    name: 'Northwind Research Workspace',
    kind: 'open_ai',
    api_key_storage: 'local_file',
    models: [{
      id: 'claude-opus-4-5',
      display_name: 'Claude Opus 4.5 with extended thinking',
      capabilities,
    }],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    kind: 'gemini',
    api_key_storage: 'local_file',
    models: [{ id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash', capabilities }],
  },
]

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') === 'earth-light' ? 'earth-light' : 'graphite') as ShotTheme
const state = (['cases', 'short', 'long', 'gemini'].includes(params.get('state') ?? '')
  ? params.get('state')
  : 'cases') as ShotState

applyAppearanceToDocument(document, theme === 'graphite'
  ? { colorTheme: 'graphite', mode: 'dark', accentColor: 'mint' }
  : { colorTheme: 'rhizome', mode: 'light', accentColor: 'mint' })

document.body.style.margin = '0'
document.body.style.background = 'var(--surface-app)'
document.body.style.color = 'var(--text-primary)'
document.body.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function CaseLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] text-muted-foreground" style={{ marginBottom: 6 }}>
      {children}
    </div>
  )
}

function ShotFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="model-chip-shot"
      style={{ padding: 24, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      {children}
    </div>
  )
}

function ModelChip({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  return (
    <div style={{ marginBottom: state === 'cases' ? 20 : 0 }}>
      {label ? <CaseLabel>{label}</CaseLabel> : null}
      <NativeChatModelPicker
        variant="chip"
        value={value}
        onChange={() => {}}
        providers={providers}
        showLabel={false}
      />
    </div>
  )
}

function App() {
  if (state === 'cases') {
    return (
      <ShotFrame>
        <ModelChip value="work-openai/gpt-4o" label="Short name" />
        <ModelChip value="northwind/claude-opus-4-5" label="Long provider" />
        <ModelChip value="gemini/gemini-2.5-flash" label="Gemini" />
      </ShotFrame>
    )
  }

  const value = state === 'short'
    ? 'work-openai/gpt-4o'
    : state === 'long'
      ? 'northwind/claude-opus-4-5'
      : 'gemini/gemini-2.5-flash'

  return (
    <ShotFrame>
      <ModelChip value={value} />
    </ShotFrame>
  )
}

createRoot(document.getElementById('root')!).render(
  <TooltipProvider delayDuration={300}>
    <App />
  </TooltipProvider>,
)
