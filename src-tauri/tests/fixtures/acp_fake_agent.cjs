#!/usr/bin/env node
// Fake ACP agent for Rhizome tests. Speaks newline-delimited JSON-RPC 2.0
// on stdio. Also mimics `hermes chat` and `hermes acp --check` so the
// Hermes adapter can select ACP vs fallback without a real Hermes install.
'use strict'

const { createInterface } = require('node:readline')

const args = process.argv.slice(2)
const isAcp = args[0] === 'acp' || args.length === 0
const wantsCheck = args.includes('--check')
const wantsVersion = args.includes('--version')

if (isAcp && wantsCheck) {
  process.exit(0)
}

if (isAcp && wantsVersion) {
  process.stdout.write('acp-fake 0.0.1\n')
  process.exit(0)
}

if (args[0] === 'chat') {
  process.stdout.write('Hello from Hermes chat fallback\n')
  process.exit(0)
}

const sessionId = process.env.ACP_FAKE_SESSION_ID || 'sess_fake_1'
const reply = process.env.ACP_FAKE_REPLY || 'Hello from ACP'
const thought = process.env.ACP_FAKE_THOUGHT || ''
const tool = process.env.ACP_FAKE_TOOL || ''
const wantPermission = process.env.ACP_FAKE_PERMISSION === '1'
const failLoad = process.env.ACP_FAKE_FAIL_LOAD === '1'
const loadReplay = process.env.ACP_FAKE_LOAD_REPLAY === '1'
const resume = process.env.ACP_FAKE_RESUME === '1'
const permStyle = process.env.ACP_FAKE_PERM_STYLE || 'hermes'
const rejectUnknown = process.env.ACP_FAKE_UNKNOWN_VERSION === '1'
const echoPrompt = process.env.ACP_FAKE_ECHO_PROMPT === '1'

let nextClientId = 1000
const pending = new Map()

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function notify(method, params) {
  send({ jsonrpc: '2.0', method, params })
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function permissionOptions() {
  if (permStyle === 'spec') {
    return [
      { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
      { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
    ]
  }
  return [
    { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' },
    { optionId: 'allow_session', name: 'Allow for session', kind: 'allow_always' },
    { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
  ]
}

function handlePrompt(id, params) {
  const currentSession = params.sessionId
  const echoed = echoPrompt ? promptText(params) : ''
  if (thought) {
    notify('session/update', {
      sessionId: currentSession,
      update: {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: thought },
      },
    })
  }
  if (tool) {
    notify('session/update', {
      sessionId: currentSession,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'call_1',
        name: tool,
        title: `Running ${tool}`,
        kind: 'read',
        status: 'pending',
        rawInput: { path: '/tmp/x' },
      },
    })
  }
  if (wantPermission) {
    const reqId = nextClientId
    nextClientId += 1
    pending.set(String(reqId), () => finishPrompt(id, currentSession, echoed))
    send({
      jsonrpc: '2.0',
      id: reqId,
      method: 'session/request_permission',
      params: {
        sessionId: currentSession,
        toolCall: {
          toolCallId: 'perm-check-1',
          title: 'Run a dangerous command',
          kind: 'execute',
        },
        options: permissionOptions(),
      },
    })
    return
  }
  finishPrompt(id, currentSession, echoed)
}

function promptText(params) {
  const blocks = params && Array.isArray(params.prompt) ? params.prompt : []
  return blocks
    .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
    .join('')
}

function finishPrompt(id, currentSession, echoed) {
  notify('session/update', {
    sessionId: currentSession,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: echoed || reply },
    },
  })
  if (tool) {
    notify('session/update', {
      sessionId: currentSession,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call_1',
        status: 'completed',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'ok' },
          },
        ],
      },
    })
  }
  respond(id, { stopReason: 'end_turn' })
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }

  if (message.result || message.error) {
    const waiter = pending.get(String(message.id))
    if (waiter) {
      pending.delete(String(message.id))
      waiter(message)
    }
    return
  }

  const { id, method, params } = message
  switch (method) {
    case 'initialize':
      if (rejectUnknown) {
        respond(id, { protocolVersion: 99, agentCapabilities: {} })
        break
      }
      respond(id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: true,
          sessionCapabilities: resume ? { resume: {}, close: {} } : { close: {} },
          promptCapabilities: { image: false, audio: false, embeddedContext: false },
        },
        agentInfo: { name: 'acp-fake', title: 'ACP Fake', version: '0.0.1' },
        authMethods: [],
      })
      break
    case 'session/new':
      respond(id, { sessionId })
      break
    case 'session/load':
      if (failLoad) {
        fail(id, -32000, 'no such session')
        break
      }
      if (loadReplay) {
        notify('session/update', {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'replayed-should-be-silent' },
          },
        })
      }
      respond(id, {})
      break
    case 'session/resume':
      if (failLoad) {
        fail(id, -32000, 'no such session')
        break
      }
      respond(id, {})
      break
    case 'session/set_mode':
      respond(id, {})
      break
    case 'session/prompt':
      handlePrompt(id, params)
      break
    case 'session/cancel':
      break
    case 'session/close':
      respond(id, {})
      break
    default:
      if (id != null) fail(id, -32601, `Method not found: ${method}`)
  }
})
