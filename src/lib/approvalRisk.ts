import { isBashTool } from './nativeToolApproval'
import { commandHasHiddenChars } from './visibleCommand'

/**
 * How much weight an approval prompt gets (ADR-0192).
 *
 * This is display only. The engine decides which tool calls ask. A
 * `routine` tier makes no claim that a command is safe: it means that
 * no rule below matched.
 */
export type ApprovalRiskTier = 'routine' | 'caution' | 'danger'

export interface ApprovalRisk {
  tier: ApprovalRiskTier
  /** Plain sentences, highest tier first. Empty for `routine`. */
  reasons: string[]
}

export interface ApprovalRiskInput {
  tool: string
  command?: string
  path?: string
  created?: boolean
  overwrite?: boolean
}

const DELETES = 'Deletes files. This cannot be undone.'
const ADMIN = 'Runs with administrator rights.'
const DISCARDS = 'Discards changes that are not committed.'
const FORCE_PUSH = 'Replaces history on the remote.'
const RUNS_BUILT_CODE = 'Runs code that it downloads or builds.'
const DISK = 'Changes a disk.'
const PERMISSIONS = 'Changes permissions on many files.'
const HIDDEN = 'Contains hidden or control characters.'
const NETWORK = 'Uses the network.'
const INSTALLS = 'Installs packages.'
const CHANGES_FILES = 'Changes files.'
const CHANGES_GIT = 'Changes the git repository.'
const OUTSIDE_VAULT = 'Uses a path outside your vault.'
const STOPS_PROGRAMS = 'Stops other programs.'
const REPLACES_FILE = 'Replaces the whole file.'

const TIER_RANK: Record<ApprovalRiskTier, number> = { routine: 0, caution: 1, danger: 2 }

interface Finding {
  tier: ApprovalRiskTier
  reason: string
}

interface Segment {
  tokens: string[]
  /** This command reads the output of the command before it. */
  piped: boolean
  /** A redirect writes to a file other than /dev/null. */
  redirectsToFile: boolean
}

interface ParsedCommand {
  segments: Segment[]
  /** Text of `$(...)` and backtick substitutions. */
  nested: string[]
}

const MAX_DEPTH = 4

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'fish', 'ksh'])
const PREFIX_WRAPPERS = new Set(['time', 'nohup', 'command', 'exec', 'nice', 'builtin', 'caffeinate'])
const ADMIN_COMMANDS = new Set(['sudo', 'doas', 'su'])
const DELETE_COMMANDS = new Set(['rm', 'rmdir', 'unlink', 'shred'])
const DISK_COMMANDS = new Set(['dd', 'diskutil', 'fdisk', 'parted'])
const NETWORK_COMMANDS = new Set([
  'curl', 'wget', 'ssh', 'scp', 'sftp', 'rsync', 'nc', 'ncat', 'telnet', 'ftp', 'gh', 'npx', 'pnpx', 'bunx',
])
const FILE_CHANGE_COMMANDS = new Set([
  'mv', 'cp', 'tee', 'touch', 'mkdir', 'ln', 'truncate', 'patch', 'install', 'unzip', 'chmod', 'chown',
])
const STOP_COMMANDS = new Set(['kill', 'killall', 'pkill'])
const PATTERN_COMMANDS = new Set(['sed', 'awk', 'grep', 'rg', 'perl', 'jq'])
const NODE_PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun'])
const NODE_INSTALL_VERBS = new Set(['install', 'i', 'add', 'ci', 'update', 'upgrade', 'remove', 'uninstall'])
const OTHER_INSTALLERS: Record<string, Set<string>> = {
  pip: new Set(['install', 'uninstall']),
  pip3: new Set(['install', 'uninstall']),
  uv: new Set(['add', 'sync', 'pip']),
  brew: new Set(['install', 'upgrade', 'uninstall', 'reinstall']),
  cargo: new Set(['install', 'add']),
  gem: new Set(['install']),
  go: new Set(['install', 'get']),
  apt: new Set(['install', 'remove', 'upgrade']),
  'apt-get': new Set(['install', 'remove', 'upgrade']),
}
const GIT_READ_ONLY = new Set([
  'status', 'log', 'diff', 'show', 'blame', 'describe', 'rev-parse', 'ls-files', 'ls-tree',
  'shortlog', 'grep', 'cat-file', 'reflog', 'help', 'version',
])
const GIT_NETWORK = new Set(['pull', 'fetch', 'clone', 'ls-remote'])
const XARGS_FLAGS_WITH_VALUE = new Set(['-n', '-I', '-P', '-L', '-s', '-d', '-E'])
const DEVICE_SINKS = new Set(['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/stdin', '/dev/tty'])

export function classifyApprovalRisk(input: ApprovalRiskInput): ApprovalRisk {
  const findings = isBashTool(input.tool)
    ? bashFindings(input.command ?? '')
    : fileToolFindings(input)
  return summarize(findings)
}

/** The first sentence of the first reason, for a one-line row. */
export function approvalRiskTag(risk: ApprovalRisk): string | null {
  const first = risk.reasons[0]
  if (!first) return null
  const end = first.indexOf('.')
  return end >= 0 ? first.slice(0, end + 1) : first
}

const REPORTED_TOOLS = new Set(['bash', 'edit_file', 'write_file', 'create_note'])

/** A tool name for analytics. An unknown name becomes `other`. */
export function approvalToolForAnalytics(tool: string): string {
  return REPORTED_TOOLS.has(tool) ? tool : 'other'
}

function summarize(findings: Finding[]): ApprovalRisk {
  const seen = new Set<string>()
  const unique = findings.filter((finding) => {
    if (seen.has(finding.reason)) return false
    seen.add(finding.reason)
    return true
  })
  const ordered = [...unique].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])
  const tier = ordered[0]?.tier ?? 'routine'
  return { tier, reasons: ordered.map((finding) => finding.reason) }
}

function fileToolFindings(input: ApprovalRiskInput): Finding[] {
  const findings: Finding[] = []
  if (input.tool === 'write_file' && input.overwrite) {
    findings.push({ tier: 'caution', reason: REPLACES_FILE })
  }
  if (input.path && isRelativeEscape(input.path)) {
    findings.push({ tier: 'caution', reason: OUTSIDE_VAULT })
  }
  return findings
}

function bashFindings(command: string): Finding[] {
  const findings: Finding[] = []
  if (commandHasHiddenChars(command)) findings.push({ tier: 'danger', reason: HIDDEN })
  collectScriptFindings(command, 0, findings)
  return findings
}

function collectScriptFindings(script: string, depth: number, findings: Finding[]) {
  if (depth > MAX_DEPTH) return
  const parsed = parseCommand(script)
  for (const segment of parsed.segments) {
    if (segment.redirectsToFile) findings.push({ tier: 'caution', reason: CHANGES_FILES })
    collectCommandFindings(segment.tokens, segment.piped, depth, findings)
  }
  for (const nested of parsed.nested) collectScriptFindings(nested, depth + 1, findings)
}

function collectCommandFindings(
  rawTokens: string[],
  piped: boolean,
  depth: number,
  findings: Finding[],
) {
  if (depth > MAX_DEPTH) return
  const tokens = dropAssignments(rawTokens)
  if (tokens.length === 0) return
  const name = commandName(tokens[0])
  const args = tokens.slice(1)

  if (name === 'env') {
    collectCommandFindings(dropAssignments(dropFlags(args)), piped, depth + 1, findings)
    return
  }
  if (PREFIX_WRAPPERS.has(name)) {
    collectCommandFindings(dropFlags(args), piped, depth + 1, findings)
    return
  }
  if (ADMIN_COMMANDS.has(name)) {
    findings.push({ tier: 'danger', reason: ADMIN })
    collectCommandFindings(dropFlags(args), piped, depth + 1, findings)
    return
  }
  if (name === 'xargs') {
    collectCommandFindings(xargsCommand(args), false, depth + 1, findings)
    return
  }

  if (!PATTERN_COMMANDS.has(name) && args.some(isOutsideVaultPath)) {
    findings.push({ tier: 'caution', reason: OUTSIDE_VAULT })
  }

  if (SHELLS.has(name)) {
    collectShellFindings(args, piped, depth, findings)
    return
  }
  if (name === 'find') {
    collectFindFindings(args, depth, findings)
    return
  }
  if (name === 'git') {
    collectGitFindings(args, findings)
    return
  }
  const finding = simpleCommandFinding(name, args)
  if (finding) findings.push(finding)
}

type CommandRule = (name: string, args: string[]) => Finding | null

function rule(tier: ApprovalRiskTier, reason: string, matches: (name: string, args: string[]) => boolean): CommandRule {
  return (name, args) => (matches(name, args) ? { tier, reason } : null)
}

/** The first rule that matches wins, so danger rules come first. */
const COMMAND_RULES: CommandRule[] = [
  rule('danger', RUNS_BUILT_CODE, (name) => name === 'eval'),
  rule('danger', DELETES, (name) => DELETE_COMMANDS.has(name)),
  rule('danger', DISK, (name) => DISK_COMMANDS.has(name) || name.startsWith('mkfs')),
  rule('danger', PERMISSIONS, (name, args) => (
    (name === 'chmod' || name === 'chown') && args.some(isRecursiveFlag)
  )),
  rule('caution', NETWORK, (name) => NETWORK_COMMANDS.has(name)),
  rule('caution', INSTALLS, isInstall),
  rule('caution', CHANGES_FILES, (name, args) => (
    FILE_CHANGE_COMMANDS.has(name) || editsInPlace(name, args) || extractsArchive(name, args)
  )),
  rule('caution', STOPS_PROGRAMS, (name) => STOP_COMMANDS.has(name)),
]

function simpleCommandFinding(name: string, args: string[]): Finding | null {
  for (const match of COMMAND_RULES) {
    const finding = match(name, args)
    if (finding) return finding
  }
  return null
}

function collectShellFindings(args: string[], piped: boolean, depth: number, findings: Finding[]) {
  const flagIndex = args.findIndex((arg) => /^-[a-z]*c$/.test(arg))
  const script = flagIndex >= 0 ? args[flagIndex + 1] : undefined
  if (script !== undefined) {
    if (script.includes('$(') || script.includes('`')) {
      findings.push({ tier: 'danger', reason: RUNS_BUILT_CODE })
    }
    collectScriptFindings(script, depth + 1, findings)
    return
  }
  if (piped) findings.push({ tier: 'danger', reason: RUNS_BUILT_CODE })
}

function collectFindFindings(args: string[], depth: number, findings: Finding[]) {
  if (args.includes('-delete')) findings.push({ tier: 'danger', reason: DELETES })
  args.forEach((arg, index) => {
    if (arg !== '-exec' && arg !== '-execdir' && arg !== '-ok') return
    const rest = args.slice(index + 1)
    const end = rest.findIndex((token) => token === ';' || token === '+')
    collectCommandFindings(end >= 0 ? rest.slice(0, end) : rest, false, depth + 1, findings)
  })
}

function collectGitFindings(args: string[], findings: Finding[]) {
  const rest = gitSubcommandArgs(args)
  const sub = rest[0]
  const subArgs = rest.slice(1)
  if (!sub || GIT_READ_ONLY.has(sub)) return
  if (sub === 'clean') {
    findings.push({ tier: 'danger', reason: DELETES })
    return
  }
  if (discardsChanges(sub, subArgs)) {
    findings.push({ tier: 'danger', reason: DISCARDS })
    return
  }
  if (sub === 'push') {
    const forced = subArgs.some((arg) => arg === '-f' || arg.startsWith('--force'))
    findings.push(forced
      ? { tier: 'danger', reason: FORCE_PUSH }
      : { tier: 'caution', reason: NETWORK })
    return
  }
  if (GIT_NETWORK.has(sub)) {
    findings.push({ tier: 'caution', reason: NETWORK })
    return
  }
  if ((sub === 'branch' || sub === 'remote' || sub === 'tag' || sub === 'stash') && isListing(subArgs)) return
  findings.push({ tier: 'caution', reason: CHANGES_GIT })
}

function discardsChanges(sub: string, args: string[]): boolean {
  if (sub === 'reset') return args.includes('--hard')
  if (sub === 'restore') return true
  if (sub === 'checkout') return args.includes('--') || args.includes('.')
  if (sub === 'stash') return args[0] === 'drop' || args[0] === 'clear'
  return false
}

function isListing(args: string[]): boolean {
  return args.every((arg) => (
    arg === 'list' || arg === '-v' || arg === '-a' || arg === '-l' || arg === '--list' || arg === '--all'
  ))
}

function gitSubcommandArgs(args: string[]): string[] {
  let index = 0
  while (index < args.length && args[index].startsWith('-')) {
    index += args[index] === '-C' || args[index] === '-c' ? 2 : 1
  }
  return args.slice(index)
}

function isInstall(name: string, args: string[]): boolean {
  const verb = args.find((arg) => !arg.startsWith('-'))
  if (!verb) return false
  if (NODE_PACKAGE_MANAGERS.has(name)) return NODE_INSTALL_VERBS.has(verb)
  return OTHER_INSTALLERS[name]?.has(verb) ?? false
}

function editsInPlace(name: string, args: string[]): boolean {
  if (name !== 'sed' && name !== 'perl') return false
  return args.some((arg) => /^-[a-zA-Z]*i/.test(arg) || arg.startsWith('--in-place'))
}

function extractsArchive(name: string, args: string[]): boolean {
  if (name !== 'tar') return false
  const mode = args[0] ?? ''
  return mode.replace(/^-+/, '').includes('x') || args.includes('--extract')
}

function isRecursiveFlag(arg: string): boolean {
  return arg === '--recursive' || /^-[a-zA-Z]*R/.test(arg)
}

function xargsCommand(args: string[]): string[] {
  let index = 0
  while (index < args.length && args[index].startsWith('-')) {
    index += XARGS_FLAGS_WITH_VALUE.has(args[index]) ? 2 : 1
  }
  return args.slice(index)
}

function dropAssignments(tokens: string[]): string[] {
  let index = 0
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1
  return tokens.slice(index)
}

function dropFlags(tokens: string[]): string[] {
  let index = 0
  while (index < tokens.length && tokens[index].startsWith('-')) index += 1
  return tokens.slice(index)
}

function commandName(token: string): string {
  const slash = token.lastIndexOf('/')
  return slash >= 0 ? token.slice(slash + 1) : token
}

function isRelativeEscape(value: string): boolean {
  return value === '~'
    || value.startsWith('~/')
    || value === '..'
    || value.startsWith('../')
    || value.includes('/../')
    || value.endsWith('/..')
}

function isOutsideVaultPath(arg: string): boolean {
  const value = arg.includes('=') && arg.startsWith('-') ? arg.slice(arg.indexOf('=') + 1) : arg
  if (value.includes('://')) return false
  if (isRelativeEscape(value)) return true
  if (!value.startsWith('/') || value.length < 2) return false
  return !DEVICE_SINKS.has(value)
}

/**
 * Split a shell command into simple commands. This is a reader for
 * display, not a shell: it knows quotes, backslash escapes, the
 * operators `;`, `&`, `&&`, `||`, `|`, newlines, parentheses, output
 * redirects, and `$(...)` and backtick substitution.
 */
function parseCommand(script: string): ParsedCommand {
  const chars = [...script]
  const segments: Segment[] = []
  const nested: string[] = []
  let tokens: string[] = []
  let token = ''
  let hasToken = false
  let piped = false
  let redirectsToFile = false
  let index = 0

  function endToken() {
    if (hasToken) tokens.push(token)
    token = ''
    hasToken = false
  }

  function endSegment(nextIsPiped: boolean) {
    endToken()
    if (tokens.length > 0 || redirectsToFile) segments.push({ tokens, piped, redirectsToFile })
    tokens = []
    piped = nextIsPiped
    redirectsToFile = false
  }

  function readSubstitution(open: number): number {
    let depth = 1
    let cursor = open
    while (cursor < chars.length && depth > 0) {
      if (chars[cursor] === '(') depth += 1
      if (chars[cursor] === ')') depth -= 1
      cursor += 1
    }
    nested.push(chars.slice(open, depth === 0 ? cursor - 1 : cursor).join(''))
    return cursor
  }

  function readBackticks(open: number): number {
    let cursor = open
    while (cursor < chars.length && chars[cursor] !== '`') cursor += 1
    nested.push(chars.slice(open, cursor).join(''))
    return cursor + 1
  }

  function readRedirectTarget(start: number): number {
    let cursor = start
    while (cursor < chars.length && (chars[cursor] === ' ' || chars[cursor] === '\t')) cursor += 1
    let target = ''
    while (cursor < chars.length && !/[\s;|&()<>]/.test(chars[cursor])) {
      target += chars[cursor]
      cursor += 1
    }
    const unquoted = target.replace(/^["']|["']$/g, '')
    if (unquoted && !DEVICE_SINKS.has(unquoted)) redirectsToFile = true
    return cursor
  }

  while (index < chars.length) {
    const char = chars[index]

    if (char === '\\') {
      if (index + 1 < chars.length) {
        token += chars[index + 1]
        hasToken = true
      }
      index += 2
      continue
    }
    if (char === "'") {
      const close = chars.indexOf("'", index + 1)
      const end = close < 0 ? chars.length : close
      token += chars.slice(index + 1, end).join('')
      hasToken = true
      index = end + 1
      continue
    }
    if (char === '"') {
      index += 1
      hasToken = true
      while (index < chars.length && chars[index] !== '"') {
        if (chars[index] === '\\' && index + 1 < chars.length) {
          token += chars[index + 1]
          index += 2
        } else if (chars[index] === '$' && chars[index + 1] === '(') {
          const start = index
          index = readSubstitution(index + 2)
          token += chars.slice(start, index).join('')
        } else if (chars[index] === '`') {
          const start = index
          index = readBackticks(index + 1)
          token += chars.slice(start, index).join('')
        } else {
          token += chars[index]
          index += 1
        }
      }
      index += 1
      continue
    }
    if (char === '$' && chars[index + 1] === '(') {
      const start = index
      index = readSubstitution(index + 2)
      token += chars.slice(start, index).join('')
      hasToken = true
      continue
    }
    if (char === '`') {
      const start = index
      index = readBackticks(index + 1)
      token += chars.slice(start, index).join('')
      hasToken = true
      continue
    }
    if (char === '>') {
      if (/^\d+$/.test(token)) {
        token = ''
        hasToken = false
      }
      endToken()
      index += chars[index + 1] === '>' ? 2 : 1
      if (chars[index] === '&') {
        index += 1
        while (index < chars.length && /[\d-]/.test(chars[index])) index += 1
      } else {
        index = readRedirectTarget(index)
      }
      continue
    }
    if (char === '|') {
      const isOr = chars[index + 1] === '|'
      endSegment(!isOr)
      index += isOr ? 2 : 1
      continue
    }
    if (char === '&') {
      endSegment(false)
      index += chars[index + 1] === '&' ? 2 : 1
      continue
    }
    if (char === ';' || char === '\n' || char === '(' || char === ')') {
      endSegment(false)
      index += 1
      continue
    }
    if (char === ' ' || char === '\t' || char === '\r' || char === '<') {
      endToken()
      index += 1
      continue
    }
    token += char
    hasToken = true
    index += 1
  }
  endSegment(false)
  return { segments, nested }
}
