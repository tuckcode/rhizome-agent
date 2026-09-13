/**
 * Prime packages — the inherited Pi catalog.
 *
 * Prime Agent is a distribution of Pi. Packages on npm tagged `pi-package`
 * are extensions, skills, prompt templates, and themes. Prime's own
 * `packages.md` is the source for install commands and the full-system-access
 * warning. Install is CLI-only: the daemon has no package command.
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

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'
const CATALOG_SIZE = 20

export function catalogSearchUrl(query: string): string {
  const trimmed = query.trim()
  const text = trimmed.length > 0
    ? `keywords:pi-package ${trimmed}`
    : 'keywords:pi-package'
  const url = new URL(NPM_SEARCH)
  url.searchParams.set('text', text)
  url.searchParams.set('size', String(CATALOG_SIZE))
  return url.toString()
}

export function primePackageInstallCommand(source: string): string {
  const trimmed = source.trim()
  if (trimmed.length === 0) return 'prime-agent package install'
  if (
    trimmed.startsWith('npm:')
    || trimmed.startsWith('git:')
    || trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('/')
    || trimmed.startsWith('.')
  ) {
    return `prime-agent package install ${trimmed}`
  }
  return `prime-agent package install npm:${trimmed}`
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
): Promise<{ hits: PrimePackageHit[]; total: number }> {
  const response = await fetch(catalogSearchUrl(query))
  if (!response.ok) {
    throw new Error(`Catalog search failed (${response.status})`)
  }
  return parseNpmSearchResponse(await response.json())
}
