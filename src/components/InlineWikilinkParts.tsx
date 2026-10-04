import { Fragment, createElement, useEffect, useImperativeHandle, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { VaultEntry } from '../types'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { NoteTitleIcon } from './NoteTitleIcon'
import { getTypeIcon } from './note-item/typeIcon'
import { Quotes } from '@phosphor-icons/react'
import { focusQuotedReply } from '../lib/replyQuote'
import type {
  InlineReplyQuote,
  InlineWikilinkChip,
  InlineWikilinkSegment,
} from './inlineWikilinkText'
import type { InlineWikilinkSuggestion } from './inlineWikilinkSuggestions'
import { cn } from '@/lib/utils'

function withNativeEvent<T extends Event>(event: T): T & { nativeEvent: T } {
  const eventWithNativeEvent = event as T & { nativeEvent?: T }
  if (!eventWithNativeEvent.nativeEvent) {
    Object.defineProperty(event, 'nativeEvent', {
      configurable: true,
      value: event,
    })
  }
  return event as T & { nativeEvent: T }
}

export function InlineWikilinkChipView({
  chip,
  typeEntryMap,
}: {
  chip: InlineWikilinkChip
  typeEntryMap: Record<string, VaultEntry>
}) {
  const typeEntry = chip.entry.isA ? typeEntryMap[chip.entry.isA] : undefined
  const color = getTypeColor(chip.entry.isA, typeEntry?.color)
  const backgroundColor = getTypeLightColor(chip.entry.isA, typeEntry?.color)
  const typeIcon = getTypeIcon(chip.entry.isA, typeEntry?.icon)

  return (
    <span
      contentEditable={false}
      data-chip-target={chip.target}
      data-testid="inline-wikilink-chip"
      className="mx-[1px] inline-flex max-w-full items-center gap-1 rounded-full align-baseline"
      style={{
        backgroundColor,
        color,
        padding: '1px 8px 1px 6px',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.5,
      }}
    >
      {chip.entry.icon ? (
        <NoteTitleIcon icon={chip.entry.icon} size={11} color={color} />
      ) : (
        createElement(typeIcon, {
          'aria-hidden': true,
          width: 11,
          height: 11,
          className: 'shrink-0',
        })
      )}
      <span className="truncate">{chip.entry.title}</span>
    </span>
  )
}

export function InlineReplyQuoteView({ quote }: { quote: InlineReplyQuote }) {
  const linked = quote.messageId.length > 0
  return (
    <span
      contentEditable={false}
      data-reply-quote={quote.token}
      data-message-id={linked ? quote.messageId : undefined}
      data-testid="composer-reply-quote"
      role={linked ? 'button' : undefined}
      tabIndex={-1}
      aria-label={linked ? 'Quoted from this reply' : 'Quoted reply'}
      title={quote.text}
      className="mx-[1px] inline-flex max-w-[240px] cursor-pointer items-center gap-1 align-baseline border-l-2 pl-1.5 text-[12px] italic"
      style={{
        color: 'var(--link-color)',
        borderLeftColor: 'var(--link-color)',
        backgroundColor: 'color-mix(in srgb, var(--link-color) 14%, transparent)',
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => focusQuotedReply(quote.messageId)}
    >
      <Quotes size={12} aria-hidden="true" className="shrink-0" />
      <span className="truncate">“{quote.text}”</span>
    </span>
  )
}

function InlineSuggestionRow({
  suggestion,
  selected,
  onHover,
  onSelect,
  typeEntryMap,
}: {
  suggestion: InlineWikilinkSuggestion
  selected: boolean
  onHover: () => void
  onSelect: () => void
  typeEntryMap: Record<string, VaultEntry>
}) {
  const typeEntry = suggestion.entry.isA ? typeEntryMap[suggestion.entry.isA] : undefined
  const color = getTypeColor(suggestion.entry.isA, typeEntry?.color)
  const backgroundColor = getTypeLightColor(suggestion.entry.isA, typeEntry?.color)
  const typeIcon = getTypeIcon(suggestion.entry.isA, typeEntry?.icon)

  return (
    <button
      type="button"
      className={cn(
        'mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center justify-between rounded-md border-0 bg-transparent px-3 py-2 text-left transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary',
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor, color }}
        >
          {suggestion.entry.icon ? (
            <NoteTitleIcon icon={suggestion.entry.icon} size={11} color={color} />
          ) : (
            createElement(typeIcon, {
              'aria-hidden': true,
              width: 11,
              height: 11,
              className: 'shrink-0',
            })
          )}
        </span>
        <span className="truncate text-sm text-foreground">{suggestion.title}</span>
      </span>
      <span className="ml-3 shrink-0 text-[11px] text-muted-foreground">
        {suggestion.entry.isA ?? 'Note'}
      </span>
    </button>
  )
}

export function InlineWikilinkSuggestionList({
  suggestions,
  selectedIndex,
  onHover,
  onSelect,
  typeEntryMap,
  variant = 'floating',
  emptyLabel = 'No matching notes',
}: {
  suggestions: InlineWikilinkSuggestion[]
  selectedIndex: number
  onHover: (index: number) => void
  onSelect: (index: number) => void
  typeEntryMap: Record<string, VaultEntry>
  variant?: 'floating' | 'palette'
  emptyLabel?: string
}) {
  if (suggestions.length === 0) {
    return (
      <div className="px-4 py-5 text-center text-[13px] text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div
      className={variant === 'floating'
        ? 'absolute bottom-full left-0 right-0 z-10 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg'
        : 'py-1'}
      data-testid="wikilink-menu"
    >
      {suggestions.map((suggestion, index) => (
        <InlineSuggestionRow
          key={`${suggestion.entry.path}:${suggestion.target}`}
          suggestion={suggestion}
          selected={index === selectedIndex}
          onHover={() => onHover(index)}
          onSelect={() => onSelect(index)}
          typeEntryMap={typeEntryMap}
        />
      ))}
    </div>
  )
}

export function InlineWikilinkEditorField({
  value,
  placeholder,
  disabled,
  inputRef,
  dataTestId,
  placeholderClassName,
  placeholderTestId,
  editorClassName,
  editorStyle,
  onCompositionEnd,
  onCompositionStart,
  onCompositionUpdate,
  onInput,
  onKeyDown,
  onCut,
  onDrop,
  onPaste,
  onSelectionChange,
  segments,
  typeEntryMap,
}: {
  value: string
  placeholder?: string
  disabled: boolean
  inputRef: React.Ref<HTMLDivElement>
  dataTestId: string
  placeholderClassName?: string
  placeholderTestId?: string
  editorClassName?: string
  editorStyle?: CSSProperties
  onCompositionEnd: (editor: HTMLDivElement) => void
  onCompositionStart: () => void
  onCompositionUpdate: () => void
  onInput: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onCut: (event: React.ClipboardEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void
  onSelectionChange: () => void
  segments: InlineWikilinkSegment[]
  typeEntryMap: Record<string, VaultEntry>
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastSegment = segments[segments.length - 1]
  const needsTrailingCaretAnchor = lastSegment?.kind === 'chip' || lastSegment?.kind === 'quote'
  // An empty contenteditable has no line for the caret, so a click focuses
  // the box and the flashing line stays hidden until the first character.
  const needsEmptyCaret = value.length === 0
  useImperativeHandle(inputRef, () => editorRef.current as HTMLDivElement, [])
  useInlineWikilinkPlaceholder(editorRef, placeholder)
  useInlineWikilinkEditorEvents(editorRef, {
    onCompositionEnd,
    onCompositionStart,
    onCompositionUpdate,
    onCut,
    onDrop,
    onInput,
    onKeyDown,
    onPaste,
    onSelectionChange,
  })

  return (
    <div className="relative">
      {value.length === 0 && placeholder && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 text-muted-foreground',
            placeholderClassName ?? 'flex items-center',
          )}
          style={placeholderClassName ? undefined : { padding: '8px 10px', fontSize: 13 }}
          data-testid={placeholderTestId}
        >
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning={true}
        aria-disabled={disabled ? 'true' : undefined}
        data-testid={dataTestId}
        className={cn(
          'min-h-[34px] w-full rounded-lg border border-border bg-transparent px-[10px] py-[8px] text-[13px] text-foreground outline-none',
          disabled && 'cursor-not-allowed opacity-60',
          editorClassName,
        )}
        style={{ ...editorStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {segments.map((segment, index) => renderInlineWikilinkSegment(segment, typeEntryMap, index))}
        {needsEmptyCaret ? <br data-caret-anchor="" /> : null}
        {needsTrailingCaretAnchor ? '\u200B' : null}
      </div>
    </div>
  )
}

type InlineWikilinkEditorHandlers = Pick<
  Parameters<typeof InlineWikilinkEditorField>[0],
  | 'onCompositionEnd'
  | 'onCompositionStart'
  | 'onCompositionUpdate'
  | 'onCut'
  | 'onDrop'
  | 'onInput'
  | 'onKeyDown'
  | 'onPaste'
  | 'onSelectionChange'
>

function useInlineWikilinkPlaceholder(editorRef: React.RefObject<HTMLDivElement | null>, placeholder?: string) {
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    syncPlaceholderAttribute(editor, placeholder)
  }, [editorRef, placeholder])
}

function syncPlaceholderAttribute(editor: HTMLDivElement, placeholder?: string) {
  if (placeholder) {
    editor.setAttribute('aria-placeholder', placeholder)
    return
  }
  editor.removeAttribute('aria-placeholder')
}

function useInlineWikilinkEditorEvents(
  editorRef: React.RefObject<HTMLDivElement | null>,
  handlers: InlineWikilinkEditorHandlers,
) {
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const listenerMap = inlineWikilinkEditorListenerMap(handlers)
    const showCaret = () => placeCaretInEditor(editor)
    for (const [eventName, listener] of listenerMap) editor.addEventListener(eventName, listener)
    editor.addEventListener('focus', showCaret)
    editor.addEventListener('mouseup', showCaret)
    return () => {
      for (const [eventName, listener] of listenerMap) editor.removeEventListener(eventName, listener)
      editor.removeEventListener('focus', showCaret)
      editor.removeEventListener('mouseup', showCaret)
    }
  }, [editorRef, handlers])
}

/** Put the flashing caret in the box when a click focused it but left no selection. */
function placeCaretInEditor(editor: HTMLDivElement) {
  const selection = window.getSelection()
  if (!selection) return
  if (
    selection.rangeCount > 0
    && editor.contains(selection.anchorNode)
    && selection.anchorNode !== editor
  ) return
  const range = document.createRange()
  const anchor = editor.querySelector('[data-caret-anchor]') ?? editor.firstChild
  if (anchor?.nodeType === Node.TEXT_NODE) {
    range.setStart(anchor, 0)
    range.collapse(true)
  } else if (anchor) {
    range.setStartBefore(anchor)
    range.collapse(true)
  } else {
    range.selectNodeContents(editor)
    range.collapse(true)
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

function inlineWikilinkEditorListenerMap({
  onCompositionEnd,
  onCompositionStart,
  onCompositionUpdate,
  onCut,
  onDrop,
  onInput,
  onKeyDown,
  onPaste,
  onSelectionChange,
}: InlineWikilinkEditorHandlers): Array<[keyof HTMLElementEventMap, EventListener]> {
  const handleSelectionChange = () => onSelectionChange()
  return [
    ['compositionstart', () => onCompositionStart()],
    ['compositionupdate', () => onCompositionUpdate()],
    ['compositionend', (event) => onCompositionEnd(event.currentTarget as HTMLDivElement)],
    ['input', () => onInput()],
    ['keydown', (event) => onKeyDown(withNativeEvent(event) as unknown as React.KeyboardEvent<HTMLDivElement>)],
    ['cut', (event) => onCut(withNativeEvent(event) as unknown as React.ClipboardEvent<HTMLDivElement>)],
    ['drop', (event) => onDrop(withNativeEvent(event) as unknown as React.DragEvent<HTMLDivElement>)],
    ['paste', (event) => onPaste(withNativeEvent(event) as unknown as React.ClipboardEvent<HTMLDivElement>)],
    ['click', handleSelectionChange],
    ['keyup', handleSelectionChange],
    ['mouseup', handleSelectionChange],
  ]
}

function renderInlineWikilinkSegment(
  segment: InlineWikilinkSegment,
  typeEntryMap: Record<string, VaultEntry>,
  index: number,
) {
  if (segment.kind === 'text') return <Fragment key={`text-${index}`}>{segment.text}</Fragment>
  if (segment.kind === 'quote') {
    return <InlineReplyQuoteView key={`quote-${index}`} quote={segment.quote} />
  }
  return (
    <InlineWikilinkChipView
      key={`chip-${segment.chip.entry.path}-${segment.chip.target}`}
      chip={segment.chip}
      typeEntryMap={typeEntryMap}
    />
  )
}

export function InlineWikilinkPaletteLayout({
  header,
  editor,
  suggestionList,
  emptyState,
  footer,
}: {
  header?: React.ReactNode
  editor: React.ReactNode
  suggestionList: React.ReactNode
  emptyState?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        {header}
        {editor}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {suggestionList ?? emptyState}
      </div>
      {footer}
    </>
  )
}
