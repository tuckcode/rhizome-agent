# Contribute

Source: reference/contribute.md
URL: /reference/contribute

Rhizome is free and open source under AGPL-3.0-or-later. All of these happen on GitHub.

## Report a bug

Open an issue on [GitHub Issues](https://github.com/tuckcode/rhizome-agent/issues). Include what happened, what you expected, and the steps to reproduce it.

From inside Rhizome, open **Contribute** from the command palette or Settings → About. It can copy diagnostics with personal details removed, for you to paste into the issue.

## Suggest a feature

Search [GitHub Issues](https://github.com/tuckcode/rhizome-agent/issues) first. Comment on an existing request, or open a new one if yours is new.

## Report a security issue

Don't open a public issue. Follow [SECURITY.md](https://github.com/tuckcode/rhizome-agent/blob/main/SECURITY.md).

## Contribute code

Small, focused pull requests are welcome. Read [CONTRIBUTING.md](https://github.com/tuckcode/rhizome-agent/blob/main/CONTRIBUTING.md) for the local workflow, then open a pull request on [GitHub](https://github.com/tuckcode/rhizome-agent/pulls).

## Origins

See [Credits and licences](credits.md).

---

# Credits and licences

Source: reference/credits.md
URL: /reference/credits

Rhizome is free software under AGPL-3.0-or-later. It builds on the projects below. Copied or ported code is also listed in the repository's `THIRD_PARTY_NOTICES` and `docs/vendored-sources.md`.

| Project | Licence | What Rhizome uses |
|---|---|---|
| [Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi | AGPL-3.0 | Thanks to Tolaria (AGPL-3.0), whose editor code Rhizome adapted. |
| [Mindwalk](https://github.com/cosmtrek/mindwalk) © 2026 Ricko Yu | MIT | The map engine behind [Mycelium](../concepts/mycelium.md). You install it separately; Rhizome calls it |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) © 2026 diegosouzapw | MIT | [Free tier (auto)](../concepts/free-models-and-routing.md): the provider catalog data and cooldown rules are ported from it |
| [freellmapi](https://github.com/tashfeenahmed/freellmapi) | MIT | Free tier (auto): used as an edge-case checklist for retries and failover. No code or hosted catalog is copied |
| [Portent](https://portent.md) ([portent-vault-template](https://github.com/refactoringhq/portent-vault-template) at commit `87c4adc`) © 2026 Refactoring | MIT | The default work types for new vaults, copied into `src-tauri/src/vault/config_seed.rs`. See [Structure a vault with Portent](../guides/structure-with-portent.md) |
| [IronCalc](https://github.com/ironcalc/IronCalc) | MIT or Apache-2.0 | Spreadsheet engine for sheet notes |

---

# File layout

Source: reference/file-layout.md
URL: /reference/file-layout

Rhizome is not opinionated about folder structure. It finds notes recursively across the whole vault, stores new notes in the root by default, and uses types and relationships for real organization.

```txt
my-vault/
  project-alpha.md
  weekly-review.md
  research/
    source-notes.md
  attachments/
    diagram.png
    source.pdf
  project.md
  person.md
  views/
    active-projects.yml
```

## Root notes

Rhizome works well with a flat vault. Folders are optional and can be useful for compatibility with other tools, but they are not required for people, projects, topics, or any other note category.

Type is not inferred from folder location. It comes from frontmatter, and relationships are expressed with wikilinks in fields. That is what Rhizome uses for the sidebar, Properties panel, search, custom views, and neighborhood navigation.

## Special folders

| Folder | Purpose |
| --- | --- |
| `views/` | Saved custom views. |
| `attachments/` | Images and other attached files. |
| `Imports/` | Chats brought in with **Import chat history**, for example `Imports/claude-code/`. |
| `.rhizome/` | Rhizome's own vault files, such as the activity log `events.jsonl`. |

## Agent files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Your conventions for AI agents working in this vault. |
| `CLAUDE.md` | A compatibility copy for tools that look for that name. |

Chats from Rhizome's engine aren't kept in the vault. They're in `native-sessions/` in the app config folder. Prime keeps its sessions in `~/.prime/agent/sessions/`.

PDFs, images, and other non-Markdown files stay as normal files. Folder browsing can show them in place, and Settings controls whether PDFs, images, and unsupported files appear in All Notes.

Whiteboards are Markdown files with durable tldraw data, so they belong with notes rather than in `attachments/`.

Spreadsheets are also Markdown files. A note with `_display: sheet` stores ordinary frontmatter plus a CSV-like body and opens in the sheet editor.

Type definitions are Markdown notes with `type: Type` in frontmatter. New type documents are normal notes, and existing type documents in older folders still work.

## Git files

If the vault is a Git repository, `.git/` belongs to Git. Rhizome reads Git state but does not treat `.git/` as notes.

---

# Frontmatter fields

Source: reference/frontmatter-fields.md
URL: /reference/frontmatter-fields

Rhizome uses conventions instead of a required schema.

| Field | Meaning |
| --- | --- |
| `type` | The note's entity type. |
| `status` | Lifecycle state. |
| `icon` | Per-note icon you set as a normal property. |
| `url` | External URL. |
| `date` | Single date. |
| `belongs_to` | Parent relationship. |
| `related_to` | Lateral relationship. |
| `has` | Contained relationship. |
| `_width` | Per-note editor width override. |
| `_display` | Display mode. Omit for text notes; use `sheet` for spreadsheet notes. |
| `_icon`, `_color` | Type or note appearance metadata. `_icon` values use Phosphor icon names in kebab-case, emoji, or HTTP(S) image URLs. |
| `_sidebar_label`, `_order` | Type sidebar label and order. |
| `_pinned_properties` | Properties pinned for a type. |
| `_sheet` | Sheet-note presentation metadata such as grid settings, column widths, row heights, and cell formatting. |

`icon` is an ordinary property you can see and edit. `_icon` is the system field Rhizome writes when you pick an icon from the app, and it's hidden from property editing.

## Custom fields

You can add your own fields. If a field contains wikilinks, Rhizome can treat it as a relationship.

## System fields

Fields starting with `_` are reserved for system behavior and hidden from standard property editing. They remain plain YAML, so they can still be inspected or changed in raw mode when needed.

Nested keys under a system field are also system-owned. For example, `_sheet.cells.B6.num_fmt` belongs to the sheet editor and should not appear as a normal user property.

---

# Keyboard shortcuts

Source: reference/keyboard-shortcuts.md
URL: /reference/keyboard-shortcuts

Shortcuts are listed for macOS and for Windows and Linux. This list comes from the app's command manifest (`src/shared/appCommandManifest.json`). Press ⌘/ in the app to see the current list.

## General

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Open the command palette | `Cmd+K` | `Ctrl+K` |
| Quick open notes and files | `Cmd+P` or `Cmd+O` | `Ctrl+P` or `Ctrl+O` |
| Open Settings | `Cmd+,` | `Ctrl+,` |
| Show keyboard shortcuts | `Cmd+/` | `Ctrl+/` |
| Reload the vault | `Cmd+Shift+R` | `Ctrl+Shift+R` |

## Layouts and Views

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Chat layout | `Cmd+1` | `Ctrl+1` |
| Notes layout | `Cmd+2` | `Ctrl+2` |
| Workbench layout | `Cmd+3` | `Ctrl+3` |
| Read layout | `Cmd+4` | `Ctrl+4` |
| Open Research (Views) | `Ctrl+Cmd+1` | `Ctrl+Shift+1` |
| Open Graph (Views) | `Ctrl+Cmd+2` | `Ctrl+Shift+2` |
| Open Mycelium (Views) | `Ctrl+Cmd+3` | `Ctrl+Shift+3` |
| Open History (Views) | `Ctrl+Cmd+4` | `Ctrl+Shift+4` |
| Show or hide Chat beside your notes | `Cmd+Shift+L` | `Ctrl+Shift+L` |

## Notes

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Create a new note | `Cmd+N` | `Ctrl+N` |
| Save the current note | `Cmd+S` | `Ctrl+S` |
| Mark the current Inbox note organized | `Cmd+E` | `Ctrl+E` |
| Toggle favorite for the current note | `Cmd+D` | `Ctrl+D` |
| Open the current note in a new window | `Cmd+Shift+O` | `Ctrl+Shift+O` |
| Delete the current note | `Cmd+Backspace` | `Ctrl+Backspace` |

## Editing

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Undo | `Cmd+Z` | `Ctrl+Z` |
| Redo | `Cmd+Shift+Z` | `Ctrl+Shift+Z` |
| Find in the current note | `Cmd+F` | `Ctrl+F` |
| Search the vault | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Paste without formatting | `Cmd+Shift+V` | `Ctrl+Shift+V` |
| Toggle raw Markdown mode | `Cmd+\` | `Ctrl+\` |
| Toggle the Properties panel | `Cmd+Shift+I` | `Ctrl+Shift+I` |
| Toggle the table of contents | `Cmd+Shift+T` | `Ctrl+Shift+T` |

## Navigation and zoom

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Go back | `Cmd+←` | `Ctrl+←` |
| Go forward | `Cmd+→` | `Ctrl+→` |
| Zoom in | `Cmd+=` | `Ctrl+=` |
| Zoom out | `Cmd+-` | `Ctrl+-` |
| Actual size | `Cmd+0` | `Ctrl+0` |

## Not on a shortcut

**Go to Changes** has no shortcut. Run it from the command palette, or click Changes next to All Notes in the sidebar.

Some shortcuts differ by platform because macOS, Windows and Linux reserve different key combinations.

---

# Platforms and updates

Source: reference/platforms-and-updates.md
URL: /reference/platforms-and-updates

Rhizome is a developer preview. It's built and tested on macOS, from source.

| Platform | Status |
|---|---|
| macOS | The preview platform. Build from source; see [Install](../start/install.md) |
| Windows | Builds from source, but isn't supported for daily use yet |
| Linux | Builds from source, but hasn't been checked as an install for someone new |

There is no signed download, no Homebrew package, and no release channel yet. The app reports version `0.1.0`. That's the bundle version, not a promise about every macOS release.

## Update Rhizome

There's no in-app updater. To update:

1. Commit or push important vault changes first. Your notes are local files, but a clean Git state makes recovery simpler.
2. Pull the latest code: `git pull` in your `rhizome-agent` folder.
3. Run `./install.sh`, then `pnpm tauri dev`.

If you built an `.app` before, replace it with a new build.

## Update Prime

If you use Prime as the Chat engine, Rhizome checks for Prime updates but never installs one on its own. When an update is ready, click **Update now**. If it fails, update Prime from a terminal.

## Report a platform bug

Open an issue on [GitHub](https://github.com/tuckcode/rhizome-agent/issues) and include:

- Rhizome version.
- Operating system, version and CPU architecture.
- Whether the vault is local-only or connected to a remote.
- Steps to reproduce.

---

# Spreadsheet file format

Source: reference/spreadsheet-format.md
URL: /reference/spreadsheet-format

Sheet notes are Markdown files with YAML frontmatter and a CSV-like body. The note uses `_display: sheet` when it should open in the spreadsheet editor. The `type` field remains ordinary semantic metadata.

For editing workflows, see [Use Spreadsheets](../guides/use-spreadsheets.md). For formula syntax and function references, see [Spreadsheet Formulas](spreadsheet-functions.md).

## Structure

```md
---
type: Project
_display: sheet
tags:
  - planning
_sheet:
  show_grid_lines: true
  frozen_rows: 1
  frozen_columns: 1
  columns:
    A:
      width: 180
  rows:
    "1":
      height: 32
  cells:
    E6:
      num_fmt: "0.00%"
      bold: true
---
Metric,January,February,March,Q1 Total
Subscriptions,1200,1350,1500,=SUM(B2:D2)
Expenses,650,700,760,=SUM(B3:D3)
Net,=B2-B3,=C2-C3,=D2-D3,=SUM(B4:D4)
Growth,,=(C4-B4)/B4,=(D4-C4)/C4,=(E4-B4)/B4
```

The frontmatter stores note metadata. The body stores rows and cells. There is no Markdown table wrapper, fenced code block, or embedded workbook blob.

## Frontmatter

All ordinary Rhizome fields remain available:

- `type`
- `status`
- `date`
- `tags`
- `url`
- relationship fields such as `belongs_to`, `related_to`, and custom wikilink properties

The `_display: sheet` field is the display-as marker. Omit it for ordinary text notes.

The `_sheet` key is reserved for spreadsheet presentation metadata. It follows the same system-field convention as other underscore-prefixed Rhizome fields: hidden from normal property editing, but visible and editable in raw source.

## Body

The body is CSV-like text:

- rows are separated by line breaks
- cells are separated by commas
- cells containing commas, quotes, or line breaks are quoted
- quotes inside quoted cells are escaped by doubling them
- empty trailing rows and columns may be omitted on save

Any cell whose input starts with `=` is treated as a formula. Other cells are treated as literal values.

## `_sheet` metadata

Rhizome stores spreadsheet presentation state in `_sheet` as plain YAML.

| Field | Meaning |
| --- | --- |
| `show_grid_lines` | Whether grid lines are shown. |
| `frozen_rows` | Number of frozen rows from the top. |
| `frozen_columns` | Number of frozen columns from the left. |
| `columns.<column>.width` | Custom column width, keyed by column letter such as `A` or `BC`. |
| `rows."<row>".height` | Custom row height, keyed by one-based row number. |
| `cells.<cell>.num_fmt` | Number format code for a cell. |
| `cells.<cell>.bold` | Bold text style. |
| `cells.<cell>.italic` | Italic text style. |
| `cells.<cell>.underline` | Underline text style. |
| `cells.<cell>.strike` | Strikethrough text style. |
| `cells.<cell>.font_size` | Font size. |
| `cells.<cell>.font_color` | Text color. |
| `cells.<cell>.fill_color` | Cell fill color. |
| `cells.<cell>.horizontal_align` | Horizontal alignment. |
| `cells.<cell>.vertical_align` | Vertical alignment. |
| `cells.<cell>.wrap_text` | Text wrapping. |
| `cells.<cell>.border_top` | Top border style. |
| `cells.<cell>.border_right` | Right border style. |
| `cells.<cell>.border_bottom` | Bottom border style. |
| `cells.<cell>.border_left` | Left border style. |

Cell metadata is keyed by A1-style cell addresses such as `A1`, `B12`, or `AA30`.

Border values are stored as a style name with an optional color, for example:

```yaml
border_bottom: "thin #d0d7de"
```

## Number formats

Number formats are stored in `num_fmt` using spreadsheet-style format codes. Common examples:

| Format | Example output |
| --- | --- |
| `#,##0` | `1,250` |
| `#,##0.00` | `1,250.50` |
| `0.00%` | `12.35%` |
| `$#,##0.00` | `$1,250.50` |
| `yyyy-mm-dd` | `2026-06-15` |

These formats affect presentation, not the underlying cell input in the CSV body.

## Markdown style import

When Rhizome imports a non-formula CSV cell, simple Markdown wrappers can seed initial styles:

| Cell text | Stored value | Style |
| --- | --- | --- |
| `**Revenue**` | `Revenue` | bold |
| `_Estimate_` | `Estimate` | italic |
| `***Total***` | `Total` | bold and italic |
| `~~Removed~~` | `Removed` | strike |

After save, the style belongs in `_sheet` metadata and the body keeps the unwrapped text.

## Wikilinks

Non-formula cells can store normal Rhizome wikilinks:

```csv
Account,Source
Newsletter,[[newsletter-revenue]]
Sponsors,[[sponsorship-pipeline]]
```

Formula cells can reference another sheet note with Rhizome's cross-sheet syntax:

```txt
=[[newsletter-revenue]].B5
=ROUND([[business-plan]].$E$12, 2)
```

Cross-sheet references resolve another sheet note by wikilink target, then read a single A1-style cell. Circular references and very deep chains are treated as unresolved.

## Guidance for agents and scripts

When editing a sheet note programmatically:

- preserve the YAML frontmatter delimiter and ordinary Rhizome fields
- keep `_display: sheet` when the file should display as a spreadsheet
- keep spreadsheet presentation state under `_sheet`
- parse and serialize the body as CSV, not by splitting on every comma manually
- preserve formulas as formulas, including `[[sheet]].A1` references
- avoid converting formulas to their displayed values
- quote CSV cells when they contain commas, quotes, or line breaks
- do not add workbook tabs inside one note; create another note with `_display: sheet` instead
- do not store opaque binary workbook state in the Markdown file

If a script cannot safely preserve `_sheet`, it should leave that block untouched and edit only the CSV body cells it understands.

---

# Spreadsheet formulas

Source: reference/spreadsheet-functions.md
URL: /reference/spreadsheet-functions

Formula cells start with `=` and are evaluated by IronCalc through Rhizome's sheet editor.

Rhizome adds vault-aware sheet references on top of the normal spreadsheet formula model. Everything else should be treated as IronCalc formula behavior. IronCalc aims for Excel-compatible formulas, but the upstream project is still evolving, so verify advanced formulas against the IronCalc docs when precision matters.

## Basic syntax

| Syntax | Meaning |
| --- | --- |
| `=B2+B3-B4` | Arithmetic over cells. |
| `=SUM(B2:D2)` | Function call over a range. |
| `=ROUND(E6, 2)` | Function call with arguments. |
| `=IF(E6>0, "Up", "Down")` | Conditional expression. |
| `=$B$2` | Absolute column and row reference. |
| `=B$2` | Relative column, absolute row. |
| `=$B2` | Absolute column, relative row. |
| `=B2:D10` | A range in the current sheet note. |
| `="Q" & 1` | Text concatenation. |

Use parentheses when a model depends on precedence:

```txt
=(B2+B3-B4)/B5
```

## Rhizome cross-sheet references

Rhizome supports wikilink cell references for values that live in another sheet note:

```txt
=[[newsletter-revenue]].B5
=SUM(B2:D2)+[[sponsorship-pipeline]].E12
=ROUND([[business-plan]].$E$12, 2)
```

The target inside `[[...]]` resolves like a normal Rhizome wikilink. The cell address after the dot uses A1 notation.

Absolute markers follow spreadsheet copy behavior:

| Reference | Copy behavior |
| --- | --- |
| `[[revenue]].B5` | row and column can shift |
| `[[revenue]].$B$5` | row and column stay fixed |
| `[[revenue]].B$5` | row fixed, column can shift |
| `[[revenue]].$B5` | column fixed, row can shift |

Cross-sheet references currently resolve single cells. Keep range formulas inside one sheet note until cross-note ranges are explicitly supported.

## Autocomplete functions

Rhizome's formula autocomplete exposes the implemented function catalog from the bundled IronCalc engine. The current catalog has 195 functions.

The dropdown shows a small ranked set of matches while you type. Keep typing to narrow the result list. Function names with digits and dots, such as `BIN2DEC` and `ERFC.PRECISE`, are supported.

### Logical

`AND`, `FALSE`, `IF`, `IFERROR`, `IFNA`, `IFS`, `NOT`, `OR`, `SWITCH`, `TRUE`, `XOR`

### Math and trigonometry

`ABS`, `ACOS`, `ACOSH`, `ASIN`, `ASINH`, `ATAN`, `ATAN2`, `ATANH`, `COS`, `COSH`, `PI`, `POWER`, `PRODUCT`, `RAND`, `RANDBETWEEN`, `ROUND`, `ROUNDDOWN`, `ROUNDUP`, `SIN`, `SINH`, `SQRT`, `SQRTPI`, `SUM`, `SUMIF`, `SUMIFS`, `TAN`, `TANH`, `SUBTOTAL`

### Lookup and reference

`CHOOSE`, `COLUMN`, `COLUMNS`, `HLOOKUP`, `INDEX`, `INDIRECT`, `LOOKUP`, `MATCH`, `OFFSET`, `ROW`, `ROWS`, `VLOOKUP`, `XLOOKUP`

### Text

`CONCAT`, `CONCATENATE`, `EXACT`, `FIND`, `LEFT`, `LEN`, `LOWER`, `MID`, `REPT`, `RIGHT`, `SEARCH`, `SUBSTITUTE`, `T`, `TEXT`, `TEXTAFTER`, `TEXTBEFORE`, `TEXTJOIN`, `TRIM`, `UNICODE`, `UPPER`, `VALUE`, `VALUETOTEXT`

### Information

`ERROR.TYPE`, `FORMULATEXT`, `ISBLANK`, `ISERR`, `ISERROR`, `ISEVEN`, `ISFORMULA`, `ISLOGICAL`, `ISNA`, `ISNONTEXT`, `ISNUMBER`, `ISODD`, `ISREF`, `ISTEXT`, `NA`, `SHEET`, `TYPE`

### Statistical

`AVERAGE`, `AVERAGEA`, `AVERAGEIF`, `AVERAGEIFS`, `COUNT`, `COUNTA`, `COUNTBLANK`, `COUNTIF`, `COUNTIFS`, `GEOMEAN`, `MAX`, `MAXIFS`, `MIN`, `MINIFS`

### Date and time

`DATE`, `DAY`, `EDATE`, `EOMONTH`, `MONTH`, `NOW`, `TODAY`, `YEAR`

### Financial

`CUMIPMT`, `CUMPRINC`, `DB`, `DDB`, `DOLLARDE`, `DOLLARFR`, `EFFECT`, `FV`, `IPMT`, `IRR`, `ISPMT`, `MIRR`, `NOMINAL`, `NPER`, `NPV`, `PDURATION`, `PMT`, `PPMT`, `PV`, `RATE`, `RRI`, `SLN`, `SYD`, `TBILLEQ`, `TBILLPRICE`, `TBILLYIELD`, `XIRR`, `XNPV`

### Engineering

`BESSELI`, `BESSELJ`, `BESSELK`, `BESSELY`, `BIN2DEC`, `BIN2HEX`, `BIN2OCT`, `BITAND`, `BITLSHIFT`, `BITOR`, `BITRSHIFT`, `BITXOR`, `COMPLEX`, `CONVERT`, `DEC2BIN`, `DEC2HEX`, `DEC2OCT`, `DELTA`, `ERF`, `ERF.PRECISE`, `ERFC`, `ERFC.PRECISE`, `GESTEP`, `HEX2BIN`, `HEX2DEC`, `HEX2OCT`, `IMABS`, `IMAGINARY`, `IMARGUMENT`, `IMCONJUGATE`, `IMCOS`, `IMCOSH`, `IMCOT`, `IMCSC`, `IMCSCH`, `IMDIV`, `IMEXP`, `IMLN`, `IMLOG10`, `IMLOG2`, `IMPOWER`, `IMPRODUCT`, `IMREAL`, `IMSEC`, `IMSECH`, `IMSIN`, `IMSINH`, `IMSQRT`, `IMSUB`, `IMSUM`, `IMTAN`, `OCT2BIN`, `OCT2DEC`, `OCT2HEX`

## Examples

### Totals

```txt
=SUM(B2:D2)
=B2+B3-B4
=SUM(B2:D2)-SUM(B4:D4)
```

### Growth and percentages

```txt
=(C5-B5)/B5
=IF(B5=0, 0, (C5-B5)/B5)
=ROUND((C5-B5)/B5, 4)
```

Format the result as a percentage with a cell `num_fmt` such as `0.00%`.

### Conditional logic

```txt
=IF(E5>10000, "On track", "Review")
=IFS(E5>10000, "High", E5>5000, "Medium", TRUE, "Low")
=IFERROR(B5/B4, 0)
```

### Dates

```txt
=TODAY()
=DATE(2026, 6, 15)
=YEAR(TODAY())
=MONTH(TODAY())
```

### Text

```txt
=CONCAT(A2, " - ", B2)
=UPPER(A2)
=TRIM(A2)
=TEXT(B2, "$#,##0.00")
```

### Lookup

```txt
=INDEX(B2:E10, 3, 2)
=MATCH("Revenue", A2:A20, 0)
=VLOOKUP("Revenue", A2:E20, 5, FALSE)
=XLOOKUP("Revenue", A2:A20, E2:E20)
```

### Cross-sheet model

```txt
=[[newsletter-revenue]].E5
=SUM(B2:D2)+[[sponsorship-pipeline]].E12
=IF([[business-plan]].$E$12>0, [[business-plan]].$E$12, 0)
```

## IronCalc function families

IronCalc documents formulas by category. Use these upstream pages for detailed syntax and examples. The upstream documentation may include newer functions that are not yet present in Rhizome's bundled IronCalc version.

| Family | Link |
| --- | --- |
| Lookup and reference | [IronCalc lookup and reference](https://docs.ironcalc.com/functions/lookup-and-reference.html) |
| Financial | [IronCalc financial](https://docs.ironcalc.com/functions/financial.html) |
| Engineering | [IronCalc engineering](https://docs.ironcalc.com/functions/engineering.html) |
| Database | [IronCalc database](https://docs.ironcalc.com/functions/database.html) |
| Statistical | [IronCalc statistical](https://docs.ironcalc.com/functions/statistical.html) |
| Text | [IronCalc text](https://docs.ironcalc.com/functions/text.html) |
| Math and trigonometry | [IronCalc math and trigonometry](https://docs.ironcalc.com/functions/math-and-trigonometry.html) |
| Logical | [IronCalc logical](https://docs.ironcalc.com/functions/logical.html) |
| Date and time | [IronCalc date and time](https://docs.ironcalc.com/functions/date-and-time.html) |
| Information | [IronCalc information](https://docs.ironcalc.com/functions/information.html) |

IronCalc also documents [value types](https://docs.ironcalc.com/features/value-types.html), [error types](https://docs.ironcalc.com/features/error-types.html), [optional arguments](https://docs.ironcalc.com/features/optional-arguments.html), and [formatting values](https://docs.ironcalc.com/features/formatting-values.html).

For current upstream gaps, see IronCalc's [unsupported features](https://docs.ironcalc.com/features/unsupported-features.html).

---

# View filters

Source: reference/view-filters.md
URL: /reference/view-filters

View filters define saved lists of notes.

## Common filter ideas

| Goal | Filter direction |
| --- | --- |
| Active projects | `type` is Project and `status` is Active |
| Drafts | `type` is Article and `status` is Draft |
| People follow-up | `type` is Person and date is before today |
| Recent work | modified date is within a recent range |

## Sorting

Useful sorts include:

- Recently modified first.
- Title ascending.
- Status ascending.
- A custom property ascending or descending.

## Operators

Saved views can combine filters for text, dates, relationship fields, and frontmatter values. Relative date expressions are useful for views such as notes changed this week or people that need follow-up.

Regex filters are available for power-user cases. Keep them narrow and test them on a small view first.

## Keep views focused

A view should answer one recurring question. If it becomes too broad, split it into two views.

You can also customize view appearance with the same kind of icon and color controls used by types.