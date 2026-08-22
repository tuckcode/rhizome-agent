import { useState, useCallback, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { RhizomeFormatModal, type ResearchMode } from './RhizomeFormatModal'
import { useRhizomeJobs } from '../hooks/useRhizomeJobs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import type { VaultOption } from './status-bar/types'
import { AI_AGENT_DEFINITIONS, createAiAgentAvailability, type AiAgentsStatus } from '../lib/aiAgents'
import { configuredModelTargets, normalizeAiModelProviders, preflightAiTarget, resolveAiTarget, type AiModelTarget } from '../lib/aiTargets'
import { openExternalUrl } from '../utils/url'
import type { Settings } from '../types'
import {
  RocketLaunch, PuzzlePiece, Brain,
  MagnifyingGlass, Code, FileText,
  BookOpenText, Sparkle, Question,
  ClockClockwise, WarningCircle
} from '@phosphor-icons/react'

interface LibraryItem {
  id: string
  title: string
  description: string
  type: 'wiki' | 'source' | 'card'
  tag?: string
  date: string
  dateEpoch: number
  path: string
}

interface AskResult {
  key: string
  title: string
  snippet: string
  path: string | null
}

interface ResearchPanelProps {
  open: boolean
  onClose: () => void
  vaultPath: string
  /** Persisted "Rhizome Vault" setting — where research output should land, independent of vaultPath. */
  agentMemoryVaultPath?: string | null
  /** Known vaults, used to resolve a destination path to a display name in the picker. */
  vaults?: VaultOption[]
  /** Persists the current destination as the new agent_memory_vault_path setting. */
  onSetDefaultDestination?: (path: string) => void
  onOpenNote: (relativePath: string) => void
  locale?: AppLocale
  /** Full settings, used to resolve which agent/model target Generate/Import/Distill
   *  will run with, so we can preflight it before starting a job. Defaults to an
   *  empty settings object (resolves to the default agent). */
  settings?: Settings
  /** Live install/auth status for each CLI agent — feeds the preflight check.
   *  Defaults to "every agent installed" so callers that don't care about
   *  preflight (most tests, and any embedder that hasn't wired status yet)
   *  see the pre-existing always-ready behavior. */
  aiAgentsStatus?: AiAgentsStatus
}

const EMPTY_SETTINGS: Settings = {
  auto_pull_interval_minutes: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
}

const ALL_AGENTS_INSTALLED_STATUS: AiAgentsStatus = Object.fromEntries(
  AI_AGENT_DEFINITIONS.map((definition) => [definition.id, createAiAgentAvailability('installed')]),
) as AiAgentsStatus

function labelForVaultPath(path: string, vaults: VaultOption[]): string {
  const match = vaults.find(v => v.path === path)
  if (match) return match.shortLabel || match.alias || match.label
  const segments = path.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || path
}

/**
 * rhizome-search's `--format json` output isn't documented anywhere in this
 * repo, so field names below are best-effort guesses across common
 * conventions (path/file/id, title/name, snippet/excerpt/description).
 * Unrecognized shapes degrade to an empty result list rather than crashing.
 */
function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value) return value
  }
  return null
}

function parseAskResults(raw: string): AskResult[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    const hits: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { results?: unknown[] })?.results)
        ? (parsed as { results: unknown[] }).results
        : []

    return hits
      .filter((hit): hit is Record<string, unknown> => typeof hit === 'object' && hit !== null)
      .map((hit, i) => {
        const path = pickString(hit, ['path', 'file', 'id', 'page'])
        const title = pickString(hit, ['title', 'name']) || path || `Result ${i + 1}`
        const snippet = pickString(hit, ['snippet', 'excerpt', 'description', 'preview']) || ''
        return { key: `${path ?? title}-${i}`, title, snippet, path }
      })
  } catch {
    return []
  }
}

export function ResearchPanel({ open, onClose, vaultPath, agentMemoryVaultPath, vaults = [], onSetDefaultDestination, onOpenNote, locale = 'en', settings = EMPTY_SETTINGS, aiAgentsStatus = ALL_AGENTS_INSTALLED_STATUS }: ResearchPanelProps) {
  const t = useMemo(() => createTranslator(locale), [locale])
  // Generate/Import/Distill all currently run through the same resolved
  // target — preflight it once so a missing/unauthenticated CLI blocks
  // the action with a clear message instead of failing mid-run with a raw
  // backend error string in the event log.
  const aiTarget = useMemo(() => resolveAiTarget(settings), [settings])
  const myConfiguredModelTargets = useMemo(
    () => configuredModelTargets(normalizeAiModelProviders(settings.ai_model_providers)),
    [settings],
  )
  // Session-local override: lets Distill/Import fall back to a configured
  // direct-API model when the resolved agent CLI is blocked. Never persists,
  // never applies to Generate — repo_research has no API-model path (it needs
  // an agentic file-writing loop), so Generate always preflights/sends the
  // plain agent target regardless of this override.
  const [apiKeyOverride, setApiKeyOverride] = useState<AiModelTarget | null>(null)
  const effectiveTarget = apiKeyOverride ?? aiTarget
  const preflight = useMemo(() => preflightAiTarget(effectiveTarget, aiAgentsStatus), [effectiveTarget, aiAgentsStatus])
  const generatePreflight = useMemo(() => preflightAiTarget(aiTarget, aiAgentsStatus), [aiTarget, aiAgentsStatus])
  // Gate the banner on the underlying agent (not the override) — Generate
  // stays blocked by that same agent even after Distill/Import opt into the
  // fallback, so the banner (and its install guidance) must stay visible.
  const preflightBlocked = generatePreflight.state === 'blocked'
  const canOfferApiFallback = preflightBlocked && myConfiguredModelTargets.length > 0
  // Pass the frontend-resolved target through explicitly so the backend uses
  // it instead of silently re-deriving resolve_default_agent_id() — a user
  // with a different agent installed but no `default_ai_agent` set would
  // otherwise always get ClaudeCode tried and failed. `target` is a strict
  // superset of the legacy `agent` arg; the backend reads `target` first and
  // falls back to `agent` for older callers.
  const resolvedTargetArg = useMemo<Record<string, string>>(
    () => ({ target: effectiveTarget.id }),
    [effectiveTarget],
  )
  // Generate ignores the API-key override — it only ever sends the plain
  // agent target.
  const generateTargetArg = useMemo<Record<string, string>>(
    () => ({ target: aiTarget.id }),
    [aiTarget],
  )
  // Default destination: the persisted Rhizome Vault setting when set, else the
  // vault currently open in the editor. Independent of vaultPath so Generate/
  // Import/Distill/Ask never silently write into whatever's open.
  const defaultDestinationVaultPath = agentMemoryVaultPath || vaultPath
  // Per-session override picked from the destination dropdown; null = using the default.
  const [destinationOverride, setDestinationOverride] = useState<string | null>(null)
  const destinationVaultPath = destinationOverride ?? defaultDestinationVaultPath
  const destinationLabel = destinationVaultPath ? labelForVaultPath(destinationVaultPath, vaults) : ''
  const destinationOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: Array<{ path: string; label: string }> = []
    if (defaultDestinationVaultPath) {
      options.push({ path: defaultDestinationVaultPath, label: labelForVaultPath(defaultDestinationVaultPath, vaults) })
      seen.add(defaultDestinationVaultPath)
    }
    for (const v of vaults) {
      if (seen.has(v.path)) continue
      seen.add(v.path)
      options.push({ path: v.path, label: v.shortLabel || v.alias || v.label })
    }
    return options
  }, [defaultDestinationVaultPath, vaults])
  const isNonDefaultDestination = destinationOverride !== null && destinationOverride !== defaultDestinationVaultPath
  const [pendingConfirmAction, setPendingConfirmAction] = useState<(() => void) | null>(null)
  const runWithDestinationConfirm = useCallback((action: () => void) => {
    if (isNonDefaultDestination) {
      setPendingConfirmAction(() => action)
    } else {
      action()
    }
  }, [isNonDefaultDestination])
  const [activeTab, setActiveTab] = useState('generate')
  const [repoInput, setRepoInput] = useState('')
  const [sourceInput, setSourceInput] = useState('')
  const [distillInput, setDistillInput] = useState('')
  const [projectInput, setProjectInput] = useState('')
  const [selectedMode, setSelectedMode] = useState<string>('architecture')
  const [formatModalOpen, setFormatModalOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [modeLabel, setModeLabel] = useState('Architecture Map')
  const [askInput, setAskInput] = useState('')
  const [askRepo, setAskRepo] = useState('')
  const [askDepth, setAskDepth] = useState('regular')
  const [dragOver, setDragOver] = useState(false)
  const [historyEvents, setHistoryEvents] = useState<string[]>([])
  const [generateDepth, setGenerateDepth] = useState('regular')
  const [distillKind, setDistillKind] = useState('auto')
  const [librarySearch, setLibrarySearch] = useState('')
  const [librarySort, setLibrarySort] = useState('recent')
  const [askResults, setAskResults] = useState<AskResult[]>([])
  const [askHasSearched, setAskHasSearched] = useState(false)
  const jobs = useRhizomeJobs()
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  const addEvent = useCallback((msg: string) => {
    setEvents(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Live progress lines emitted by the Rust backend while a CLI runs
  useEffect(() => {
    if (!open) return
    let unlisten: (() => void) | null = null
    let cancelled = false
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<{ line: string }>('rhizome-progress', (event) => {
          if (event.payload?.line) addEvent(event.payload.line)
        })
      )
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => { /* non-Tauri env (tests) */ })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [open, addEvent])

  const loadLibrary = useCallback(async (): Promise<LibraryItem[]> => {
    if (!destinationVaultPath) return []
    try {
      const result = await invoke('call_rhizome_tool', {
        name: 'rhizome_scan_library',
        args: { vaultPath: destinationVaultPath }
      }) as string
      const items = JSON.parse(result) as Array<{
        id: string; path: string; title: string; description: string;
        type: string; tag: string; date: number
      }>
      const mapped = items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '(no description)',
        type: item.type as 'wiki' | 'source' | 'card',
        tag: item.tag,
        date: item.date > 0 ? new Date(item.date * 1000).toLocaleDateString() : 'unknown',
        dateEpoch: item.date,
        path: item.path,
      }))
      setLibrary(mapped)
      addEvent(t('research.event.libraryLoaded', { count: items.length }))
      return mapped
    } catch (err) {
      addEvent(t('research.event.libraryScanError', { error: String(err) }))
      return []
    }
  }, [destinationVaultPath, addEvent, t])

  /** Reload the library and open the newest artifact created after `prevMaxEpoch`, if any. */
  const reloadAndAutoOpen = useCallback(async (prevMaxEpoch: number) => {
    const items = await loadLibrary()
    const newest = items
      .filter(item => item.dateEpoch > prevMaxEpoch)
      .sort((a, b) => b.dateEpoch - a.dateEpoch)[0]
    if (!newest) return
    trackEvent('research_artifact_autoopen', { type: newest.type })
    onOpenNote(newest.path)
    onClose()
  }, [loadLibrary, onOpenNote, onClose])

  /** Fresh pre-run snapshot — avoids racing the initial library load. */
  const maxLibraryEpoch = useCallback(async () => {
    const items = await loadLibrary()
    return items.reduce((max, item) => Math.max(max, item.dateEpoch), 0)
  }, [loadLibrary])

  // Load library from destination vault on open
  useEffect(() => {
    if (!open || !destinationVaultPath) return
    loadLibrary()
  }, [open, destinationVaultPath, loadLibrary])

  const handleGenerate = useCallback(async () => {
    if (!repoInput.trim() || !destinationVaultPath) return
    if (generatePreflight.state !== 'ready') {
      trackEvent('research_preflight_blocked', { action: 'generate', agent: generatePreflight.state === 'blocked' ? generatePreflight.agent : '' })
      return
    }
    setRunning(true)
    setCurrentJobId(null)
    setStatus(t('research.status.researching'))
    setEvents([])
    const prevMaxEpoch = await maxLibraryEpoch()
    addEvent(t('research.event.startingResearch', { repo: repoInput, mode: selectedMode }))

    const jobId = crypto.randomUUID()
    setCurrentJobId(jobId)
    const result = await jobs.startJob(
      'rhizome_repo_research',
      { repo: repoInput, mode: selectedMode, depth: generateDepth, project: projectInput || '', vaultPath: destinationVaultPath, ...generateTargetArg },
      `${t('research.generate.button')}: ${selectedMode}`,
      jobId
    )
    setCurrentJobId(null)

    if (result.status === 'complete') {
      trackEvent('research_generate', { mode: selectedMode, depth: generateDepth, has_project: projectInput.trim() ? 1 : 0 })
      addEvent(t('research.event.researchComplete'))
      setStatus(t('research.status.generationComplete'))
      await reloadAndAutoOpen(prevMaxEpoch)
    } else if (result.status === 'error') {
      setStatus(t('research.status.error', { error: result.error }))
      addEvent(t('research.status.error', { error: result.error }))
    }
    // cancelled: no-op
    setRunning(false)
  }, [repoInput, selectedMode, generateDepth, projectInput, destinationVaultPath, addEvent, reloadAndAutoOpen, maxLibraryEpoch, t, jobs, generatePreflight, generateTargetArg])

  const handleImportSource = useCallback(async () => {
    if (!sourceInput.trim() || !destinationVaultPath) return
    if (preflight.state !== 'ready') {
      trackEvent('research_preflight_blocked', { action: 'import', agent: preflight.state === 'blocked' ? preflight.agent : '' })
      return
    }
    setRunning(true)
    setCurrentJobId(null)
    setStatus(t('research.status.importing'))
    setEvents([])
    const prevMaxEpoch = await maxLibraryEpoch()
    addEvent(t('research.event.importingSource', { source: sourceInput }))

    const jobId = crypto.randomUUID()
    setCurrentJobId(jobId)
    const result = await jobs.startJob(
      'rhizome_import_source',
      { source: sourceInput, project: projectInput || '', vaultPath: destinationVaultPath, ...resolvedTargetArg },
      t('research.import.button'),
      jobId
    )
    setCurrentJobId(null)

    if (result.status === 'complete') {
      trackEvent('research_import', { has_project: projectInput.trim() ? 1 : 0 })
      addEvent(t('research.status.importComplete'))
      setStatus(t('research.status.importComplete'))
      await reloadAndAutoOpen(prevMaxEpoch)
    } else if (result.status === 'error') {
      setStatus(t('research.status.error', { error: result.error }))
      addEvent(t('research.status.error', { error: result.error }))
    }
    setRunning(false)
  }, [sourceInput, projectInput, destinationVaultPath, addEvent, reloadAndAutoOpen, maxLibraryEpoch, t, jobs, preflight, resolvedTargetArg])

  const handleDistill = useCallback(async () => {
    if (!distillInput.trim() || !destinationVaultPath) return
    if (preflight.state !== 'ready') {
      trackEvent('research_preflight_blocked', { action: 'distill', agent: preflight.state === 'blocked' ? preflight.agent : '' })
      return
    }
    setRunning(true)
    setCurrentJobId(null)
    setStatus(t('research.status.distilling'))
    setEvents([])
    const prevMaxEpoch = await maxLibraryEpoch()
    addEvent(t('research.event.distillingText'))

    const jobId = crypto.randomUUID()
    setCurrentJobId(jobId)
    const args: Record<string, string> = {
      text: distillInput,
      project: projectInput || '',
      vaultPath: destinationVaultPath,
      ...resolvedTargetArg,
    }
    if (distillKind !== 'auto') args.kind = distillKind
    const result = await jobs.startJob('rhizome_distill', args, t('research.distill.button'), jobId)
    setCurrentJobId(null)

    if (result.status === 'complete') {
      trackEvent('research_distill', {
        kind: distillKind,
        engine: effectiveTarget.kind === 'agent' ? 'agent' : effectiveTarget.provider.kind,
      })
      addEvent(t('research.status.distillationComplete'))
      setStatus(t('research.status.distillationComplete'))
      await reloadAndAutoOpen(prevMaxEpoch)
    } else if (result.status === 'error') {
      setStatus(t('research.status.error', { error: result.error }))
      addEvent(t('research.status.error', { error: result.error }))
    }
    setRunning(false)
  }, [distillInput, projectInput, distillKind, destinationVaultPath, addEvent, reloadAndAutoOpen, maxLibraryEpoch, t, jobs, preflight, resolvedTargetArg, effectiveTarget])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0] as (File & { path?: string }) | undefined
    if (file) setSourceInput(file.path || file.name)
  }, [])

  const pickLocalPath = useCallback(async (setValue: (path: string) => void) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ multiple: false })
      if (selected) setValue(selected)
    } catch {
      // Fallback: Tauri dialog not available, user types path manually
    }
  }, [])

  const handleFilePick = useCallback(() => pickLocalPath(setSourceInput), [pickLocalPath])
  const handleLocalRepoPick = useCallback(() => pickLocalPath(setRepoInput), [pickLocalPath])

  const pickType = useCallback((type: string) => {
    if (type === 'URL') setSourceInput('https://')
    else if (type === 'PDF') handleFilePick()
    else setSourceInput('')
  }, [handleFilePick])

  const handleModeSelect = useCallback((mode: ResearchMode) => {
    setSelectedMode(mode.id)
    setModeLabel(mode.title)
  }, [])

  const handleAsk = useCallback(async () => {
    if (!askInput.trim() || !destinationVaultPath) return
    setRunning(true)
    setStatus(t('research.status.askResearching'))
    setEvents([])
    setAskResults([])
    setAskHasSearched(false)
    addEvent(t('research.event.asking', { question: askInput.slice(0, 80) }))

    try {
      const askLimit = askDepth === 'deep' ? '10' : askDepth === 'fast' ? '3' : '5'
      const result = await invoke('call_rhizome_tool', {
        name: 'rhizome_search',
        args: { query: askInput, vaultPath: destinationVaultPath, limit: askLimit }
      }) as string
      const repoFilter = askRepo.trim().toLowerCase()
      const results = parseAskResults(result)
        .filter(r => !repoFilter || (r.path?.toLowerCase().includes(repoFilter) ?? false))
      trackEvent('research_ask', { depth: askDepth, scoped: repoFilter ? 1 : 0 })
      setAskResults(results)
      setAskHasSearched(true)
      addEvent(t('research.event.researchComplete'))
      setStatus(t('research.status.done'))
    } catch (err) {
      setStatus(t('research.status.error', { error: String(err) }))
      addEvent(t('research.status.error', { error: String(err) }))
    } finally {
      setRunning(false)
    }
  }, [askInput, askRepo, askDepth, destinationVaultPath, addEvent, t])

  const handleAskResultOpen = useCallback((result: AskResult) => {
    if (!result.path) return
    onOpenNote(result.path)
    onClose()
  }, [onOpenNote, onClose])

  const handleLibraryOpen = useCallback((item: LibraryItem) => {
    trackEvent('research_library_open', { type: item.type })
    onOpenNote(item.path)
    onClose()
  }, [onOpenNote, onClose])

  const loadHistory = useCallback(async () => {
    if (!destinationVaultPath) return
    try {
      const result = await invoke('call_rhizome_tool', {
        name: 'rhizome_read_events',
        args: { vaultPath: destinationVaultPath }
      }) as string
      const items = JSON.parse(result) as Array<Record<string, unknown>>
      setHistoryEvents(items.map((e) =>
        `[${(e.timestamp as string | undefined)?.slice(0, 19)?.replace('T', ' ') || '?'}] ${e.type}: ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'timestamp'))) || '(empty)'}`
      ))
    } catch {
      // best-effort refresh; ignore failures
    }
  }, [destinationVaultPath])

  useEffect(() => {
    if (!open || activeTab !== 'history') return
    loadHistory()
  }, [open, activeTab, loadHistory])

  const filteredLibrary = library
    .filter(item => {
      const search = librarySearch.trim().toLowerCase()
      if (!search) return true
      return item.title.toLowerCase().includes(search) || item.description.toLowerCase().includes(search)
    })
    .sort((a, b) => librarySort === 'name' ? a.title.localeCompare(b.title) : b.dateEpoch - a.dateEpoch)

  return (
    <>
      <RhizomeFormatModal
        open={formatModalOpen}
        onClose={() => setFormatModalOpen(false)}
        onSelect={handleModeSelect}
        currentMode={selectedMode}
        vaultPath={defaultDestinationVaultPath}
        locale={locale}
      />

      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent
          className="flex flex-col p-0 gap-0 bg-popover border-border rounded-xl overflow-hidden"
          style={{ width: '95vw', maxWidth: 1100, height: '85vh', maxHeight: 700 }}
        >
          <DialogHeader className="px-5 pt-4 pb-2 border-b border-border">
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkle weight="bold" className="w-5 h-5 text-muted-foreground" />
              {t('research.title')}
            </DialogTitle>
            {destinationVaultPath ? (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <span>📁</span>
                <Select
                  value={destinationVaultPath}
                  onValueChange={(path) => {
                    const isDefault = path === defaultDestinationVaultPath
                    setDestinationOverride(isDefault ? null : path)
                    if (!isDefault) trackEvent('research_destination_override', {})
                  }}
                >
                  <SelectTrigger
                    aria-label={t('research.destination.label')}
                    className="h-6 text-xs bg-transparent border-none shadow-none text-muted-foreground px-1 w-auto gap-1 hover:text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationOptions.map(opt => (
                      <SelectItem key={opt.path} value={opt.path}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onSetDefaultDestination && destinationVaultPath !== agentMemoryVaultPath && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetDefaultDestination(destinationVaultPath)
                      setDestinationOverride(null)
                      trackEvent('research_destination_set_default', {})
                    }}
                    className="underline hover:text-foreground"
                  >
                    {t('research.destination.setAsDefault')}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#ff9f0a] mt-1">⚠ {t('research.noVaultWarning')}</p>
            )}
          </DialogHeader>

          {preflightBlocked && (
            <div
              data-testid="research-preflight-blocked"
              className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 px-3 py-2.5 text-xs text-foreground"
            >
              <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0 text-[#ff9f0a]" />
              <div className="flex-1">
                <p className="font-medium">{t('research.preflight.agentMissingTitle', { agent: generatePreflight.state === 'blocked' ? generatePreflight.label : '' })}</p>
                <p className="mt-0.5 text-muted-foreground">{t('research.preflight.agentMissingBody', { agent: generatePreflight.state === 'blocked' ? generatePreflight.label : '' })}</p>
                <button
                  type="button"
                  onClick={() => { if (generatePreflight.state === 'blocked') void openExternalUrl(generatePreflight.installUrl) }}
                  className="mt-1 underline hover:text-foreground"
                >
                  {t('research.preflight.installLink', { agent: generatePreflight.state === 'blocked' ? generatePreflight.label : '' })}
                </button>
                {apiKeyOverride ? (
                  <p className="mt-2 text-muted-foreground">
                    {t('research.preflight.apiFallbackActive', { model: apiKeyOverride.shortLabel })}
                  </p>
                ) : canOfferApiFallback ? (
                  <div className="mt-2">
                    <p className="font-medium">{t('research.preflight.apiFallbackTitle')}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {t('research.preflight.apiFallbackBody', {
                        agent: generatePreflight.state === 'blocked' ? generatePreflight.label : '',
                        model: myConfiguredModelTargets[0].shortLabel,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setApiKeyOverride(myConfiguredModelTargets[0])}
                      className="mt-1 underline hover:text-foreground"
                    >
                      {t('research.preflight.apiFallbackCta', { model: myConfiguredModelTargets[0].shortLabel })}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          {generatePreflight.state === 'checking' && (
            <p data-testid="research-preflight-checking" className="mx-5 mt-3 text-xs text-muted-foreground">
              {t('research.preflight.checking')}
            </p>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            {/* Tab bar */}
            <div className="px-5 pt-3 border-b border-border overflow-x-auto whitespace-nowrap">
              <TabsList className="bg-transparent gap-2 flex-nowrap min-w-max">
                <TabsTrigger value="generate" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <RocketLaunch weight="bold" className="w-4 h-4" /> {t('research.tab.generate')}
                </TabsTrigger>
                <TabsTrigger value="import" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <FileText weight="bold" className="w-4 h-4" /> {t('research.tab.import')}
                </TabsTrigger>
                <TabsTrigger value="distill" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <Brain weight="bold" className="w-4 h-4" /> {t('research.tab.distill')}
                </TabsTrigger>
                <TabsTrigger value="library" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <BookOpenText weight="bold" className="w-4 h-4" /> {t('research.tab.library')}
                </TabsTrigger>
                <TabsTrigger value="ask" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <Question weight="bold" className="w-4 h-4" /> {t('research.tab.ask')}
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <ClockClockwise weight="bold" className="w-4 h-4" /> {t('research.tab.history')}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {/* GENERATE TAB */}
              <TabsContent value="generate" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder={t('research.generate.repoPlaceholder')}
                    className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  <Button
                    variant="outline"
                    onClick={handleLocalRepoPick}
                    className="bg-muted border-border text-foreground hover:bg-accent"
                  >
                    <FolderIcon /> {t('research.generate.local')}
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setFormatModalOpen(true)}
                    className="bg-muted border-border text-foreground hover:bg-accent"
                  >
                    {modeLabel}
                  </Button>

                  <Select value={generateDepth} onValueChange={setGenerateDepth}>
                    <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">{t('research.depth.fast')}</SelectItem>
                      <SelectItem value="regular">{t('research.depth.regular')}</SelectItem>
                      <SelectItem value="deep">{t('research.depth.deep')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  {running ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { if (currentJobId) jobs.cancelJob(currentJobId) }}
                      className="px-5"
                    >
                      {t('research.cancel')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => runWithDestinationConfirm(handleGenerate)}
                      disabled={!repoInput.trim() || generatePreflight.state !== 'ready'}
                      className="bg-primary text-primary-foreground hover:bg-muted px-5"
                    >
                      {`${t('research.generate.button')} → ${destinationLabel}`}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    placeholder={t('research.generate.projectPlaceholder')}
                    className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                  />
                </div>

                {status && (
                  <div className="text-sm text-muted-foreground mb-2">{status}</div>
                )}

                <ScrollArea className="flex-1 rounded-lg bg-muted p-3">
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.generate.emptyState')}
                    </p>
                  ) : (
                    events.map((ev, i) => (
                      <div key={i} className="text-xs text-muted-foreground py-0.5 font-mono">{ev}</div>
                    ))
                  )}
                </ScrollArea>
              </TabsContent>

              {/* IMPORT TAB */}
              <TabsContent value="import" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`mb-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-white bg-accent'
                      : 'border-border hover:border-border'
                  }`}
                  onClick={handleFilePick}
                >
                  <FileText weight="thin" className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-foreground' : 'text-muted-foreground'}`} />
                  <p className={`text-sm ${dragOver ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                    {dragOver ? t('research.import.dropActive') : t('research.import.dropIdle')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t('research.import.dropHint')}</p>
                </div>

                {/* Input row */}
                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    placeholder={t('research.import.sourcePlaceholder')}
                    className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                    onKeyDown={(e) => e.key === 'Enter' && runWithDestinationConfirm(handleImportSource)}
                  />
                  {running ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { if (currentJobId) jobs.cancelJob(currentJobId) }}
                      className="px-5"
                    >
                      {t('research.cancel')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => runWithDestinationConfirm(handleImportSource)}
                      disabled={!sourceInput.trim() || preflight.state !== 'ready'}
                      className="bg-primary text-primary-foreground hover:bg-muted px-5"
                    >
                      {`${t('research.import.button')} → ${destinationLabel}`}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    placeholder={t('research.import.projectPlaceholder')}
                    className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                  />
                  <div className="flex gap-1.5">
                    {['PDF', 'URL', 'Text'].map(type => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => pickType(type)}
                        className="bg-muted border-border text-muted-foreground hover:text-foreground"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                <ScrollArea className="flex-1 rounded-lg bg-muted p-3">
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.import.emptyState')}
                    </p>
                  ) : (
                    events.map((ev, i) => (
                      <div key={i} className="text-xs text-muted-foreground py-0.5 font-mono">{ev}</div>
                    ))
                  )}
                </ScrollArea>
              </TabsContent>

              {/* DISTILL TAB */}
              <TabsContent value="distill" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                <div className="mb-3">
                  <Textarea
                    value={distillInput}
                    onChange={(e) => setDistillInput(e.target.value)}
                    placeholder={t('research.distill.textareaPlaceholder')}
                    className="w-full h-32 bg-muted border border-border text-foreground placeholder:text-muted-foreground/70 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-border"
                  />
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    placeholder={t('research.distill.projectPlaceholder')}
                    className="w-64 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                  />
                  <Select value={distillKind} onValueChange={setDistillKind}>
                    <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('research.distillKind.auto')}</SelectItem>
                      <SelectItem value="concept">{t('research.distillKind.concept')}</SelectItem>
                      <SelectItem value="architecture-pattern">{t('research.distillKind.architecturePattern')}</SelectItem>
                      <SelectItem value="workflow">{t('research.distillKind.workflow')}</SelectItem>
                      <SelectItem value="integration">{t('research.distillKind.integration')}</SelectItem>
                      <SelectItem value="failure-mode">{t('research.distillKind.failureMode')}</SelectItem>
                      <SelectItem value="convention">{t('research.distillKind.convention')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  {running ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { if (currentJobId) jobs.cancelJob(currentJobId) }}
                      className="px-5"
                    >
                      {t('research.cancel')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => runWithDestinationConfirm(handleDistill)}
                      disabled={!distillInput.trim() || preflight.state !== 'ready'}
                      className="bg-primary text-primary-foreground hover:bg-muted px-5"
                    >
                      {`${t('research.distill.button')} → ${destinationLabel}`}
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 rounded-lg bg-muted p-3">
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.distill.emptyState')}
                    </p>
                  ) : (
                    events.map((ev, i) => (
                      <div key={i} className="text-xs text-muted-foreground py-0.5 font-mono">{ev}</div>
                    ))
                  )}
                </ScrollArea>
              </TabsContent>

              {/* LIBRARY TAB */}
              <TabsContent value="library" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                    <Input
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder={t('research.library.searchPlaceholder')}
                      className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                    />
                  </div>
                  <Select value={librarySort} onValueChange={setLibrarySort}>
                    <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">{t('research.library.sortRecent')}</SelectItem>
                      <SelectItem value="name">{t('research.library.sortName')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="flex-1">
                  {library.length === 0 ? (
                    <div className="text-center py-16">
                      <BookOpenText weight="thin" className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground/70">{t('research.library.emptyTitle')}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('research.library.emptySubtitle')}
                      </p>
                    </div>
                  ) : filteredLibrary.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-16">{t('research.library.noMatches')}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredLibrary.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleLibraryOpen(item)}
                          className="rounded-lg bg-muted p-4 hover:bg-accent transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                              {item.type === 'wiki' ? <Code className="w-5 h-5 text-muted-foreground" /> :
                               item.type === 'source' ? <FileText className="w-5 h-5 text-muted-foreground" /> :
                               <PuzzlePiece className="w-5 h-5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{item.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                {item.tag && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
                                    {item.tag}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground/70">{item.date}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* ASK TAB */}
              <TabsContent value="ask" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                <div className="mb-3 flex-1 flex flex-col">
                  <Textarea
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    placeholder={t('research.ask.textareaPlaceholder')}
                    className="w-full h-28 bg-muted border border-border text-foreground placeholder:text-muted-foreground/70 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-border"
                  />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <Input
                    value={askRepo}
                    onChange={(e) => setAskRepo(e.target.value)}
                    placeholder={t('research.ask.repoPlaceholder')}
                    className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground/70"
                  />
                  <Select value={askDepth} onValueChange={setAskDepth}>
                    <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">{t('research.depth.fast')}</SelectItem>
                      <SelectItem value="regular">{t('research.depth.regular')}</SelectItem>
                      <SelectItem value="deep">{t('research.depth.deep')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <Button
                    onClick={handleAsk}
                    disabled={running || !askInput.trim()}
                    className="bg-primary text-primary-foreground hover:bg-muted px-5"
                  >
                    {running ? t('research.ask.running') : t('research.ask.button')}
                  </Button>
                </div>
                <ScrollArea className="flex-1 rounded-lg bg-muted p-3">
                  {!askHasSearched ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.ask.hint')}
                    </p>
                  ) : askResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.ask.noResults')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {askResults.map(result => (
                        <div
                          key={result.key}
                          onClick={() => handleAskResultOpen(result)}
                          className={`rounded-lg bg-accent p-3 ${result.path ? 'hover:bg-accent cursor-pointer' : ''}`}
                        >
                          <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                          {result.snippet && (
                            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{result.snippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* HISTORY TAB */}
              <TabsContent value="history" className="h-full p-5 m-0 data-[state=active]:flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-muted-foreground">{t('research.history.title')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadHistory}
                    className="bg-muted border-border text-muted-foreground hover:text-foreground"
                  >
                    {t('research.history.refresh')}
                  </Button>
                </div>

                <ScrollArea className="flex-1 rounded-lg bg-muted p-3">
                  {historyEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 text-center py-8">
                      {t('research.history.emptyState')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {historyEvents.map((ev, i) => (
                        <div key={i} className="text-xs text-muted-foreground py-1 px-2 rounded hover:bg-accent font-mono">
                          {ev}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingConfirmAction !== null} onOpenChange={(o) => { if (!o) setPendingConfirmAction(null) }}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('research.destination.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('research.destination.confirmMessage', { destination: destinationLabel })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                pendingConfirmAction?.()
                setPendingConfirmAction(null)
              }}
              className="bg-primary text-primary-foreground hover:bg-muted"
            >
              {t('research.destination.confirmSend')}
            </Button>
            <Button variant="outline" onClick={() => setPendingConfirmAction(null)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1">
      <path d="M2 4.5C2 3.94772 2.44772 3.5 3 3.5H6L7.5 5H13C13.5523 5 14 5.44772 14 6V11.5C14 12.0523 13.5523 12.5 13 12.5H3C2.44772 12.5 2 12.0523 2 11.5V4.5Z" />
    </svg>
  )
}
