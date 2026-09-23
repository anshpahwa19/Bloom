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
- Design rules to keep consistent:
  - Corners come from the radius tokens in `src/styles.css`, chosen by role:
    `--r-pill` buttons/chips/tags/tabs, `--r-icon` app and icon tiles,
    `--r-sm` rows inside a panel, `--r-md` nested surfaces and dropdowns,
    `--r-lg` cards and floating panels, `--r-xl` feature media, `--r-2xl`
    full-width chapter panels. Nested surfaces stay concentric (inner =
    outer − inset). Never add a literal px radius.
  - Floating chrome (nav capsule, dock, hero fragments) uses the `.frost`
    glass class; nav dropdowns use the `--frost-panel` recipe.
  - The flag cursor (canvas `#flag-cursor` + ring `#flag-ring`, "Flag cursor"
    section of `src/app.js`) uses the logo's fixed blue/red, not the accent.
    Anything clickable should match `FC_HOVER` so the ring appears on it.
  - Chart colours are the `--viz-1..3` tokens (TCDF, Internal Memo, RFP).
    They were validated as a set with the dataviz skill's validator in both
    themes. Re-run it before changing or adding a colour. Text never uses them;
    they mark dots, icon tiles and chart marks only.
  - The Inbox page (`#inbox-page`, "Inbox — the requests workspace" in
    `src/app.js`) reads its Inbox tab from the Attention rows. Keep one
    source of truth; don't copy task data.
  - Counters read `01 / 05`. Carousels put progress, counter and arrows in
    `.rail-foot`, and each chapter's "see all" link is a `.soft-link`.
