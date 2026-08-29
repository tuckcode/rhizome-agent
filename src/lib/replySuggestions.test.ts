import { describe, expect, it } from 'vitest'
import { suggestReply } from './replySuggestions'

describe('suggestReply', () => {
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
     * Old parser returned the question back as a yes/no option.
     * A question that just echoes itself back is not a usable reply —
     * it's just repetition. Must return null for these.
     */
    it('non_imperative_yes_no_returns_null', () => {
      expect(suggestReply('Want me to run it now instead?')).toBeNull()
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
  })
})
