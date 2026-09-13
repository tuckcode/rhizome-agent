import { useCallback, useEffect, useState } from 'react'
import { PuzzlePiece } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'
import { callHost } from '../lib/callHost'
import {
  parseInstalledPrimePackages,
  primePackageInstallCommand,
  searchPrimePackageCatalog,
  type InstalledPrimePackage,
  type PrimePackageHit,
  type PrimePackageKind,
} from '../lib/primePackages'
import {
  trackPrimePackageCatalogOpened,
  trackPrimePackageInstallCopied,
} from '../lib/productAnalytics'
import { writeClipboardText } from '../utils/clipboardText'
import { openExternalUrl } from '../utils/url'

const KIND_TABS: ReadonlyArray<{ id: PrimePackageKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'extension', label: 'Extensions' },
  { id: 'skill', label: 'Skills' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'theme', label: 'Themes' },
]

/**
 * Pi package hub — catalog plus what is already on this machine.
 *
 * Prime's daemon cannot install them. This section searches the public
 * catalog and copies `prime-agent package install …` the same way provider
 * sign-in copies a Terminal command.
 */
export function PrimeExtensionsSection({ active = true }: { active?: boolean }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<PrimePackageKind>('all')
  const [hits, setHits] = useState<PrimePackageHit[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [installed, setInstalled] = useState<InstalledPrimePackage[] | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    trackPrimePackageCatalogOpened()
    let cancelled = false
    void (async () => {
      try {
        const raw = await callHost<unknown>('list_prime_packages')
        if (!cancelled) {
          setInstalled(Array.isArray(raw)
            ? parseInstalledPrimePackages({ packages: raw })
            : parseInstalledPrimePackages(raw))
        }
      } catch {
        if (!cancelled) setInstalled([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const idle = window.setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      void (async () => {
        try {
          const result = await searchPrimePackageCatalog(query, kind)
          if (cancelled) return
          setHits(result.hits)
          setTotal(result.total)
        } catch (error) {
          if (cancelled) return
          setHits([])
          setTotal(null)
          setSearchError(error instanceof Error ? error.message : String(error))
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, query.trim().length === 0 ? 0 : 280)
    return () => {
      cancelled = true
      window.clearTimeout(idle)
    }
  }, [active, kind, query])

  const copyInstall = useCallback(async (source: string, origin: 'catalog' | 'installed') => {
    setCopyError(null)
    const command = primePackageInstallCommand(source)
    try {
      await writeClipboardText(command)
      setCopied(command)
      trackPrimePackageInstallCopied(origin)
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  return (
    <div className="space-y-3" data-testid="prime-extensions-section">
      <SectionHeading
        icon={<PuzzlePiece size={16} aria-hidden="true" />}
        title="Packages"
        description="The Pi catalog: extensions, skills, prompts, and themes. They run with full system access. Review the source before you install."
      />
      {active ? (
        <>
      {installed && installed.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">On this machine</div>
          <SettingsGroup>
            {installed.map((pkg) => (
              <SettingsGroupItem key={pkg.source}>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{pkg.source}</div>
                    <div className="text-xs text-muted-foreground">Installed</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyInstall(pkg.source, 'installed')}
                  >
                    Copy install
                  </Button>
                </div>
              </SettingsGroupItem>
            ))}
          </SettingsGroup>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">Catalog</div>
        <div className="flex flex-wrap gap-1" data-testid="prime-packages-kind-tabs" role="tablist" aria-label="Package kind">
          {KIND_TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={kind === tab.id ? 'secondary' : 'ghost'}
              role="tab"
              aria-selected={kind === tab.id}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalog"
          aria-label="Search Prime packages"
          data-testid="prime-extensions-search"
        />
      </div>

      {searching ? (
        <p className="text-xs text-muted-foreground">Searching the catalog…</p>
      ) : null}
      {searchError ? (
        <p className="text-xs text-destructive">{searchError}</p>
      ) : null}

      {hits.length > 0 ? (
        <SettingsGroup>
          {hits.map((hit) => (
            <SettingsGroupItem key={hit.name}>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{hit.name}</div>
                  {hit.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{hit.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[hit.publisher, hit.kinds.length > 0 ? hit.kinds.join(', ') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void copyInstall(hit.name, 'catalog')}
                >
                  Copy install
                </Button>
              </div>
            </SettingsGroupItem>
          ))}
        </SettingsGroup>
      ) : null}

      {total !== null && !searching ? (
        <p className="text-xs text-muted-foreground">
          {total === 1 ? '1 package in the catalog.' : `${total.toLocaleString()} packages in the catalog.`}
          {' '}Showing {hits.length}.
        </p>
      ) : null}

      {copied ? (
        <p className="text-xs text-muted-foreground" data-testid="prime-extensions-copied">
          Copied. Paste in Terminal:{' '}
          <code className="break-all">{copied}</code>
        </p>
      ) : null}
      {copyError ? (
        <p className="text-xs text-destructive">{copyError}</p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-xs text-muted-foreground"
        onClick={() => void openExternalUrl('https://pi.dev/packages')}
      >
        Browse the full catalog
      </Button>
        </>
      ) : null}
    </div>
  )
}
