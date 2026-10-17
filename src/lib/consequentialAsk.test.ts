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
  ['Next I will draft the note.', 'Draft the note'],
  ["Next I'll draft the intro.", 'Draft the intro'],
  ['Next, we will outline the next section.', 'Outline the next section'],
  ["Next I'll draft your note.", 'Draft my note'],
  ["Next I'll read yours carefully.", null],
  ["Next I'll check you're done.", null],
  ['Next I will commit these changes.', null],
  ['Next I will purge the cache.', null],
  ['Next I will email the client.', null],
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
    'do the above',
    'execute the above',
    'take care of the above',
    'keep going',
    'carry on',
    'do so',
    'get started',
    'do the rest',
    'finish the job',
    'handle everything',
    'take care of everything',
    'take care of that',
    'proceed with the plan',
    'proceed with the changes',
    'make the changes',
    'go ahead with the deletion',
  ] as const)('denies clause %j', (clause) => {
    expect(predictedCompletion(`Want me to ${clause}?`)).toBeNull()
    expect(predictedCompletion(`Next I'll ${clause}.`)).toBeNull()
  })

  it('shows a read of a shared target and hides a write beside one', () => {
    expect(predictedCompletion('Want me to search my vault for related notes?')).toBeNull()
    expect(predictedCompletion('Want me to summarize the main points?')).toBe(
      'Yes — summarize the main points',
    )
    expect(predictedCompletion('Want me to outline the production plan?')).toBeNull()
    expect(predictedCompletion('Want me to draft the vault note?')).toBeNull()
    expect(predictedCompletion('Want me to add the remote?')).toBeNull()
    expect(isConsequentialAsk('search my vault for related notes')).toBe(false)
    expect(isConsequentialAsk('summarize the main points')).toBe(false)
    expect(isConsequentialAsk('draft the vault note')).toBe(true)
  })

  it('names one safe approval and keeps the ready path on Yes', () => {
    expect(predictedCompletion("Let me know when you're ready and I'll draft the note.")).toBe(
      'Yes — draft the note',
    )
    expect(predictedCompletion("When you're ready, I'll start the outline.")).toBeNull()
    expect(predictedCompletion('Should I draft the note?')).toBe('Yes — draft the note')
    expect(predictedCompletion('Would you like me to outline the next section?')).toBe(
      'Yes — outline the next section',
    )
    expect(isBareApproval('Yes — draft the note')).toBe(false)
    expect(isConsequentialAsk('draft the note')).toBe(false)
  })

  it('strips zero-width characters and rejects a homoglyph verb', () => {
    expect(predictedCompletion('Want me to dra\u200bft the note?')).toBe('Yes — draft the note')
    expect(predictedCompletion('Want me to dr\u0430ft the note?')).toBeNull()
    expect(predictedCompletion('Next I will summar\u0430ize the diff.')).toBeNull()
  })

  it('rejects inflected leading verbs and agent pronouns', () => {
    expect(predictedCompletion('Want me to drafting the note?')).toBeNull()
    expect(predictedCompletion('Next I will drafted the note.')).toBeNull()
    expect(predictedCompletion('Want me to summarizing the main points?')).toBeNull()
    expect(predictedCompletion('Want me to show you the diff?')).toBeNull()
    expect(predictedCompletion('Want me to check my notes?')).toBeNull()
    expect(predictedCompletion("Next I'll check my notes.")).toBeNull()
    expect(predictedCompletion("Next I'll show you the diff.")).toBeNull()
  })

  it('stays silent after a fenced push when asked to do the above', () => {
    const message = '```\ngit push origin main\n```\nWant me to do the above?'
    expect(predictedCompletion('Want me to do the above?')).toBeNull()
    expect(predictedCompletion(message.split('\n').at(-1) ?? '')).toBeNull()
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

  it('allows a native stream and an API model in Safe mode only', () => {
    const text = 'Yes — draft the note'
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      agentId: 'prime',
      permissionMode: 'safe',
    })).toBe(true)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      agentId: 'hermes',
      permissionMode: 'safe',
    })).toBe(true)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'api_model',
      permissionMode: 'safe',
    })).toBe(true)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      agentId: 'codex',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      agentId: 'claude_code',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      agentId: 'prime',
      permissionMode: 'power_user',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text,
      agentId: 'prime',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text,
      targetKind: 'agent',
      permissionMode: 'safe',
    })).toBe(false)
    expect(allowPredictedCompletion({
      text: 'Yes, go ahead',
      targetKind: 'api_model',
      permissionMode: 'safe',
    })).toBe(false)
  })
})

const MUST_BE_NULL = [
  'Want me to add the remote?',
  'Want me to add a new remote for the fork?',
  'Want me to add an upstream remote?',
  'Want me to add the upstream?',
  'Want me to create a branch and push?',
  'Want me to create a branch and then open a PR?',
  'Want me to write to prod config?',
  'Want me to write to the staging config?',
  'Want me to add a cron job that deletes old logs?',
  'Want me to add a cron job that purges old logs?',
  'Want me to add a hook that wipes the cache on commit?',
  'Want me to create a release?',
  'Want me to update the main branch?',
  'Want me to add you to the shared vault?',
  'Want me to add Bob to the shared drive?',
  'Want me to add a collaborator to the repo?',
  'Want me to add the API key to the env file?',
  'Want me to add the secret to GitHub?',
  'Want me to add a webhook to Slack?',
  'Want me to add a payment method?',
  'Want me to add a force flag?',
  'Want me to add --force to the script?',
  'Want me to add sudo to the command?',
  'Want me to write a script that truncates the table and execute it?',
  'Want me to draft the email and send it?',
  'Want me to draft the email and email it?',
  'Want me to draft the email, then email the client?',
  'Want me to draft the reply and fire it off?',
  'Want me to draft the post and tweet it?',
  'Want me to write the migration and roll it out?',
  'Want me to write the commit message and commit?',
  'Want me to write the release notes and cut the release?',
  'Want me to write the file over the old one?',
  'Want me to write over the config?',
  'Want me to write the changes to disk?',
  'Want me to write everything to the database?',
  'Want me to write the new password to the keychain?',
  'Want me to review and approve the PR?',
  'Want me to review the PR and approve it?',
  'Want me to check out the main branch?',
  'Want me to check out the other branch?',
  'Want me to check in the changes?',
  'Want me to start the deployment?',
  'Want me to start the migration?',
  'Want me to start the server?',
  'Want me to start over from scratch?',
  'Want me to start fresh and discard the draft?',
  'Want me to start a new branch off origin?',
  'Want me to list and remove the stale branches?',
  'Want me to search and replace across the vault?',
  'Want me to search and replace across all notes?',
  'Want me to show the diff and commit?',
  'Want me to read the file and overwrite it?',
  'Want me to explain and then rebase?',
  'Want me to add, commit, and push?',
  'Want me to add and commit?',
  'Want me to add the files and commit them?',
  'Want me to sketch it out and ship?',
  'Want me to outline the plan and execute it?',
  'Should I delete the old branch?',
  'Should I rebase onto main?',
  'Should I commit these changes?',
  'Should I add the remote and fetch?',
  'Would you like me to truncate the table?',
  'Would you like me to email the client?',
  'Should I draft the note and then email it to the team?',
  "Next I'll draft the email and send it to the client.",
  "Next, I'll add the files and commit them.",
  "Next, I'll write the migration and execute it.",
  "Next I'll add a cron job that wipes the logs.",
  "Next I'll start the deploy.",
  "Next I'll add you as a collaborator.",
  "Next I'll add your key to the server.",
  "Next I'll write your token to the config.",
  'The next step is to add the remote and fetch.',
  'Want me to read through it?',
  'Want me to read it?',
  'Want me to review them?',
  'Want me to check all?',
  'Want me to check everything?',
  'Want me to search for it?',
  'Want me to start with that?',
  'Want me to write that?',
  'Want me to draft one?',
  'Want me to add some?',
  'Want me to show you?',
  'Want me to add it for you?',
  'Want me to explain it to you?',
  'Want me to add\u00ad the remote?',
  // Inflection is not the base verb. "Review my PR and mine" is two objects joined by "and".
  'Want me to drafts the note?',
  'Want me to review my PR and mine?',
] as const

const STILL_GHOST: ReadonlyArray<readonly [string, string | null]> = [
  ['Would you like me to draft the note?', 'Yes — draft the note'],
  ['Want me to summarize the thread?', 'Yes — summarize the thread'],
  ['Want me to brainstorm some titles?', 'Yes — brainstorm some titles'],
  ['Want me to suggest a few names?', 'Yes — suggest a few names'],
  ['Want me to fix the typo?', 'Yes — fix the typo'],
  ['Want me to rephrase the intro?', 'Yes — rephrase the intro'],
  ['Want me to expand on the second point?', 'Yes — expand on the second point'],
  ['Want me to Draft the note?', 'Yes — Draft the note'],
  ['Want me to DRAFT the note?', 'Yes — DRAFT the note'],
  ['Want me to write-up the notes?', 'Yes — write-up the notes'],
  ['Want me to re-write the intro?', 'Yes — re-write the intro'],
  ['Want me to ａｄｄ the note?', 'Yes — add the note'],
  ['Want me to summarise the main points?', 'Yes — summarise the main points'],
  ['Want me to summarize the pros and cons?', 'Yes — summarize the pros and cons'],
  ['Want me to write the intro and conclusion?', 'Yes — write the intro and conclusion'],
  ['Want me to draft a Q&A?', 'Yes — draft a Q&A'],
  ['Want me to explain C++?', 'Yes — explain C++'],
  ['Want me to find the note that mentions Paris?', 'Yes — find the note that mentions Paris'],
  ['Want me to elaborate on the second point?', 'Yes — elaborate on the second point'],
  ['Want me to walk through the outline?', 'Yes — walk through the outline'],
  ['Want me to shorten the intro?', 'Yes — shorten the intro'],
  ['Want me to simplify the summary?', 'Yes — simplify the summary'],
  ['Want me to proofread the draft?', 'Yes — proofread the draft'],
  ['Want me to polish the intro?', 'Yes — polish the intro'],
  ['Want me to format the paragraph?', 'Yes — format the paragraph'],
  ['Want me to format the list?', 'Yes — format the list'],
  ['Want me to translate it?', 'Yes — translate it'],
  ['Want me to write a poem?', 'Yes — write a poem'],
  ['Want me to add a TL;DR?', 'Yes — add a TL;DR'],
  ['Want me to draft your note?', 'Yes — draft my note'],
  ['Shall I continue?', null],
  ["I've staged the force push to main. Shall I continue?", null],
  ['Want me to continue the outline?', 'Yes — continue the outline'],
  ['Want me to find the note that mentions Paris and delete it?', null],
  ['Want me to find the note that mentions Paris and push it to main?', null],
  ['Want me to find the note that mentions Paris then push?', null],
  ['Want me to search notes that mentions the deploy and run it?', null],
  ['Want me to find notes that mentions delete everything?', null],
  ['Want me to find the note that mentions apikey?', null],
  ['Want me to find the note that mention Paris?', 'Yes — find the note that mention Paris'],
  ['Want me to rewrite my notes?', null],
  ['Want me to rewrite these notes?', null],
  ['Want me to format these notes?', null],
  ['Want me to edit the notes?', null],
  ['Want me to fix the typos in my notes?', null],
  ['Want me to add the thread?', null],
  ['Want me to write the text?', null],
  ['Want me to edit the title?', null],
  ['Your API key is sk-123. Want me to make a note of that?', null],
  ['Want me to make a note of this?', 'Yes — make a note of this'],
  ['Want me to look into the failing test?', null],
  ['Want me to draft the note\nand push it?', null],
  ['Want me to:\n- draft the note\n- push it?', null],
]

describe('single-clause allowlist', () => {
  it.each(MUST_BE_NULL)('%j is null', (phrase) => {
    expect(predictedCompletion(phrase)).toBeNull()
  })

  it.each(STILL_GHOST)('%j → %j', (phrase, expected) => {
    expect(predictedCompletion(phrase)).toBe(expected)
  })
})
