import { useCallback, useEffect, useState } from 'react'
import { CaretDown, CaretRight, Warning } from '@phosphor-icons/react'
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
import { SettingsGroup, SettingsGroupItem } from './SettingsControls'
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
import { cn } from '@/lib/utils'

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
 * Prime package hub — catalog plus what is already on this machine.
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
  const [catalogOpen, setCatalogOpen] = useState(false)

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
    if (!active || !catalogOpen) return
    trackPrimePackageCatalogOpened()
  }, [active, catalogOpen])

  useEffect(() => {
    if (!active || !catalogOpen) return
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
  }, [active, catalogOpen, kind, query])

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
      <div>
        <h3 className="text-sm font-medium text-foreground">Packages</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Add-ons for the Prime engine: extensions, skills, prompts and themes.
        </p>
        <p
          className="mt-1 flex items-start gap-1.5 text-[12px] leading-5 text-[var(--feedback-warning-text)]"
          data-testid="prime-packages-access-warning"
        >
          <Warning size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>They run with full system access. Review the source before you install.</span>
        </p>
      </div>
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

      <Button
        type="button"
        variant="ghost"
        aria-expanded={catalogOpen}
        aria-controls="prime-packages-catalog"
        data-testid="prime-packages-browse"
        onClick={() => setCatalogOpen((open) => !open)}
        className="h-auto w-full justify-start gap-2 px-0 py-1.5 text-left text-sm font-medium text-foreground hover:bg-transparent"
      >
        {catalogOpen ? (
          <CaretDown size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <CaretRight size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        Browse packages
      </Button>

      {catalogOpen ? (
        <div id="prime-packages-catalog" className="space-y-2">
        <div className="flex flex-wrap gap-1" data-testid="prime-packages-kind-tabs" role="tablist" aria-label="Package kind">
          {KIND_TABS.map((tab) => {
            const selected = kind === tab.id
            return (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant="ghost"
              role="tab"
              aria-selected={selected}
              data-active={selected ? 'true' : 'false'}
              className={cn(
                selected
                  ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setKind(tab.id)}
            >
              {tab.label}
            </Button>
            )
          })}
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalog"
          aria-label="Search Prime packages"
          data-testid="prime-extensions-search"
        />

      {searching ? (
        <p className="text-xs text-muted-foreground">Searching the catalog…</p>
      ) : null}
      {searchError ? (
        <p className="text-xs text-destructive">{searchError}</p>
      ) : null}

      {hits.length > 0 ? (
        <div className="max-h-[31rem] overflow-y-auto" data-testid="prime-packages-catalog-list">
        <SettingsGroup>
          {hits.map((hit) => {
            const already = isPrimePackageInstalled(hit.name, listed)
            return (
              <SettingsGroupItem key={hit.name}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{hit.name}</div>
                    {hit.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{hit.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[hit.publisher, hit.kinds.length > 0 ? hit.kinds.join(', ') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {already ? (
                    <p className="shrink-0 self-start text-xs text-muted-foreground">Installed</p>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
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
        </div>
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
        </div>
      ) : null}
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
