import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ArrowSquareOut, Check, CircleNotch, Copy, Desktop, Key, OpenAiLogo } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AiAgentIcon } from './AiAgentIcon'
import { OnboardingShell } from './OnboardingShell'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import type { AiModelProvider } from '../lib/aiTargets'
import { CHATGPT_ACCOUNT_PROVIDER_ID } from '../lib/accountSignInProviders'
import { callHost } from '../lib/callHost'
import {
  CLAUDE_CODE_LOGIN_COMMAND,
  claudeCodeStatusLine,
  isClaudeCodeEngineReady,
  startClaudeCodeLogin,
  useClaudeCodeEngineState,
  type ClaudeCodeEngineState,
} from '../lib/claudeCodeEngine'
import { CLAUDE_CODE_SESSION_TARGET } from '../lib/nativeSessionTarget'
import {
  FIRST_RUN_LOCAL_KINDS,
  FIRST_RUN_OTHER_PATHS,
  FIRST_RUN_SIGN_IN_PATHS,
  firstDetectedLocal,
  firstRunKeyPresets,
  keyProviderFor,
  localProviderFor,
  nativeTargetFor,
  providersWith,
  recommendedModelPath,
  type DetectedLocalModels,
  type FirstRunModelPath,
} from '../lib/firstRunModelStep'
import { forgetListedProviderModels, listAiModelProviderModels, type ChatgptAccountModel } from '../lib/listProviderModels'
import { connectionErrorMessage } from '../lib/providerConnection'
import { oauthAccountReady } from '../lib/providerOauth'
import { providerForDiscover } from '../lib/rhizomeChatModels'
import { trackEvent } from '../lib/telemetry'
import { useOauthAccounts } from '../lib/useOauthAccounts'
import { saveAiModelProviderApiKey, testAiModelProvider } from '../utils/aiProviderSecrets'
import { openExternalUrl } from '../utils/url'
import type { Settings } from '../types'

export type FirstRunModelPatch = Pick<Settings, 'ai_model_providers' | 'native_chat_target' | 'claude_code_engine_enabled'>

interface FirstRunModelStepProps {
  /** Providers already saved. Normally none on a fresh profile. */
  providers: AiModelProvider[] | null | undefined
  /** Called once a model works. The caller saves the patch and ends the step. */
  onConnected: (patch: Partial<FirstRunModelPatch>) => Promise<void> | void
  /** "Set up later". Ends the step with nothing saved. */
  onSkip: () => void
}

type LocalProbe =
  | { status: 'checking' }
  | { status: 'done'; found: DetectedLocalModels | null }

const PATH_LABELS: Record<FirstRunModelPath, { title: string; description: string }> = {
  local: {
    title: 'A model on this computer',
    description: 'Ollama or LM Studio. No account, nothing leaves this computer.',
  },
  chatgpt: {
    title: 'ChatGPT',
    description: 'Use your ChatGPT plan. Sign-in opens in your browser.',
  },
  claude_code: {
    title: 'Claude',
    description: 'Use your Claude plan. Claude Code opens sign-in in your browser.',
  },
  api_key: {
    title: 'An API key',
    description: 'OpenAI, Google Gemini, OpenRouter, xAI or Groq.',
  },
}

const PATH_ICONS: Record<FirstRunModelPath, React.ReactNode> = {
  local: <Desktop size={18} aria-hidden="true" />,
  chatgpt: <OpenAiLogo size={18} aria-hidden="true" />,
  claude_code: <AiAgentIcon agent="claude_code" size={18} />,
  api_key: <Key size={18} aria-hidden="true" />,
}

async function probeLocalModels(): Promise<DetectedLocalModels | null> {
  const results = await Promise.all(FIRST_RUN_LOCAL_KINDS.map(async (kind) => {
    const provider = providerForDiscover(kind)
    // A server started after an earlier probe should be found on "Look again".
    forgetListedProviderModels(provider)
    const models = await listAiModelProviderModels(provider).catch(() => [] as string[])
    return { kind, name: provider.name, models }
  }))
  return firstDetectedLocal(results)
}

async function firstChatgptModelTarget(): Promise<string | null> {
  try {
    const models = await callHost<ChatgptAccountModel[]>('list_chatgpt_account_models')
    const first = Array.isArray(models) ? models[0] : undefined
    return first ? `${CHATGPT_ACCOUNT_PROVIDER_ID}/${first.slug}` : null
  } catch {
    return null
  }
}

function useLocalProbe() {
  const [probe, setProbe] = useState<LocalProbe>({ status: 'checking' })
  const [round, setRound] = useState(0)

  useEffect(() => {
    let cancelled = false
    void probeLocalModels().then((found) => {
      if (!cancelled) setProbe({ status: 'done', found })
    })
    return () => {
      cancelled = true
    }
  }, [round])

  const again = useCallback(() => {
    setProbe({ status: 'checking' })
    setRound((value) => value + 1)
  }, [])
  return { probe, again }
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function ErrorLine({ message, testId }: { message: string; testId: string }) {
  return (
    <p role="alert" className="text-sm text-destructive" data-testid={testId}>
      {message}
    </p>
  )
}

function PathOption({
  path,
  selected,
  recommended,
  tile = false,
  onSelect,
}: {
  path: FirstRunModelPath
  selected: boolean
  recommended: boolean
  /** Sign-in paths show as large tiles. Other ways show as compact rows. */
  tile?: boolean
  onSelect: () => void
}) {
  const label = PATH_LABELS[path]
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={`first-run-model-path-${path}`}
      onClick={onSelect}
      className={cn(
        'flex w-full gap-3 rounded-md border bg-background text-left outline-none transition-colors',
        'hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        tile ? 'flex-col items-start p-4' : 'items-start px-3 py-2.5',
        selected ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <span
        className={cn(
          'text-muted-foreground',
          tile ? 'flex size-9 items-center justify-center rounded-md border border-border bg-muted text-foreground' : 'mt-0.5',
        )}
      >
        {PATH_ICONS[path]}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-2 font-medium text-foreground', tile ? 'text-base' : 'text-sm')}>
          {label.title}
          {recommended ? (
            <span className="rounded-sm border border-border px-1.5 text-xs font-normal text-muted-foreground">
              Recommended
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{label.description}</span>
      </span>
    </button>
  )
}

function LocalPanel({
  probe,
  onLookAgain,
  onUse,
  busy,
}: {
  probe: LocalProbe
  onLookAgain: () => void
  onUse: (found: DetectedLocalModels, modelId: string) => void
  busy: boolean
}) {
  const selectId = useId()
  const found = probe.status === 'done' ? probe.found : null
  const [modelId, setModelId] = useState<string>('')
  const chosen = found && found.models.includes(modelId) ? modelId : found?.models[0] ?? ''

  if (probe.status === 'checking') {
    return (
      <StatusLine>
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
        Looking for Ollama and LM Studio on this computer…
      </StatusLine>
    )
  }

  if (!found) {
    return (
      <div className="flex flex-col gap-3" data-testid="first-run-model-local-none">
        <p className="text-sm text-muted-foreground">
          No model server answered. Start Ollama or LM Studio with at least one model, then look again.
        </p>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onLookAgain} data-testid="first-run-model-local-retry">
            Look again
          </Button>
        </div>
      </div>
    )
  }

  const count = found.models.length
  return (
    <div className="flex flex-col gap-3" data-testid="first-run-model-local-found">
      <p className="text-sm text-foreground">
        {found.name} is running with {count} {count === 1 ? 'model' : 'models'}.
      </p>
      {count > 1 ? (
        <label htmlFor={selectId} className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
          <span>Model</span>
          <Select value={chosen} onValueChange={setModelId}>
            <SelectTrigger id={selectId} className="h-9 w-full" data-testid="first-run-model-local-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {found.models.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
      <div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => onUse(found, chosen)}
          data-testid="first-run-model-local-use"
        >
          Use {chosen}
        </Button>
      </div>
    </div>
  )
}

function ChatgptPanel({ onReady }: { onReady: () => void }) {
  const oauth = useOauthAccounts()
  const status = oauth.oauthByProvider[CHATGPT_ACCOUNT_PROVIDER_ID]
  const ready = oauthAccountReady(status)
  const error = oauth.errorByProvider[CHATGPT_ACCOUNT_PROVIDER_ID]

  if (ready) {
    return (
      <div className="flex flex-col gap-3" data-testid="first-run-model-chatgpt-ready">
        <p className="text-sm text-foreground">
          Signed in to ChatGPT{status?.email ? ` as ${status.email}` : ''}.
        </p>
        <div>
          <Button type="button" onClick={onReady} data-testid="first-run-model-chatgpt-continue">
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={oauth.signingIn}
          onClick={() => {
            void oauth.signIn(CHATGPT_ACCOUNT_PROVIDER_ID).then((next) => {
              if (oauthAccountReady(next)) onReady()
            })
          }}
          data-testid="first-run-model-chatgpt-sign-in"
        >
          {oauth.signingIn ? 'Waiting for the browser…' : 'Sign in with ChatGPT'}
        </Button>
        {oauth.signingIn ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { void oauth.cancel() }}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? <ErrorLine message={error} testId="first-run-model-chatgpt-error" /> : null}
    </div>
  )
}

function LoginCommand() {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <code className="flex-1 font-mono text-sm text-foreground">{CLAUDE_CODE_LOGIN_COMMAND}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(CLAUDE_CODE_LOGIN_COMMAND).then(() => setCopied(true)).catch(() => {})
        }}
        data-testid="first-run-model-claude-code-copy"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

function ClaudeCodeSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3" data-testid="first-run-model-claude-code-signed-out">
      <div>
        <Button
          type="button"
          disabled={signingIn}
          onClick={() => {
            setSigningIn(true)
            setError(null)
            void startClaudeCodeLogin()
              .then(onSignedIn)
              .catch((err: unknown) => {
                setError(err instanceof Error && err.message ? err.message : String(err))
              })
              .finally(() => setSigningIn(false))
          }}
          data-testid="first-run-model-claude-code-sign-in"
        >
          {signingIn ? 'Waiting for the browser…' : 'Sign in with Claude'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Claude Code runs the sign-in and keeps your Claude sign-in. Rhizome never sees it.
      </p>
      {error ? <ErrorLine message={error} testId="first-run-model-claude-code-error" /> : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Sign in from a terminal</summary>
        <div className="mt-2 flex flex-col gap-2">
          <LoginCommand />
          <div>
            <Button type="button" variant="outline" size="sm" onClick={onSignedIn} data-testid="first-run-model-claude-code-check">
              Check again
            </Button>
          </div>
        </div>
      </details>
    </div>
  )
}

/**
 * ADR-0191: Rhizome drives the user's own Claude Code. "Sign in with Claude"
 * runs `claude auth login`, so Claude Code does the OAuth. Rhizome never
 * holds a Claude token.
 */
function ClaudeCodePanel({
  state,
  onCheckAgain,
  onUse,
  busy,
}: {
  state: ClaudeCodeEngineState
  onCheckAgain: () => void
  onUse: () => void
  busy: boolean
}) {
  if (state.kind === 'checking') {
    return (
      <StatusLine>
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
        {claudeCodeStatusLine(state)}
      </StatusLine>
    )
  }

  const checkAgain = (
    <Button type="button" variant="outline" size="sm" onClick={onCheckAgain} data-testid="first-run-model-claude-code-check">
      Check again
    </Button>
  )

  if (state.kind === 'ready') {
    return (
      <div className="flex flex-col gap-3" data-testid="first-run-model-claude-code-ready">
        <p className="text-sm text-foreground">{claudeCodeStatusLine(state)}</p>
        <p className="text-xs text-muted-foreground">
          Chats use your own Claude plan and count toward its limits. Anthropic does not make or endorse Rhizome.
        </p>
        <div>
          <Button type="button" disabled={busy} onClick={onUse} data-testid="first-run-model-claude-code-use">
            Use Claude
          </Button>
        </div>
      </div>
    )
  }

  if (state.kind === 'signed_out') {
    return (
      <ClaudeCodeSignIn onSignedIn={onCheckAgain} />
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="first-run-model-claude-code-missing">
      <p className="text-sm text-foreground">Rhizome could not find Claude Code on this computer.</p>
      <p className="text-xs text-muted-foreground">Install Claude Code, then sign in to it in your terminal:</p>
      <LoginCommand />
      <div>{checkAgain}</div>
    </div>
  )
}

function ApiKeyPanel({
  onConnected,
}: {
  onConnected: (provider: AiModelProvider) => Promise<void>
}) {
  const presets = useMemo(() => firstRunKeyPresets(), [])
  const providerSelectId = useId()
  const keyInputId = useId()
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')
  const [secret, setSecret] = useState('')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preset = presets.find((entry) => entry.id === presetId) ?? presets[0]

  if (!preset) return null

  const saveAndTest = async () => {
    const key = secret.trim()
    if (!key) return
    const provider = keyProviderFor(preset)
    setTesting(true)
    setError(null)
    try {
      await testAiModelProvider(provider, preset.modelId, key)
      await saveAiModelProviderApiKey(provider.id, key)
      trackEvent('provider_connection_tested', { provider_kind: provider.kind, outcome: 'success', surface: 'first_run' })
      setSecret('')
      await onConnected(provider)
    } catch (err) {
      trackEvent('provider_connection_tested', { provider_kind: provider.kind, outcome: 'failed', surface: 'first_run' })
      setError(connectionErrorMessage(err, key))
    } finally {
      setTesting(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void saveAndTest()
      }}
    >
      <label htmlFor={providerSelectId} className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
        <span>Provider</span>
        <Select
          value={preset.id}
          onValueChange={(next) => {
            setPresetId(next)
            setError(null)
          }}
        >
          <SelectTrigger id={providerSelectId} className="h-9 w-full" data-testid="first-run-model-key-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {presets.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label htmlFor={keyInputId} className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
        <span>API key</span>
        <Input
          id={keyInputId}
          type="password"
          autoComplete="off"
          value={secret}
          placeholder={`Paste your ${preset.label} key`}
          onChange={(event) => setSecret(event.target.value)}
          data-testid="first-run-model-key-input"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        The key is kept in this computer's keychain. Rhizome tests it with {preset.modelId} before saving.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={testing || secret.trim() === ''}
          data-testid="first-run-model-key-save"
        >
          {testing ? 'Testing…' : 'Save and test'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            trackEvent('provider_preset_get_api_key', { preset: preset.id, surface: 'first_run' })
            void openExternalUrl(preset.keyPageUrl).catch(() => {
              setError('Could not open the key page.')
            })
          }}
        >
          Get a key
          <ArrowSquareOut size={14} aria-hidden="true" />
        </Button>
      </div>
      {error ? <ErrorLine message={error} testId="first-run-model-key-error" /> : null}
    </form>
  )
}

export function FirstRunModelStep({ providers, onConnected, onSkip }: FirstRunModelStepProps) {
  const { probe, again } = useLocalProbe()
  const claudeCode = useClaudeCodeEngineState(true)
  const [chosenPath, setChosenPath] = useState<FirstRunModelPath | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const claudeCodeChecked = claudeCode.state.kind !== 'checking'
  const recommended = recommendedModelPath({ claudeCodeReady: isClaudeCodeEngineReady(claudeCode.state) })
  // Wait for the Claude Code check before preselecting, so the selection does
  // not jump from ChatGPT to Claude Code a moment after the screen opens.
  const selected: FirstRunModelPath | null = chosenPath ?? (claudeCodeChecked ? recommended : null)

  const finish = useCallback(async (patch: Partial<FirstRunModelPatch>, path: FirstRunModelPath) => {
    setSaving(true)
    setSaveError(null)
    try {
      await onConnected(patch)
      trackEvent('first_run_model_step', { outcome: 'connected', path })
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Could not save the model choice.')
    } finally {
      setSaving(false)
    }
  }, [onConnected])

  const connectProvider = useCallback(async (provider: AiModelProvider, path: FirstRunModelPath) => {
    await finish({
      ai_model_providers: providersWith(providers, provider),
      native_chat_target: nativeTargetFor(provider),
    }, path)
  }, [finish, providers])

  return (
    <OnboardingShell
      className="bg-sidebar"
      contentClassName="flex w-full max-w-lg flex-col gap-6 rounded-xl border border-border bg-background p-8"
      testId="first-run-model-step"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Connect a model</h1>
        <p className="text-sm text-muted-foreground">
          Rhizome's agent runs on a model you choose. You can change it later in Settings.
        </p>
      </header>

      <div role="group" aria-label="Sign in" className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign in</h2>
        <div className="grid grid-cols-2 gap-2">
          {FIRST_RUN_SIGN_IN_PATHS.map((path) => (
            <PathOption
              key={path}
              path={path}
              tile
              selected={selected === path}
              recommended={claudeCodeChecked && path === recommended}
              onSelect={() => setChosenPath(path)}
            />
          ))}
        </div>
      </div>

      <div role="group" aria-label="Other ways" className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other ways</h2>
        {FIRST_RUN_OTHER_PATHS.map((path) => (
          <PathOption
            key={path}
            path={path}
            selected={selected === path}
            recommended={false}
            onSelect={() => setChosenPath(path)}
          />
        ))}
      </div>

      <section aria-label="Connect" className="flex flex-col gap-3" data-testid="first-run-model-panel">
        {selected === null ? (
          <StatusLine>
            <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
            Checking how this computer can connect…
          </StatusLine>
        ) : null}
        {selected === 'claude_code' ? (
          <ClaudeCodePanel
            state={claudeCode.state}
            busy={saving}
            onCheckAgain={claudeCode.refresh}
            onUse={() => {
              void finish({ claude_code_engine_enabled: true, native_chat_target: CLAUDE_CODE_SESSION_TARGET }, 'claude_code')
            }}
          />
        ) : null}
        {selected === 'local' ? (
          <LocalPanel
            probe={probe}
            busy={saving}
            onLookAgain={again}
            onUse={(found, modelId) => {
              void connectProvider(localProviderFor(found.kind, modelId), 'local')
            }}
          />
        ) : null}
        {selected === 'chatgpt' ? (
          <ChatgptPanel
            onReady={() => {
              void firstChatgptModelTarget().then((target) => (
                finish(target ? { native_chat_target: target } : {}, 'chatgpt')
              ))
            }}
          />
        ) : null}
        {selected === 'api_key' ? (
          <ApiKeyPanel onConnected={(provider) => connectProvider(provider, 'api_key')} />
        ) : null}
        {saveError ? <ErrorLine message={saveError} testId="first-run-model-save-error" /> : null}
      </section>

      <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">You can chat once a model is connected.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            trackEvent('first_run_model_step', { outcome: 'skipped' })
            onSkip()
          }}
          data-testid="first-run-model-skip"
        >
          Set up later
        </Button>
      </footer>
    </OnboardingShell>
  )
}
