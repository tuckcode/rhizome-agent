import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ArrowClockwise,
  Brain,
  CaretDown,
  CaretRight,
  CircleNotch,
  Copy,
  FloppyDisk,
  GitFork,
  SpeakerHigh,
  Square,
  Terminal,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AiActionCard, type AiActionStatus } from './AiActionCard'
import { MarkdownContent } from './MarkdownContent'
import { ReplySelectionPill } from './ReplySelectionPill'
import { translate, type AppLocale } from '../lib/i18n'
import { normalizeReasoningDisplay } from '../lib/normalizeReasoningDisplay'
import { visibleUserText } from '../utils/ai-chat'
import { isSupportedImageType, type PrimeImageContent } from '../lib/composerAttachments'
import type { NoteReference } from '../utils/ai-context'
import { writeClipboardText } from '../utils/clipboardText'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { groupConsecutiveToolActions } from '../lib/groupConsecutiveToolActions'
import { trackVaultRetrievalSourceOpened } from '../lib/productAnalytics'
import { trackEvent } from '../lib/telemetry'
import { insertAiComposerQuote } from '../utils/aiPromptBridge'
import { useDisplayTimeZone } from '../hooks/useAppPreferences'
import { formatMessageClock } from '../utils/messageTimestamp'
import { presentWorkerStartFailure } from '../lib/primeWorkerStartError'
import { toggleReadAloud, useReadAloud } from '../lib/readAloudPlayer'

export interface AiAction {
  tool: string
  toolId: string
  label: string
  path?: string
  status: AiActionStatus
  input?: string
  output?: string
}

export interface AiMessageProps {
  userMessage: string
  references?: NoteReference[]
  localMarker?: string
  locale?: AppLocale
  messageId?: string
  /** Entry to fork from; hosts differ, see ResponseActions. */
  forkTargetId?: string
  reasoning?: string
  reasoningDone?: boolean
  actions: AiAction[]
  response?: string
  isStreaming?: boolean
  /** When this turn was created (ms). Shown as a small clock under the ask. */
  createdAtMs?: number
  /** Images pasted with this turn. Shown in the user bubble. */
  images?: PrimeImageContent[]
  /** Find-aid: green dot left of the first line of the newest assistant reply. */
  isLatestReply?: boolean
  onFork?: (messageId: string) => void
  onOpenNote?: (path: string) => void
  onNavigateWikilink?: (target: string) => void
  onRegenerate?: (messageId: string) => void
  onPromoteToVault?: (text: string) => void
}

function LocalMarker({ text }: { text: string }) {
  const [title, ...rest] = text.split('\n')
  const detail = rest.join('\n').trim()
  return (
    <div
      className="mx-auto flex w-full max-w-[85%] flex-col items-center gap-1 text-center font-mono text-[11px] tracking-[0.02em] text-muted-foreground"
      style={{ margin: '12px 0 16px' }}
      data-testid="ai-local-marker"
      data-no-drag
      role="note"
    >
      <span className="flex w-full items-center gap-2">
        <span className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
        <span className="shrink-0">{title}</span>
        <span className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
      </span>
      {detail ? <span className="max-w-full truncate">{detail}</span> : null}
    </div>
  )
}

function ReferencePill({ reference, onClick }: {
  reference: NoteReference
  onClick?: (path: string) => void
}) {
  const type = reference.type ?? null
  const color = getTypeColor(type)
  const lightColor = getTypeLightColor(type)
  return (
    <button type="button"
      className="inline-flex items-center border-none cursor-pointer transition-opacity hover:opacity-80"
      style={{
        background: lightColor,
        color,
        borderRadius: 9999,
        padding: '1px 8px',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'inherit',
        lineHeight: 1.4,
      }}
      onClick={() => onClick?.(reference.path)}
      data-testid="message-reference-pill"
    >
      {reference.title}
    </button>
  )
}

function userImageSrc(image: PrimeImageContent): string | null {
  if (!isSupportedImageType(image.mimeType) || !image.data) return null
  return `data:${image.mimeType};base64,${image.data}`
}

function UserBubble({ content, images, references, onOpenNote, createdAtMs }: {
  content: string
  images?: PrimeImageContent[]
  references?: NoteReference[]
  onOpenNote?: (path: string) => void
  createdAtMs?: number
}) {
  const displayTimeZone = useDisplayTimeZone()
  const clock = typeof createdAtMs === 'number' ? formatMessageClock(createdAtMs, displayTimeZone) : ''
  return (
    <div className="flex flex-col items-end" style={{ marginBottom: 8 }}>
      {/*
        Tinted with the accent rather than `--state-hover`, and carrying a
        2px accent rule down its right edge.

        The rule is the part that matters. An answer runs for screens, so
        scrolling back to "where did I ask this?" means hunting for a boundary
        in a wall of prose — and `--state-hover` is a hover affordance,
        deliberately almost invisible, so it never caught the eye. The bubble
        is right-aligned, which puts its right edge at a fixed x: a rule there
        forms a rhythm down the margin that reads while scrolling fast, when
        text does not.
      */}
      <div
        className="min-w-0 max-w-[85%] overflow-hidden"
        style={{
          background: 'var(--accent-blue-bg)',
          color: 'var(--foreground)',
          borderRight: '2px solid var(--accent-blue)',
          borderRadius: '12px 12px 2px 12px',
          maxWidth: '85%',
          padding: '8px 12px',
          fontSize: 13,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
        }}
      >
        {references && references.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginBottom: 4 }}>
            {references.map(ref => (
              <ReferencePill key={ref.path} reference={ref} onClick={onOpenNote} />
            ))}
          </div>
        )}
        {images && images.length > 0 ? (
          <div className="flex flex-col gap-1.5" data-testid="user-message-images">
            {images.map((image, index) => {
              const src = userImageSrc(image)
              if (!src) return null
              return (
                <img
                  key={`${image.mimeType}-${index}`}
                  alt=""
                  src={src}
                  className="block max-h-40 max-w-full rounded-md"
                  data-testid="user-message-image"
                />
              )
            })}
          </div>
        ) : null}
        {visibleUserText(content)}
      </div>
      {clock ? (
        <time
          className="text-muted-foreground"
          dateTime={new Date(createdAtMs!).toISOString()}
          data-testid="message-timestamp"
          style={{ fontSize: 11, marginTop: 4, paddingRight: 2 }}
        >
          {clock}
        </time>
      ) : null}
    </div>
  )
}

/** Same slack as the transcript: one deliberate scroll up releases the tail. */
const REASONING_FOLLOW_THRESHOLD_PX = 48

function ReasoningBlock({ locale, text, expanded, onToggle }: {
  locale: AppLocale; text: string; expanded: boolean; onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const followingRef = useRef(true)

  function noteReadingPosition() {
    const element = contentRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    followingRef.current = distanceFromBottom <= REASONING_FOLLOW_THRESHOLD_PX
  }

  useEffect(() => {
    if (!expanded) {
      followingRef.current = true
      return
    }
    const element = contentRef.current
    if (!element || !followingRef.current) return
    element.scrollTop = element.scrollHeight
  }, [expanded, text])

  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button"
        className="flex items-center gap-1.5 w-full border-none bg-transparent cursor-pointer p-0 text-muted-foreground hover:text-foreground transition-colors"
        style={{ fontSize: 12, padding: '4px 0' }}
        aria-expanded={expanded}
        onClick={onToggle}
        data-testid="reasoning-toggle"
      >
        <Brain size={14} />
        <span>{translate(locale, 'ai.message.reasoning')}</span>
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </button>
      {expanded && (
        <div
          ref={contentRef}
          className="text-muted-foreground reasoning-markdown"
          style={{ fontSize: 12, lineHeight: 1.5, padding: '4px 0 4px 20px', maxHeight: 280, overflowY: 'auto' }}
          onScroll={noteReadingPosition}
          data-testid="reasoning-content"
        >
          <MarkdownContent content={normalizeReasoningDisplay(text)} />
        </div>
      )}
    </div>
  )
}

function ActionCardsList({ actions, onOpenNote, expandedIds, onToggleExpand }: {
  actions: AiAction[]
  onOpenNote?: (path: string) => void
  expandedIds: Set<string>
  onToggleExpand: (toolId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
      {groupConsecutiveToolActions(actions).map((action) => (
        <AiActionCard
          key={action.toolId}
          tool={action.tool}
          label={action.label}
          path={action.path}
          status={action.status}
          input={action.input}
          output={action.output}
          expanded={expandedIds.has(action.toolId)}
          onToggle={() => onToggleExpand(action.toolId)}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  )
}

function ToolUseBlock({
  actions,
  expanded,
  expandedActionIds,
  locale,
  onOpenNote,
  onToggle,
  onToggleAction,
}: {
  actions: AiAction[]
  expanded: boolean
  expandedActionIds: Set<string>
  locale: AppLocale
  onOpenNote?: (path: string) => void
  onToggle: () => void
  onToggleAction: (toolId: string) => void
}) {
  const pending = actions.some((action) => action.status === 'pending')

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground"
        style={{ fontSize: 12, padding: '4px 0' }}
        aria-expanded={expanded}
        onClick={onToggle}
        data-testid="tool-use-toggle"
      >
        <Terminal size={14} />
        <span>{translate(locale, 'ai.message.toolUse')}</span>
        <span
          className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full ${pending ? 'animate-pulse' : ''}`}
          style={{
            background: 'var(--state-hover)',
            color: 'var(--muted-foreground)',
            fontSize: 10,
            fontWeight: 600,
            padding: '0 5px',
          }}
          data-pending={pending || undefined}
          data-testid="tool-use-count"
        >
          {actions.length}
        </span>
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </button>
      {expanded && (
        <div data-testid="tool-use-content" style={{ marginTop: 4 }}>
          <ActionCardsList
            actions={actions}
            onOpenNote={onOpenNote}
            expandedIds={expandedActionIds}
            onToggleExpand={onToggleAction}
          />
        </div>
      )}
    </div>
  )
}

function ResponseActions({
  locale,
  messageId,
  forkTargetId,
  onCopy,
  onFork,
  onPromoteToVault,
  onRegenerate,
  onReadAloud,
  promoteDisabled = false,
  showReadAloud = false,
}: {
  locale: AppLocale
  messageId?: string
  onCopy: () => void
  onFork?: (messageId: string) => void
  onPromoteToVault?: () => void
  onRegenerate?: (messageId: string) => void
  onReadAloud?: () => void
  promoteDisabled?: boolean
  showReadAloud?: boolean
  /**
   * What a fork branches from. Hosts differ: the AI workspace copies its own
   * conversation and uses the local message id, ChatHome branches the Prime
   * session and needs its entry id — which only replayed turns have.
   */
  forkTargetId?: string
}) {
  const regenerateDisabled = !messageId || !onRegenerate
  const forkDisabled = !forkTargetId || !onFork
  const saveDisabled = promoteDisabled || !onPromoteToVault
  const regenerateLabel = translate(locale, 'ai.message.regenerate')
  const copyLabel = translate(locale, 'ai.message.copy')
  const saveLabel = translate(locale, 'ai.message.saveToVault')
  const forkLabel = translate(locale, 'ai.message.fork')
  const readAloud = useReadAloud()
  const readingThis = showReadAloud && messageId != null && readAloud.messageId === messageId
  const readAloudLabel = readingThis && readAloud.phase === 'playing'
    ? 'Stop reading'
    : 'Read aloud'

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="mt-1.5 flex flex-wrap items-center gap-0.5"
        data-testid="ai-message-actions"
      >
        <ActionTooltip copy={{ label: regenerateLabel }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            disabled={regenerateDisabled}
            aria-label={regenerateLabel}
            onClick={() => messageId && onRegenerate?.(messageId)}
            data-testid="ai-message-regenerate"
          >
            <ArrowClockwise size={14} aria-hidden="true" />
          </Button>
        </ActionTooltip>
        {showReadAloud ? (
          <ActionTooltip copy={{ label: readAloud.error && readingThis ? readAloud.error : readAloudLabel }}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={readAloudLabel}
              onClick={onReadAloud}
              data-testid="ai-message-read-aloud"
            >
              {readingThis && readAloud.phase === 'loading' ? (
                <CircleNotch size={14} className="animate-spin" aria-hidden="true" />
              ) : readingThis && readAloud.phase === 'playing' ? (
                <Square size={14} weight="fill" aria-hidden="true" />
              ) : (
                <SpeakerHigh size={14} aria-hidden="true" />
              )}
            </Button>
          </ActionTooltip>
        ) : null}
        <ActionTooltip copy={{ label: copyLabel }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label={copyLabel}
            onClick={onCopy}
            data-testid="ai-message-copy"
          >
            <Copy size={14} aria-hidden="true" />
          </Button>
        </ActionTooltip>
        <ActionTooltip copy={{ label: saveLabel }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:text-primary"
            disabled={saveDisabled}
            aria-label={saveLabel}
            onClick={() => onPromoteToVault?.()}
            data-testid="ai-message-save-to-vault"
          >
            <FloppyDisk size={14} aria-hidden="true" />
          </Button>
        </ActionTooltip>
        <ActionTooltip copy={{ label: forkLabel }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            disabled={forkDisabled}
            aria-label={forkLabel}
            onClick={() => forkTargetId && onFork?.(forkTargetId)}
            data-testid="ai-message-fork"
          >
            <GitFork size={14} aria-hidden="true" />
          </Button>
        </ActionTooltip>
      </div>
    </TooltipProvider>
  )
}

function RetrievedNoteSources({
  actions,
  onOpenNote,
}: {
  actions: AiAction[]
  onOpenNote?: (path: string) => void
}) {
  const paths = [...new Set(actions.flatMap((action) => (
    action.tool === 'get_note' && action.status === 'done' && action.path
      ? [action.path]
      : []
  )))]

  if (paths.length === 0) return null

  return (
    <div
      className="mt-3 flex max-w-full flex-wrap items-center gap-1.5"
      data-testid="retrieved-note-sources"
      role="group"
      aria-label="Notes used from your vault"
    >
      <span className="text-xs text-muted-foreground">From your vault</span>
      {paths.map((path) => {
        const label = retrievedNoteSourceLabel(path)
        return (
          <Button
            key={path}
            type="button"
            variant="secondary"
            size="sm"
            className="max-w-full rounded-full text-xs font-normal"
            disabled={!onOpenNote}
            aria-label={`Open ${label}`}
            title={path}
            onClick={() => {
              trackVaultRetrievalSourceOpened(paths.length)
              onOpenNote?.(path)
            }}
          >
            <span className="max-w-64 truncate">{label}</span>
          </Button>
        )
      })}
    </div>
  )
}

function retrievedNoteSourceLabel(path: string): string {
  const normalized = path.replace(/\\/gu, '/')
  const absolute = normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized)
  return absolute ? (normalized.split('/').filter(Boolean).pop() ?? path) : path
}

function LatestReplyMarker() {
  return (
    <span
      data-testid="latest-assistant-reply-marker"
      aria-hidden="true"
      className="pointer-events-none absolute top-[0.55em] -left-2.5 size-1.5 rounded-full bg-[var(--accent-green)]"
    />
  )
}

function ResponseBlock({
  actions,
  locale,
  messageId,
  forkTargetId,
  onFork,
  onOpenNote,
  onNavigateWikilink,
  onPromoteToVault,
  onRegenerate,
  text,
  isLatestReply = false,
  isStreaming = false,
}: {
  actions: AiAction[]
  locale: AppLocale
  messageId?: string
  forkTargetId?: string
  onFork?: (messageId: string) => void
  onOpenNote?: (path: string) => void
  onNavigateWikilink?: (target: string) => void
  onPromoteToVault?: (text: string) => void
  onRegenerate?: (messageId: string) => void
  text: string
  isLatestReply?: boolean
  isStreaming?: boolean
}) {
  const handleCopy = useCallback(() => {
    void writeClipboardText(text).catch((error) => {
      console.warn('[ai] Failed to copy assistant message:', error)
    })
  }, [text])
  const handlePromote = useCallback(() => {
    onPromoteToVault?.(text)
  }, [onPromoteToVault, text])

  return (
    <div className="relative min-w-0 max-w-full" style={{ marginBottom: 4 }}>
      {isLatestReply ? <LatestReplyMarker /> : null}
      <div
        className="group/ai-response min-w-0 max-w-full overflow-hidden"
        data-testid="ai-response-block"
        data-reply-id={messageId}
      >
        <ReplySelectionPill
          onAdd={(excerpt) => {
            insertAiComposerQuote(excerpt, messageId)
            trackEvent('chat_reply_quote_added', { length: excerpt.length, linked: messageId ? 1 : 0 })
          }}
        >
          <MarkdownContent content={text} onWikilinkClick={onNavigateWikilink} />
        </ReplySelectionPill>
        <RetrievedNoteSources actions={actions} onOpenNote={onOpenNote} />
        <ResponseActions
          locale={locale}
          messageId={messageId}
          forkTargetId={forkTargetId}
          onCopy={handleCopy}
          onFork={onFork}
          onPromoteToVault={onPromoteToVault ? handlePromote : undefined}
          onRegenerate={onRegenerate}
          onReadAloud={() => messageId && void toggleReadAloud(messageId, text)}
          promoteDisabled={!text.trim()}
          showReadAloud={!isStreaming && Boolean(text.trim()) && Boolean(messageId)}
        />
      </div>
    </div>
  )
}

function StreamingIndicator({ isLatestReply = false }: { isLatestReply?: boolean }) {
  return (
    <div
      className="relative flex items-center gap-2 text-muted-foreground"
      style={{ fontSize: 12, marginTop: 8, padding: 0 }}
    >
      {isLatestReply ? <LatestReplyMarker /> : null}
      <div className="flex gap-1">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
        <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

export function AiMessage(props: AiMessageProps) {
  if (props.localMarker) {
    return <LocalMarker text={props.localMarker} />
  }

  return <ConversationMessage {...props} />
}

function ConversationMessage({ userMessage, images, references, locale = 'en', messageId, forkTargetId, reasoning, reasoningDone, actions, response, isStreaming, createdAtMs, isLatestReply = false, onFork, onOpenNote, onNavigateWikilink, onPromoteToVault, onRegenerate }: AiMessageProps) {
  // Manual override: null = follow auto behavior, true/false = user forced
  const [userOverride, setUserOverride] = useState<boolean | null>(null)
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())
  const [toolUseExpanded, setToolUseExpanded] = useState(false)

  // Auto: expanded while reasoning streams, collapsed once done
  // User can manually toggle to override the auto state
  // Once the user has decided, their choice holds. The override used to be a plain
  // boolean read as `userOverride ? !autoExpanded : autoExpanded`, which inverted
  // against autoExpanded rather than storing a state -- so a block collapsed during
  // streaming re-opened itself the moment reasoningDone flipped.
  const autoExpanded = !reasoningDone
  const reasoningExpanded = userOverride ?? autoExpanded
  const reasoningVisible = Boolean(reasoning && normalizeReasoningDisplay(reasoning).trim())

  const toggleAction = useCallback((toolId: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev)
      if (next.has(toolId)) next.delete(toolId)
      else next.add(toolId)
      return next
    })
  }, [])

  return (
    <div
      className="min-w-0 max-w-full"
      data-testid="ai-message"
      data-no-drag
      style={{ marginBottom: 16 }}
    >
      <UserBubble
        content={userMessage}
        images={images}
        references={references}
        onOpenNote={onOpenNote}
        createdAtMs={createdAtMs}
      />
      {reasoningVisible && reasoning ? (
        <ReasoningBlock
          locale={locale}
          text={reasoning}
          expanded={reasoningExpanded}
          onToggle={() => setUserOverride(prev => !(prev ?? autoExpanded))}
        />
      ) : null}
      {actions.length > 0 && (
        <ToolUseBlock
          actions={actions}
          expanded={toolUseExpanded}
          expandedActionIds={expandedActions}
          locale={locale}
          onOpenNote={onOpenNote}
          onToggle={() => setToolUseExpanded((current) => !current)}
          onToggleAction={toggleAction}
        />
      )}
      {response && (
        <ResponseBlock
          actions={actions}
          locale={locale}
          messageId={messageId}
          forkTargetId={forkTargetId}
          text={presentWorkerStartFailure(response) ?? response}
          onFork={onFork}
          onOpenNote={onOpenNote}
          onNavigateWikilink={onNavigateWikilink}
          onPromoteToVault={onPromoteToVault}
          onRegenerate={onRegenerate}
          isLatestReply={isLatestReply}
          isStreaming={isStreaming}
        />
      )}
      {isStreaming && !response && <StreamingIndicator isLatestReply={isLatestReply} />}
    </div>
  )
}
