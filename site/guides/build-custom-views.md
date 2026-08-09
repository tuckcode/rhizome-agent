# Build Custom Views

Custom views are saved filters for recurring questions.

## Good View Candidates

- Active projects.
- People without a recent follow-up.
- Drafts ready for review.
- Notes changed this week.
- Events in a date range.

## View Definition

Saved views live as files in the vault. They describe filters, sorting, and visible columns using structured data.

## Filters

Custom views can use nested conditions, similar to Notion or Airtable filter groups. Combine `all` and `any` logic when a view needs to answer a more precise question than a single field filter can express.

Date filters support dynamic natural-language values such as `today`, `yesterday`, or `one week ago`. Use these for views that should keep moving over time, such as recent work, stale follow-ups, or upcoming events.

## Design The Question First

Before creating a view, write the question it answers. A good view is not "all fields with all filters"; it is a focused lens.
