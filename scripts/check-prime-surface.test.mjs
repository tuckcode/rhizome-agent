import assert from 'node:assert/strict'
import test from 'node:test'

import {
  diffLists,
  extractDaemonCommandSet,
  extractQuotedTypes,
  formatReport,
  isNewerVersion,
  spokenFromHostSource,
  stripTagPrefix,
} from './check-prime-surface.mjs'

const SUPERVISOR = `
const DAEMON_COMMAND_TYPES = new Set([
  "abort",
  "cancel_rlm_child",
  "get_queue",
  "list",
  "prompt",
  "shutdown",
]);
`

const HOST = `
host.call(serde_json::json!({ "type": "prompt" }))?;
host.call(serde_json::json!({ "type": "cancel_rlm_child", "childId": trimmed }))?;
// event, not a command
emit({ "type": "agent_end" });
`

test('extracts DAEMON_COMMAND_TYPES without the Set constructor noise', () => {
  assert.deepEqual(extractDaemonCommandSet(SUPERVISOR), [
    'abort',
    'cancel_rlm_child',
    'get_queue',
    'list',
    'prompt',
    'shutdown',
  ])
})

test('spoken commands are the host type strings that exist on the daemon', () => {
  assert.deepEqual(
    spokenFromHostSource(HOST, extractDaemonCommandSet(SUPERVISOR)),
    ['cancel_rlm_child', 'prompt'],
  )
})

test('event type names that are not daemon commands are dropped', () => {
  assert.ok(extractQuotedTypes(HOST).includes('agent_end'))
  assert.ok(!spokenFromHostSource(HOST, extractDaemonCommandSet(SUPERVISOR)).includes('agent_end'))
})

test('a missing command set is a hard error, not an empty list', () => {
  assert.throws(() => extractDaemonCommandSet('no commands here'), /DAEMON_COMMAND_TYPES not found/)
})

test('diffs report both directions', () => {
  assert.deepEqual(diffLists(['a', 'c'], ['a', 'b']), { added: ['c'], removed: ['b'] })
})

test('strips a leading v from GitHub tags', () => {
  assert.equal(stripTagPrefix('v0.8.0'), '0.8.0')
})

test('a higher GitHub tag is newer than the snapshot tag', () => {
  assert.equal(isNewerVersion('v0.8.1', 'v0.8.0'), true)
  assert.equal(isNewerVersion('v0.8.0', 'v0.8.0'), false)
})

test('the report names GitHub drift without dumping Prime source', () => {
  const report = formatReport({
    installed: { version: '0.8.0', daemonCommands: ['list'] },
    github: { tag: 'v0.8.1', snapshotTag: 'v0.8.0', newer: true },
  })
  assert.match(report, /GitHub latest is v0.8.1/)
  assert.match(report, /do not dump the Prime tree/)
})
