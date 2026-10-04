import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join, resolve } from 'node:path'

const APP_CONFIG_DIR = 'com.rhizome.app'
const LEGACY_APP_CONFIG_DIRS = ['com.tolaria.app', 'com.laputa.app']
const HOME_VAULT_ERROR =
  'VAULT_PATH cannot be the home directory. Open a vault in Rhizome before starting MCP tools (#46).'

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

function expandLeadingTilde(vaultPath, home = homedir()) {
  if (vaultPath === '~') return home
  if (vaultPath.startsWith('~/')) return join(home, vaultPath.slice(2))
  return vaultPath
}

const VERBATIM_UNC_PREFIX = '\\\\?\\UNC\\'
const VERBATIM_PREFIX = '\\\\?\\'

// Rust's canonicalize returns Windows verbatim paths. Without this,
// `\\?\C:\Vault` and `C:\Vault` list the same vault twice.
// e.g. `\\?\C:\Vault` → `C:\Vault`, `\\?\UNC\nas\share` → `\\nas\share`
function stripVerbatimPrefix(vaultPath) {
  if (vaultPath.startsWith(VERBATIM_UNC_PREFIX)) {
    return `\\\\${vaultPath.slice(VERBATIM_UNC_PREFIX.length)}`
  }

  if (vaultPath.startsWith(VERBATIM_PREFIX)) {
    return vaultPath.slice(VERBATIM_PREFIX.length)
  }

  return vaultPath
}

function normalizeVaultPath(vaultPath, home = homedir()) {
  if (typeof vaultPath !== 'string') return ''
  const trimmed = vaultPath.trim()
  if (!trimmed) return ''
  return expandLeadingTilde(stripVerbatimPrefix(trimmed), home)
}

function uniqueVaultPaths(paths) {
  const seen = new Set()
  const unique = []
  for (const path of paths) {
    const normalized = normalizeVaultPath(path)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(normalized)
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
  for (const legacyDir of LEGACY_APP_CONFIG_DIRS) {
    const legacy = join(configDir, legacyDir, 'vaults.json')
    if (existsSync(legacy)) return legacy
  }
  return preferred
}

function canonicalPath(value) {
  const resolved = resolve(value)
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

/** `$HOME` is never a vault. MCP tools must not see the whole home tree (#46). */
export function isHomeVaultPath(vaultPath, home = homedir()) {
  if (typeof vaultPath !== 'string' || !vaultPath.trim() || !home) return false
  try {
    return canonicalPath(normalizeVaultPath(vaultPath, home)) === canonicalPath(home)
  } catch {
    return false
  }
}

function pushUniquePath(paths, value) {
  const path = normalizeVaultPath(value)
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
  const scoped = vaultPaths.filter((path) => !isHomeVaultPath(path))
  if (vaultPaths.length > 0 && scoped.length === 0) {
    throw new Error(HOME_VAULT_ERROR)
  }
  if (scoped.length === 0) {
    const configuredPaths = configuredVaultPaths(options).filter((path) => !isHomeVaultPath(path))
    if (configuredPaths.length > 0) return configuredPaths
    throw new Error('VAULT_PATH is required. Open a vault in Rhizome before starting MCP tools.')
  }
  return scoped
}

export function requireVaultPath(env = process.env, options = {}) {
  return requireVaultPaths(env, options)[0]
}
