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
    section of `src/app.js`) uses the logo's fixed red/blue (red on top, as on the logo), not the accent.
    Anything clickable should match `FC_HOVER` so the ring appears on it.
  - Chart colours are the `--viz-1..4` tokens. Request types use slots 1–3
    (TCDF, Internal Memo, RFP); the Inbox donut's apps use all four
    (Salesforce 1, Darwinbox 2, UiPath 3, SAP 4). The four were validated
    all-pairs with the dataviz skill's validator in both themes. Re-run it
    before changing or adding a colour. Text never uses them; they mark dots,
    icon tiles and chart marks only.
  - The Inbox page (`#inbox-page`, "Inbox — the requests workspace" in
    `src/app.js`) reads its Inbox tab from the Attention rows. Keep one
    source of truth; don't copy task data.
  - Announcements are one `slides` list in `src/app.js`: one slide per
    birthday, then the anniversary, fire drill and Eid. The feed has one tile
    per kind (`ANN_TILES`); birthdays share a tile. Each kind sets
    `data-mood` on the chapter, which tints it (`.announce__mood--*`).
    Birthday wishes and anniversary congratulations share the wish dialog
    (`WISH`).
  - Perks come from the one `perks` list in `src/app.js`, which feeds the
    chips, index, spotlight and search. Add a perk there, never in the
    markup. Only the first four are real (from the original); the rest are
    placeholders that show the layout at scale. A perk without `img` gets
    generated art in its category hue (`--pc-*`, decoration only).
  - The logo's flag is red on top, blue below (both logo files; the flag
    cursor and its menu icon follow it). The colours are the logo's own.
  - Bloom GPT (`#gpt-page`, "Bloom GPT" section of `src/app.js`) answers
    from the page's data through `GPT_SKILLS`, picked by `GPT_ROUTES` (first
    match wins, order matters), and acts through `GPT_ACTS`. Anything that
    leaves the page closes Bloom GPT first (`gptLeave`). Add a new kind of
    answer as a skill plus a route; never hard-code data the page already
    has.
  - Counters read `01 / 05`. Carousels put progress, counter and arrows in
    `.rail-foot`, and each chapter's "see all" link is a `.soft-link`.
  - Nothing gets cut at the side:
    - Word and line reveal masks clip vertically only
      (`overflow-x: visible; overflow-y: clip`). The tight tracking otherwise
      shaves off the last letter.
    - Scroll strips and clipping carousels leave padding for selected rings,
      focus rings, hover lifts and halos.
    - Tab bars fit their width on phones.
  - Phones down to 320px (iPhone SE) are supported. The nav capsule never
    pushes the ☰ button off-screen: the section name gives way first. At
    ≤419px the jump chevron hides; at ≤359px Search moves into the ☰ menu
    (`.mo__only-narrow`) and the logo hides once past the hero. Re-check
    every section label at 320 and 375 after adding anything to the capsule.
  - Dark-mode shadows stay neutral and soft (the dark `--sh-*`,
    `--frost-shadow` and `--pill-shadow` tokens). Don't add coloured glow
    halos; `--accent-glow` is kept faint for ambient light inside panels.
