/**
 * Approval bridge for the Claude Code engine (ADR-0191 step 4).
 *
 * Claude Code calls the `approve` tool through `--permission-prompt-tool`.
 * This module forwards the ask to the Rhizome app over a loopback socket
 * and turns the answer into Claude Code's permission reply.
 *
 * Every failure denies: no address or token, a refused or dropped
 * connection, a timeout, or an answer that is not exactly allow or deny.
 *
 * Wire format: one JSON line each way.
 *   Request: {"token","tool_name","input","tool_use_id"}
 *   Reply:   {"behavior":"allow"} or {"behavior":"deny","message":"..."}
 */
import net from 'node:net'

export const APPROVAL_ADDR_ENV = 'RHIZOME_APPROVAL_ADDR'
export const APPROVAL_TOKEN_ENV = 'RHIZOME_APPROVAL_TOKEN'
export const APPROVAL_TIMEOUT_ENV = 'RHIZOME_APPROVAL_TIMEOUT_MS'

/** Matches the app's ten-minute wait, plus time for the app's own reply. */
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 + 15 * 1000
const MAX_REPLY_BYTES = 64 * 1024
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export const APPROVE_TOOL = Object.freeze({
  name: 'approve',
  description: 'Rhizome permission prompt for Claude Code. Called by Claude Code, not by the model.',
  inputSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string' },
      input: { type: 'object' },
      tool_use_id: { type: 'string' },
    },
    required: ['tool_name', 'input'],
  },
})

export function denyReply(message) {
  return { behavior: 'deny', message }
}

function normalizeTimeoutMs(value) {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_TIMEOUT_MS
}

function scheduleApprovalTimeout(onTimeout, delayMs) {
  return setTimeout(onTimeout, delayMs)
}

/** Read the bridge settings from the environment. Missing parts stay null. */
export function approvalConfigFromEnv(env = process.env) {
  const parsed = parseAddr(env[APPROVAL_ADDR_ENV] ?? '')
  const token = typeof env[APPROVAL_TOKEN_ENV] === 'string' ? env[APPROVAL_TOKEN_ENV].trim() : ''
  const timeout = Number.parseInt(env[APPROVAL_TIMEOUT_ENV] ?? '', 10)
  return {
    host: parsed?.host ?? null,
    port: parsed?.port ?? null,
    token: token || null,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  }
}

/** `127.0.0.1:1234` or `[::1]:1234`. Only loopback hosts are accepted. */
export function parseAddr(addr) {
  const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d{1,5})$/u.exec(String(addr).trim())
  if (!match) return null
  const host = match[1] ?? match[2]
  const port = Number.parseInt(match[3], 10)
  if (!LOOPBACK_HOSTS.has(host) || port < 1 || port > 65535) return null
  return { host, port }
}

/** Keep only the answer shapes Rhizome sends. Anything else denies. */
export function normalizeReply(raw) {
  if (raw && raw.behavior === 'allow') return { behavior: 'allow' }
  if (raw && raw.behavior === 'deny') {
    const message = typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : 'Rhizome denied this tool call.'
    return denyReply(message)
  }
  return denyReply('Rhizome sent an approval answer it could not read.')
}

/**
 * Ask the app. Resolves to `{behavior:'allow'}` or `{behavior:'deny',message}`
 * and never rejects.
 */
export function requestApproval(config, ask, connect = net.connect) {
  if (!config?.host || !config?.port || !config?.token) {
    return Promise.resolve(denyReply('Rhizome approvals are not connected for this chat.'))
  }
  const delayMs = normalizeTimeoutMs(config.timeoutMs)
  return new Promise((resolve) => {
    let settled = false
    let buffer = ''
    let socket = null
    let timer = null
    const finish = (reply) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket?.destroy()
      resolve(reply)
    }
    try {
      socket = connect({ host: config.host, port: config.port })
    } catch {
      finish(denyReply('Rhizome is not reachable, so this tool call is denied.'))
      return
    }
    const onTimeout = () => finish(denyReply('No one approved this tool call in time.'))
    timer = scheduleApprovalTimeout(onTimeout, delayMs)
    socket.setEncoding?.('utf8')
    socket.on('connect', () => {
      const request = {
        tool_name: typeof ask?.tool_name === 'string' ? ask.tool_name : '',
        input: ask?.input && typeof ask.input === 'object' ? ask.input : {},
        tool_use_id: typeof ask?.tool_use_id === 'string' ? ask.tool_use_id : undefined,
      }
      Reflect.set(request, 'token', config.token)
      socket.write(`${JSON.stringify(request)}\n`)
    })
    socket.on('data', (chunk) => {
      buffer += chunk
      if (buffer.length > MAX_REPLY_BYTES) {
        finish(denyReply('Rhizome sent an approval answer it could not read.'))
        return
      }
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      try {
        finish(normalizeReply(JSON.parse(buffer.slice(0, newline))))
      } catch {
        finish(denyReply('Rhizome sent an approval answer it could not read.'))
      }
    })
    socket.on('error', () => finish(denyReply('Rhizome is not reachable, so this tool call is denied.')))
    socket.on('close', () => finish(denyReply('Rhizome closed the approval before answering.')))
  })
}

/** Claude Code's permission prompt reply, as MCP tool content. */
export function permissionToolResult(reply, input) {
  const body = reply.behavior === 'allow'
    ? { behavior: 'allow', updatedInput: input && typeof input === 'object' ? input : {} }
    : { behavior: 'deny', message: reply.message }
  return { content: [{ type: 'text', text: JSON.stringify(body) }] }
}

export async function handleApprove(args, config = approvalConfigFromEnv(), connect = net.connect) {
  const reply = await requestApproval(config, args, connect)
  return permissionToolResult(reply, args?.input)
}
