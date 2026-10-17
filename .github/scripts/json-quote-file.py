#!/usr/bin/env python3
"""Print a JSON string of a signature file for alpha-latest.json."""

import json
import pathlib
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
if text.endswith("\n"):
    text = text[:-1]
print(json.dumps(text), end="")
