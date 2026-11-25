import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {
  APPROVAL_ADDR_ENV,
  APPROVAL_TIMEOUT_ENV,
  APPROVAL_TOKEN_ENV,
  APPROVE_TOOL,
  approvalConfigFromEnv,
  handleApprove,
  normalizeReply,
  parseAddr,
  requestApproval,
} from './approval-bridge.js'

const TOKEN = 'a'.repeat(64)

/** A fake Rhizome broker. `answer(request, socket)` decides what to send. */
async function withBroker(answer, run) {
  const seen = []
  const server = net.createServer((socket) => {
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      const request = JSON.parse(buffer.slice(0, newline))
      seen.push(request)
      answer(request, socket)
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await run({ host: '127.0.0.1', port, token: TOKEN, timeoutMs: 2000 }, seen)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function parseResult(result) {
  return JSON.parse(result.content[0].text)
}

test('allow passes the original input back as updatedInput', async () => {
  await withBroker((_req, socket) => socket.end('{"behavior":"allow"}\n'), async (config, seen) => {
    const input = { command: 'ls' }
    const result = parseResult(await handleApprove({ tool_name: 'Bash', input, tool_use_id: 't1' }, config))
    assert.deepEqual(result, { behavior: 'allow', updatedInput: input })
    assert.equal(seen[0].token, TOKEN)
    assert.equal(seen[0].tool_name, 'Bash')
    assert.equal(seen[0].tool_use_id, 't1')
  })
})

test('deny keeps the app message', async () => {
  await withBroker(
    (_req, socket) => socket.end('{"behavior":"deny","message":"The person denied this tool call."}\n'),
    async (config) => {
      const result = parseResult(await handleApprove({ tool_name: 'Edit', input: {} }, config))
      assert.deepEqual(result, { behavior: 'deny', message: 'The person denied this tool call.' })
    },
  )
})

test('missing address or token denies without connecting', async () => {
  let connected = false
  const connect = () => {
    connected = true
    throw new Error('should not connect')
  }
  for (const config of [{}, { host: '127.0.0.1', port: 1 }, { host: '127.0.0.1', token: TOKEN }]) {
    const reply = await requestApproval(config, { tool_name: 'Bash', input: {} }, connect)
    assert.equal(reply.behavior, 'deny')
  }
  assert.equal(connected, false)
})

test('a refused connection denies', async () => {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  const reply = await requestApproval({ host: '127.0.0.1', port, token: TOKEN, timeoutMs: 2000 }, { tool_name: 'Bash', input: {} })
  assert.equal(reply.behavior, 'deny')
})

test('the app closing before it answers denies', async () => {
  await withBroker((_req, socket) => socket.destroy(), async (config) => {
    const reply = await requestApproval(config, { tool_name: 'Bash', input: {} })
    assert.equal(reply.behavior, 'deny')
  })
})

test('no answer before the timeout denies', async () => {
  await withBroker(() => {}, async (config) => {
    const reply = await requestApproval({ ...config, timeoutMs: 50 }, { tool_name: 'Bash', input: {} })
    assert.deepEqual(reply, { behavior: 'deny', message: 'No one approved this tool call in time.' })
  })
})

test('an unreadable or unexpected answer denies', async () => {
  for (const line of ['not json\n', '{"behavior":"allowed"}\n', '{}\n', '{"behavior":"ALLOW"}\n']) {
    await withBroker((_req, socket) => socket.end(line), async (config) => {
      const reply = await requestApproval(config, { tool_name: 'Bash', input: {} })
      assert.equal(reply.behavior, 'deny', line)
    })
  }
})

test('normalizeReply only passes exact allow', () => {
  assert.deepEqual(normalizeReply({ behavior: 'allow', updatedInput: { x: 1 } }), { behavior: 'allow' })
  assert.equal(normalizeReply(null).behavior, 'deny')
  assert.equal(normalizeReply({ behavior: 'deny' }).behavior, 'deny')
})

test('only loopback addresses are accepted', () => {
  assert.deepEqual(parseAddr('127.0.0.1:4100'), { host: '127.0.0.1', port: 4100 })
  assert.deepEqual(parseAddr('[::1]:4100'), { host: '::1', port: 4100 })
  assert.equal(parseAddr('10.0.0.5:4100'), null)
  assert.equal(parseAddr('example.com:4100'), null)
  assert.equal(parseAddr('127.0.0.1:0'), null)
  assert.equal(parseAddr('127.0.0.1'), null)
})

test('config comes from the environment and a bad address leaves it unset', () => {
  const ok = approvalConfigFromEnv(
    Object.fromEntries([
      [APPROVAL_ADDR_ENV, '127.0.0.1:4100'],
      [APPROVAL_TOKEN_ENV, TOKEN],
      [APPROVAL_TIMEOUT_ENV, '1000'],
    ]),
  )
  assert.deepEqual(ok, { host: '127.0.0.1', port: 4100, token: TOKEN, timeoutMs: 1000 })
  const bad = approvalConfigFromEnv({ RHIZOME_APPROVAL_ADDR: '8.8.8.8:53' })
  assert.equal(bad.host, null)
  assert.equal(bad.token, null)
})

test('the approve tool is the only tool and needs tool_name and input', () => {
  assert.equal(APPROVE_TOOL.name, 'approve')
  assert.deepEqual(APPROVE_TOOL.inputSchema.required, ['tool_name', 'input'])
})
