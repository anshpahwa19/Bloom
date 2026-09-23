#!/usr/bin/env python3
"""Build BlooMultiverse-Interactive.html — one self-contained file.

src/index.html carries three include markers:
  <!-- @include styles.css -->  <!-- @include media.css -->  <!-- @include app.js -->
media.css references images as {{file.ext}}; each is inlined as a data URI
exactly once, so the output has no external dependencies besides Google Fonts.
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "BlooMultiverse-Interactive.html"
MIME = {".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml"}


def data_uri(name: str) -> str:
    path = SRC / "assets" / name
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{MIME[path.suffix]};base64,{payload}"


def include(match: re.Match) -> str:
    text = (SRC / match.group(1)).read_text(encoding="utf-8")
    return re.sub(r"\{\{([\w.-]+)\}\}", lambda m: data_uri(m.group(1)), text)


html = (SRC / "index.html").read_text(encoding="utf-8")
html = re.sub(r"<!-- @include ([\w.-]+) -->", include, html)
OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT.name} ({OUT.stat().st_size / 1024:.0f} KB)")
