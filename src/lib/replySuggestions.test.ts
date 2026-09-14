import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { suggestReply } from './replySuggestions'

describe('suggestReply', () => {
  it('takes only the last agent message — #51 Case 2 stays deferred', () => {
    expect(suggestReply.length).toBe(1)
    const source = readFileSync(`${process.cwd()}/src/lib/replySuggestions.ts`, 'utf8')
    expect(source).toContain('case 2 in #51')
    expect(source).not.toMatch(/\binvoke\(|get_git|list_sessions|unpushedCommits/)
  })

  describe('Real cases from production that broke the old parser', () => {
    /**
     * Old parser split on commas and turned the lead-in into an option.
     * Also truncated at hyphens. Must extract only the actual choices
     * after stripping the lead-in by finding the last ":" or "—".
     */
    it('stripping_lead_in_with_colon_or_dash', () => {
      const msg = 'Next, your call: kill the `en.json` rule, or chase the missing menu-bar icon?'
      const result = suggestReply(msg)
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        expect(result.options[0].label).toBe('kill the `en.json` rule')
        expect(result.options[1].label).toBe('chase the missing menu-bar icon')
      }
    })

    /**
     * Old parser split on ", or " which gave ["Which one — A, B", "both"],
     * then on commas which dropped the first item entirely.
     * Must handle comma-separated lists within "or" structure.
     */
    it('comma_separated_list_with_or', () => {
      const msg = 'Which one — A, B, or both?'
      const result = suggestReply(msg)
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(3)
        expect(result.options[0].label).toBe('A')
        expect(result.options[1].label).toBe('B')
        expect(result.options[2].label).toBe('both')
      }
    })

    /**
     * "Want me to…?" is a consent offer, not a closed choice. Pills would
     * echo the question; Tab fills a named continuation instead of bare "yes".
     */
    it('want_me_to_returns_named_completion', () => {
      const result = suggestReply('Want me to run it now instead?')
      expect(result).toEqual({ kind: 'completion', text: 'Yes, go ahead' })
    })

    /**
     * This should work: it's a clear "X or Y" pattern where both parts
     * after stripping the lead-in are valid options.
     */
    it('clear_or_pattern_with_lead_in', () => {
      const msg = 'Should I fix the tests, or leave them?'
      const result = suggestReply(msg)
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        expect(result.options[0].label).toBe('fix the tests')
        expect(result.options[1].label).toBe('leave them')
      }
    })
  })

  describe('Numbered and bulleted lists', () => {
    it('numbered_list_extracts_all_items', () => {
      const result = suggestReply('1. Keep it 2. Cut it 3. Rewrite it — which?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(3)
        expect(result.options[0].label).toBe('Keep it')
        expect(result.options[1].label).toBe('Cut it')
        expect(result.options[2].label).toBe('Rewrite it')
      }
    })

    it('bullet_list_extracts_all_items', () => {
      const result = suggestReply('- Add auth\n- Skip it\n- Use external service — which?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(3)
      }
    })

    it('multiline_numbered_list_in_message', () => {
      const msg = `Here's what I can do:\n1. Refactor it\n2. Leave as-is\n3. Delete it — which?`
      const result = suggestReply(msg)
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(3)
      }
    })
  })

  describe('Boundary conditions', () => {
    /**
     * Fewer than 2 options is not a choice.
     */
    it('single_option_returns_null', () => {
      expect(suggestReply('A?')).toBeNull()
    })

    /**
     * More than 4 options is a menu, not pills.
     */
    it('more_than_four_options_returns_null', () => {
      const result = suggestReply('1. One 2. Two 3. Three 4. Four 5. Five — pick?')
      expect(result).toBeNull()
    })

    /**
     * Exactly 2 options is valid.
     */
    it('exactly_two_options_is_valid', () => {
      const result = suggestReply('Fix it or skip it?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
      }
    })

    /**
     * Exactly 4 options is valid.
     */
    it('exactly_four_options_is_valid', () => {
      const result = suggestReply('1. A 2. B 3. C 4. D — which?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(4)
      }
    })

    /**
     * Five "or"-separated options is a menu, not pills — same cap as numbered lists.
     */
    it('five_or_separated_options_returns_null', () => {
      expect(suggestReply('A or B or C or D or E?')).toBeNull()
    })

    it('empty_and_whitespace_only_return_null', () => {
      expect(suggestReply('')).toBeNull()
      expect(suggestReply('   ')).toBeNull()
    })
  })

  describe('Cases that should return null', () => {
    /**
     * Open questions ask for free-form input, not a choice.
     */
    it('open_questions_return_null', () => {
      expect(suggestReply('What do you think?')).toBeNull()
      expect(suggestReply('How should this work?')).toBeNull()
      expect(suggestReply('Any ideas?')).toBeNull()
    })

    /**
     * No question mark at all.
     */
    it('statements_without_question_return_null', () => {
      expect(suggestReply('I fixed the bug')).toBeNull()
      expect(suggestReply('Done')).toBeNull()
    })

    /**
     * A question buried in the message is not a trailing question.
     */
    it('mid_message_questions_return_null', () => {
      expect(suggestReply('Should I fix this? I think so.')).toBeNull()
      expect(suggestReply('Want me to push? Let me know.')).toBeNull()
    })

    /**
     * An option longer than ~40 characters is too long for a pill.
     * If this happens, the parse is probably wrong.
     */
    it('returns_null_if_option_too_long', () => {
      const msg = 'Should I implement a very long and complicated feature that takes many words, or skip it?'
      expect(suggestReply(msg)).toBeNull()
    })

    /**
     * " or " in the trailing question is not enough when the first segment
     * after splitting is still too long to become a pill.
     */
    it('or_pattern_with_long_lead_in_returns_null', () => {
      expect(
        suggestReply('I can run the tests if you would like. Fix it or skip it?'),
      ).toBeNull()
    })
  })

  describe('Whitespace and normalization', () => {
    it('normalizes_whitespace', () => {
      const result = suggestReply('  Fix it  or  skip it  ?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options[0].label).toBe('Fix it')
        expect(result.options[1].label).toBe('skip it')
      }
    })

    it('handles_extra_punctuation', () => {
      const result = suggestReply('Fix it or skip it?!')
      expect(result?.kind).toBe('options')
    })

    it('handles_ellipsis', () => {
      const result = suggestReply('Keep it... or change it?')
      expect(result?.kind).toBe('options')
    })
  })

  describe('Simple two-option patterns', () => {
    it('simple_x_or_y_without_comma', () => {
      const result = suggestReply('Rewrite it or delete it?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        for (const option of result.options) {
          expect(option.text).toBe(option.label)
        }
      }
    })

    it('simple_x_or_y_with_comma', () => {
      const result = suggestReply('Rewrite it, or delete it?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
      }
    })

    it('simple_multiple_or_items', () => {
      const result = suggestReply('Add it, update it, or remove it?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(3)
      }
    })
  })

  describe('Imperative action questions', () => {
    /**
     * "Push 33 commits?" is already in imperative form.
     * Use it as the affirmative label, with "No" as the negative.
     */
    it('imperative_action_question_with_no', () => {
      const result = suggestReply('Push 33 commits?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        expect(result.options[0].label).toBe('Push 33 commits')
        expect(result.options[1].label).toBe('No')
      }
    })

    it('another_imperative_question', () => {
      const result = suggestReply('Commit and push?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options[0].label).toBe('Commit and push')
        expect(result.options[1].label).toBe('No')
      }
    })

    it('action_no_option_uses_no_for_label_and_text', () => {
      const result = suggestReply('Run the build?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options[1]).toEqual({ label: 'No', text: 'No' })
      }
    })

    /**
     * Open-question prefixes must not become a yes/no action pill pair.
     */
    it('rejects_open_question_prefixes_for_action_yes_no', () => {
      expect(suggestReply('Should I push?')).toBeNull()
      expect(suggestReply('Can you fix it?')).toBeNull()
      expect(suggestReply('Would you like me to deploy?')).toBeNull()
    })
  })

  describe('Tab completions', () => {
    it('soft_consent_is_yes_go_ahead_not_bare_yes', () => {
      expect(suggestReply('I can run the tests if you would like.')).toEqual({
        kind: 'completion',
        text: 'Yes, go ahead',
      })
      expect(suggestReply('Shall I start the rebuild?')).toEqual({
        kind: 'completion',
        text: 'Yes, go ahead',
      })
    })

    it('ready_when_you_are_does_not_need_a_question_mark', () => {
      expect(suggestReply('Let me know when you are ready.')).toEqual({
        kind: 'completion',
        text: 'Ready — proceed',
      })
    })

    it('echoes_a_stated_next_step', () => {
      expect(suggestReply('Next I will run the tests.')).toEqual({
        kind: 'completion',
        text: 'Run the tests',
      })
    })

    it('open_questions_still_return_null', () => {
      expect(suggestReply('What should I do next?')).toBeNull()
      expect(suggestReply('How do you want to proceed?')).toBeNull()
    })

    it('options_win_when_a_closed_choice_is_also_a_consent_offer', () => {
      const result = suggestReply('Want me to keep it or cut it?')
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        expect(result.options[0].label).toBe('keep it')
        expect(result.options[1].label).toBe('cut it')
      }
    })

    it('options_beat_shall_i_completion_when_closed_choice_present', () => {
      const result = suggestReply('Shall I keep it or cut it?')
      expect(result?.kind).toBe('options')
      expect(result).not.toEqual({ kind: 'completion', text: 'Yes, go ahead' })
    })

    it('numbered_options_beat_consent_completion_in_same_message', () => {
      const result = suggestReply(
        'I can run the tests if you would like. 1. Keep 2. Cut — which?',
      )
      expect(result?.kind).toBe('options')
      if (result?.kind === 'options') {
        expect(result.options).toHaveLength(2)
        expect(result.options[0].label).toBe('Keep')
        expect(result.options[1].label).toBe('Cut')
      }
    })

    it('want_me_to_or_pattern_returns_options_not_completion', () => {
      const result = suggestReply('Want me to run tests or skip them?')
      expect(result?.kind).toBe('options')
      expect(result).not.toEqual({ kind: 'completion', text: 'Yes, go ahead' })
      if (result?.kind === 'options') {
        expect(result.options[0].label).toBe('run tests')
        expect(result.options[1].label).toBe('skip them')
      }
    })
  })
})
