import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'site/.vitepress/cache/',
    'site/.vitepress/dist/',
    'src-tauri/resources/mcp-server/',
    'src-tauri/target/',
    'src-tauri/gen/',
    'tools/',
    // Playwright's output. It is build product, never source — and it is
    // *deleted and recreated* at the start of a run, so a lint walking the
    // tree while the smoke lane starts crashes on a directory that vanished
    // mid-glob. That became reachable when the pre-push gates started running
    // their lanes concurrently (C37); it was always wrong to lint it.
    'test-results/',
    'playwright-report/',
    'blob-report/',
    // Nested worktrees (.claude/worktrees/<name>/) are separate checkouts
    // with their own src-tauri/gen/ etc. — the anchored ignores above don't
    // reach inside them, so a project-wide `eslint .` from the main tree
    // would otherwise lint whatever generated/build artifacts happen to
    // exist in a sibling worktree at the time.
    '.claude/worktrees/',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
