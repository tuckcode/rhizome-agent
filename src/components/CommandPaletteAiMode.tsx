import { useLayoutEffect, useRef } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { createTranslator } from '../lib/i18n'
import { openExternalUrl } from '../utils/url'
import { InlineWikilinkInput } from './InlineWikilinkInput'
import { Button } from './ui/button'

interface CommandPaletteAiModeProps {
  entries: VaultEntry[]
  value: string
  aiAgentReady?: boolean
  aiAgentLabel?: string
  aiAgentInstallUrl?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  onChange: (value: string) => void
  onSubmit: (text: string, references: NoteReference[]) => void
  onUseRhizome?: () => void
}

function stripLeadingSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value
}

export function CommandPaletteAiMode({
  entries,
  value,
  aiAgentReady = true,
  aiAgentLabel = 'Claude Code',
  aiAgentInstallUrl,
  inputRef,
  onChange,
  onSubmit,
  onUseRhizome,
}: CommandPaletteAiModeProps) {
  const t = createTranslator()
  const useRhizomeRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (aiAgentReady || !onUseRhizome) return
    useRhizomeRef.current?.focus()
  }, [aiAgentReady, onUseRhizome])

  return (
    <InlineWikilinkInput
      entries={entries}
      value={value}
      inputRef={inputRef}
      onChange={onChange}
      onSubmit={(text, references) => onSubmit(stripLeadingSpace(text), references)}
      submitOnEmpty={true}
      readOnly={!aiAgentReady}
      placeholder={t('ai.panel.placeholder.ready', { agent: aiAgentLabel })}
      dataTestId="command-palette-ai-input"
      editorClassName="border-none px-0 py-0 text-[15px]"
      suggestionListVariant="palette"
      paletteHeader={(
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <Sparkle size={12} weight="fill" />
          <span>Ask {aiAgentLabel}</span>
        </div>
      )}
      paletteEmptyState={(
        <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          {!aiAgentReady ? (
            <div className="space-y-3">
              <div>{aiAgentLabel} is not available on this machine.</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {aiAgentInstallUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="command-palette-install-agent"
                    onClick={() => { void openExternalUrl(aiAgentInstallUrl) }}
                  >
                    Install {aiAgentLabel}
                  </Button>
                ) : null}
                {onUseRhizome ? (
                  <Button
                    ref={useRhizomeRef}
                    type="button"
                    size="sm"
                    className="focus:ring-2 focus:ring-[var(--state-focus-ring)]"
                    onClick={onUseRhizome}
                    data-testid="command-palette-use-rhizome"
                  >
                    Use Rhizome instead
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-1 font-medium text-foreground">Ask {aiAgentLabel}</div>
              <div>
                {value.trim().length === 0
                  ? 'Type your prompt after the leading space.'
                  : 'Type [[ to insert a note reference inline.'}
              </div>
            </>
          )}
        </div>
      )}
      paletteFooter={(
        <div className="flex items-center gap-4 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>{aiAgentLabel} mode</span>
          {aiAgentReady ? <span data-testid="command-palette-ai-send-hint">↵ send</span> : null}
          <span>esc close</span>
        </div>
      )}
    />
  )
}
