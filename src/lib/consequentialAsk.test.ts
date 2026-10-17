import { describe, expect, it } from 'vitest'
import {
  allowPredictedCompletion,
  captureActionClause,
  isBareApproval,
  isConsequentialAsk,
  predictedCompletion,
} from './consequentialAsk'

const CONSEQUENTIAL_VERBS = [
  'push',
  'delete',
  'remove',
  'drop',
  'deploy',
  'ship',
  'merge',
  'pay',
  'send',
  'post',
  'rm',
  'run',
  'migrate',
  'apply',
  'wipe',
  'reset',
  'force',
  'publish',
  'sync',
  'clean up',
  'overwrite',
] as const

/**
 * Phrases that used to become a bare "Yes, go ahead" or "Ready — proceed".
 * Each result is null or a named safe approval. Never a bare yes.
 */
const APPROVAL_PHRASES: ReadonlyArray<readonly [string, string | null]> = [
  ['Want me to push the 33 commits?', null],
  ["Let me know when you're ready and I'll wipe the vault.", null],
  ['Shall I proceed?', null],
  ['Shall I proceed with the merge?', null],
  ['Want me to apply the migration?', null],
  ['Want me to ship it to prod?', null],
  ['…ship it to prod?', null],
  ['Want me to sync it up with origin?', null],
  ['…sync it up with origin?', null],
  ['Want me to clean up the repo?', null],
  ['…clean up the repo?', null],
  ['Want me to take care of the remote?', null],
  ['…take care of the remote?', null],
  ['Want me to pay the invoice?', null],
  ['…pay the invoice?', null],
  ['Shall I run rm -rf build/?', null],
]

const NEXT_STEP_PHRASES: ReadonlyArray<readonly [string, string | null]> = [
  ['Next I will sketch the diagram.', 'Sketch the diagram'],
  ["Next I'll draft the note.", 'Draft the note'],
  ['Next, we will outline the change.', 'Outline the change'],
  ["Next I'll read your notes.", 'Read my notes'],
  ["Next I'll check you're done.", "Check you're done"],
  ["Next I'll force-push main", null],
  ['Next I will run the tests.', null],
  ['The next step is to wipe the vault.', null],
  ['Next, I will delete the branch.', null],
  ['The next step is to clean up the repo.', null],
  ['Next I will ship it to prod.', null],
  ['Next I will push the 33 commits.', null],
  ['The next step is to rm -rf build/.', null],
  ['The next step is to pay the invoice.', null],
  ['Next we will merge the branch.', null],
]

const REQUIRED_NULL = [
  'Shall I proceed?',
  '...with the merge?',
  'apply the migration',
  'ship it to prod',
  'sync it up with origin',
  'clean up the repo',
  'take care of the remote',
  'pay the invoice',
  'Shall I run rm -rf build/?',
  "...and I'll wipe the vault.",
  "Let me know when you're ready.",
  'push the 33 commits',
  "Next I'll force-push to main.",
  'run it now',
] as const

const BARE_APPROVALS = [
  'Yes',
  'yes.',
  'YES!',
  'Yes, go ahead',
  'yes — go ahead',
  'Yes — proceed',
  'Ready — proceed',
  'Ready-proceed',
  'Go ahead',
  '  sure  ',
  'ok',
  'Okay.',
]

describe('consequential asks', () => {
  it.each(REQUIRED_NULL)('%j is null', (row) => {
    expect(predictedCompletion(row)).toBeNull()
  })

  it.each([
    'with the merge',
    'apply the migration',
    'ship it to prod',
    'sync it up with origin',
    'clean up the repo',
    'take care of the remote',
    'pay the invoice',
    'wipe the vault',
    'push the 33 commits',
    'force-push to main',
    'run it now',
    'do it',
  ] as const)('denies clause %j', (clause) => {
    expect(isConsequentialAsk(clause)).toBe(true)
    expect(predictedCompletion(`Want me to ${clause}?`)).toBeNull()
    expect(predictedCompletion(`Next I'll ${clause}.`)).toBeNull()
  })

  it.each(['origin', 'remote', 'prod', 'production', 'main', 'master', 'vault'] as const)(
    'denies shared target %s whatever the verb',
    (target) => {
      expect(isConsequentialAsk(`sketch the ${target}`)).toBe(true)
      expect(predictedCompletion(`Want me to sketch the ${target}?`)).toBeNull()
    },
  )

  it('names one safe approval and keeps the ready path on Yes', () => {
    expect(predictedCompletion("Let me know when you're ready and I'll draft the note.")).toBe(
      'Yes — draft the note',
    )
    expect(isBareApproval('Yes — draft the note')).toBe(false)
    expect(isConsequentialAsk('draft the note')).toBe(false)
  })
  it.each(APPROVAL_PHRASES)('%j is null or a named safe approval', (phrase, expected) => {
    const result = predictedCompletion(phrase)
    expect(result).toBe(expected)
    expect(result === null || isBareApproval(result) === false).toBe(true)
    if (result !== null) {
      const clause = captureActionClause(phrase)
      expect(clause).not.toBeNull()
      expect(result).toContain(clause)
      expect(isConsequentialAsk(clause ?? '')).toBe(false)
    }
  })

  it.each(NEXT_STEP_PHRASES)('next step %j → %j', (phrase, expected) => {
    const result = predictedCompletion(phrase)
    expect(result).toBe(expected)
    expect(result === null || isBareApproval(result) === false).toBe(true)
    if (result !== null) {
      expect(isConsequentialAsk(result)).toBe(false)
    }
  })

  it.each(CONSEQUENTIAL_VERBS)('denies the verb %j', (verb) => {
    const action = verb === 'clean up'
      ? 'clean up the repo'
      : verb === 'rm'
        ? 'rm -rf build/'
        : `${verb} the target`
    expect(isConsequentialAsk(action)).toBe(true)
    expect(predictedCompletion(`Want me to ${action}?`)).toBeNull()
    expect(predictedCompletion(`Next I will ${action}.`)).toBeNull()
    expect(isBareApproval(`Yes — ${action}`)).toBe(false)
  })

  it('captures a clean clause and refuses a bare proceed', () => {
    expect(captureActionClause('Want me to push the 33 commits?')).toBe('push the 33 commits')
    expect(captureActionClause('Shall I proceed with the merge?')).toBe('proceed with the merge')
    expect(captureActionClause("Let me know when you're ready and I'll wipe the vault.")).toBe(
      'wipe the vault',
    )
    expect(captureActionClause('Want me to take care of the remote?')).toBe('take care of the remote')
    expect(captureActionClause('Shall I proceed?')).toBeNull()
    expect(captureActionClause('Let me know when you are ready.')).toBeNull()
  })

  it.each(BARE_APPROVALS)('normalizes %j as a bare approval', (sample) => {
    expect(isBareApproval(sample)).toBe(true)
  })

  it('does not treat a named approval as bare', () => {
    expect(isBareApproval('Yes — push the 33 commits')).toBe(false)
    expect(isBareApproval('Yes — take care of the remote')).toBe(false)
    expect(isBareApproval('Ready — wipe the vault')).toBe(false)
    expect(isBareApproval('Ready — draft the note')).toBe(false)
    expect(isBareApproval('Sketch the diagram')).toBe(false)
  })

  it('does not treat an unrelated word as a consequential verb', () => {
    expect(isConsequentialAsk('sketch the diagram')).toBe(false)
    expect(isConsequentialAsk('application of the patch')).toBe(false)
    expect(isConsequentialAsk('runtime notes')).toBe(false)
    expect(isConsequentialAsk('postpone the review')).toBe(false)
  })

  it('hides predicted completions for a CLI agent and for Power User', () => {
    const samples = [
      'Yes — draft the note',
      'Sketch the diagram',
    ]
    for (const text of samples) {
      expect(allowPredictedCompletion({
        text,
        targetKind: 'agent',
        permissionMode: 'safe',
      })).toBe(false)
      expect(allowPredictedCompletion({
        text,
        targetKind: 'api_model',
        permissionMode: 'power_user',
      })).toBe(false)
      expect(allowPredictedCompletion({
        text,
        targetKind: 'api_model',
        permissionMode: 'safe',
      })).toBe(true)
    }
    expect(allowPredictedCompletion({
      text: 'Yes, go ahead',
      targetKind: 'api_model',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text: 'Force-push main',
      targetKind: 'api_model',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text: 'Ready — proceed',
      targetKind: 'api_model',
      permissionMode: 'safe',
    })).toBe(false)
  })
})
