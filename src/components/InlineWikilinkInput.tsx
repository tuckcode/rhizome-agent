import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { imageFilesFromTransfer } from '../lib/composerAttachments'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { buildTypeEntryMap } from '../utils/typeColors'
import {
  deleteInlineSelection,
  replaceInlineSelection,
  selectedInlineText,
} from './inlineWikilinkEdits'
import {
  buildInlineWikilinkSegments,
  extractInlineWikilinkReferences,
  findActiveWikilinkQuery,
} from './inlineWikilinkText'
import { extractDroppedPathText, formatDroppedPathList } from './inlineWikilinkDropText'
import {
  readSelectionRange,
  serializeInlineNode,
  type InlineSelectionRange,
} from './inlineWikilinkDom'
import {
  buildPendingPasteState,
  type PendingPasteState,
  shouldRecoverPendingPaste,
} from './inlineWikilinkPasteRecovery'
import {
  InlineWikilinkEditorField,
  InlineWikilinkPaletteLayout,
  InlineWikilinkSuggestionList,
} from './InlineWikilinkParts'
import { handleInlineWikilinkKeyDown } from './inlineWikilinkKeydown'
import { useInlineWikilinkSelection } from './useInlineWikilinkSelection'
import { useInlineWikilinkSuggestionsState } from './useInlineWikilinkSuggestionsState'
import { normalizeInlineWikilinkValue } from './inlineWikilinkTokens'
import { ChatCommandMenu } from './ChatCommandMenu'
import {
  applyCommandMenuSelection,
  findActiveSlashQuery,
  matchCommandMenuEntries,
  type CommandMenuAction,
  type CommandMenuEntry,
} from '../lib/primeCommandMenu'
import {
  isInsertBeforeInput,
  isPlainTextBeforeInput,
} from './inlineWikilinkBeforeInput'
import { restorePendingRemountState } from './inlineWikilinkRemountState'
import { useNativePathDrop } from './useNativePathDrop'

interface InlineWikilinkInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSubmit?: (text: string, references: NoteReference[]) => void
  onUnsupportedPaste?: (message: string) => void
  /**
   * Images pasted or dropped into the composer. Without a handler they are
   * refused exactly as before — this input is also the note editor's inline
   * field, which has no use for an attachment.
   */
  onImagePaste?: (files: File[]) => void
  submitOnEmpty?: boolean
  disabled?: boolean
  placeholder?: string
  placeholderClassName?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  dataTestId?: string
  editorClassName?: string
  editorStyle?: CSSProperties
  suggestionListVariant?: 'floating' | 'palette'
  suggestionEmptyLabel?: string
  paletteHeader?: ReactNode
  paletteEmptyState?: ReactNode
  paletteFooter?: ReactNode
  commandEntries?: CommandMenuEntry[]
  commandDisabled?: Record<string, string>
  commandSkillLabel?: string
  commandInstantLabel?: string
  onCommandAction?: (action: CommandMenuAction, nextValue: string) => void
}

function collapseSelectionRange(nextSelectionIndex: number) {
  return {
    start: nextSelectionIndex,
    end: nextSelectionIndex,
  }
}

function fullSelectionRange(value: string) {
  return {
    start: 0,
    end: value.length,
  }
}

function isSelectAllShortcut(event: React.KeyboardEvent<HTMLDivElement>) {
  return event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)
}

function isCommandBackspaceShortcut(event: React.KeyboardEvent<HTMLDivElement>) {
  return event.key === 'Backspace'
    && event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
}

function isLineBreakShortcut(
  event: React.KeyboardEvent<HTMLDivElement>,
  isComposing: boolean,
) {
  return event.key === 'Enter'
    && (event.shiftKey || event.ctrlKey)
    && !isComposing
    && !event.nativeEvent.isComposing
    && event.keyCode !== 229
}

function isNativeCompositionBeforeInput(
  nativeEvent: InputEvent,
  isComposing: boolean,
  hasPendingCompositionInput: boolean,
) {
  return isComposing
    || hasPendingCompositionInput
    || nativeEvent.isComposing
    || nativeEvent.inputType === 'insertCompositionText'
}

export const UNSUPPORTED_INLINE_PASTE_MESSAGE = 'Only text paste is supported in the AI composer right now.'

function hasUnsupportedClipboardPayload(clipboardData: DataTransfer) {
  if (clipboardData.files.length > 0) return true

  return Array.from(clipboardData.items).some((item) =>
    item.kind === 'file' || item.type.startsWith('image/'),
  )
}

function containsUnsupportedInlineContent(editor: HTMLDivElement) {
  return editor.querySelector('img, picture, video, audio, canvas, figure, iframe, object') !== null
}

function deleteToLineStart(
  value: string,
  selection: InlineSelectionRange,
): { value: string; selection: InlineSelectionRange } | null {
  const start = Math.max(0, Math.min(selection.start, selection.end, value.length))
  const end = Math.max(start, Math.min(Math.max(selection.start, selection.end), value.length))
  if (start !== end) return replaceInlineSelection(value, { start, end }, '')

  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
  if (lineStart === start) return null

  return replaceInlineSelection(value, { start: lineStart, end: start }, '')
}

function submitInlineValue({
  onSubmit,
  submitOnEmpty,
  value,
  references,
}: {
  onSubmit?: (text: string, references: NoteReference[]) => void
  submitOnEmpty: boolean
  value: string
  references: NoteReference[]
}) {
  if (!onSubmit) return
  const normalizedValue = normalizeInlineWikilinkValue(value)
  if (!submitOnEmpty && !normalizedValue.trim()) return
  onSubmit(normalizedValue, references)
}

function renderInlineSuggestionList({
  suggestions,
  selectedSuggestionIndex,
  setSuggestionIndex,
  selectSuggestion,
  typeEntryMap,
  suggestionListVariant,
  suggestionEmptyLabel,
}: {
  suggestions: ReturnType<typeof useInlineWikilinkSuggestionsState>['suggestions']
  selectedSuggestionIndex: number
  setSuggestionIndex: (index: number) => void
  selectSuggestion: (index: number) => void
  typeEntryMap: Record<string, VaultEntry>
  suggestionListVariant: 'floating' | 'palette'
  suggestionEmptyLabel: string
}) {
  if (suggestions.length === 0) return null

  return (
    <InlineWikilinkSuggestionList
      suggestions={suggestions}
      selectedIndex={selectedSuggestionIndex}
      onHover={setSuggestionIndex}
      onSelect={selectSuggestion}
      typeEntryMap={typeEntryMap}
      variant={suggestionListVariant}
      emptyLabel={suggestionEmptyLabel}
    />
  )
}

export function InlineWikilinkInput({
  entries,
  value,
  onChange,
  onSubmit,
  onUnsupportedPaste,
  onImagePaste,
  submitOnEmpty = false,
  disabled = false,
  placeholder,
  placeholderClassName,
  inputRef,
  dataTestId = 'agent-input',
  editorClassName,
  editorStyle,
  suggestionListVariant = 'floating',
  suggestionEmptyLabel = 'No matching notes',
  paletteHeader,
  paletteEmptyState,
  paletteFooter,
  commandEntries,
  commandDisabled,
  commandSkillLabel = 'Skill',
  commandInstantLabel = 'Command',
  onCommandAction,
}: InlineWikilinkInputProps) {
  const [renderVersion, forceRender] = useState(0)
  const isComposingRef = useRef(false)
  const segments = useMemo(
    () => buildInlineWikilinkSegments(value, entries),
    [entries, value],
  )
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const {
    editorRef,
    selectionRange,
    selectionIndex,
    setSelectionRange,
    setCombinedRef,
    syncSelectionRange,
    focusSelectionRange,
  } = useInlineWikilinkSelection({
    value,
    onChange,
    inputRef,
    isComposingRef,
  })
  const pendingPasteRef = useRef<PendingPasteState | null>(null)
  const pendingCompositionInputRef = useRef(false)
  const handledFileDropRef = useRef(false)
  const pendingFocusAfterRemountRef = useRef<InlineSelectionRange | null>(null)
  const pendingScrollTopAfterRemountRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    void renderVersion
    restorePendingRemountState(
      editorRef.current,
      focusSelectionRange,
      pendingFocusAfterRemountRef,
      pendingScrollTopAfterRemountRef,
    )
  }, [editorRef, focusSelectionRange, renderVersion])
  const activeQuery = useMemo(
    () => selectionRange.start === selectionRange.end
      ? findActiveWikilinkQuery(value, selectionIndex)
      : null,
    [selectionIndex, selectionRange.end, selectionRange.start, value],
  )
  const [commandState, setCommandState] = useState({ key: '', dismissed: false, index: 0 })
  const activeSlash = useMemo(
    () => {
      if (!commandEntries?.length) return null
      if (selectionRange.start !== selectionRange.end) return null
      return findActiveSlashQuery(value, selectionIndex)
    },
    [commandEntries, selectionIndex, selectionRange.end, selectionRange.start, value],
  )
  const slashKey = activeSlash ? `${activeSlash.start}:${activeSlash.query}` : ''
  const commandDismissed = commandState.key === slashKey ? commandState.dismissed : false
  const commandIndex = commandState.key === slashKey ? commandState.index : 0
  const commandMatches = useMemo(
    () => (activeSlash && !commandDismissed
      ? matchCommandMenuEntries(commandEntries ?? [], activeSlash.query)
      : []),
    [activeSlash, commandDismissed, commandEntries],
  )
  const commandMenuOpen = commandMatches.length > 0
  const selectedCommandIndex = commandMenuOpen
    ? Math.min(commandIndex, commandMatches.length - 1)
    : 0
  const references = useMemo(() => extractInlineWikilinkReferences(value, entries), [entries, value])
  const {
    suggestions,
    selectedSuggestionIndex,
    setSuggestionIndex,
    selectSuggestion,
    cycleSuggestions,
  } = useInlineWikilinkSuggestionsState({
    activeQueryKey: activeQuery ? `${activeQuery.start}:${activeQuery.query}` : '',
    entries,
    query: activeQuery?.query ?? null,
    value,
    selectionIndex,
    onChange,
    onSelectionIndexChange: (nextSelectionIndex) => setSelectionRange(collapseSelectionRange(nextSelectionIndex)),
    focusSelectionAt: (nextSelectionIndex) => focusSelectionRange(collapseSelectionRange(nextSelectionIndex)),
  })
  const insertTransferText = useCallback((text: string, focusAfterInsert = false) => {
    const editor = editorRef.current
    const currentSelectionRange = editor && !focusAfterInsert
      ? readSelectionRange(editor)
      : selectionRange
    const nextState = replaceInlineSelection(value, currentSelectionRange, text)
    const shouldRestoreFocus = focusAfterInsert || document.activeElement === editor

    onChange(nextState.value)
    setSelectionRange(nextState.selection)
    pendingFocusAfterRemountRef.current = shouldRestoreFocus ? nextState.selection : null
    pendingScrollTopAfterRemountRef.current = editor?.scrollTop ?? null
    forceRender((current) => current + 1)
  }, [editorRef, onChange, selectionRange, setSelectionRange, value])
  const insertNativePathDrop = (paths: string[]) => {
    const droppedPathText = formatDroppedPathList(paths)
    if (!droppedPathText) return

    insertTransferText(droppedPathText, true)
  }
  useNativePathDrop({
    targetRef: editorRef,
    disabled,
    onPathDrop: insertNativePathDrop,
  })
  const notifyUnsupportedPaste = useCallback(
    () => onUnsupportedPaste?.(UNSUPPORTED_INLINE_PASTE_MESSAGE),
    [onUnsupportedPaste],
  )
  /**
   * Take the images out of a paste or drop, if anyone is listening for them.
   * Returns whether it handled the payload, so the caller keeps its existing
   * refusal for everything else — a PDF is still not a message.
   */
  const takeImages = useCallback(
    (transfer: DataTransfer | null) => {
      if (!onImagePaste) return false
      const images = imageFilesFromTransfer(transfer)
      if (images.length === 0) return false
      onImagePaste(images)
      return true
    },
    [onImagePaste],
  )
  const recoverUnsupportedMutation = () => {
    pendingCompositionInputRef.current = false
    pendingPasteRef.current = null
    notifyUnsupportedPaste()
    forceRender((current) => current + 1)
    setSelectionRange({ ...selectionRange })
  }
  const deleteContent = (direction: 'backward' | 'forward') => {
    const nextState = deleteInlineSelection(value, selectionRange, segments, direction)
    if (!nextState) return
    onChange(nextState.value)
    setSelectionRange(nextState.selection)
  }
  const deleteContentToLineStart = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isCommandBackspaceShortcut(event)) return false
    if (isComposingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return false

    const editor = editorRef.current
    const currentSelectionRange = editor ? readSelectionRange(editor) : selectionRange
    const nextState = deleteToLineStart(value, currentSelectionRange)

    event.preventDefault()
    event.stopPropagation()

    if (!nextState) return true

    onChange(nextState.value)
    setSelectionRange(nextState.selection)
    pendingFocusAfterRemountRef.current = nextState.selection
    forceRender((current) => current + 1)
    return true
  }
  const selectAllContent = () => {
    const nextSelection = fullSelectionRange(value)
    setSelectionRange(nextSelection)
    focusSelectionRange(nextSelection)
  }
  const cutSelectedContent = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    const editor = editorRef.current
    const currentSelectionRange = editor ? readSelectionRange(editor) : selectionRange
    const selectedText = selectedInlineText(value, currentSelectionRange)
    if (!selectedText) return

    event.preventDefault()
    event.clipboardData.setData('text/plain', normalizeInlineWikilinkValue(selectedText))

    const nextState = deleteInlineSelection(value, currentSelectionRange, segments, 'backward')
    if (!nextState) return

    onChange(nextState.value)
    setSelectionRange(nextState.selection)
    pendingFocusAfterRemountRef.current = nextState.selection
    forceRender((current) => current + 1)
  }
  const handleBeforeInput = useCallback((nativeEvent: InputEvent) => {
    if (disabled) return

    if (!isInsertBeforeInput(nativeEvent)) return

    if (isNativeCompositionBeforeInput(
      nativeEvent,
      isComposingRef.current,
      pendingCompositionInputRef.current,
    )) return

    if (nativeEvent.inputType === 'insertLineBreak') {
      nativeEvent.preventDefault()
      insertTransferText('\n')
      return
    }

    if (isPlainTextBeforeInput(nativeEvent)) {
      nativeEvent.preventDefault()
      insertTransferText(nativeEvent.data)
      return
    }

    const dataTransfer = nativeEvent.dataTransfer
    if (!dataTransfer || !hasUnsupportedClipboardPayload(dataTransfer)) return

    if (nativeEvent.inputType === 'insertFromDrop' && handledFileDropRef.current) {
      handledFileDropRef.current = false
      nativeEvent.preventDefault()
      return
    }

    if (nativeEvent.inputType === 'insertFromDrop') {
      const droppedPathText = extractDroppedPathText(dataTransfer)
      if (droppedPathText) {
        nativeEvent.preventDefault()
        insertTransferText(droppedPathText)
        return
      }
    }

    nativeEvent.preventDefault()
    if (takeImages(dataTransfer)) return
    notifyUnsupportedPaste()
  }, [disabled, insertTransferText, notifyUnsupportedPaste, takeImages])
  useLayoutEffect(() => {
    void renderVersion
    const editor = editorRef.current
    if (!editor) return

    editor.addEventListener('beforeinput', handleBeforeInput as EventListener)
    return () => editor.removeEventListener('beforeinput', handleBeforeInput as EventListener)
  }, [editorRef, handleBeforeInput, renderVersion])
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!hasUnsupportedClipboardPayload(event.dataTransfer)) return

    handledFileDropRef.current = true
    const droppedPathText = extractDroppedPathText(event.dataTransfer)
    event.preventDefault()

    if (!droppedPathText) {
      if (takeImages(event.dataTransfer)) return
      notifyUnsupportedPaste()
      return
    }

    insertTransferText(droppedPathText)
  }
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    if (hasUnsupportedClipboardPayload(event.clipboardData)) {
      event.preventDefault()
      if (takeImages(event.clipboardData)) return
      notifyUnsupportedPaste()
      return
    }

    const pastedText = normalizeInlineWikilinkValue(event.clipboardData.getData('text/plain'))
    if (!pastedText) return

    const nextState = replaceInlineSelection(value, selectionRange, pastedText)
    pendingPasteRef.current = buildPendingPasteState(value, selectionRange, pastedText)

    event.preventDefault()
    onChange(nextState.value)
    setSelectionRange(nextState.selection)
  }
  const syncValueFromEditor = () => {
    const editor = editorRef.current
    if (editor && containsUnsupportedInlineContent(editor)) {
      recoverUnsupportedMutation()
      return
    }

    const pendingPaste = pendingPasteRef.current
    if (editor && pendingPaste) {
      const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editor))
      pendingPasteRef.current = null

      if (shouldRecoverPendingPaste(nextValue, pendingPaste)) {
        onChange(pendingPaste.expectedValue)
        forceRender((current) => current + 1)
        setSelectionRange({ ...pendingPaste.expectedSelection })
        return
      }
    }

    if (!editor) return

    const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editor))
    const nextSelection = readSelectionRange(editor)
    const clampedSelection: InlineSelectionRange = {
      start: Math.min(nextSelection.start, nextValue.length),
      end: Math.min(nextSelection.end, nextValue.length),
    }

    const shouldRestoreFocus = document.activeElement === editor
    pendingFocusAfterRemountRef.current = shouldRestoreFocus ? clampedSelection : null
    onChange(nextValue)
    setSelectionRange(clampedSelection)
    forceRender((current) => current + 1)
  }
  const flushPendingCompositionInput = (compositionEditor?: HTMLDivElement | null) => {
    if (isComposingRef.current) return
    const hadPendingInput = pendingCompositionInputRef.current
    pendingCompositionInputRef.current = false

    const editor = compositionEditor ?? editorRef.current
    if (!editor) return

    if (containsUnsupportedInlineContent(editor)) {
      recoverUnsupportedMutation()
      return
    }

    const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editor))
    if (!hadPendingInput && nextValue === value) return

    const nextSelection = readSelectionRange(editor)
    const clampedSelection: InlineSelectionRange = {
      start: Math.min(nextSelection.start, nextValue.length),
      end: Math.min(nextSelection.end, nextValue.length),
    }

    const shouldRestoreFocus = document.activeElement === editor || document.activeElement === editorRef.current
    pendingFocusAfterRemountRef.current = shouldRestoreFocus ? clampedSelection : null
    onChange(nextValue)
    setSelectionRange(clampedSelection)
    forceRender((current) => current + 1)
  }
  const handleCompositionStart = () => {
    isComposingRef.current = true
  }
  const handleCompositionUpdate = () => {
    isComposingRef.current = true
  }
  const handleCompositionEnd = (compositionEditor: HTMLDivElement) => {
    isComposingRef.current = false
    queueMicrotask(() => flushPendingCompositionInput(compositionEditor))
  }
  const handleInput = () => {
    if (disabled) return

    if (isComposingRef.current) {
      pendingCompositionInputRef.current = true
      return
    }

    pendingCompositionInputRef.current = false
    syncValueFromEditor()
  }
  const submitValue = () =>
    submitInlineValue({ onSubmit, submitOnEmpty, value, references })
  const selectCommand = (index: number) => {
    const entry = commandMatches[index]
    if (!entry || commandDisabled?.[entry.slash]) return
    const applied = applyCommandMenuSelection(value, selectionIndex, entry)
    if (!applied) return
    onChange(applied.value)
    setSelectionRange(collapseSelectionRange(applied.nextSelectionIndex))
    window.setTimeout(() => focusSelectionRange(collapseSelectionRange(applied.nextSelectionIndex)), 0)
    setCommandState({ key: '', dismissed: false, index: 0 })
    onCommandAction?.(applied.action, applied.value)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && isLineBreakShortcut(event, isComposingRef.current)) {
      event.preventDefault()
      insertTransferText('\n')
      return
    }

    if (isSelectAllShortcut(event)) {
      event.preventDefault()
      selectAllContent()
      return
    }

    if (!disabled && deleteContentToLineStart(event)) {
      return
    }

    handleInlineWikilinkKeyDown({
      event,
      disabled,
      isComposing: isComposingRef.current,
      suggestionsOpen: commandMenuOpen || suggestions.length > 0,
      onCycleSuggestions: commandMenuOpen
        ? (direction) => {
            setCommandState((current) => {
              const count = commandMatches.length
              if (count === 0) return { key: slashKey, dismissed: false, index: 0 }
              const from = current.key === slashKey ? current.index : 0
              const next = direction > 0
                ? (from + 1) % count
                : (from <= 0 ? count - 1 : from - 1)
              return { key: slashKey, dismissed: false, index: next }
            })
          }
        : cycleSuggestions,
      onSelectSuggestion: commandMenuOpen
        ? () => selectCommand(selectedCommandIndex)
        : () => selectSuggestion(selectedSuggestionIndex),
      onDismissSuggestions: commandMenuOpen
        ? () => setCommandState({ key: slashKey, dismissed: true, index: 0 })
        : undefined,
      onDeleteContent: deleteContent,
      canSubmit: onSubmit !== undefined,
      onSubmit: submitValue,
    })
  }
  const editor = (
    <InlineWikilinkEditorField
      key={renderVersion}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      inputRef={setCombinedRef}
      dataTestId={dataTestId}
      placeholderClassName={placeholderClassName}
      editorClassName={editorClassName}
      editorStyle={editorStyle}
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={handleCompositionStart}
      onCompositionUpdate={handleCompositionUpdate}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCut={cutSelectedContent}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onSelectionChange={syncSelectionRange}
      segments={segments}
      typeEntryMap={typeEntryMap}
    />
  )
  const suggestionList = renderInlineSuggestionList({
    suggestions,
    selectedSuggestionIndex,
    setSuggestionIndex,
    selectSuggestion,
    typeEntryMap,
    suggestionListVariant,
    suggestionEmptyLabel,
  })
  if (suggestionListVariant === 'palette') {
    return (
      <InlineWikilinkPaletteLayout
        header={paletteHeader}
        editor={editor}
        suggestionList={suggestionList}
        emptyState={paletteEmptyState}
        footer={paletteFooter}
      />
    )
  }
  return (
    <div className="relative">
      {editor}
      {commandMenuOpen ? (
        <ChatCommandMenu
          entries={commandMatches}
          selectedIndex={selectedCommandIndex}
          onHover={(index) => setCommandState({ key: slashKey, dismissed: false, index })}
          onSelect={selectCommand}
          onDismiss={() => setCommandState({ key: slashKey, dismissed: true, index: 0 })}
          skillLabel={commandSkillLabel}
          instantLabel={commandInstantLabel}
          disabled={commandDisabled}
        />
      ) : suggestionList}
    </div>
  )
}
