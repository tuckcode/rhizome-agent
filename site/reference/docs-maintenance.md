# Docs Maintenance

The public docs live in the app repo so documentation changes can ship with behavior changes.

## Update Docs When You Change

- A Tauri command.
- A new component or hook that changes user behavior.
- A data model or frontmatter convention.
- Git, AI, onboarding, or release behavior.
- Public release pages, download metadata, or updater channels.
- Platform support.
- Keyboard shortcuts.

## Suggested Workflow

1. Make the code change.
2. Update the matching concept, guide, or reference page.
3. Add a troubleshooting page if the change creates a new failure mode.
4. Run `pnpm docs:build`.
5. Check the home page, search, release/download links, and changed docs pages in a browser.

## Page Types

| Type | Purpose |
| --- | --- |
| Start | Helps a new user get into the app. |
| Concepts | Explains mental models. |
| Guides | Teaches workflows. |
| Reference | Gives stable facts and tables. |
| Troubleshooting | Starts from a symptom and ends with recovery. |

## Review Checklist

- Does the page describe current behavior?
- Does it mention macOS primary and Windows/Linux supported-early status when platform support matters?
- Are links relative and VitePress-compatible?
- Can a user discover the page with local search?
