#!/usr/bin/env python3
"""Pointer: the contrast checker lives at scripts/contrast_check.py.

Design-file callers can keep this path:

  python3 docs/design/earth-theme/contrast_check.py docs/design/earth-theme/colors_and_type.css

Default (no args) now checks the shipped Earth/Loam CSS in src/index.css
and src/themes.css. This file only forwards.
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parents[3] / 'scripts' / 'contrast_check.py'
sys.argv[0] = str(TARGET)
runpy.run_path(str(TARGET), run_name='__main__')
