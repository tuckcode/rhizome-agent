import type { VaultEntry } from '../types'
import { notePathsMatch } from './notePathIdentity'
import { extractSheetExternalCellReferences } from './sheetExternalReferences'
import { splitSheetDocument } from './sheetCsv'
import { resolveEntry } from './wikilink'

export interface SheetExternalFormulaInput {
  evaluated: string
  source: string
}

export interface SheetExternalFormulaWorkerDependency {
  content: string
  entry: VaultEntry
}

interface NativeSheetDependencyContent {
  content: string
  path: string
}

interface NativeSheetExternalReferenceLink {
  sourcePath: string
  target: string
  targetPath: string
}

interface NativeResolvedSheetExternalFormulaInput {
  cell: string
  evaluated: string
  source: string
}

interface NativeResolveSheetExternalFormulaInputsResponse {
  inputs: NativeResolvedSheetExternalFormulaInput[]
}

let nativeSheetFormulaWorkerUnavailable = false

function hasTauriInternals(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined'
}

export function canUseNativeSheetFormulaWorker(): boolean {
  return !nativeSheetFormulaWorkerUnavailable && hasTauriInternals()
}

function resolveEntryForTarget(
  entries: VaultEntry[],
  target: string,
  sourceEntry?: VaultEntry | null,
): VaultEntry | undefined {
  return resolveEntry(entries, target, sourceEntry ?? undefined)
    ?? (sourceEntry ? resolveEntry([sourceEntry], target, sourceEntry) : undefined)
}

function addExternalReferenceLinksForSource(
  links: Map<string, NativeSheetExternalReferenceLink>,
  entries: VaultEntry[],
  source: { content: string; entry?: VaultEntry | null; path: string },
): void {
  const body = splitSheetDocument(source.content).body
  const resolutionCache = new Map<string, VaultEntry | undefined>()

  for (const reference of extractSheetExternalCellReferences(body)) {
    const cacheKey = reference.target.toLowerCase()
    const cached = resolutionCache.has(cacheKey)
      ? resolutionCache.get(cacheKey)
      : resolveEntryForTarget(entries, reference.target, source.entry)
    if (!resolutionCache.has(cacheKey)) resolutionCache.set(cacheKey, cached)
    if (!cached) continue

    const linkKey = `${source.path}\n${reference.target.toLowerCase()}`
    if (!links.has(linkKey)) {
      links.set(linkKey, {
        sourcePath: source.path,
        target: reference.target,
        targetPath: notePathsMatch(cached.path, source.path) ? source.path : cached.path,
      })
    }
  }
}

function buildExternalReferenceLinks({
  content,
  currentPath,
  dependencies,
  entries,
  sourceEntry,
}: {
  content: string
  currentPath: string
  dependencies: SheetExternalFormulaWorkerDependency[]
  entries: VaultEntry[]
  sourceEntry?: VaultEntry | null
}): NativeSheetExternalReferenceLink[] {
  const links = new Map<string, NativeSheetExternalReferenceLink>()
  addExternalReferenceLinksForSource(links, entries, { content, entry: sourceEntry, path: currentPath })
  for (const dependency of dependencies) {
    addExternalReferenceLinksForSource(links, entries, {
      content: dependency.content,
      entry: dependency.entry,
      path: dependency.entry.path,
    })
  }
  return Array.from(links.values())
}

export async function resolveExternalFormulaInputsWithNativeWorker({
  content,
  currentPath,
  dependencies,
  entries,
  maxDepth,
  sourceEntry,
  timezone,
}: {
  content: string
  currentPath: string
  dependencies: SheetExternalFormulaWorkerDependency[]
  entries: VaultEntry[]
  maxDepth: number
  sourceEntry?: VaultEntry | null
  timezone: string
}): Promise<Map<string, SheetExternalFormulaInput> | null> {
  if (!canUseNativeSheetFormulaWorker()) return null

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const response = await invoke<NativeResolveSheetExternalFormulaInputsResponse>(
      'resolve_sheet_external_formula_inputs',
      {
        request: {
          content,
          currentPath,
          dependencies: dependencies.map((dependency): NativeSheetDependencyContent => ({
            content: dependency.content,
            path: dependency.entry.path,
          })),
          links: buildExternalReferenceLinks({
            content,
            currentPath,
            dependencies,
            entries,
            sourceEntry,
          }),
          maxDepth,
          timezone,
        },
      },
    )

    return new Map(response.inputs.map((input) => [
      input.cell,
      { evaluated: input.evaluated, source: input.source },
    ]))
  } catch {
    nativeSheetFormulaWorkerUnavailable = true
    return null
  }
}
