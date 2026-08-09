export const NOTE_LIST_SEARCH_AVAILABILITY_EVENT = 'laputa:note-list-search-availability'
export const NOTE_LIST_SEARCH_TOGGLE_EVENT = 'laputa:toggle-note-list-search'

interface NoteListSearchAvailabilityDetail {
  enabled: boolean
}

function isAvailabilityDetail(detail: unknown): detail is NoteListSearchAvailabilityDetail {
  return typeof detail === 'object'
    && detail !== null
    && 'enabled' in detail
    && typeof (detail as { enabled?: unknown }).enabled === 'boolean'
}

export function dispatchNoteListSearchAvailability(enabled: boolean) {
  window.dispatchEvent(new CustomEvent<NoteListSearchAvailabilityDetail>(
    NOTE_LIST_SEARCH_AVAILABILITY_EVENT,
    { detail: { enabled } },
  ))
}

export function readNoteListSearchAvailability(event: Event): boolean | null {
  if (!(event instanceof CustomEvent) || !isAvailabilityDetail(event.detail)) return null
  return event.detail.enabled
}

export function dispatchNoteListSearchToggle() {
  window.dispatchEvent(new Event(NOTE_LIST_SEARCH_TOGGLE_EVENT))
}

export function addNoteListSearchToggleListener(listener: () => void): () => void {
  window.addEventListener(NOTE_LIST_SEARCH_TOGGLE_EVENT, listener)
  return () => window.removeEventListener(NOTE_LIST_SEARCH_TOGGLE_EVENT, listener)
}
