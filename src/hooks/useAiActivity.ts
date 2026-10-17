import { useState, useEffect, useRef, useCallback } from 'react'
import { isTauri } from '../mock-tauri'

export type HighlightElement = 'editor' | 'tab' | 'properties' | 'notelist' | null

export interface AiActivity {
  highlightElement: HighlightElement
  highlightPath: string | null
}

export interface AiActivityCallbacks {
  onOpenNote?: (path: string) => void
  onOpenTab?: (path: string) => void
  onSetFilter?: (type: string) => void
  onVaultChanged?: (path?: string) => void
  /**
   * The agent asked to celebrate something it judged worth marking. Whether
   * anything is shown is the celebration gate's decision, not this hook's.
   */
  onCelebrate?: (details: { message?: string; from?: string }) => void
}

const WS_UI_URL = 'ws://localhost:9711'
const HIGHLIGHT_DURATION_MS = 800
const RECONNECT_BASE_MS = 3000
const RECONNECT_MAX_MS = 30_000
/** Opened sockets that then die. A retry that never connects does not count. */
const MAX_OPENED_DROPS = 5
/** A minute up clears the drop count, so later blips get a fresh budget. */
const HEALTHY_RESET_MS = 60_000
const WS_CONNECTING = 0
const WS_OPEN = 1

function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt)
}

type UiActionMessage = Record<string, unknown> & {
  action: string
  type: 'ui_action'
}
type StringPayloadAction = 'open_note' | 'open_tab' | 'set_filter'
type StringPayloadCallback = 'onOpenNote' | 'onOpenTab' | 'onSetFilter'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseUiActionMessage(event: MessageEvent): UiActionMessage | null {
  try {
    const data = JSON.parse(String(event.data))
    if (!isRecord(data) || data.type !== 'ui_action' || typeof data.action !== 'string') return null
    return data as UiActionMessage
  } catch {
    return null
  }
}

function highlightElementFromValue(value: unknown): HighlightElement {
  if (value === 'editor' || value === 'tab' || value === 'properties' || value === 'notelist') return value
  return null
}

function useLatestAiActivityCallbacks(callbacks?: AiActivityCallbacks) {
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks })
  return callbacksRef
}

function useAiHighlightState() {
  const [highlightElement, setHighlightElement] = useState<HighlightElement>(null)
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHighlightTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const clearHighlight = useCallback(() => {
    setHighlightElement(null)
    setHighlightPath(null)
  }, [])

  const showHighlight = useCallback((message: UiActionMessage) => {
    setHighlightElement(highlightElementFromValue(message.element))
    setHighlightPath(optionalString(message.path) ?? null)
    clearHighlightTimer()
    timerRef.current = setTimeout(clearHighlight, HIGHLIGHT_DURATION_MS)
  }, [clearHighlight, clearHighlightTimer])

  return {
    clearHighlightTimer,
    highlightElement,
    highlightPath,
    showHighlight,
  }
}

function dispatchStringPayload(value: unknown, callback?: (value: string) => void): void {
  const payload = optionalString(value)
  if (payload) callback?.(payload)
}

const STRING_PAYLOAD_CALLBACKS: Record<StringPayloadAction, StringPayloadCallback> = {
  open_note: 'onOpenNote',
  open_tab: 'onOpenTab',
  set_filter: 'onSetFilter',
}

function isStringPayloadAction(action: string): action is StringPayloadAction {
  return action === 'open_note' || action === 'open_tab' || action === 'set_filter'
}

function stringPayloadValue(message: UiActionMessage): unknown {
  return message.action === 'set_filter' ? message.filterType : message.path
}

function dispatchUiActionMessage(
  message: UiActionMessage,
  callbacksRef: ReturnType<typeof useLatestAiActivityCallbacks>,
  showHighlight: (message: UiActionMessage) => void,
): void {
  if (message.action === 'highlight') {
    showHighlight(message)
    return
  }
  if (message.action === 'vault_changed') {
    callbacksRef.current?.onVaultChanged?.(optionalString(message.path))
    return
  }
  if (message.action === 'celebrate') {
    callbacksRef.current?.onCelebrate?.({
      message: optionalString(message.message),
      from: optionalString(message.from),
    })
    return
  }
  if (!isStringPayloadAction(message.action)) return

  const callbackName = STRING_PAYLOAD_CALLBACKS[message.action]
  dispatchStringPayload(stringPayloadValue(message), callbacksRef.current?.[callbackName])
}

function useUiActionMessageHandler(
  callbacksRef: ReturnType<typeof useLatestAiActivityCallbacks>,
  showHighlight: (message: UiActionMessage) => void,
) {
  return useCallback((event: MessageEvent) => {
    const message = parseUiActionMessage(event)
    if (message) dispatchUiActionMessage(message, callbacksRef, showHighlight)
  }, [callbacksRef, showHighlight])
}

function useUiActionSocket(handleMessage: (event: MessageEvent) => void, clearHighlightTimer: () => void): void {
  useEffect(() => {
    // Port 9711 is the desktop UI bridge. The browser build has no Tauri
    // backend and no bridge, so opening the socket only logs a refused
    // connection. Inside the app, a down bridge retries with backoff and
    // stays at debug — the browser already prints its own network error.
    if (!isTauri()) return

    let ws: WebSocket | null = null
    let mounted = true
    let attempt = 0
    let openedDrops = 0
    let gaveUp = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let healthyTimer: ReturnType<typeof setTimeout> | null = null

    function clearHealthyTimer() {
      if (healthyTimer) clearTimeout(healthyTimer)
      healthyTimer = null
    }

    function scheduleReconnect() {
      if (!mounted || gaveUp || reconnectTimer) return
      const delay = reconnectDelay(attempt)
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    function connect() {
      if (!mounted || gaveUp) return
      if (ws && (ws.readyState === WS_CONNECTING || ws.readyState === WS_OPEN)) return
      try {
        const socket = new WebSocket(WS_UI_URL)
        ws = socket
        let thisOpened = false
        socket.onmessage = handleMessage
        socket.onopen = () => {
          thisOpened = true
          attempt = 0
          clearHealthyTimer()
          healthyTimer = setTimeout(() => {
            openedDrops = 0
          }, HEALTHY_RESET_MS)
        }
        socket.onclose = () => {
          if (ws === socket) ws = null
          clearHealthyTimer()
          if (!mounted) return
          // Only a socket that reached open spends the drop budget.
          // A refused retry during a restart does not.
          if (thisOpened) {
            openedDrops += 1
            if (openedDrops >= MAX_OPENED_DROPS) {
              gaveUp = true
              console.debug('[ai-activity] UI bridge dropped; stopped reconnecting')
              return
            }
          }
          scheduleReconnect()
        }
        socket.onerror = () => {
          console.debug('[ai-activity] UI bridge socket failed')
        }
      } catch (error) {
        console.debug('[ai-activity] UI bridge socket failed', error)
        scheduleReconnect()
      }
    }

    function wake() {
      if (!mounted || document.visibilityState === 'hidden') return
      gaveUp = false
      openedDrops = 0
      attempt = 0
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
      connect()
    }

    function onVisible() {
      if (document.visibilityState === 'visible') wake()
    }

    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', onVisible)
    connect()

    return () => {
      mounted = false
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', onVisible)
      ws?.close()
      clearHighlightTimer()
      clearHealthyTimer()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [clearHighlightTimer, handleMessage])
}

/**
 * Listens on the UI WebSocket bridge (port 9711) for UI action events
 * from the MCP server. Handles highlight, open_note, open_tab, set_filter,
 * and vault_changed actions.
 */
export function useAiActivity(callbacks?: AiActivityCallbacks): AiActivity {
  const callbacksRef = useLatestAiActivityCallbacks(callbacks)
  const {
    clearHighlightTimer,
    highlightElement,
    highlightPath,
    showHighlight,
  } = useAiHighlightState()
  const handleMessage = useUiActionMessageHandler(callbacksRef, showHighlight)

  useUiActionSocket(handleMessage, clearHighlightTimer)

  return { highlightElement, highlightPath }
}
