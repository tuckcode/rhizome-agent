#!/usr/bin/env python3
"""
Phase 6a: Wiki frontmatter repair script.

Detects .md files whose first body line (after the closing ---) matches
^(kind|project|source):  and moves that line into the frontmatter block,
before the closing ---.

Usage:
  python3 wiki-frontmatter-repair.py --dry-run  <vault-path>
  python3 wiki-frontmatter-repair.py --execute <vault-path>

The dry-run mode is the default if neither flag is given.  --execute
performs the actual edits.

Safety:
  - Requires an explicit --execute flag to mutate files.
  - Operates only on .md files.
  - Skips files that have no frontmatter block (no opening ---).
  - Skips files where the offending line is already inside the frontmatter.
  - Preserves all other body content unchanged.
"""

import argparse
import os
import re
import sys

FRONTMATTER_CLOSE = re.compile(r'^---\s*$')
BODY_LINE_RE = re.compile(r'^(kind|project|source):\s')


def find_frontmatter_end(lines):
    """Return the index of the closing --- line, or -1 if no frontmatter."""
    in_fm = False
    for i, line in enumerate(lines):
        if line.strip() == '---':
            if not in_fm:
                in_fm = True
            else:
                return i
    return -1


def repair_file(path, execute=False):
    """Attempt one repair. Returns (changed, message)."""
    with open(path, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    fm_end = find_frontmatter_end(lines)

    if fm_end < 0:
        return (False, 'no frontmatter block — skipped')

    # Find the first non-empty body line after the closing ---
    first_body_idx = None
    for i in range(fm_end + 1, len(lines)):
        if lines[i].strip() != '':
            first_body_idx = i
            break

    if first_body_idx is None:
        return (False, 'empty body after frontmatter — skipped')

    body_line = lines[first_body_idx].rstrip('\n')
    if not BODY_LINE_RE.match(body_line):
        return (False, f'first body line does not match pattern — skipped')

    # Extract the matched key
    matched_key = BODY_LINE_RE.match(body_line).group(1)

    # Check if this key already exists in the frontmatter
    fm_lines = lines[:fm_end]
    key_already_in_fm = any(
        re.match(rf'^{matched_key}:\s', l.strip()) for l in fm_lines if l.strip()
    )

    if key_already_in_fm:
        return (False, f'{matched_key}: already present in frontmatter — skipped')

    if not execute:
        return (True, f'DRY-RUN: would move line {first_body_idx + 1} `{body_line.strip()}` into frontmatter')

    # Perform the edit: insert the line before the closing ---
    # Remove it from body
    moved_line = lines.pop(first_body_idx)
    # fm_end index shifts by -1 since we removed a line before it
    fm_end -= 1
    # Insert before the closing ---
    lines.insert(fm_end, moved_line)

    new_content = '\n'.join(lines)
    with open(path, 'w') as f:
        f.write(new_content)

    return (True, f'FIXED: moved `{body_line.strip()}` into frontmatter')


def main():
    parser = argparse.ArgumentParser(
        description='Phase 6a wiki frontmatter repair — move kind/project/source lines into frontmatter block'
    )
    parser.add_argument('vault', help='Path to the vault root')
    parser.add_argument('--execute', action='store_true',
                        help='Perform actual file edits (without this flag, dry-run only)')
    parser.add_argument('--ext', default='.md', help='File extension to process (default: .md)')
    args = parser.parse_args()

    vault = os.path.abspath(args.vault)
    if not os.path.isdir(vault):
        print(f'Error: vault path does not exist or is not a directory: {vault}', file=sys.stderr)
        sys.exit(1)

    total = 0
    changed = 0
    skipped = 0
    errors = 0

    for root, dirs, files in os.walk(vault):
        # Skip .git and .obsidian directories
        # Skip .git, .obsidian and other dotdirs
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '.git' and d != '.obsidian']

        for fname in sorted(files):
            if not fname.endswith(args.ext):
                continue
            path = os.path.join(root, fname)
            total += 1
            try:
                did_change, msg = repair_file(path, execute=args.execute)
                if did_change:
                    changed += 1
                    print(f'{path}: {msg}')
                else:
                    skipped += 1
            except Exception as e:
                errors += 1
                print(f'{path}: ERROR {e}', file=sys.stderr)

    mode = 'EXECUTE' if args.execute else 'DRY-RUN'
    print(f'\n--- {mode} summary ---')
    print(f'Total .md files scanned: {total}')
    print(f'Matched (would fix / fixed): {changed}')
    print(f'Skipped: {skipped}')
    print(f'Errors: {errors}')


if __name__ == '__main__':
    main()