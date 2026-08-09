export type ReleaseChannel = 'alpha' | 'stable'

function cleanedReleaseChannel(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function normalizeReleaseChannel(value: string | null | undefined): ReleaseChannel {
  return cleanedReleaseChannel(value) === 'alpha' ? 'alpha' : 'stable'
}

export function serializeReleaseChannel(channel: ReleaseChannel): string | null {
  return channel === 'alpha' ? 'alpha' : null
}
