---
session: 2026-11-14T13:01-06:00
model: GPT-6.1 Sol
description: >-
  Add six Tailwind type sizes and an ESLint rule that prevents new files from
  introducing arbitrary pixel text sizes, static font sizes, and raw colors.
---

# Type scale

The approved utilities are `text-meta` (11px), `text-small` (12px, also for
monospace text), `text-control` (13px), `text-body` (14px), `text-title`
(16px), and `text-display` (20px). Chromium reported those computed sizes at
the app's 14px root.

The lint rule runs on app source. It permits dynamic sizes and CSS custom
properties. Remove a file's exact exemption from `eslint.config.js` when you
migrate its styles. The two leftover tests now protect visual roles without
requiring arbitrary pixel-size classes.

The change adds utilities for future migrations. Current components use their
existing utilities. This change needs no analytics event.
