import { existsSync, readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const APP_CONFIG_DIR = 'com.tolaria.app'
const LEGACY_APP_CONFIG_DIR = 'com.laputa.app'

function parseVaultPathList(rawValue) {
  if (!rawValue?.trim()) return []

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) return parsed.filter(value => typeof value === 'string')
  } catch {
    // Older clients only set VAULT_PATH; keep VAULT_PATHS strict JSON so paths
    // with platform separators are never split incorrectly.
  }

  return []
}

function uniqueVaultPaths(paths) {
  const seen = new Set()
  const unique = []
  for (const path of paths) {
    const trimmed = path.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

function appConfigBaseDir(env = process.env) {
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support')
  if (platform() === 'win32') return env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

export function vaultsJsonPath({ configDir = appConfigBaseDir() } = {}) {
  const preferred = join(configDir, APP_CONFIG_DIR, 'vaults.json')
  if (existsSync(preferred)) return preferred

  const legacy = join(configDir, LEGACY_APP_CONFIG_DIR, 'vaults.json')
  return existsSync(legacy) ? legacy : preferred
}

function pushUniquePath(paths, value) {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path || paths.includes(path)) return
  paths.push(path)
}

function activeVaultPathsFromList(list) {
  const paths = []
  pushUniquePath(paths, list?.active_vault)

  for (const vault of list?.vaults ?? []) {
    if (vault?.mounted === false) continue
    pushUniquePath(paths, vault?.path)
  }

  return paths
}

export function configuredVaultPaths({ configDir } = {}) {
  const filePath = vaultsJsonPath({ configDir })
  if (!existsSync(filePath)) return []

  return activeVaultPathsFromList(JSON.parse(readFileSync(filePath, 'utf-8')))
}

export function requireVaultPaths(env = process.env, options = {}) {
  const vaultPaths = uniqueVaultPaths([
    env.VAULT_PATH?.trim() ?? '',
    ...parseVaultPathList(env.VAULT_PATHS),
  ])
  if (vaultPaths.length === 0) {
    const configuredPaths = configuredVaultPaths(options)
    if (configuredPaths.length > 0) return configuredPaths
    throw new Error('VAULT_PATH is required. Open a vault in Rhizome before starting MCP tools.')
  }
  return vaultPaths
}

export function requireVaultPath(env = process.env, options = {}) {
  return requireVaultPaths(env, options)[0]
}
