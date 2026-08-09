const LEGACY_JOURNAL_TYPE = 'journal'

export function isLegacyJournalingType(type: string | null | undefined): boolean {
  return type?.trim().toLowerCase() === LEGACY_JOURNAL_TYPE
}
