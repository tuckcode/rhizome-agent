/**
 * Vault operations — read-only helpers for Tolaria markdown vault.
 * Most write operations are handled by the app-managed agent's active
 * permission profile and native file-edit tools; createNote is intentionally
 * narrow so read-only agents can create a new Markdown file without overwrite.
 */
import { lstat, mkdir, open, opendir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

const YAML_FRONTMATTER_LANGUAGES = new Set(['', 'yaml', 'yml'])
const JSON_FRONTMATTER_LANGUAGES = new Set(['json'])
const EXECUTABLE_FRONTMATTER_LANGUAGES = new Set([
  'javascript',
  'js',
  'coffee',
  'coffeescript',
  'cson',
])

const ACTIVE_VAULT_ERROR = 'Note path must stay inside the active vault'

/**
 * Recursively find all .md files under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function findMarkdownFiles(dir) {
  const vaultRoot = await realpath(dir)
  return collectMarkdownFilesUnder(vaultRoot, vaultRoot)
}

async function collectMarkdownFilesUnder(vaultRoot, dir) {
  const results = []
  let items
  try {
    items = await opendir(dir)
  } catch {
    return results
  }
  for await (const item of items) {
    await collectMarkdownFile(results, vaultRoot, dir, item)
  }
  return results
}

async function resolveVaultNotePath(vaultPath, notePath) {
  const vaultRoot = await realpath(vaultPath)
  const requestedPath = resolveRequestedNotePath(vaultRoot, notePath)
  const noteRealPath = await resolveContainedRegularFile(vaultRoot, requestedPath)
  if (!noteRealPath) {
    try {
      await lstat(requestedPath)
    } catch (error) {
      if (error?.code === 'ENOENT') throw error
      throw error
    }
    throw new Error(ACTIVE_VAULT_ERROR)
  }

  return {
    vaultRoot,
    noteRealPath,
    relativePath: path.relative(vaultRoot, noteRealPath),
  }
}

/**
 * Read a note with parsed frontmatter and content.
 * @param {string} vaultPath
 * @param {string} notePath
 * @returns {Promise<{path: string, frontmatter: Record<string, unknown>, content: string}>}
 */
export async function getNote(vaultPath, notePath) {
  const {
    noteRealPath,
    relativePath,
  } = await resolveVaultNotePath(vaultPath, notePath)
  const raw = await readUtf8File(noteRealPath)
  const parsed = parseMarkdownNote(raw)
  return {
    path: toVaultNotePath(relativePath),
    frontmatter: parsed.data,
    content: parsed.content.trim(),
  }
}

/**
 * Create a new markdown note inside the vault without overwriting an existing file.
 * @param {string} vaultPath
 * @param {string} notePath
 * @param {string} content
 * @returns {Promise<{path: string, absolutePath: string}>}
 */
export async function createNote(vaultPath, notePath, content) {
  const { requestedPath, relativePath } = await resolveNewVaultNotePath(vaultPath, notePath)
  await writeNewUtf8File(requestedPath, content)
  return {
    path: toVaultNotePath(relativePath),
    absolutePath: requestedPath,
  }
}

/**
 * Search notes by title or content substring.
 * @param {string} vaultPath
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Promise<Array<{path: string, title: string, snippet: string}>>}
 */
export async function searchNotes(vaultPath, query, limit = 10) {
  const vaultRoot = await realpath(vaultPath)
  const files = await findMarkdownFiles(vaultRoot)
  const q = query.toLowerCase()
  const results = []

  for (const filePath of files) {
    if (results.length >= limit) break
    const content = await readContainedUtf8(vaultRoot, filePath)
    if (content === null) continue
    const filename = path.basename(filePath, '.md')
    const titleMatch = extractTitle(content, filename)
    if (!matchesSearchQuery(titleMatch, content, q)) continue

    const snippet = extractSnippet(content, q)
    results.push({
      path: toVaultNotePath(path.relative(vaultRoot, filePath)),
      title: titleMatch,
      snippet,
    })
  }

  return results
}

/**
 * Get vault context: unique types, note count, top-level folders, and 20 most recent notes.
 * @param {string} vaultPath
 * @returns {Promise<{types: string[], noteCount: number, folders: string[], recentNotes: Array<{path: string, title: string, type: string|null}>, vaultPath: string}>}
 */
export async function vaultContext(vaultPath) {
  const vaultRoot = await realpath(vaultPath)
  const files = await findMarkdownFiles(vaultRoot)
  const typesSet = new Set()
  const foldersSet = new Set()
  const notesWithMtime = []

  for (const filePath of files) {
    const entry = await readVaultContextNote(vaultRoot, filePath)
    if (!entry) continue
    if (entry.type) typesSet.add(entry.type)
    if (entry.topFolder) foldersSet.add(entry.topFolder)
    notesWithMtime.push(entry.note)
  }

  notesWithMtime.sort((a, b) => b.mtime - a.mtime)
  const recentNotes = notesWithMtime.slice(0, 20).map(contextNoteWithoutMtime)

  return {
    types: [...typesSet].sort(),
    noteCount: notesWithMtime.length,
    folders: [...foldersSet].sort(),
    recentNotes,
    configFiles: await readConfigFiles(vaultRoot),
    vaultPath,
  }
}

// --- Helpers ---

async function collectMarkdownFile(results, vaultRoot, dir, item) {
  if (item.name.startsWith('.')) return

  const full = resolveInside(dir, item.name)
  if (!full) return

  if (item.isDirectory()) {
    const contained = await resolveContainedPath(vaultRoot, full)
    if (!contained) return
    results.push(...await collectMarkdownFilesUnder(vaultRoot, contained))
    return
  }

  if (item.isSymbolicLink()) {
    const contained = await resolveContainedPath(vaultRoot, full)
    if (!contained) return
    let st
    try {
      st = await stat(contained)
    } catch {
      return
    }
    if (st.isDirectory()) {
      results.push(...await collectMarkdownFilesUnder(vaultRoot, contained))
      return
    }
    if (st.isFile() && item.name.endsWith('.md')) {
      results.push(full)
    }
    return
  }

  if (!item.name.endsWith('.md')) return
  const regular = await resolveContainedRegularFile(vaultRoot, full)
  if (regular) results.push(full)
}

function resolveRequestedNotePath(vaultRoot, notePath) {
  if (path.isAbsolute(notePath)) return notePath
  const resolved = resolveInside(vaultRoot, notePath)
  if (!resolved) throw new Error(ACTIVE_VAULT_ERROR)
  return resolved
}

async function resolveNewVaultNotePath(vaultPath, notePath) {
  const requestedNotePath = validateNewNotePath(notePath)
  const vaultRoot = await realpath(vaultPath)
  const requestedPath = resolveRequestedNotePath(vaultRoot, requestedNotePath)
  const relativePath = relativeNotePathInsideVault(vaultRoot, requestedPath)
  await ensureWritableParentInsideVault(vaultRoot, requestedPath)
  return { requestedPath, relativePath }
}

function validateNewNotePath(notePath) {
  const trimmedPath = typeof notePath === 'string' ? notePath.trim() : ''
  if (!trimmedPath) {
    throw new Error('Note path is required')
  }
  if (!trimmedPath.endsWith('.md')) {
    throw new Error('New notes must be markdown files ending in .md')
  }
  return trimmedPath
}

async function ensureWritableParentInsideVault(vaultRoot, requestedPath) {
  const parentPath = path.dirname(requestedPath)
  const existingAncestor = await nearestExistingAncestor(parentPath)
  assertInsideVault(vaultRoot, existingAncestor)
  await mkdir(parentPath, { recursive: true })
  assertInsideVault(vaultRoot, await realpath(parentPath))
}

async function nearestExistingAncestor(targetPath) {
  let currentPath = targetPath
  while (currentPath && currentPath !== path.dirname(currentPath)) {
    try {
      return await realpath(currentPath)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      currentPath = path.dirname(currentPath)
    }
  }
  return realpath(currentPath)
}

function assertInsideVault(vaultRoot, targetPath) {
  if (!isVaultRelativePath(path.relative(vaultRoot, targetPath))) {
    throw new Error(ACTIVE_VAULT_ERROR)
  }
}

function relativeNotePathInsideVault(vaultRoot, requestedPath) {
  const relativePath = path.relative(vaultRoot, requestedPath)
  if (!isVaultRelativePath(relativePath) || !relativePath) {
    throw new Error(ACTIVE_VAULT_ERROR)
  }
  return relativePath
}

function resolveInside(root, target) {
  const resolved = path.resolve(root, target)
  const relative = path.relative(root, resolved)
  if (isVaultRelativePath(relative)) return resolved
  return null
}

// Note paths leave the server with `/` on every platform, so a client sees
// `note/alpha.md`, never `note\alpha.md` on Windows (C80).
function toVaultNotePath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function isVaultRelativePath(relativePath) {
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function matchesSearchQuery(title, content, query) {
  return title.toLowerCase().includes(query) || content.toLowerCase().includes(query)
}

function contextNoteWithoutMtime(note) {
  return {
    path: note.path,
    title: note.title,
    type: note.type,
  }
}

async function readVaultContextNote(vaultRoot, filePath) {
  const raw = await readContainedUtf8(vaultRoot, filePath)
  if (raw === null) return null
  const parsed = parseMarkdownNote(raw)
  const rel = toVaultNotePath(path.relative(vaultRoot, filePath))
  const topFolder = extractTopFolder(rel)
  const fileStat = await statContainedRegularFile(vaultRoot, filePath)
  if (!fileStat) return null
  const type = parsed.data.type || parsed.data.is_a || null

  return {
    topFolder,
    type,
    note: {
      path: rel,
      title: parsed.data.title || extractTitle(raw, path.basename(filePath, '.md')),
      type,
      mtime: fileStat.mtimeMs,
    },
  }
}

function parseMarkdownNote(raw) {
  const language = detectFrontmatterLanguage(raw)
  if (language === null) return { data: {}, content: raw }
  if (EXECUTABLE_FRONTMATTER_LANGUAGES.has(language)) {
    return { data: {}, content: raw }
  }
  if (JSON_FRONTMATTER_LANGUAGES.has(language)) {
    return parseJsonFrontmatter(raw)
  }
  if (YAML_FRONTMATTER_LANGUAGES.has(language)) {
    return parseYamlFrontmatter(raw)
  }
  return { data: {}, content: raw }
}

function detectFrontmatterLanguage(raw) {
  const match = String(raw ?? '').match(/^---([A-Za-z0-9_-]*)[ \t]*\r?\n/)
  if (!match) return null
  return match[1].toLowerCase()
}

function parseYamlFrontmatter(raw) {
  const split = splitFrontmatter(raw)
  if (!split) return { data: {}, content: raw }

  return {
    data: parseFrontmatterBlock(split.frontmatter),
    content: split.content,
  }
}

function parseJsonFrontmatter(raw) {
  const match = String(raw ?? '').match(
    /^---json[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/i,
  )
  if (!match) return { data: {}, content: raw }
  try {
    const data = JSON.parse(match[1])
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: {}, content: raw }
    }
    return { data, content: match[2] }
  } catch {
    return { data: {}, content: raw }
  }
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---(?:yaml|yml)?[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/i)
  if (!match) return null
  return { frontmatter: match[1], content: match[2] }
}

function parseFrontmatterBlock(frontmatter) {
  const data = {}
  let listKey = null

  for (const line of frontmatter.split(/\r?\n/)) {
    const item = parseYamlListItem(line)
    if (listKey && item !== null) {
      data[listKey].push(parseYamlScalar(item))
      continue
    }

    listKey = null
    const field = parseTopLevelYamlField(line)
    if (!field) continue

    data[field.key] = field.value ? parseYamlValue(field.value) : []
    listKey = field.value ? null : field.key
  }

  return data
}

function parseTopLevelYamlField(line) {
  if (!line || line.trimStart() !== line || line.trimStart().startsWith('#')) return null

  const separatorIndex = line.indexOf(':')
  if (separatorIndex <= 0) return null

  return {
    key: stripMatchingQuotes(line.slice(0, separatorIndex).trim()),
    value: line.slice(separatorIndex + 1).trim(),
  }
}

function parseYamlValue(value) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInlineYamlArray(value).map(parseYamlScalar)
  }
  return parseYamlScalar(value)
}

function splitInlineYamlArray(value) {
  const inner = value.slice(1, -1)
  const items = []
  let current = ''
  let quote = null

  for (const char of inner) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === ',') {
      items.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) items.push(current.trim())
  return items
}

function parseYamlListItem(line) {
  const match = line.match(/^\s+-\s*(.*)$/)
  return match ? match[1].trim() : null
}

function parseYamlScalar(value) {
  const unquoted = stripMatchingQuotes(value.trim())
  if (unquoted !== value.trim()) return unquoted

  if (/^(true|yes)$/i.test(unquoted)) return true
  if (/^(false|no)$/i.test(unquoted)) return false
  if (/^(null|~)$/i.test(unquoted)) return null
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted)

  return unquoted
}

function stripMatchingQuotes(value) {
  const first = value[0]
  const last = value[value.length - 1]
  return (first === '"' || first === "'") && first === last ? value.slice(1, -1) : value
}

function extractTopFolder(relativePath) {
  const topFolder = relativePath.split('/')[0]
  return topFolder === relativePath ? null : `${topFolder}/`
}

async function readConfigFiles(vaultPath) {
  const agents = await readContainedVaultText(vaultPath, 'config/agents.md')
  return agents === null ? {} : { agents }
}

function isInsideResolvedVault(vaultRoot, targetPath) {
  const relative = path.relative(vaultRoot, targetPath)
  return relative === '' || isVaultRelativePath(relative)
}

async function resolveContainedPath(vaultRoot, lexicalPath) {
  let real
  try {
    real = await realpath(lexicalPath)
  } catch {
    return null
  }
  if (!isInsideResolvedVault(vaultRoot, real)) return null
  return real
}

async function resolveContainedRegularFile(vaultRoot, lexicalPath) {
  try {
    const lst = await lstat(lexicalPath)
    if (
      lst.isDirectory()
      || lst.isFIFO()
      || lst.isSocket()
      || lst.isCharacterDevice()
      || lst.isBlockDevice()
    ) {
      return null
    }
  } catch {
    return null
  }

  const real = await resolveContainedPath(vaultRoot, lexicalPath)
  if (!real) return null

  try {
    const st = await stat(real)
    if (!st.isFile()) return null
  } catch {
    return null
  }
  return real
}

async function statContainedRegularFile(vaultRoot, lexicalPath) {
  const real = await resolveContainedRegularFile(vaultRoot, lexicalPath)
  if (!real) return null
  try {
    return await stat(real)
  } catch {
    return null
  }
}

export async function readContainedVaultText(vaultPath, relativePath) {
  let vaultRoot
  try {
    vaultRoot = await realpath(vaultPath)
  } catch {
    return null
  }
  const lexical = resolveInside(vaultRoot, relativePath)
  if (!lexical) return null
  return readContainedUtf8(vaultRoot, lexical)
}

async function readContainedUtf8(vaultRoot, lexicalPath) {
  const real = await resolveContainedRegularFile(vaultRoot, lexicalPath)
  if (!real) return null
  return readUtf8File(real)
}

async function readUtf8File(filePath) {
  const handle = await open(filePath, 'r')
  try {
    return await handle.readFile('utf-8')
  } finally {
    await handle.close()
  }
}

async function writeNewUtf8File(filePath, content) {
  const handle = await open(filePath, 'wx')
  try {
    await handle.writeFile(content, 'utf-8')
  } finally {
    await handle.close()
  }
}


/**
 * Extract title from markdown content (first H1 or frontmatter title).
 * @param {string} content
 * @param {string} fallback
 * @returns {string}
 */
function extractTitle(content, fallback) {
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()

  const titleMatch = content.match(/^title:\s*(.+)$/m)
  if (titleMatch) return titleMatch[1].trim()

  return fallback
}

/**
 * Extract a snippet around the query match.
 * @param {string} content
 * @param {string} query
 * @returns {string}
 */
function extractSnippet(content, query) {
  const body = content.replace(/^---[\s\S]*?---\n?/, '').trim()
  const idx = body.toLowerCase().indexOf(query)
  if (idx === -1) return body.slice(0, 120)
  const start = Math.max(0, idx - 40)
  const end = Math.min(body.length, idx + query.length + 80)
  return (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '')
}
