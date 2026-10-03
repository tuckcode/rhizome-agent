import { useSyncExternalStore } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { trackEvent } from './telemetry'
import { prepareReadAloudText, splitReadAloudText } from './prepareReadAloudText'

const VOICE_ID = 'eve'
const LANGUAGE = 'auto'

export type ReadAloudPhase = 'idle' | 'loading' | 'playing'

export interface ReadAloudSnapshot {
  messageId: string | null
  phase: ReadAloudPhase
  error: string | null
}

const idle: ReadAloudSnapshot = { messageId: null, phase: 'idle', error: null }
let snapshot: ReadAloudSnapshot = idle
const listeners = new Set<() => void>()
let audio: HTMLAudioElement | null = null
let finishPlayback: (() => void) | null = null
let generation = 0
const cache = new Map<string, Blob>()

function emit() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: ReadAloudSnapshot) {
  snapshot = next
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useReadAloud(): ReadAloudSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

export function stopReadAloud() {
  generation += 1
  finishPlayback?.()
  finishPlayback = null
  audio?.pause()
  audio = null
  setSnapshot(idle)
}

export async function toggleReadAloud(messageId: string, source: string) {
  if (snapshot.messageId === messageId && (snapshot.phase === 'loading' || snapshot.phase === 'playing')) {
    stopReadAloud()
    return
  }

  const text = prepareReadAloudText(source)
  if (!text) {
    setSnapshot({ messageId, phase: 'idle', error: 'Nothing to read.' })
    return
  }

  stopReadAloud()
  const turn = generation
  setSnapshot({ messageId, phase: 'loading', error: null })
  let reported = false

  try {
    const parts = splitReadAloudText(text)
    for (const part of parts) {
      if (turn !== generation) return
      const blob = await loadSpeech(part)
      if (turn !== generation) return
      if (!reported) {
        reported = true
        trackEvent('read_aloud_played', { length: text.length, voice: VOICE_ID })
      }
      setSnapshot({ messageId, phase: 'playing', error: null })
      await playBlob(blob, turn)
    }
    if (turn === generation) setSnapshot(idle)
  } catch (error) {
    if (turn !== generation) return
    const message = error instanceof Error ? error.message : 'Read aloud failed.'
    setSnapshot({ messageId, phase: 'idle', error: message })
  }
}

async function loadSpeech(text: string): Promise<Blob> {
  const key = `${VOICE_ID}\n${LANGUAGE}\n${text}`
  const cached = cache.get(key)
  if (cached) return cached
  const bytes = await invoke<number[]>('speak_reply', {
    text,
    voiceId: VOICE_ID,
    language: LANGUAGE,
  })
  const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' })
  cache.set(key, blob)
  return blob
}

function playBlob(blob: Blob, turn: number): Promise<void> {
  const url = URL.createObjectURL(blob)
  const element = new Audio(url)
  audio = element
  return new Promise((resolve, reject) => {
    const done = () => {
      URL.revokeObjectURL(url)
      if (audio === element) audio = null
      finishPlayback = null
      resolve()
    }
    finishPlayback = done
    element.addEventListener('ended', done)
    element.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      finishPlayback = null
      reject(new Error('Playback failed.'))
    })
    void element.play().catch((error: unknown) => {
      URL.revokeObjectURL(url)
      finishPlayback = null
      reject(error instanceof Error ? error : new Error('Playback failed.'))
    })
    if (turn !== generation) done()
  })
}
