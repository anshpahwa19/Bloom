# BlooMultiverse — working notes

- The design lives in `src/` (index.html, styles.css, media.css, app.js, assets/).
  Never hand-edit the built files; change `src/` and run `python3 build.py`.
- **Publish every change to the existing live link, never a new one:**
  https://claude.ai/artifact/RPNXEfBFNa8GupVeHBzqgZ
  Build first, then publish `hosted/BlooMultiverse.html` with the Artifact tool,
  passing that URL as `url` (read it first when the session has not published it).
  Keep the page title "BlooMultiverse Interactive" and don't pass a new icon.
- `reference/` holds the original prototype (Direction A). Keep every feature
  and content block from it.
