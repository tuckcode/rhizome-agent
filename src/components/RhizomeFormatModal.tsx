import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { callHostOr } from '../lib/callHost'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackResearchFormatSaved } from '../lib/productAnalytics'
import { customToResearchMode, type CustomFormat } from '../lib/researchFormats'
import { MagnifyingGlass, BugBeetle, Brain, RocketLaunch, Code, PuzzlePiece, Question, FileMagnifyingGlass, ArrowsDownUp } from '@phosphor-icons/react'

export interface ResearchMode {
  id: string
  title: string
  description: string
  category: string
  categoryLabel: string
  tag?: string
  tagColor?: string
  icon: React.ReactNode
  produces: string[]
  samplePeek: {
    title: string
    description: string
    pills: string[]
  }
}

const RESEARCH_MODES: ResearchMode[] = [
  {
    id: 'architecture',
    title: 'Architecture Map',
    description: 'A comprehensive developer reference for entry points, data flow, abstractions, and key components.',
    category: 'technical',
    categoryLabel: 'Technical',
    tag: 'Developer reference',
    icon: <Code weight="bold" className="w-5 h-5" />,
    produces: ['Entry points', 'Data flow', 'Key abstractions', 'Tech stack map'],
    samplePeek: {
      title: 'Architecture Overview',
      description: 'A system-level map of the repo showing how the main components connect and where a developer should start reading.',
      pills: ['Entry points', 'Data flow diagram', 'Component map', 'Dependency graph'],
    },
  },
  {
    id: 'first-hour',
    title: 'First Hour',
    description: 'A fast path from cold start to useful repo context. Get oriented and productive quickly.',
    category: 'start',
    categoryLabel: 'Start',
    tag: 'Fast start',
    icon: <RocketLaunch weight="bold" className="w-5 h-5" />,
    produces: ['Read order', 'Entry points', 'Local glossary'],
    samplePeek: {
      title: 'Start Here',
      description: 'A cold-start path for understanding the repo before you spend the whole afternoon.',
      pills: ['Read these files first', 'Words you need to know', 'What to ignore for now'],
    },
  },
  {
    id: 'eli5',
    title: 'Explain Like I\'m 5',
    description: 'A plain-language explanation of what the repo does, using careful analogies without losing source grounding.',
    category: 'start',
    categoryLabel: 'Start',
    tag: 'Plain English',
    icon: <Question weight="bold" className="w-5 h-5" />,
    produces: ['Simple explanation', 'Analogies', 'Core concepts'],
    samplePeek: {
      title: 'What This Does (Simply)',
      description: 'The simplest useful explanation of the repo, with one analogy to keep in mind.',
      pills: ['The one analogy', 'What moves where', 'Why each part exists'],
    },
  },
  {
    id: 'hidden-lessons',
    title: 'Hidden Lessons',
    description: 'Non-obvious implementation details, edge cases, constraints, and hard-won lessons from the code.',
    category: 'analyze',
    categoryLabel: 'Analyze',
    tag: 'Deep dive',
    icon: <BugBeetle weight="bold" className="w-5 h-5" />,
    produces: ['Hidden constraints', 'Edge cases', 'Workarounds', 'Failure modes'],
    samplePeek: {
      title: 'Hidden Quirks Map',
      description: 'The non-obvious implementation details, tests, scripts, and adapters worth studying first.',
      pills: ['Surprising constraints', 'Test secrets', 'Config tricks', 'Adapter behavior'],
    },
  },
  {
    id: 'reusable-patterns',
    title: 'Reusable Patterns',
    description: 'Elegant designs, best practices, and architecture bets worth extracting and reusing elsewhere.',
    category: 'analyze',
    categoryLabel: 'Analyze',
    tag: 'Builder favorite',
    icon: <PuzzlePiece weight="bold" className="w-5 h-5" />,
    produces: ['Reusable patterns', 'Best practices', 'Porting recipes', 'Transfer limits'],
    samplePeek: {
      title: 'What To Reuse',
      description: 'The strongest reusable moves, why they work, and what a naive clone would miss.',
      pills: ['The pattern', 'Why it works', 'When not to copy', 'How to port'],
    },
  },
  {
    id: 'feature-scout',
    title: 'Feature Scout',
    description: 'A scout report of features worth exploring, demoing, copying, or productizing.',
    category: 'analyze',
    categoryLabel: 'Analyze',
    icon: <FileMagnifyingGlass weight="bold" className="w-5 h-5" />,
    produces: ['Feature inventory', 'Workflows', 'CLI commands', 'Product mechanics'],
    samplePeek: {
      title: 'Feature Scout Brief',
      description: 'The product surface, the features worth exploring first, and why they deserve attention.',
      pills: ['Top features', 'Hidden power moves', 'Automation hooks', 'What to demo'],
    },
  },
  {
    id: 'mental-model',
    title: 'Mental Model',
    description: 'A durable model of how the system behaves, its invariants, boundaries, and where changes are safe.',
    category: 'deep',
    categoryLabel: 'Deep Dive',
    tag: 'Deep understanding',
    icon: <Brain weight="bold" className="w-5 h-5" />,
    produces: ['System invariants', 'State ownership', 'Failure modes', 'Safe-change rules'],
    samplePeek: {
      title: 'The Mental Model',
      description: 'The simplest useful model of the system, its main flows, boundaries, and what changes your predictions.',
      pills: ['Core invariants', 'Boundaries', 'Failure modes', 'Safe-change rules'],
    },
  },
  {
    id: 'debugging-atlas',
    title: 'Debugging Atlas',
    description: 'A practical guide to failure modes, observability hooks, root-cause paths, and recovery flows.',
    category: 'deep',
    categoryLabel: 'Deep Dive',
    icon: <MagnifyingGlass weight="bold" className="w-5 h-5" />,
    produces: ['Failure modes', 'Observability hooks', 'Recovery flows', 'Regression checks'],
    samplePeek: {
      title: 'Debugging Map',
      description: 'Symptoms, probes, logs, state transitions, and root-cause paths for the most common failures.',
      pills: ['Error patterns', 'What to check first', 'Logs that matter', 'Recovery steps'],
    },
  },
  {
    id: 'integration-plan',
    title: 'Integration Plan',
    description: 'A concrete plan for connecting, embedding, or bridging this repo with another system.',
    category: 'compare',
    categoryLabel: 'Compare & Plan',
    icon: <ArrowsDownUp weight="bold" className="w-5 h-5" />,
    produces: ['Integration surface', 'Data shapes', 'Step-by-step plan', 'Conflict map'],
    samplePeek: {
      title: 'Integration Surface',
      description: 'APIs, hooks, event buses, and CLI interfaces — with exact files to touch and commands to run.',
      pills: ['Integration points', 'Data contracts', 'Auth & errors', 'Step-by-step plan'],
    },
  },
  {
    id: 'agent-handoff',
    title: 'Agent Handoff',
    description: 'Everything an AI agent needs to work effectively with this repo — deps, env, CI, conventions.',
    category: 'compare',
    categoryLabel: 'Compare & Plan',
    icon: <RocketLaunch weight="bold" className="w-5 h-5" />,
    produces: ['Env vars', 'CI gates', 'Do-not-touch files', 'Conventions'],
    samplePeek: {
      title: 'Agent Context',
      description: 'What the agent needs to know: env vars, API keys, test commands, and files it should never modify.',
      pills: ['Environment setup', 'Test commands', 'Generated files', 'CI gates'],
    },
  },
]

interface RhizomeFormatModalProps {
  open: boolean
  onClose: () => void
  onSelect: (mode: ResearchMode) => void
  currentMode?: string
  /** Vault whose `.rhizome/research-formats.json` holds the custom formats. */
  vaultPath?: string
  locale?: AppLocale
}

function getCategoryModes(modes: ResearchMode[], category: string): ResearchMode[] {
  return modes.filter(m => m.category === category)
}

export function RhizomeFormatModal({
  open,
  onClose,
  onSelect,
  currentMode,
  vaultPath = '',
  locale = 'en',
}: RhizomeFormatModalProps) {
  const t = createTranslator(locale)
  const [selectedId, setSelectedId] = useState<string>(currentMode || 'architecture')
  const [customFormats, setCustomFormats] = useState<CustomFormat[]>([])
  const [composing, setComposing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftInstruction, setDraftInstruction] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reloaded per open rather than once: another window (or the agent) can
  // write the file while this modal is closed.
  useEffect(() => {
    if (!open || !vaultPath) return
    let cancelled = false
    void callHostOr<CustomFormat[]>('list_research_formats', [], { vaultPath }).then(formats => {
      if (!cancelled) setCustomFormats(Array.isArray(formats) ? formats : [])
    })
    return () => { cancelled = true }
  }, [open, vaultPath])

  const customLabel = t('research.format.customCategory')
  const allModes = [
    ...RESEARCH_MODES,
    ...customFormats.map(f => customToResearchMode(f, customLabel)),
  ]
  const selected = allModes.find(m => m.id === selectedId) ?? RESEARCH_MODES[0]

  const categories = [...new Set(allModes.map(m => m.category))]

  const resetDraft = () => {
    setComposing(false)
    setDraftTitle('')
    setDraftInstruction('')
    setSaveError(null)
  }

  const handleSave = async () => {
    const title = draftTitle.trim()
    const instruction = draftInstruction.trim()
    if (!title || !instruction) {
      setSaveError(t('research.format.saveIncomplete'))
      return
    }
    try {
      const formats = await callHostOr<CustomFormat[] | null>(
        'save_research_format',
        null,
        { vaultPath, title, instruction },
      )
      if (!formats) {
        setSaveError(t('research.format.saveFailed'))
        return
      }
      setCustomFormats(formats)
      // Count only. The instruction is user content and never leaves here.
      trackResearchFormatSaved(formats.length)
      const saved = formats.find(f => f.title === title)
      if (saved) setSelectedId(saved.id)
      resetDraft()
    } catch {
      setSaveError(t('research.format.saveFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="p-0 gap-0 bg-popover border-border rounded-xl overflow-hidden"
        style={{ width: '95vw', maxWidth: 900 }}
      >
        <div className="flex h-[520px]">
          {/* Left column — mode list */}
          <div className="w-[420px] overflow-y-auto border-r border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase mb-1">Format</p>
                <h2 className="text-lg font-semibold text-foreground">{selected?.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{selected?.description}</p>

            <div className="space-y-4">
              {categories.map(cat => {
                const modes = getCategoryModes(allModes, cat)
                if (modes.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase mb-2">{modes[0].categoryLabel}</p>
                    <div className="space-y-0.5">
                      {modes.map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setSelectedId(mode.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3 ${
                            selectedId === mode.id
                              ? 'bg-muted'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <span className={`mt-0.5 ${
                            selectedId === mode.id ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {mode.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${
                                selectedId === mode.id ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {mode.title}
                              </span>
                              {mode.tag && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  mode.tagColor || 'bg-accent text-muted-foreground'
                                }`}>
                                  {mode.tag}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs mt-0.5 line-clamp-2 ${
                              selectedId === mode.id ? 'text-muted-foreground' : 'text-muted-foreground/70'
                            }`}>
                              {mode.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5">
              {composing ? (
                <div
                  data-testid="research-format-composer"
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <Input
                    data-testid="research-format-title"
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    placeholder={t('research.format.titlePlaceholder')}
                    aria-label={t('research.format.titleLabel')}
                  />
                  <Textarea
                    data-testid="research-format-instruction"
                    value={draftInstruction}
                    onChange={e => setDraftInstruction(e.target.value)}
                    placeholder={t('research.format.instructionPlaceholder')}
                    aria-label={t('research.format.instructionLabel')}
                    rows={3}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('research.format.instructionHint')}
                  </p>
                  {saveError && (
                    <p role="alert" className="text-[11px] text-destructive">{saveError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      data-testid="research-format-save"
                      onClick={() => { void handleSave() }}
                    >
                      {t('research.format.save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetDraft}>
                      {t('research.format.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  data-testid="research-format-add"
                  disabled={!vaultPath}
                  className="w-full justify-start border-dashed text-muted-foreground"
                  onClick={() => setComposing(true)}
                >
                  {t('research.format.add')}
                </Button>
              )}
            </div>
          </div>

          {/* Right column — detail preview */}
          <div className="flex-1 p-5 flex flex-col">
            <div className="mb-4">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase mb-1">What this produces</p>
              <h2 className="text-lg font-semibold text-foreground mb-1">{selected.title}</h2>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </div>

            <div className="space-y-2 mb-5">
              {selected.produces.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase mb-2">Sample peek</p>
              <div className="rounded-lg bg-muted p-3.5">
                <p className="text-sm font-medium text-foreground mb-1">{selected.samplePeek.title}</p>
                <p className="text-xs text-muted-foreground mb-2.5">{selected.samplePeek.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.samplePeek.pills.map((pill, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-accent text-muted-foreground">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <Button
                onClick={() => { onSelect(selected); onClose() }}
                className="bg-primary text-primary-foreground hover:bg-muted px-5"
              >
                Use {selected.title}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
