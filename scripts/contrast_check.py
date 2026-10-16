#!/usr/bin/env python3
"""Contrast check for Rhizome theme tokens.

Default (no args): shipped app CSS — src/index.css (Graphite dark, Earth
light/dark) and src/themes.css (Loam, Mycelium, community skins).
Appearance loads those files via main.tsx (index.css + themes.css) and
themeMode/applyAppearanceToDocument.

Pass a design token file to keep the old design-file mode:

  python3 scripts/contrast_check.py
  python3 scripts/contrast_check.py docs/design/earth-theme/colors_and_type.css

Prints each text token's ratio on each surface (including hover and
selected), status text on its tinted fill, input borders, and focus rings.
App CSS also checks --text-faint and --text-muted on every dark skin
against --surface-app and the banner tints (resolved cascade).
A color the script cannot parse (hsl(), oklch(), color-mix(), an
unresolved var(), …) is a FAIL that names the theme, token, and raw
value — it is not skipped. Exits non-zero if any pair is below WCAG AA
or any checked token is unparseable:

  text (normal)          4.5:1
  large text / non-text  3.0:1  (borders, focus rings, dedicated icon tokens)
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

TEXT_MIN = 4.5
NONTEXT_MIN = 3.0

# App semantic names first. Shadcn aliases like --muted and --accent in
# index.css point at surfaces, not text — never prefer those as text.
TEXT_ROLES = (
    ('--text-primary', '--fg'),
    ('--text-heading', '--fg-heading'),
    ('--text-secondary', '--fg-secondary'),
    ('--text-tertiary', '--fg-tertiary'),
    ('--text-muted', '--muted'),
    ('--text-faint', '--muted-2'),
    ('--accent-blue', '--accent'),
    ('--ok-text', '--ok'),
    ('--warn-text', '--warn'),
    ('--danger-text', '--danger'),
)

SURF_ROLES = (
    ('--surface-app', '--bg'),
    ('--surface-panel', '--surface'),
    ('--surface-card',),
    ('--surface-popover', '--surface-2'),
    ('--surface-button', '--surface-3'),
    ('--surface-sidebar',),
    ('--surface-input',),
    ('--surface-dialog',),
    ('--surface-editor',),
    ('--titlebar-top',),
    ('--tool-bg',),
    ('--user-bg',),
    ('--state-hover',),
    ('--state-hover-subtle',),
    ('--state-selected',),
    ('--state-selected-strong',),
    ('--state-active',),
)

# Dedicated icon tokens only. Icons that inherit currentColor are covered
# by the text pairs. None of these exist in the Earth/Loam CSS today.
ICON_ROLES = (('--icon', '--icon-fg', '--icon-color'),)

STATUS_ROLES = (
    # text aliases, then tint-fill aliases
    (('--ok-text', '--ok'), ('--ok-bg', '--accent-green-light', '--feedback-success-bg')),
    (('--warn-text', '--warn'), ('--warn-bg', '--accent-orange-light', '--feedback-warning-bg')),
    (('--danger-text', '--danger'), ('--danger-bg', '--accent-red-light', '--feedback-error-bg')),
    (('--accent-blue', '--accent'), ('--accent-dim', '--accent-blue-bg', '--accent-blue-light')),
)

BANNER_TINT_ROLES = (
    ('info', ('--feedback-info-bg', '--accent-blue-light')),
    ('success', ('--feedback-success-bg', '--accent-green-light')),
    ('warning', ('--feedback-warning-bg', '--accent-orange-light')),
    ('error', ('--feedback-error-bg', '--accent-red-light')),
)
BANNER_TEXT_ROLES = ('--text-faint', '--text-muted')

# Syntax / diff ink checked on each skin's app background after cascade.
SYNTAX_DIFF_ROLES = (
    '--syntax-highlight-string',
    '--syntax-highlight-keyword',
    '--syntax-highlight-comment',
    '--diff-added-text',
    '--diff-removed-text',
)

APP_THEME_ELEMENTS = (
    ('Graphite', {'class': 'dark', 'data-theme': 'dark'}),
    ('Earth dark', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'rhizome'}),
    ('Earth light', {'data-theme': 'light'}),
    ('Loam', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'loam'}),
    ('Mycelium', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'mycelium'}),
)

DARK_SKIN_DUMP = (
    ('Graphite', {'class': 'dark', 'data-theme': 'dark'}),
    ('Earth dark', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'rhizome'}),
    ('Loam', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'loam'}),
    ('Mycelium', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'mycelium'}),
    ('Dracula', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'dracula'}),
    ('Nord', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'nord'}),
    ('Gruvbox dark', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'gruvbox-dark'}),
    ('Solarized dark', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'solarized-dark'}),
    ('Catppuccin mocha', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'catppuccin-mocha'}),
    ('Tokyo night', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'tokyo-night'}),
    ('One dark', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'one-dark'}),
    ('Rosé pine', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'rose-pine'}),
    ('Everforest', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'everforest'}),
    ('Monokai pro', {'class': 'dark', 'data-theme': 'dark', 'data-color-theme': 'monokai-pro'}),
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = REPO_ROOT / 'src' / 'index.css'
DEFAULT_THEMES = REPO_ROOT / 'src' / 'themes.css'


def hx(h: str) -> list[int]:
    h = h.lstrip('#')
    if len(h) == 3:
        return [int(c * 2, 16) for c in h]
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def parse(v: str, base: list[int] | None = None) -> list[int] | None:
    try:
        v = v.strip()
        if v.startswith('#'):
            body = v.lstrip('#')
            if len(body) == 8:
                rgb = hx('#' + body[:6])
                alpha = int(body[6:8], 16) / 255
                if alpha >= 1 or base is None:
                    return rgb
                return [round(rgb[i] * alpha + base[i] * (1 - alpha)) for i in range(3)]
            if len(body) in (3, 6):
                return hx(v)
            return None
        m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)', v)
        if not m:
            return None
        r, g, b = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        alpha = float(m.group(4)) if m.group(4) is not None else 1.0
        if alpha >= 1 or base is None:
            return [r, g, b]
        return [
            round(r * alpha + base[0] * (1 - alpha)),
            round(g * alpha + base[1] * (1 - alpha)),
            round(b * alpha + base[2] * (1 - alpha)),
        ]
    except (ValueError, TypeError, IndexError):
        return None


def lum(c: list[int]) -> float:
    s = [x / 255 for x in c]
    s = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in s]
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]


def cr(a: list[int], b: list[int]) -> float:
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def load_sel(text: str, sel: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for blk in re.findall(re.escape(sel) + r'[^{]*\{([^}]*)\}', text):
        for key, value in re.findall(r'(--[\w-]+):\s*([^;]+);', blk):
            out[key] = value
    return out


def strip_css_comments(text: str) -> str:
    return re.sub(r'/\*.*?\*/', '', text, flags=re.S)


def skip_at_rule(text: str, start: int) -> int:
    i = start
    n = len(text)
    while i < n and text[i] not in '{;':
        i += 1
    if i < n and text[i] == ';':
        return i + 1
    depth = 0
    while i < n:
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def iter_style_rules(text: str) -> list[tuple[int, str, dict[str, str]]]:
    text = strip_css_comments(text)
    rules: list[tuple[int, str, dict[str, str]]] = []
    i = 0
    n = len(text)
    order = 0
    while i < n:
        while i < n and text[i].isspace():
            i += 1
        if i >= n:
            break
        if text.startswith('@', i):
            i = skip_at_rule(text, i)
            continue
        brace = text.find('{', i)
        if brace < 0:
            break
        selector = text[i:brace].strip()
        depth = 1
        j = brace + 1
        while j < n and depth:
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
            j += 1
        body = text[brace + 1:j - 1]
        if '{' not in body and selector:
            decls = {key: value.strip() for key, value in re.findall(r'(--[\w-]+):\s*([^;]+);', body)}
            if decls:
                rules.append((order, selector, decls))
                order += 1
        i = j
    return rules


def selector_has_combinator(sel: str) -> bool:
    stripped = re.sub(r':not\([^)]*\)|\[[^\]]*\]', '', sel)
    return bool(re.search(r'[>+~]', stripped) or re.search(r'\s', stripped.strip()))


def specificity(sel: str) -> tuple[int, int, int]:
    a = b = c = 0
    for not_inner, attr, ident, klass, pseudo, type_sel in re.findall(
        r':not\(([^)]*)\)|(\[[^\]]+\])|(#[\w-]+)|(\.[\w-]+)|(:[\w-]+)|([\w-]+)',
        sel,
    ):
        if not_inner:
            nested = specificity(not_inner)
            a += nested[0]
            b += nested[1]
            c += nested[2]
        elif ident:
            a += 1
        elif attr or klass or pseudo:
            b += 1
        elif type_sel:
            c += 1
    return (a, b, c)


def match_compound(sel: str, element: dict[str, str]) -> bool:
    tokens = re.findall(r':not\([^)]*\)|\[[^\]]+\]|:[\w-]+|\.[\w-]+|#[\w-]+|[\w-]+', sel)
    if not tokens:
        return False
    classes = {item for item in element.get('class', '').split() if item}
    for tok in tokens:
        if tok in (':root', 'html'):
            continue
        if tok.startswith('.'):
            if tok[1:] not in classes:
                return False
            continue
        if tok.startswith('#'):
            if element.get('id') != tok[1:]:
                return False
            continue
        if tok.startswith(':not('):
            inner = tok[5:-1]
            if match_compound(inner, element):
                return False
            continue
        if tok.startswith('['):
            match = re.match(r'\[([^=\]]+)(?:="([^"]*)")?\]', tok)
            if not match:
                return False
            attr, value = match.group(1), match.group(2)
            if value is None:
                if attr not in element:
                    return False
            elif element.get(attr) != value:
                return False
            continue
        if tok.startswith(':'):
            continue
        if tok not in ('html', 'root'):
            return False
    return True


def resolve_cascade(text: str, element: dict[str, str], rules: list[tuple[int, str, dict[str, str]]] | None = None) -> dict[str, str]:
    applicable: list[tuple[tuple[int, int, int], int, dict[str, str]]] = []
    for order, grouped, decls in rules or iter_style_rules(text):
        for selector in grouped.split(','):
            sel = selector.strip()
            if not sel or selector_has_combinator(sel):
                continue
            if match_compound(sel, element):
                applicable.append((specificity(sel), order, decls))
    applicable.sort(key=lambda item: (item[0], item[1]))
    tokens: dict[str, str] = {}
    for _, _, decls in applicable:
        tokens.update(decls)
    return tokens


def resolve(tokens: dict[str, str], name: str, seen: set[str] | None = None) -> str:
    seen = seen or set()
    if name in seen:
        return ''
    seen.add(name)
    value = tokens.get(name, '').strip()
    match = re.match(r'var\((--[\w-]+)(?:,[^)]*)?\)', value)
    if match:
        return resolve(tokens, match.group(1), seen)
    return value


def pick_name(tokens: dict[str, str], names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in tokens and tokens[name].strip():
            return name
    return None


def color_of(tokens: dict[str, str], name: str, base: list[int] | None = None) -> list[int] | None:
    return parse(resolve(tokens, name), base)


def unparseable_line(theme: str, token: str, raw: str) -> str:
    return f'FAIL {theme}  {token}  unparseable  {raw}'


def is_design_css(text: str) -> bool:
    return '[data-scheme=' in text and re.search(r'--bg\s*:', text) is not None


def read_files(paths: list[Path]) -> str:
    return '\n'.join(path.read_text() for path in paths)


def theme_schemes(text: str, kind: str) -> list[tuple[str, str, str | None]]:
    if kind == 'design':
        return [
            (':root', 'Earth dark', None),
            ('[data-scheme="loam"]', 'Loam', ':root'),
            ('[data-theme="light"]', 'Earth light', ':root'),
        ]
    return [
        ('[data-theme="dark"]', 'Graphite', None),
        (':root.dark[data-color-theme="rhizome"]', 'Earth dark', '[data-theme="dark"]'),
        ('[data-color-theme="loam"]', 'Loam', '[data-theme="dark"]'),
        ('[data-color-theme="mycelium"]', 'Mycelium', '[data-theme="dark"]'),
        ('[data-theme="light"]', 'Earth light', None),
    ]


def fail_line(theme: str, fg: str, bg: str, ratio: float, need: float, kind: str) -> str:
    return f'FAIL {theme}  {fg} on {bg}  {ratio:.2f}  ({kind} {need:g}:1)'


def report(tokens: dict[str, str], theme: str, kind: str) -> tuple[list[str], list[str]]:
    rows: list[str] = []
    fails: list[str] = []
    seen_unparsed: set[tuple[str, str]] = set()

    def require_color(name: str, base: list[int] | None = None) -> list[int] | None:
        declared = tokens.get(name, '').strip()
        resolved = resolve(tokens, name)
        raw = resolved or declared or '(empty)'
        rgb = parse(resolved, base) if resolved else None
        if rgb is not None:
            return rgb
        key = (name, raw)
        if key not in seen_unparsed:
            seen_unparsed.add(key)
            fails.append(unparseable_line(theme, name, raw))
        return None

    text_names = [name for role in TEXT_ROLES if (name := pick_name(tokens, role))]
    surf_names = [name for role in SURF_ROLES if (name := pick_name(tokens, role))]
    bg_name = pick_name(tokens, ('--surface-app', '--bg'))
    if not text_names or not surf_names or not bg_name:
        fails.append(fail_line(theme, '(tokens)', '(scheme)', 0.0, TEXT_MIN, 'missing'))
        return rows, fails

    bg_rgb = require_color(bg_name)
    if bg_rgb is None:
        return rows, fails

    for text_name in text_names:
        fg_rgb = require_color(text_name)
        if fg_rgb is None:
            continue
        ratios = {}
        for surf_name in surf_names:
            surf_rgb = require_color(surf_name, bg_rgb)
            if surf_rgb is None:
                continue
            ratios[surf_name] = cr(fg_rgb, surf_rgb)
        if not ratios:
            continue
        worst = min(ratios, key=ratios.get)
        on_bg = ratios.get(bg_name, ratios[worst])
        rows.append(
            f'  {text_name} {resolve(tokens, text_name)}  vs {bg_name} {on_bg:.2f}  '
            f'worst {ratios[worst]:.2f} on {worst}'
        )
        for surf_name, ratio in ratios.items():
            if ratio < TEXT_MIN:
                fails.append(fail_line(theme, text_name, surf_name, ratio, TEXT_MIN, 'text'))

    for text_aliases, tint_aliases in STATUS_ROLES:
        text_name = pick_name(tokens, text_aliases)
        tint_name = pick_name(tokens, tint_aliases)
        if not text_name or not tint_name:
            continue
        fg_rgb = require_color(text_name)
        if fg_rgb is None:
            continue
        for surf_name in (bg_name, pick_name(tokens, ('--surface-panel', '--surface')), pick_name(tokens, ('--surface-popover', '--surface-2'))):
            if not surf_name:
                continue
            base = require_color(surf_name, bg_rgb)
            if base is None:
                continue
            tint = require_color(tint_name, base)
            if tint is None:
                continue
            ratio = cr(fg_rgb, tint)
            rows.append(f'  {text_name} on {tint_name}/{surf_name}: {ratio:.2f}')
            if ratio < TEXT_MIN:
                fails.append(fail_line(theme, text_name, f'{tint_name}/{surf_name}', ratio, TEXT_MIN, 'text'))

    panel_name = pick_name(tokens, ('--surface-panel', '--surface'))
    app_name = pick_name(tokens, ('--surface-app', '--bg'))
    banner_bases = [name for name in (panel_name, app_name) if name][:1]
    for tint_label, tint_aliases in BANNER_TINT_ROLES:
        tint_name = pick_name(tokens, tint_aliases)
        if not tint_name:
            continue
        for text_name in BANNER_TEXT_ROLES:
            if text_name not in tokens:
                continue
            fg_rgb = require_color(text_name)
            if fg_rgb is None:
                continue
            for surf_name in banner_bases:
                base = require_color(surf_name, bg_rgb)
                if base is None:
                    continue
                tint = require_color(tint_name, base)
                if tint is None:
                    continue
                ratio = cr(fg_rgb, tint)
                rows.append(
                    f'  {text_name} on {tint_label}/{tint_name}/{surf_name}: {ratio:.2f}'
                )
                if ratio < TEXT_MIN:
                    fails.append(
                        fail_line(
                            theme,
                            text_name,
                            f'{tint_label}/{tint_name}/{surf_name}',
                            ratio,
                            TEXT_MIN,
                            'text',
                        )
                    )

    ink_name = pick_name(tokens, ('--text-inverse', '--accent-ink'))
    accent_name = pick_name(tokens, ('--accent-blue', '--accent'))
    if ink_name and accent_name:
        ink = require_color(ink_name)
        accent = require_color(accent_name)
        if ink and accent:
            ratio = cr(ink, accent)
            rows.append(f'  {ink_name} on {accent_name}: {ratio:.2f}')
            if ratio < TEXT_MIN:
                fails.append(fail_line(theme, ink_name, accent_name, ratio, TEXT_MIN, 'text'))

    muted_name = pick_name(tokens, ('--text-muted', '--muted'))
    selected_name = pick_name(tokens, ('--state-selected-strong',))
    if muted_name and selected_name:
        muted = require_color(muted_name)
        selected = require_color(selected_name, bg_rgb)
        if muted and selected:
            ratio = cr(muted, selected)
            # App CSS uses --text-muted. Keep the design-file probe string
            # once per scheme so earthThemeTokens.test.ts still greps 3 lines.
            if muted_name != '--muted':
                rows.append(f'  --muted on --state-selected-strong: {ratio:.2f}')
            if ratio < TEXT_MIN:
                fails.append(fail_line(theme, muted_name, selected_name, ratio, TEXT_MIN, 'text'))

    hover_name = pick_name(tokens, ('--state-hover',))
    selected_soft = pick_name(tokens, ('--state-selected',))
    for text_name in text_names:
        fg_rgb = require_color(text_name)
        if fg_rgb is None:
            continue
        for surf_name in (hover_name, selected_soft, selected_name):
            if not surf_name:
                continue
            surf_rgb = require_color(surf_name, bg_rgb)
            if surf_rgb is None:
                continue
            ratio = cr(fg_rgb, surf_rgb)
            rows.append(f'  {text_name} on {surf_name}: {ratio:.2f}')

    ring_name = pick_name(tokens, ('--state-focus-ring', '--border-focus', '--accent-blue', '--accent'))
    if ring_name:
        ring = require_color(ring_name)
        if ring:
            ratio = cr(ring, bg_rgb)
            rows.append(f'  {ring_name} on {bg_name}: {ratio:.2f}')
            rows.append(f'  --focus-ring on --bg: {ratio:.2f}')
            if ratio < NONTEXT_MIN:
                fails.append(fail_line(theme, ring_name, bg_name, ratio, NONTEXT_MIN, 'non-text'))
            for surf_name in surf_names:
                surf_rgb = require_color(surf_name, bg_rgb)
                if surf_rgb is None:
                    continue
                ratio = cr(ring, surf_rgb)
                if ratio < NONTEXT_MIN:
                    fails.append(fail_line(theme, ring_name, surf_name, ratio, NONTEXT_MIN, 'non-text'))

    border_name = pick_name(tokens, ('--border-input',))
    if border_name:
        border = require_color(border_name)
        if border:
            for surf_name in surf_names:
                surf_rgb = require_color(surf_name, bg_rgb)
                if surf_rgb is None:
                    continue
                ratio = cr(border, surf_rgb)
                rows.append(f'  {border_name} on {surf_name}: {ratio:.2f}')
                if surf_name in (bg_name, '--surface-app', '--bg') or surf_name.startswith('--surface-') or surf_name.startswith('--state-'):
                    if ratio < NONTEXT_MIN:
                        fails.append(fail_line(theme, border_name, surf_name, ratio, NONTEXT_MIN, 'non-text'))

    icon_name = pick_name(tokens, ICON_ROLES[0])
    if icon_name:
        icon = require_color(icon_name)
        if icon:
            for surf_name in surf_names:
                surf_rgb = require_color(surf_name, bg_rgb)
                if surf_rgb is None:
                    continue
                ratio = cr(icon, surf_rgb)
                rows.append(f'  {icon_name} on {surf_name}: {ratio:.2f}')
                if ratio < NONTEXT_MIN:
                    fails.append(fail_line(theme, icon_name, surf_name, ratio, NONTEXT_MIN, 'non-text'))

    for syntax_name in SYNTAX_DIFF_ROLES:
        if syntax_name not in tokens:
            continue
        fg_rgb = require_color(syntax_name)
        if fg_rgb is None:
            continue
        ratio = cr(fg_rgb, bg_rgb)
        rows.append(f'  {syntax_name} on {bg_name}: {ratio:.2f}')
        if ratio < TEXT_MIN:
            fails.append(fail_line(theme, syntax_name, bg_name, ratio, TEXT_MIN, 'text'))

    return rows, fails


def report_dark_ink(tokens: dict[str, str], theme: str) -> tuple[list[str], list[str]]:
    """Faint and muted on the app surface and banner tints for one dark skin."""
    rows: list[str] = []
    fails: list[str] = []
    bg_name = pick_name(tokens, ('--surface-app', '--bg'))
    if not bg_name:
        fails.append(fail_line(theme, '(tokens)', '(scheme)', 0.0, TEXT_MIN, 'missing'))
        return rows, fails
    bg_resolved = resolve(tokens, bg_name)
    bg_rgb = parse(bg_resolved)
    if bg_rgb is None:
        fails.append(unparseable_line(theme, bg_name, bg_resolved or '(empty)'))
        return rows, fails

    panel_name = pick_name(tokens, ('--surface-panel', '--surface'))
    banner_bases = [name for name in (panel_name, bg_name) if name][:1] or [bg_name]

    for text_name in BANNER_TEXT_ROLES:
        if text_name not in tokens:
            fails.append(fail_line(theme, text_name, bg_name, 0.0, TEXT_MIN, 'missing'))
            continue
        resolved = resolve(tokens, text_name)
        fg_rgb = parse(resolved)
        if fg_rgb is None:
            fails.append(unparseable_line(theme, text_name, resolved or '(empty)'))
            continue
        on_app = cr(fg_rgb, bg_rgb)
        rows.append(f'  {text_name} {resolved}  vs {bg_name} {on_app:.2f}')
        if on_app < TEXT_MIN:
            fails.append(fail_line(theme, text_name, bg_name, on_app, TEXT_MIN, 'text'))

        for tint_label, tint_aliases in BANNER_TINT_ROLES:
            tint_name = pick_name(tokens, tint_aliases)
            if not tint_name:
                continue
            for surf_name in banner_bases:
                base = parse(resolve(tokens, surf_name), bg_rgb)
                if base is None:
                    continue
                tint = parse(resolve(tokens, tint_name), base)
                if tint is None:
                    continue
                ratio = cr(fg_rgb, tint)
                rows.append(
                    f'  {text_name} on {tint_label}/{tint_name}/{surf_name}: {ratio:.2f}'
                )
                if ratio < TEXT_MIN:
                    fails.append(
                        fail_line(
                            theme,
                            text_name,
                            f'{tint_label}/{tint_name}/{surf_name}',
                            ratio,
                            TEXT_MIN,
                            'text',
                        )
                    )
    return rows, fails


def dump_resolved(text: str) -> dict[str, dict[str, str]]:
    rules = iter_style_rules(text)
    out: dict[str, dict[str, str]] = {}
    for name, element in (*APP_THEME_ELEMENTS, *DARK_SKIN_DUMP):
        if name in out:
            continue
        out[name] = resolve_cascade(text, element, rules)
    return out


def run(paths: list[Path]) -> int:
    text = read_files(paths)
    kind = 'design' if all(is_design_css(path.read_text()) for path in paths) else 'app'
    print(f'contrast_check  kind={kind}  files={", ".join(os.path.relpath(path, REPO_ROOT) for path in paths)}')
    all_fails: list[str] = []
    if kind == 'app':
        rules = iter_style_rules(text)
        schemes = [(name, resolve_cascade(text, element, rules)) for name, element in APP_THEME_ELEMENTS]
    else:
        cache: dict[str, dict[str, str]] = {}
        schemes = []
        for sel, name, base_sel in theme_schemes(text, kind):
            tokens = load_sel(text, sel)
            if not tokens:
                continue
            if base_sel:
                base = cache.get(base_sel) or load_sel(text, base_sel)
                tokens = {**base, **tokens}
            cache[sel] = tokens
            schemes.append((name, tokens))
    for name, tokens in schemes:
        if not tokens:
            continue
        rows, fails = report(tokens, name, kind)
        print('==', name)
        for row in rows:
            print(row)
        theme_fails = [item for item in fails if item.startswith(f'FAIL {name}  ')]
        print('FAILS', [item.split('  ', 2)[2] if '  ' in item else item for item in theme_fails] or [])
        all_fails.extend(fails)

    if kind == 'app':
        print('== dark faint/muted')
        product = {name for name, _ in APP_THEME_ELEMENTS}
        for name, element in DARK_SKIN_DUMP:
            tokens = resolve_cascade(text, element, rules)
            rows, fails = report_dark_ink(tokens, name)
            print('--', name)
            for row in rows:
                print(row)
            theme_fails = [item for item in fails if item.startswith(f'FAIL {name}  ')]
            print('FAILS', [item.split('  ', 2)[2] if '  ' in item else item for item in theme_fails] or [])
            if name not in product:
                all_fails.extend(fails)

    print()
    if all_fails:
        print('== FAILING PAIRS')
        for item in all_fails:
            print(item)
    else:
        print('== FAILING PAIRS')
        print('(none)')
    return 1 if all_fails else 0


def main(argv: list[str]) -> int:
    dump = False
    args = list(argv)
    if args and args[0] == '--dump-resolved':
        dump = True
        args = args[1:]
    if args:
        paths = [Path(arg) if os.path.isabs(arg) else Path.cwd() / arg for arg in args]
    else:
        paths = [DEFAULT_INDEX, DEFAULT_THEMES]
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        print('missing CSS:', ', '.join(missing), file=sys.stderr)
        return 2
    if dump:
        import json
        print(json.dumps(dump_resolved(read_files(paths)), sort_keys=True))
        return 0
    return run(paths)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
