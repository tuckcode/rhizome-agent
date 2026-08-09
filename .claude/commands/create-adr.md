# Create Architecture Decision Record

Use this command when you need to document an architectural decision made during a task.

Inspired by [adr-tools](https://github.com/npryce/adr-tools) (Nygard format), adapted for Laputa's frontmatter-based note format.

## When to use this

Create an ADR when your work involves any of these:
- Choosing a storage strategy (vault vs app settings vs database)
- Adding or removing a major dependency
- Supporting a new platform or target
- Introducing or removing a core abstraction
- Making a cross-cutting decision that affects how future code should be written

Do NOT create ADRs for: bug fixes, UI styling, refactors that preserve behavior, or test additions.

## Creating a new ADR

### 1. Find the next ID

```bash
ls docs/adr/*.md | grep -oP '\d{4}' | sort -n | tail -1 | xargs -I{} printf '%04d\n' $(({} + 1))
```

If no files exist yet, start at `0001`.

### 2. Create the file

Filename: `docs/adr/NNNN-short-kebab-title.md`

Template:

```markdown
---
type: ADR
id: "NNNN"
title: "Short decision title"
status: active
date: YYYY-MM-DD
---

## Context

The issue motivating this decision, and any context that influences or constrains it.

## Decision

**The change we're proposing or have agreed to implement.** State it clearly in one or two sentences — bold so it stands out.

## Options considered

- **Option A** (chosen): brief description — pros / cons
- **Option B**: brief description — pros / cons
- **Option C**: brief description — pros / cons

## Consequences

What becomes easier or harder as a result?
What risks does this introduce that will need to be mitigated?
What would trigger re-evaluation of this decision?

## Advice

*(optional)* Input received before making this decision — who was consulted, what they said.
Omit this section if the decision was made without external input.
```

### 3. Update the index

Add a row to `docs/adr/README.md`:

```markdown
| [NNNN](NNNN-short-kebab-title.md) | Title | active |
```

### 4. Include in the same commit as the feature

```bash
git add docs/adr/NNNN-*.md docs/adr/README.md
# fold into the feature commit — do not create a separate commit just for the ADR
```

---

## Superseding an existing ADR

Equivalent of `adr new -s <N>` from adr-tools — do this in two steps:

### Step 1: Mark the old ADR as superseded

Edit the existing file — add `superseded_by` and update `status`:

```yaml
---
type: ADR
id: "000N"
title: "Old decision title"
status: superseded          # ← change from active
superseded_by: "NNNN"       # ← add this
date: YYYY-MM-DD
---
```

**Never edit the content sections** of an active ADR — only the status metadata.

### Step 2: Create the new ADR

Follow the steps above. In the **Context** section, reference the superseded ADR:

```markdown
## Context

Supersedes [ADR-000N](000N-old-title.md).

[explain why the old decision no longer holds]
```

### Step 3: Update the README index

Change the old row's status to `superseded`, add the new row.

---

## Best practices (from adr-tools / Nygard)

- **One decision per ADR** — if you find yourself writing "and also", split it
- **Write Decision first** — if you can't state it in 1-2 sentences, the decision is too vague
- **Context is the "why now"** — what forced this decision to be made today?
- **Consequences should include negatives** — a one-sided ADR is a red flag
- **Committed = immutable** — once pushed, the content doesn't change; only status metadata does
- **If in doubt, create one** — cheaper to have an unnecessary ADR than to lose context
- Date = today's date, `YYYY-MM-DD`
