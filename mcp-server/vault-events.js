/**
 * The single JS writer for `.rhizome/events.jsonl`.
 *
 * Counterpart to `src-tauri/src/vault_events.rs` (ADR-0161). The two
 * runtimes cannot share code, so they share a contract instead: **`type`,
 * `trigger` and `timestamp` are on every record.**
 *
 * Until 2026-07-31 this helper lived inline in `index.js` and wrote no
 * `trigger` at any of its ten call sites — which is why a third of the
 * records in a real event log have none, and why the activity feed could
 * not say where a save came from. Five of those call sites (`search`,
 * `lint`, `graph-summary`, `wiki-generate-started`, `wiki-generate-finished`)
 * are ungated and still the only writer for their event types.
 *
 * It lives in its own module because `index.js` starts the MCP server on
 * import, so nothing in it is testable. That is also why
 * `node --test mcp-server/` hangs forever — use `pnpm test:mcp`, which
 * globs the test files instead of the directory.
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'

/**
 * Everything reaching this module arrived over MCP from an external agent,
 * so that is the honest default. A caller may still pass its own `trigger`.
 */
export const DEFAULT_MCP_TRIGGER = 'mcp'

/**
 * Append one record. Synchronous on purpose: every call site invokes this
 * without `await`, so the previous `async` version could resolve after the
 * tool had already returned, turning a write failure into an unhandled
 * rejection.
 *
 * @param {string} vaultPath Absolute vault root.
 * @param {Record<string, unknown>} event Must carry `type`. May override
 *   `trigger`; anything else rides along as a kind-specific field.
 */
export function appendRhizomeEvent(vaultPath, event) {
  const eventsDir = `${vaultPath}/.rhizome`
  if (!existsSync(eventsDir)) mkdirSync(eventsDir, { recursive: true })

  // `trigger` first so an explicit one in `event` wins; `timestamp` last so
  // it cannot be spoofed by a caller.
  const record = {
    trigger: DEFAULT_MCP_TRIGGER,
    ...event,
    timestamp: new Date().toISOString(),
  }
  appendFileSync(`${eventsDir}/events.jsonl`, `${JSON.stringify(record)}\n`, 'utf-8')
}
