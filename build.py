#!/usr/bin/env python3
"""Build the BlooMultiverse directions — each one self-contained file.

Each source folder has an index.html with include markers such as
  <!-- @include styles.css -->  <!-- @include ../src/media.css -->  <!-- @include app.js -->
Paths resolve from that folder. media.css references images as {{file.ext}};
each is inlined from src/assets as a data URI, so the output has no external
dependencies besides Google Fonts.
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
ASSETS = ROOT / "src" / "assets"
TARGETS = {
    "src": "BlooMultiverse-Interactive.html",  # Direction B · interactive experience
    "ai": "BlooMultiverse-AI.html",            # Direction C · AI-first experience
}
MIME = {".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml"}


def data_uri(name: str) -> str:
    path = ASSETS / name
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{MIME[path.suffix]};base64,{payload}"


def build(folder: str, out_name: str) -> None:
    src = ROOT / folder

    def include(match: re.Match) -> str:
        text = (src / match.group(1)).resolve().read_text(encoding="utf-8")
        return re.sub(r"\{\{([\w.-]+)\}\}", lambda m: data_uri(m.group(1)), text)

    html = (src / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"<!-- @include ([\w./-]+) -->", include, html)
    out = ROOT / out_name
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.name} ({out.stat().st_size / 1024:.0f} KB)")


for folder, out_name in TARGETS.items():
    build(folder, out_name)
