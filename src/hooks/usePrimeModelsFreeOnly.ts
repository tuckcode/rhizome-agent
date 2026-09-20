import { useSyncExternalStore } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { readStoredBooleanPreference, writeStoredBooleanPreference } from '../lib/uiPreference'

const listeners = new Set<() => void>()

function getSnapshot(): boolean {
  return readStoredBooleanPreference(APP_STORAGE_KEYS.primeModelsFreeOnly, false)
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APP_STORAGE_KEYS.primeModelsFreeOnly) listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function setPrimeModelsFreeOnly(on: boolean): void {
  writeStoredBooleanPreference(APP_STORAGE_KEYS.primeModelsFreeOnly, on)
  for (const listener of listeners) listener()
}

export function usePrimeModelsFreeOnly(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return [on, setPrimeModelsFreeOnly]
}
