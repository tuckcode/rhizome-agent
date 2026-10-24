/**
 * Version strings from the local-agent probe.
 * "2.1.289 (Claude Code)" and "codex-cli 0.157.1" both become a v-prefixed number.
 */
export function normalizeAgentVersion(
  raw: string | null | undefined,
  agentLabel: string,
): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const label = agentLabel.trim()
  let withoutLabel = trimmed
  if (label) {
    const target = `(${label})`.toLowerCase()
    while (true) {
      const idx = withoutLabel.toLowerCase().indexOf(target)
      if (idx === -1) break
      withoutLabel =
        withoutLabel.slice(0, idx) + ' ' + withoutLabel.slice(idx + target.length)
    }
  }
  withoutLabel = withoutLabel.replace(/\s+/g, ' ').trim()
  const match = withoutLabel.match(/v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/)
  if (!match) return withoutLabel.replace(/\s+/g, ' ').trim() || null
  const version = match[0]
  return version.startsWith('v') || version.startsWith('V')
    ? `v${version.slice(1)}`
    : `v${version}`
}

export function formatLastChecked(checkedAt: number, now: number): string {
  const elapsed = Math.max(0, now - checkedAt)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Last checked just now'
  if (minutes === 1) return 'Last checked 1 min ago'
  return `Last checked ${minutes} min ago`
}
