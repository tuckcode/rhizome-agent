import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChatTeardropText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface QuoteAnchor {
  text: string
  top: number
  left: number
}

function quoteFromSelection(root: HTMLElement): QuoteAnchor | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const text = selection.toString().trim()
  if (!text) return null
  const rect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : root.getBoundingClientRect()
  return {
    text,
    top: rect.top,
    left: rect.left + rect.width / 2,
  }
}

interface ReplySelectionPillProps {
  children: ReactNode
  onAdd: (excerpt: string) => void
}

/**
 * Highlight text in an agent reply. A pill sits above the selection.
 * Add to Chat puts that passage in the composer. It does not send.
 */
export function ReplySelectionPill({ children, onAdd }: ReplySelectionPillProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [quote, setQuote] = useState<QuoteAnchor | null>(null)

  const refresh = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    setQuote(quoteFromSelection(root))
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  }, [refresh])

  return (
    <div ref={rootRef} className="min-w-0" onMouseUp={refresh}>
      {children}
      {quote ? (
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="fixed z-[12000] -translate-x-1/2 -translate-y-full rounded-full shadow-md"
          style={{ top: Math.max(quote.top - 6, 8), left: quote.left }}
          data-testid="reply-selection-pill"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onAdd(quote.text)
            window.getSelection()?.removeAllRanges()
            setQuote(null)
          }}
        >
          <ChatTeardropText />
          Add to Chat
        </Button>
      ) : null}
    </div>
  )
}
