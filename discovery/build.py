#!/usr/bin/env python3
"""Build the Phase 1 ecosystem deck into one self-contained HTML file.

deck.html references images as {{file.ext}}. Each is looked up in discovery/assets,
then in src/assets (the BlooMultiverse design's images), and inlined as a data URI,
so the output needs nothing from the network besides Google Fonts.
"""
import base64
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ASSET_DIRS = [HERE / "assets", HERE.parent / "src" / "assets"]
OUT = HERE / "Bloom-Ecosystem-Phase1.html"
# The hosted (claude.ai Artifact) copy: the host supplies <!doctype>, <html>,
# <head>, <body>, charset and viewport, so those wrappers are stripped.
HOSTED = HERE / "hosted" / "Bloom-Ecosystem-Phase1.html"
MIME = {".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml"}


def data_uri(name: str) -> str:
    for folder in ASSET_DIRS:
        path = folder / name
        if path.exists():
            payload = base64.b64encode(path.read_bytes()).decode("ascii")
            return f"data:{MIME[path.suffix]};base64,{payload}"
    raise FileNotFoundError(name)


html = (HERE / "deck.html").read_text(encoding="utf-8")
html = re.sub(r"\{\{([\w.-]+)\}\}", lambda m: data_uri(m.group(1)), html)
OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT.name} ({OUT.stat().st_size / 1024:.0f} KB)")

hosted = re.sub(
    r"<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*"
    r"|<meta (?:charset|name=\"(?:viewport|description)\")[^>]*>\s*",
    "", html, flags=re.I)
HOSTED.parent.mkdir(exist_ok=True)
HOSTED.write_text(hosted.lstrip(), encoding="utf-8")
print(f"wrote {HOSTED.relative_to(HERE)} ({HOSTED.stat().st_size / 1024:.0f} KB)")
