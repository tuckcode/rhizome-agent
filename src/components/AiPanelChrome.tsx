import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Sparkle, X, PaperPlaneRight, Plus, Stop, ImageSquare } from '@phosphor-icons/react'
import { AiMessage } from './AiMessage'
import { Button } from '@/components/ui/button'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { ComposerAttachment } from '../lib/composerAttachments'
import { WikilinkChatInput } from './WikilinkChatInput'
import { extractInlineWikilinkReferences } from './inlineWikilinkText'
import { serializeInlineNode } from './inlineWikilinkDom'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'
import {
  aiAgentPermissionModeLabels,
  type AiAgentPermissionMode,
} from '../lib/aiAgentPermissionMode'
import { createTranslator, type AppLocale } from '../lib/i18n'
import type { AiAgentMessage } from '../hooks/useCliAiAgent'
import type { AiAgentReadiness } from '../lib/aiAgents'
import type { NoteReference } from '../utils/ai-context'
import type { VaultEntry } from '../types'
import type { CommandMenuAction, CommandMenuEntry } from '../lib/primeCommandMenu'
import { primeQueueIsEmpty, primeQueueItems, type PrimeQueue } from '../lib/primeQueue'
import { PrimeQueueItemActions } from './PrimeQueueItemActions'
import { cn } from '@/lib/utils'
import { suggestReply } from '../lib/replySuggestions'
import { latestAssistantMessageIndex } from '../lib/latestAssistantMessage'
import { useDragRegion } from '../hooks/useDragRegion'
import { useComposerPromptHistory } from '../hooks/useComposerPromptHistory'
import {
  trackComposerReplyCompletionAccepted,
  trackComposerReplyCompletionDismissed,
  trackComposerReplyCompletionShown,
} from '../lib/productAnalytics'
import { workerStartFailureReason } from '../lib/primeWorkerStartError'

interface AiPanelHeaderProps {
  agentLabel: string
  agentReadiness: AiAgentReadiness
  /** Live turn state from the session controller. */
  agentStatus?: 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'
  /** Latest send error, when the turn failed. Worker failures name their reason. */
  sendError?: string | null
  /** Optional model label from Prime host (e.g. "Grok 4.5"). */
  modelLabel?: string | null
  targetKind?: 'agent' | 'api_model'
  locale?: AppLocale
  permissionMode: AiAgentPermissionMode
  permissionModeDisabled: boolean
  onPermissionModeChange: (mode: AiAgentPermissionMode) => void
  /** Prime product: hide Safe/Power toggle (default toolkit only). */
  hidePermissionMode?: boolean
  /** Lightweight skills affordance, e.g. "rhizome-vault". */
  skillsLabel?: string | null
  onClose: () => void
  onNewChat: () => void
}

interface AiPanelMessageHistoryProps {
  agentLabel: string
  agentReadiness: AiAgentReadiness
  locale?: AppLocale
  messages: AiAgentMessage[]
  isActive: boolean
  onForkMessage?: (messageId: string) => void
  /** Fork branches the Prime session rather than copying the conversation. */
  forkTargetsPrimeEntry?: boolean
  onOpenNote?: (path: string) => void
  onNavigateWikilink?: (target: string) => void
  onRegenerateMessage?: (messageId: string) => void
  onPromoteToVault?: (text: string) => void
  onScrollStateChange?: (scrolled: boolean) => void
  hasContext: boolean
}

interface AiPanelComposerProps {
  /** Images staged for this message. Owned by the panel, not the composer. */
  attachments?: ComposerAttachment[]
  onAttachImages?: (files: File[]) => void
  onRemoveAttachment?: (id: string) => void
  entries: VaultEntry[]
  agentLabel: string
  agentReadiness: AiAgentReadiness
  locale?: AppLocale
  input: string
  inputRef: React.RefObject<HTMLDivElement | null>
  isActive: boolean
  controls?: ReactNode
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
  onStop: () => void
  /** Redirect a running turn instead of aborting it. When absent the composer
   *  stays disabled while streaming, which is the pre-steering behaviour. */
  onSteer?: (text: string, references: NoteReference[]) => void
  /** Prime's steer/follow-up queue. Absent when this surface does not queue. */
  queue?: PrimeQueue
  onClearQueue?: () => void
  onUnsupportedAiPaste?: (message: string) => void
  /** Frame A foot row. Rendered under the box so it can see controller state. */
  foot?: ReactNode
  commandEntries?: CommandMenuEntry[]
  commandDisabled?: Record<string, string>
  commandSkillLabel?: string
  commandInstantLabel?: string
  onCommandAction?: (action: CommandMenuAction, nextValue: string) => void
  /** The last agent message in the conversation, used to compute reply suggestions. */
  lastAgentMessage?: string | null
}

function getComposerPlaceholder(
  agentLabel: string,
  agentReadiness: AiAgentReadiness,
  t: ReturnType<typeof createTranslator>,
): string {
  if (agentReadiness === 'checking') {
    return t('ai.panel.placeholder.checking')
  }

  if (agentReadiness === 'missing') {
    return t('ai.panel.placeholder.missing', { agent: agentLabel })
  }

  return t('ai.panel.placeholder.ready', { agent: agentLabel })
}

function composerSendButtonStyle(canSend: boolean): CSSProperties {
  return {
    background: canSend ? 'var(--primary)' : 'var(--muted)',
    color: canSend ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
    borderRadius: 8,
    width: 30,
    height: 30,
    cursor: canSend ? 'pointer' : 'not-allowed',
  }
}

function composerStopButtonStyle(): CSSProperties {
  return {
    background: 'var(--destructive)',
    color: 'var(--destructive-foreground)',
    borderRadius: 8,
    width: 30,
    height: 30,
    cursor: 'pointer',
  }
}

function ComposerInput({
  disabled,
  entries,
  hasControls,
  input,
  inputRef,
  onChange,
  onSend,
  onUnsupportedAiPaste,
  onImagePaste,
  unsupportedPasteMessage,
  placeholder,
  completion,
  onAcceptCompletion,
  onDismissCompletion,
  commandEntries,
  commandDisabled,
  commandSkillLabel,
  commandInstantLabel,
  onCommandAction,
  onBrowsePromptHistory,
}: {
  disabled: boolean
  entries: VaultEntry[]
  hasControls: boolean
  input: string
  inputRef: React.RefObject<HTMLDivElement | null>
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
  onUnsupportedAiPaste?: (message: string) => void
  onImagePaste?: (files: File[]) => void
  unsupportedPasteMessage: string
  placeholder: string
  completion?: string | null
  onAcceptCompletion?: () => boolean
  onDismissCompletion?: () => boolean
  commandEntries?: CommandMenuEntry[]
  commandDisabled?: Record<string, string>
  commandSkillLabel?: string
  commandInstantLabel?: string
  onCommandAction?: (action: CommandMenuAction, nextValue: string) => void
  onBrowsePromptHistory?: (
    direction: 'up' | 'down',
    meta: {
      value: string
      selectionStart: number
      selectionEnd: number
      suggestionsOpen: boolean
    },
  ) => boolean
}) {
  const shownPlaceholder = completion ?? placeholder
  return (
    <WikilinkChatInput
      entries={entries}
      value={input}
      onChange={onChange}
      onSend={onSend}
      onUnsupportedPaste={onUnsupportedAiPaste}
      onImagePaste={onImagePaste}
      unsupportedPasteMessage={unsupportedPasteMessage}
      disabled={disabled}
      placeholder={shownPlaceholder}
      placeholderClassName={
        completion
          ? cn(
              hasControls ? 'px-2 py-1.5 text-[12px] leading-5' : 'flex items-center px-[10px] py-[8px] text-[13px]',
              'italic',
            )
          : hasControls
            ? 'px-2 py-1.5 text-[12px] leading-5'
            : undefined
      }
      placeholderTestId={completion ? 'composer-reply-completion' : undefined}
      onAcceptCompletion={onAcceptCompletion}
      onDismissCompletion={onDismissCompletion}
      inputRef={inputRef}
      commandEntries={commandEntries}
      commandDisabled={commandDisabled}
      commandSkillLabel={commandSkillLabel}
      commandInstantLabel={commandInstantLabel}
      onCommandAction={onCommandAction}
      onBrowsePromptHistory={onBrowsePromptHistory}
      editorClassName={cn(
        'max-h-[120px] overflow-y-auto overscroll-contain',
        hasControls && 'min-h-[34px] border-0 px-2 py-1.5 leading-5',
      )}
      editorStyle={{ maxHeight: 120, overflowY: 'auto', overscrollBehavior: 'contain' }}
    />
  )
}

function ComposerSendButton({
  canSend,
  entries,
  input,
  inputRef,
  label,
  onSend,
}: {
  canSend: boolean
  entries: VaultEntry[]
  input: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  label: string
  onSend: (text: string, references: NoteReference[]) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors"
      style={composerSendButtonStyle(canSend)}
      onClick={() => {
        const editor = inputRef?.current
        const live = editor
          ? normalizeInlineWikilinkValue(serializeInlineNode(editor))
          : input
        onSend(live, extractInlineWikilinkReferences(live, entries))
      }}
      disabled={!canSend}
      aria-label={label}
      title={`${label} (↵) · New line (⇧↵)`}
      data-testid="agent-send"
    >
      <PaperPlaneRight size={16} />
    </Button>
  )
}

function ComposerStopButton({
  label,
  onStop,
  entries,
  input,
  inputRef,
  onSteer,
}: {
  label: string
  onStop: () => void
  entries?: VaultEntry[]
  input?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  onSteer?: (text: string, references: NoteReference[]) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 flex items-center justify-center border-none cursor-pointer transition-colors hover:opacity-90"
      style={composerStopButtonStyle()}
      onClick={() => {
        // Mid-turn chrome shows Stop when React's draft is empty. Automation
        // and some paste paths can leave real text in the contenteditable
        // without syncing React — prefer that text as a steer, not a stop.
        if (onSteer) {
          const editor = inputRef?.current
          const live = editor
            ? normalizeInlineWikilinkValue(serializeInlineNode(editor))
            : (input ?? '')
          if (live.trim().length > 0) {
            onSteer(live, extractInlineWikilinkReferences(live, entries ?? []))
            return
          }
        }
        onStop()
      }}
      aria-label={label}
      title={label}
      data-testid="agent-stop"
    >
      <Stop size={16} weight="fill" />
    </Button>
  )
}

function ComposerControlsRow({
  children,
  hasControls,
  sendButton,
}: {
  children?: ReactNode
  hasControls: boolean
  sendButton: ReactNode
}) {
  if (!hasControls) return <>{sendButton}</>

  return (
    <div className="mt-0.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {children}
      </div>
      {sendButton}
    </div>
  )
}

function ComposerReplySuggestions({
  lastAgentMessage,
  isActive,
  input,
  onChange,
}: {
  lastAgentMessage?: string | null
  isActive: boolean
  /** What is already typed. Suggestions are for an empty box, not a full one. */
  input: string
  onChange: (value: string) => void
}) {
  // Once you start typing you have answered the question your own way, and a
  // row of alternatives is clutter — worse, picking one would wipe what you
  // wrote. Hidden rather than disabled: a dead control still asks to be read.
  // Backspacing to empty brings them back, so nothing is lost by starting to
  // type and changing your mind.
  if (input.trim().length > 0) {
    return null
  }

  // Never show suggestions while streaming, and only show if there's a message to analyze.
  if (isActive || !lastAgentMessage) {
    return null
  }

  const suggestion = suggestReply(lastAgentMessage)

  // Render nothing if no options are suggested.
  if (!suggestion || suggestion.kind !== 'options') {
    return null
  }

  return (
    <div
      className="mb-1.5 flex min-w-0 flex-wrap gap-1.5"
      data-testid="composer-reply-suggestions"
    >
      {suggestion.options.map((option) => (
        <Button
          key={option.label}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-3 py-1.5 text-xs font-normal"
          onClick={() => onChange(option.text)}
          data-testid="composer-reply-suggestion"
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function permissionModeTooltip(
  mode: AiAgentPermissionMode,
  t: ReturnType<typeof createTranslator>,
): { label: string } {
  return {
    label: t(mode === 'power_user'
      ? 'ai.permission.powerUser.tooltip'
      : 'ai.permission.safe.tooltip'),
  }
}

function headerStatusText({
  agentLabel,
  agentReadiness,
  agentStatus,
  sendError,
  modeLabel,
  modelLabel,
  t,
}: {
  agentLabel: string
  agentReadiness: AiAgentReadiness
  agentStatus?: 'idle' | 'thinking' | 'tool-executing' | 'done' | 'error'
  sendError?: string | null
  modeLabel: string
  modelLabel?: string | null
  t: ReturnType<typeof createTranslator>
}): string {
  if (agentReadiness === 'checking') return t('ai.panel.status.checking')
  if (agentReadiness === 'missing') return t('ai.panel.status.missing', { agent: agentLabel })
  if (agentStatus === 'thinking') return t('ai.panel.status.working', { agent: agentLabel })
  if (agentStatus === 'tool-executing') return t('ai.panel.status.tools', { agent: agentLabel })
  if (agentStatus === 'error') {
    const reason = sendError ? workerStartFailureReason(sendError) : null
    return reason ?? t('ai.panel.status.error', { agent: agentLabel })
  }
  const ready = t('ai.panel.status.ready', { agent: agentLabel, mode: modeLabel })
  const model = modelLabel?.trim()
  return model ? t('ai.panel.status.readyWithModel', { agent: agentLabel, mode: modeLabel, model }) : ready
}

function AiPanelEmptyState({
  agentLabel,
  agentReadiness,
  hasContext,
  locale = 'en',
}: Pick<AiPanelMessageHistoryProps, 'agentLabel' | 'agentReadiness' | 'hasContext' | 'locale'>) {
  const t = createTranslator(locale)

  if (agentReadiness === 'checking') {
    return (
      <div
        className="flex min-h-full flex-col items-center justify-center text-center text-muted-foreground"
      >
        <Sparkle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>
          {t('ai.panel.empty.checkingTitle')}
        </p>
        <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
          {t('ai.panel.empty.checkingDescription')}
        </p>
      </div>
    )
  }

  if (agentReadiness === 'missing') {
    return (
      <div
        className="flex min-h-full flex-col items-center justify-center text-center text-muted-foreground"
      >
        <Sparkle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>
          {t('ai.panel.empty.missingTitle', { agent: agentLabel })}
        </p>
        <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
          {t('ai.panel.empty.missingDescription')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center text-center text-muted-foreground"
    >
      <Sparkle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
      <p style={{ fontSize: 13, margin: '0 0 4px' }}>
        {hasContext
          ? t('ai.panel.empty.withContextTitle', { agent: agentLabel })
          : t('ai.panel.empty.noContextTitle', { agent: agentLabel })
        }
      </p>
      <p style={{ fontSize: 11, margin: 0 }}>
        {hasContext
          ? t('ai.panel.empty.withContextDescription')
          : t('ai.panel.empty.noContextDescription')
        }
      </p>
    </div>
  )
}

export const AiPanelHeader = memo(function AiPanelHeader({
  agentLabel,
  agentReadiness,
  agentStatus = 'idle',
  sendError = null,
  modelLabel = null,
  targetKind = 'agent',
  locale = 'en',
  permissionMode,
  permissionModeDisabled,
  onPermissionModeChange,
  hidePermissionMode = false,
  skillsLabel = null,
  onClose,
  onNewChat,
}: AiPanelHeaderProps) {
  const t = createTranslator(locale)
  const modeLabel = hidePermissionMode
    ? t('ai.panel.mode.harness')
    : targetKind === 'api_model'
      ? t('ai.panel.mode.chat')
      : aiAgentPermissionModeLabels(permissionMode, locale).short
  const working = agentStatus === 'thinking' || agentStatus === 'tool-executing'

  return (
    <div
      className="flex shrink-0 flex-col border-b border-border"
      style={{ padding: '8px 12px', gap: 8 }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <Sparkle
          size={16}
          className={working ? 'shrink-0 animate-pulse text-foreground' : 'shrink-0 text-muted-foreground'}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
            {t('ai.panel.title')}
          </span>
          <span className="truncate text-[11px] text-muted-foreground" data-agent-status={agentStatus}>
            {headerStatusText({ agentLabel, agentReadiness, agentStatus, sendError, modeLabel, modelLabel, t })}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 p-0 [&_svg:not([class*=size-])]:size-4"
          onClick={onNewChat}
          aria-label={t('ai.panel.newChat')}
          title={t('ai.panel.newChat')}
        >
          <Plus size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 p-0 [&_svg:not([class*=size-])]:size-4"
          onClick={onClose}
          aria-label={t('ai.panel.close')}
          title={t('ai.panel.close')}
        >
          <X size={16} />
        </Button>
      </div>
      {hidePermissionMode ? (
        <div
          className="rounded-md border border-border bg-muted px-3 py-2 text-[11px] leading-5 text-muted-foreground"
          data-testid="ai-harness-skills"
        >
          {skillsLabel
            ? t('ai.panel.skills.withVault', { skills: skillsLabel })
            : t('ai.panel.skills.default')}
        </div>
      ) : targetKind === 'agent' ? (
        <AiPermissionModeToggle
          value={permissionMode}
          locale={locale}
          disabled={permissionModeDisabled}
          onChange={onPermissionModeChange}
        />
      ) : (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          {t('ai.panel.mode.chatDescription')}
        </div>
      )}
    </div>
  )
})

function AiPermissionModeToggle({
  value,
  locale = 'en',
  disabled,
  onChange,
}: {
  value: AiAgentPermissionMode
  locale?: AppLocale
  disabled: boolean
  onChange: (mode: AiAgentPermissionMode) => void
}) {
  const t = createTranslator(locale)

  return (
    <TooltipProvider>
      <div
        className="inline-flex w-full rounded-md border border-border bg-muted p-1"
        role="radiogroup"
        aria-label={t('ai.permission.modeAria')}
        data-testid="ai-permission-mode-toggle"
      >
        {(['safe', 'power_user'] as const).map((mode) => {
          const selected = value === mode
          return (
            <ActionTooltip
              key={mode}
              copy={permissionModeTooltip(mode, t)}
              side="bottom"
              contentTestId="ai-permission-mode-tooltip"
            >
              <Button
                type="button"
                size="sm"
                variant="ghost"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                className={
                  selected
                    ? 'h-7 flex-1 border border-border bg-background text-foreground shadow-xs hover:bg-background'
                    : 'h-7 flex-1 text-muted-foreground hover:text-foreground'
                }
                onClick={() => onChange(mode)}
              >
                {aiAgentPermissionModeLabels(mode, locale).control}
              </Button>
            </ActionTooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

/**
 * How close to the bottom still counts as "reading the live output".
 * Generous enough to survive sub-pixel rounding and a partly-drawn last line,
 * tight enough that one deliberate scroll up releases the stream.
 */
const FOLLOW_THRESHOLD_PX = 48

export const AiPanelMessageHistory = memo(function AiPanelMessageHistory({
  agentLabel,
  agentReadiness,
  locale = 'en',
  messages,
  isActive,
  onForkMessage,
  forkTargetsPrimeEntry = false,
  onOpenNote,
  onNavigateWikilink,
  onRegenerateMessage,
  onPromoteToVault,
  onScrollStateChange,
  hasContext,
}: AiPanelMessageHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const { onMouseDown: onDragRegionMouseDown } = useDragRegion<HTMLDivElement>()
  // Following the stream is a mode, not an event: true while the reader is
  // parked at the bottom, false the moment they scroll up to read. Starts
  // true so a freshly opened conversation lands at the newest turn.
  const followingRef = useRef(true)
  const messageCountRef = useRef(messages.length)

  const updateScrollState = useCallback(() => {
    const element = containerRef.current
    if (element) {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
      followingRef.current = distanceFromBottom <= FOLLOW_THRESHOLD_PX
    }
    onScrollStateChange?.((element?.scrollTop ?? 0) > 1)
  }, [onScrollStateChange])

  useEffect(() => {
    void isActive
    // A longer response is output arriving on its own; a longer list is the
    // reader sending. Only the second one earns yanking them to the bottom.
    const sent = messages.length > messageCountRef.current
    messageCountRef.current = messages.length
    if (sent) followingRef.current = true

    if (followingRef.current) endRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(updateScrollState)
    else updateScrollState()
  }, [messages, isActive, updateScrollState])

  const latestReplyIndex = latestAssistantMessageIndex(messages)

  return (
    // `min-h-0` is load-bearing: a flex item defaults to `min-height: auto`,
    // so without it this refuses to shrink below its content and scrolls
    // nothing however tall the transcript gets.
    <div
      ref={containerRef}
      className="chat-transcript min-h-0 flex-1 overflow-y-auto"
      style={{ padding: 12 }}
      onScroll={updateScrollState}
      onMouseDown={onDragRegionMouseDown}
      data-testid="ai-panel-message-history"
    >
      <div className="chat-column">
        {messages.length === 0 && !isActive && (
          <AiPanelEmptyState
            agentLabel={agentLabel}
            agentReadiness={agentReadiness}
            locale={locale}
            hasContext={hasContext}
          />
        )}
        {messages.map((message, index) => (
          <AiMessage
            key={message.id ?? index}
            {...message}
            locale={locale}
            isLatestReply={index === latestReplyIndex}
            messageId={message.id}
            // ChatHome forks the Prime session and needs its entry id, which
            // only replayed turns carry; the AI workspace copies its own
            // conversation and uses the local id.
            forkTargetId={forkTargetsPrimeEntry ? message.primeEntryId : message.id}
            onFork={onForkMessage}
            onOpenNote={onOpenNote}
            onNavigateWikilink={onNavigateWikilink}
            onRegenerate={onRegenerateMessage}
            onPromoteToVault={onPromoteToVault}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
})

export function AiPanelComposer({
  entries,
  agentLabel,
  agentReadiness,
  locale = 'en',
  input,
  inputRef,
  isActive,
  controls,
  onChange,
  onSend,
  onStop,
  onSteer,
  queue,
  onClearQueue,
  onUnsupportedAiPaste,
  attachments = [],
  onAttachImages,
  onRemoveAttachment,
  foot,
  commandEntries,
  commandDisabled,
  commandSkillLabel,
  commandInstantLabel,
  onCommandAction,
  lastAgentMessage,
}: AiPanelComposerProps) {
  const t = createTranslator(locale)
  const { recordSent, browse } = useComposerPromptHistory(onChange)
  const [dismissedCompletionFor, setDismissedCompletionFor] = useState<string | null>(null)
  const replySuggestion = !isActive && lastAgentMessage ? suggestReply(lastAgentMessage) : null
  const completionText =
    replySuggestion?.kind === 'completion'
    && input.trim().length === 0
    && dismissedCompletionFor !== lastAgentMessage
      ? replySuggestion.text
      : null

  useEffect(() => {
    if (!completionText) return
    trackComposerReplyCompletionShown()
  }, [completionText, lastAgentMessage])

  const handleAcceptCompletion = useCallback(() => {
    if (!completionText) return false
    onChange(completionText)
    trackComposerReplyCompletionAccepted()
    return true
  }, [completionText, onChange])

  const handleDismissCompletion = useCallback(() => {
    if (!completionText || !lastAgentMessage) return false
    setDismissedCompletionFor(lastAgentMessage)
    trackComposerReplyCompletionDismissed()
    return true
  }, [completionText, lastAgentMessage])

  const handleSend = useCallback((text: string, references: NoteReference[]) => {
    recordSent(text)
    onSend(text, references)
  }, [onSend, recordSent])
  const handleSteer = useCallback((text: string, references: NoteReference[]) => {
    if (!onSteer) return
    recordSent(text)
    onSteer(text, references)
  }, [onSteer, recordSent])
  // Steering keeps the input live during a turn. Without an onSteer handler the
  // composer locks while streaming, exactly as it did before.
  const canSteer = isActive && typeof onSteer === 'function'
  const composerDisabled = (isActive && !canSteer) || agentReadiness !== 'ready'
  const hasInput = input.trim().length > 0
  // An attachment is a message. Pasting a screenshot and asking nothing is
  // the ordinary case for "what is this?", so it must be sendable alone.
  const hasPayload = hasInput || attachments.length > 0
  const canSend = !composerDisabled && hasPayload
  const placeholder = getComposerPlaceholder(agentLabel, agentReadiness, t)
  const hasControls = controls !== undefined && controls !== null
  // While a turn runs: typed text steers it, empty input stops it. The button
  // says which, so the affordance is never ambiguous.
  const sendButton = isActive
    ? (canSteer && hasPayload
        ? (
            <ComposerSendButton
              canSend
              entries={entries}
              input={input}
              inputRef={inputRef}
              label={t('ai.panel.steer')}
              onSend={handleSteer}
            />
          )
        : (
            <ComposerStopButton
              label={t('ai.panel.stop')}
              onStop={onStop}
              {...(canSteer
                ? { entries, input, inputRef, onSteer: handleSteer }
                : {})}
            />
          ))
    : (
        <ComposerSendButton
          canSend={canSend}
          entries={entries}
          input={input}
          inputRef={inputRef}
          label={t('ai.panel.send')}
          onSend={handleSend}
        />
      )

  return (
    <div
      className="chat-column flex shrink-0 flex-col"
      style={{ padding: '6px 10px' }}
    >
      {hasControls ? (
        <div className="mb-1.5 min-w-0">
          {controls}
        </div>
      ) : null}
      <ComposerReplySuggestions
        lastAgentMessage={lastAgentMessage}
        isActive={isActive}
        input={input}
        onChange={onChange}
      />
      {queue && !primeQueueIsEmpty(queue) ? (
        <div
          className="mb-2 flex min-w-0 flex-col gap-1"
          data-testid="composer-queued-follow-ups"
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground">
              {t('ai.panel.queuedLabel')}
            </span>
            {onClearQueue ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                data-testid="composer-queue-clear"
                onClick={onClearQueue}
              >
                <X size={10} aria-hidden="true" />
                {t('ai.panel.queuedClear')}
              </Button>
            ) : null}
          </div>
          <ul
            className="flex min-w-0 flex-col gap-1"
            aria-label={t('ai.panel.queuedLabel')}
          >
            {primeQueueItems(queue).map((item) => (
              <li
                key={`${item.lane}-${item.index}-${item.text}`}
                className="flex min-w-0 items-center gap-1.5 font-mono text-[12px]"
                data-testid={item.lane === 'steer' ? 'composer-queued-steer' : 'composer-queued-follow-up'}
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">
                    {item.lane === 'steer' ? t('ai.panel.queuedSteer') : t('ai.panel.queuedFollowUp')}
                    {' · '}
                  </span>
                  <span className="text-foreground">{item.text}</span>
                </span>
                <PrimeQueueItemActions item={item} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {attachments.length > 0 ? (
        <ul
          className="mb-1.5 flex min-w-0 flex-wrap gap-1.5"
          data-testid="composer-attachments"
          aria-label={t('ai.composer.attachments')}
        >
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-md border border-border',
                'bg-muted px-2 py-1 text-[11px] text-foreground',
              )}
            >
              <ImageSquare size={12} weight="regular" aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <span className="max-w-[160px] truncate">{attachment.name}</span>
              {onRemoveAttachment ? (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  data-testid={`composer-attachment-remove-${attachment.id}`}
                  aria-label={t('ai.composer.attachmentRemove', { name: attachment.name })}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={cn(
        'flex items-end gap-2',
        hasControls && 'rounded-xl border border-border bg-background px-2 py-1.5 shadow-xs',
      )}>
        <div className="min-w-0 flex-1">
          <ComposerInput
            disabled={composerDisabled}
            entries={entries}
            hasControls={hasControls}
            input={input}
            inputRef={inputRef}
            onChange={onChange}
            onSend={handleSend}
            onUnsupportedAiPaste={onUnsupportedAiPaste}
            onImagePaste={onAttachImages}
            unsupportedPasteMessage={t('ai.composer.pasteTextOnly')}
            placeholder={placeholder}
            completion={completionText}
            onAcceptCompletion={handleAcceptCompletion}
            onDismissCompletion={handleDismissCompletion}
            commandEntries={commandEntries}
            commandDisabled={commandDisabled}
            commandSkillLabel={commandSkillLabel}
            commandInstantLabel={commandInstantLabel}
            onCommandAction={onCommandAction}
            onBrowsePromptHistory={browse}
          />
        </div>
        <ComposerControlsRow hasControls={false} sendButton={sendButton} />
      </div>
      {foot}
    </div>
  )
}
