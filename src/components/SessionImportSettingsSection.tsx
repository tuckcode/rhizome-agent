import { useState } from 'react'
import { ChatCircleText } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { trackEvent } from '../lib/telemetry'
import { Button } from './ui/button'
import {
  SectionHeading,
  SettingsGroup,
  SettingsRow,
} from './SettingsControls'

/**
 * Settings entry for the session-import engine.
 *
 * Vault notes under `Imports/<source>/` are wired. Prime session-list rows are
 * not — `import_jsonl` replaces the active session (see the 2026-09-01 plan).
 * Claude Code is the only source adapter shipped so far.
 */

interface SessionImportPreview {
  source: string
  projectsDir?: string | null
  found: number
  willImport: number
  vaultOnly: number
  withSessionRowPlanned: number
  skippedDuplicate: number
  needsConfirmation: number
  sessionListNotYetWired: boolean
}

interface SessionImportRunResult {
  writtenNotes: string[]
  imported: number
  skipped: number
  failed: number
  sessionListNotYetWired: boolean
}

interface SessionImportSettingsSectionProps {
  vaultPath: string | null
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

export function SessionImportSettingsSection({ vaultPath }: SessionImportSettingsSectionProps) {
  const [preview, setPreview] = useState<SessionImportPreview | null>(null)
  const [result, setResult] = useState<SessionImportRunResult | null>(null)
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasVault = Boolean(vaultPath?.trim())

  const handlePreview = async () => {
    if (!vaultPath) return
    setBusy('preview')
    setError(null)
    setResult(null)
    try {
      trackEvent('session_import_started', { source: 'claude_code', phase: 'preview' })
      const next = await call<SessionImportPreview>('preview_claude_code_session_import', {
        vaultPath,
      })
      setPreview(next)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async () => {
    if (!vaultPath) return
    setBusy('import')
    setError(null)
    try {
      trackEvent('session_import_started', { source: 'claude_code', phase: 'run' })
      const next = await call<SessionImportRunResult>('run_claude_code_session_import', {
        vaultPath,
      })
      setResult(next)
      trackEvent('session_import_completed', {
        source: 'claude_code',
        imported: next.imported,
        skipped: next.skipped,
        failed: next.failed,
      })
      // Refresh counts after the write so a second click stays honest.
      const refreshed = await call<SessionImportPreview>('preview_claude_code_session_import', {
        vaultPath,
      })
      setPreview(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SectionHeading
        icon={<ChatCircleText size={16} aria-hidden="true" />}
        title="Import chat history"
        description="Bring Claude Code sessions into this vault as notes under Imports/. Re-runs skip what is already imported."
      />

      <SettingsGroup>
        <SettingsRow
          label="Claude Code"
          description={
            hasVault
              ? 'Scans ~/.claude/projects on this Mac. Cursor and other sources are not wired yet.'
              : 'Open a vault first. Imports are written as notes under Imports/claude-code/.'
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasVault || busy !== null}
              onClick={() => {
                void handlePreview()
              }}
              data-testid="session-import-preview"
            >
              {busy === 'preview' ? 'Scanning…' : 'Scan'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasVault || busy !== null || !preview || preview.willImport === 0}
              onClick={() => {
                void handleImport()
              }}
              data-testid="session-import-run"
            >
              {busy === 'import' ? 'Importing…' : 'Import to vault'}
            </Button>
          </div>
        </SettingsRow>

        {preview ? (
          <SettingsRow label="Preview" description={[
              `${preview.found} found`,
              `${preview.willImport} new`,
              `${preview.skippedDuplicate} already imported`,
              preview.needsConfirmation > 0
                ? `${preview.needsConfirmation} need review (skipped this pass)`
                : null,
              preview.withSessionRowPlanned > 0
                ? `${preview.withSessionRowPlanned} would also get a Chat list row once that path ships`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <span className="sr-only">Preview counts</span>
          </SettingsRow>
        ) : null}

        {result ? (
          <SettingsRow
            label="Last import"
            description={`${result.imported} notes written · ${result.skipped} skipped · ${result.failed} failed. Chat list rows are not created yet.`}
          >
            <span className="sr-only">Import result</span>
          </SettingsRow>
        ) : null}

        {error ? (
          <SettingsRow label="Could not import" description={error}>
            <span className="sr-only">Import error</span>
          </SettingsRow>
        ) : null}
      </SettingsGroup>
    </>
  )
}
