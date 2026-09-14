# #36 — Timezone setting

**Status:** spec. Do not build tonight. Not small.
**Stamped 15:30:** Settings still has date-format only. Source lock in
`VaultContentSettingsSection.test.ts`. Do not add a timezone picker.  
**Origin:** Cursor Grok 4.6 · 2026-09-13 · GitHub [#36](https://github.com/tuckcode/rhizome-agent/issues/36)  
**Pickup:** [`NEXT.md`](../NEXT.md) Platform table.

---

## Plain answer

Dates on screen already follow **this Mac’s clock**. The missing piece is a Settings choice: “show me those times as Chicago even when I am elsewhere.”

It must **not** change filenames, note frontmatter (the YAML at the top of a note), or git.

---

## Locked (issue left these open; this page picks)

1. **Display only.** `Settings.timezone` never writes a date. Two machines can still create different note titles for “today”; that is already true.
2. **One setting, all on-screen clocks.** Note list `mtime`, Chat timestamps, session `startedAt`, search subtitles, note info. Selective “files stay local, sessions follow the setting” is more defensible and will rot. Pick one.
3. **Sheets stay on the workbook’s own zone.** `sheet.rs` already has a timezone. Do not route that through this setting.
4. **No `en.json` keys (C18).** Hardcoded English next to the existing date-format row in `VaultContentSettingsSection`. Reuse the existing `settings.dateDisplay.*` keys if a label already exists; do not add new locale files.

Default: `None` = follow the machine. Stored value: an IANA name (`America/Chicago`), never a UTC offset.

---

## Build later (one slice)

- Rust `Settings.timezone: Option<String>`
- Hook beside `useDateDisplayFormat` (`useAppPreferences.ts`)
- `dateDisplay.ts` uses `Intl.DateTimeFormat` with `timeZone`; stop calling `getHours()` / `getDate()` for display
- Picker: `Intl.supportedValuesOf('timeZone')` + shadcn `Select` next to date format
- Tests first: `dateDisplay.test.ts` with a fixed instant in `America/Chicago` vs `Europe/Rome`; Settings round-trip; `None` matches today’s local behavior
- PostHog: `timezone_display_changed` with the IANA name only (no path, no note text)

**Done when:** changing the setting redraws list times without rewriting a note.

**Not this issue:** writing dates, Windows first-boot, localization.
