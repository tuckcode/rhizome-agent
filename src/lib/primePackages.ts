/**
 * Prime packages — the inherited Pi catalog.
 *
 * Prime Agent is a distribution of Pi. Packages on npm tagged `pi-package`
 * are extensions, skills, prompt templates, and themes. Prime's own
 * `packages.md` is the source for install commands and the full-system-access
 * warning. Rhizome runs `prime-agent package install`, then reloads the
 * live session. Chat is only the fallback when that CLI is missing.
 */

export interface PrimePackageHit {
  name: string
  description: string
  publisher: string | null
  downloadsMonthly: number | null
  npmUrl: string
  kinds: string[]
}

export interface InstalledPrimePackage {
  source: string
}

export type PrimePackageKind = 'all' | 'extension' | 'skill' | 'prompt' | 'theme'

const KIND_SEARCH_KEYWORD: Record<Exclude<PrimePackageKind, 'all'>, string> = {
  extension: 'extension',
  skill: 'skill',
  prompt: 'prompt',
  theme: 'theme',
}

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'
const CATALOG_SIZE = 20

export function catalogSearchUrl(query: string, kind: PrimePackageKind = 'all'): string {
  const trimmed = query.trim()
  const parts = ['keywords:pi-package']
  if (kind !== 'all') parts.push(`keywords:${KIND_SEARCH_KEYWORD[kind]}`)
  if (trimmed.length > 0) parts.push(trimmed)
  const url = new URL(NPM_SEARCH)
  url.searchParams.set('text', parts.join(' '))
  url.searchParams.set('size', String(CATALOG_SIZE))
  return url.toString()
}

export function primePackageInstallSpec(source: string): string {
  const trimmed = source.trim()
  if (trimmed.length === 0) return ''
  if (
    trimmed.startsWith('npm:')
    || trimmed.startsWith('git:')
    || trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('ssh://')
    || trimmed.startsWith('git://')
    || trimmed.startsWith('/')
    || trimmed.startsWith('.')
  ) {
    return trimmed
  }
  return `npm:${trimmed}`
}

export function primePackageInstallCommand(source: string): string {
  const spec = primePackageInstallSpec(source)
  if (spec.length === 0) return 'prime-agent package install'
  return `prime-agent package install ${spec}`
}

export function primePackageAskAgentPrompt(source: string): string {
  return [
    'Install this Prime package by running:',
    '',
    primePackageInstallCommand(source),
    '',
    'Packages have full system access. After it finishes, reload or start a new chat.',
  ].join('\n')
}

export function isPrimePackageInstalled(
  source: string,
  installed: InstalledPrimePackage[],
): boolean {
  const key = packageSourceKey(source)
  if (!key) return false
  return installed.some((pkg) => packageSourceKey(pkg.source) === key)
}

export function isPrimeCliMissing(error: string): boolean {
  return error.includes('Prime is not installed') || error.includes('Prime Agent not found')
}

function packageSourceKey(source: string): string {
  let spec = primePackageInstallSpec(source)
  if (spec.startsWith('npm:')) spec = spec.slice(4)
  if (
    spec.startsWith('git:')
    || spec.startsWith('http://')
    || spec.startsWith('https://')
    || spec.startsWith('ssh://')
    || spec.startsWith('git://')
    || spec.startsWith('/')
    || spec.startsWith('.')
  ) {
    return spec
  }
  return stripNpmVersion(spec)
}

function stripNpmVersion(name: string): string {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/')
    if (slash === -1) return name
    const versionAt = name.indexOf('@', slash)
    return versionAt === -1 ? name : name.slice(0, versionAt)
  }
  const versionAt = name.indexOf('@')
  return versionAt === -1 ? name : name.slice(0, versionAt)
}

export function parseInstalledPrimePackages(settings: unknown): InstalledPrimePackage[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return []
  const packages = Reflect.get(settings, 'packages')
  if (!Array.isArray(packages)) return []
  const seen = new Set<string>()
  const listed: InstalledPrimePackage[] = []
  for (const entry of packages) {
    const source = installedSource(entry)
    if (!source || seen.has(source)) continue
    seen.add(source)
    listed.push({ source })
  }
  return listed
}

function installedSource(entry: unknown): string | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const source = Reflect.get(entry, 'source')
  if (typeof source !== 'string') return null
  const trimmed = source.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseNpmSearchResponse(payload: unknown): { hits: PrimePackageHit[]; total: number } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { hits: [], total: 0 }
  }
  const totalRaw = Reflect.get(payload, 'total')
  const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : 0
  const objects = Reflect.get(payload, 'objects')
  if (!Array.isArray(objects)) return { hits: [], total }
  const hits: PrimePackageHit[] = []
  for (const object of objects) {
    const hit = parseSearchObject(object)
    if (hit) hits.push(hit)
  }
  return { hits, total }
}

function parseSearchObject(object: unknown): PrimePackageHit | null {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return null
  const pkg = Reflect.get(object, 'package')
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return null
  const nameRaw = Reflect.get(pkg, 'name')
  if (typeof nameRaw !== 'string' || nameRaw.trim().length === 0) return null
  const name = nameRaw.trim()
  const descriptionRaw = Reflect.get(pkg, 'description')
  const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : ''
  const publisher = publisherName(Reflect.get(pkg, 'publisher'))
  const keywordsRaw = Reflect.get(pkg, 'keywords')
  const keywords = Array.isArray(keywordsRaw)
    ? keywordsRaw.filter((keyword): keyword is string => typeof keyword === 'string')
    : []
  const downloads = Reflect.get(object, 'downloads')
  const monthly = downloads && typeof downloads === 'object' && !Array.isArray(downloads)
    ? Reflect.get(downloads, 'monthly')
    : null
  const links = Reflect.get(pkg, 'links')
  const npmFromLinks = links && typeof links === 'object' && !Array.isArray(links)
    ? Reflect.get(links, 'npm')
    : null
  return {
    name,
    description,
    publisher,
    downloadsMonthly: typeof monthly === 'number' && Number.isFinite(monthly) ? monthly : null,
    npmUrl: typeof npmFromLinks === 'string' && npmFromLinks.startsWith('https://')
      ? npmFromLinks
      : `https://www.npmjs.com/package/${name}`,
    kinds: packageKinds(keywords),
  }
}

function publisherName(publisher: unknown): string | null {
  if (!publisher || typeof publisher !== 'object' || Array.isArray(publisher)) return null
  const username = Reflect.get(publisher, 'username')
  if (typeof username !== 'string' || username.trim().length === 0) return null
  return username.trim()
}

function packageKinds(keywords: string[]): string[] {
  const lower = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  const kinds: string[] = []
  if (lower.has('extension') || lower.has('pi-extension')) kinds.push('extension')
  if (lower.has('skill') || lower.has('skills')) kinds.push('skill')
  if (lower.has('prompt') || lower.has('prompt-template')) kinds.push('prompt')
  if (lower.has('theme') || lower.has('themes')) kinds.push('theme')
  return kinds
}

export async function searchPrimePackageCatalog(
  query: string,
  kind: PrimePackageKind = 'all',
): Promise<{ hits: PrimePackageHit[]; total: number }> {
  const response = await fetch(catalogSearchUrl(query, kind))
  if (!response.ok) {
    throw new Error(`Catalog search failed (${response.status})`)
  }
  return parseNpmSearchResponse(await response.json())
}
