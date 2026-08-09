export const GETTING_STARTED_VAULT_NAME = 'Getting Started'
export const RHIZOME_VAULT_DEFAULT_NAME = 'Rhizome Vault'

const CLONE_PATH_ERRORS = [
  'already exists and is not empty',
  'already exists and is not a directory',
  'Failed to create parent directory',
  'Target path is required',
]

const GIT_NOT_FOUND_ERRORS = [
  'no such file or directory',
  'os error 2',
  'program not found',
  'system cannot find the file',
]

const NETWORK_ERRORS = [
  'could not resolve host',
  'connection refused',
  'network is unreachable',
  'timed out',
  'failed to connect',
  'ssl connect error',
]

const AUTH_ERRORS = [
  'authentication failed',
  'could not read username',
  'permission denied',
  'repository not found',
  '403',
]

function appendVaultFolderName(parentPath: string, name: string): string {
  const trimmed = parentPath.trim().replace(/[\\/]+$/g, '')
  if (!trimmed) {
    return name
  }

  const separator = trimmed.includes('\\') && !trimmed.includes('/') ? '\\' : '/'
  return `${trimmed}${separator}${name}`
}

export function buildGettingStartedVaultPath(parentPath: string): string {
  return appendVaultFolderName(parentPath, GETTING_STARTED_VAULT_NAME)
}

/**
 * Normalize a user-supplied vault folder name.
 *
 * Strips path separators and characters Windows rejects in folder names, so a
 * typed name can only ever create a folder *inside* the parent the user picked
 * — `../../etc` becomes `etc`, never an escape. Falls back to the default when
 * the input is blank or sanitizes away to nothing.
 */
export function sanitizeVaultFolderName(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '')
    // Characters Windows rejects in folder names. Spaces are deliberately kept.
    .replace(/[:*?"<>|]/g, '')
    // Leading dots create a hidden folder; trailing dots are invalid on Windows.
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()

  return cleaned || RHIZOME_VAULT_DEFAULT_NAME
}

export function buildEmptyVaultPath(parentPath: string, name?: string): string {
  return appendVaultFolderName(parentPath, sanitizeVaultFolderName(name ?? RHIZOME_VAULT_DEFAULT_NAME))
}

export function labelFromPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/g, '')
  return trimmed.split(/[\\/]/).pop() || 'Vault'
}

export function formatGettingStartedCloneError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : `${err}`

  if (CLONE_PATH_ERRORS.some(fragment => message.includes(fragment))) {
    return message
  }

  const lower = message.toLowerCase()
  if (GIT_NOT_FOUND_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Git is required to download the Getting Started vault. Install Git and try again.'
  }
  if (AUTH_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Could not download Getting Started vault. Check your GitHub access and try again.'
  }
  if (NETWORK_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Could not download Getting Started vault. Check your connection and try again.'
  }

  return `Could not download Getting Started vault: ${firstCloneErrorLine(message)}`
}

function firstCloneErrorLine(message: string): string {
  return message
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) ?? 'git reported an unknown error'
}
