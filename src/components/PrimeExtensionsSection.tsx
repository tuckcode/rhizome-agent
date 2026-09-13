import { useCallback, useEffect, useState } from 'react'
import { PuzzlePiece } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'
import { callHost } from '../lib/callHost'
import {
  isPrimeCliMissing,
  isPrimePackageInstalled,
  parseInstalledPrimePackages,
  primePackageAskAgentPrompt,
  primePackageInstallCommand,
  searchPrimePackageCatalog,
  type InstalledPrimePackage,
  type PrimePackageHit,
  type PrimePackageKind,
} from '../lib/primePackages'
import {
  trackPrimePackageCatalogOpened,
  trackPrimePackageInstallCopied,
  trackPrimePackageInstallFailed,
  trackPrimePackageInstalled,
} from '../lib/productAnalytics'
import { queueAiPrompt, requestOpenAiChat } from '../utils/aiPromptBridge'
import { writeClipboardText } from '../utils/clipboardText'
import { openExternalUrl } from '../utils/url'

const KIND_TABS: ReadonlyArray<{ id: PrimePackageKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'extension', label: 'Extensions' },
  { id: 'skill', label: 'Skills' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'theme', label: 'Themes' },
]

interface InstallPrimePackageResult {
  source: string
  reloaded: boolean
}

/**
 * Pi package hub — catalog plus what is already on this machine.
 *
 * Install runs `prime-agent package install` in the background, then reloads
 * Prime. Chat is only the fallback when that CLI is missing.
 */
export function PrimeExtensionsSection({
  active = true,
  onClose,
}: {
  active?: boolean
  onClose?: () => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<PrimePackageKind>('all')
  const [hits, setHits] = useState<PrimePackageHit[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [installed, setInstalled] = useState<InstalledPrimePackage[] | null>(null)
  const [pendingSource, setPendingSource] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [cliMissingSource, setCliMissingSource] = useState<string | null>(null)

  const refreshInstalled = useCallback(async () => {
    try {
      const raw = await callHost<unknown>('list_prime_packages')
      setInstalled(Array.isArray(raw)
        ? parseInstalledPrimePackages({ packages: raw })
        : parseInstalledPrimePackages(raw))
    } catch {
      setInstalled([])
    }
  }, [])

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

  const confirmInstall = useCallback(async () => {
    if (!pendingSource) return
    const source = pendingSource
    setInstalling(true)
    setInstallError(null)
    setCliMissingSource(null)
    setStatus(null)
    try {
      const result = await callHost<InstallPrimePackageResult>('install_prime_package', { source })
      setPendingSource(null)
      trackPrimePackageInstalled('catalog')
      await refreshInstalled()
      setStatus(result.reloaded
        ? 'Installed. Prime reloaded this chat.'
        : 'Installed. Start a new chat to load it.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPendingSource(null)
      if (isPrimeCliMissing(message)) {
        trackPrimePackageInstallFailed('cli_missing')
        setCliMissingSource(source)
        setInstallError(message)
      } else {
        trackPrimePackageInstallFailed('error')
        setInstallError(message)
      }
    } finally {
      setInstalling(false)
    }
  }, [pendingSource, refreshInstalled])

  const copyInstall = useCallback(async (source: string) => {
    try {
      await writeClipboardText(primePackageInstallCommand(source))
      trackPrimePackageInstallCopied('catalog')
      setStatus(`Copied. Paste in Terminal: ${primePackageInstallCommand(source)}`)
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const askChatToInstall = useCallback((source: string) => {
    queueAiPrompt(primePackageAskAgentPrompt(source), [])
    requestOpenAiChat()
    onClose?.()
  }, [onClose])

  const listed = installed ?? []

  return (
    <div className="space-y-3" data-testid="prime-extensions-section">
      <SectionHeading
        icon={<PuzzlePiece size={16} aria-hidden="true" />}
        title="Packages"
        description="The Pi catalog: extensions, skills, prompts, and themes. They run with full system access. Review the source before you install."
      />
      {active ? (
        <>
      {listed.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">On this machine</div>
          <SettingsGroup>
            {listed.map((pkg) => (
              <SettingsGroupItem key={pkg.source}>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{pkg.source}</div>
                    <div className="text-xs text-muted-foreground">Installed</div>
                  </div>
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
          {hits.map((hit) => {
            const already = isPrimePackageInstalled(hit.name, listed)
            return (
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
                  {already ? (
                    <p className="shrink-0 text-xs text-muted-foreground">Installed</p>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={installing}
                      onClick={() => {
                        setCliMissingSource(null)
                        setInstallError(null)
                        setPendingSource(hit.name)
                      }}
                    >
                      Install
                    </Button>
                  )}
                </div>
              </SettingsGroupItem>
            )
          })}
        </SettingsGroup>
      ) : null}

      {total !== null && !searching ? (
        <p className="text-xs text-muted-foreground">
          {total === 1 ? '1 package in the catalog.' : `${total.toLocaleString()} packages in the catalog.`}
          {' '}Showing {hits.length}.
        </p>
      ) : null}

      {status ? (
        <p className="text-xs text-muted-foreground" data-testid="prime-extensions-installed-status">
          {status}
        </p>
      ) : null}
      {installError ? (
        <p className="text-xs text-destructive">{installError}</p>
      ) : null}
      {cliMissingSource ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => askChatToInstall(cliMissingSource)}
          >
            Ask Chat to install
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyInstall(cliMissingSource)}
          >
            Copy install
          </Button>
        </div>
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

      <Dialog
        open={pendingSource !== null}
        onOpenChange={(open) => {
          if (!open && !installing) setPendingSource(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install this package?</DialogTitle>
            <DialogDescription>
              Prime packages run with full system access. Review the source before you install.
            </DialogDescription>
          </DialogHeader>
          {pendingSource ? (
            <p className="truncate text-sm text-foreground">{pendingSource}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={installing}
              onClick={() => setPendingSource(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={installing}
              onClick={() => void confirmInstall()}
            >
              {installing ? 'Installing…' : 'Install package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
