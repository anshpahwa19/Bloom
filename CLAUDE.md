# BlooMultiverse — working notes

- The design lives in `src/` (index.html, styles.css, mobile.css, media.css,
  app.js, mobile.js, assets/). Never hand-edit the built files; change `src/`
  and run `python3 build.py`.
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
  - Every font size lands on an even pixel. Fixed sizes are even px (written
    in rem or px, e.g. `.75rem` = 12px); never add an odd or decimal size.
    Fluid sizes are `clamp()` with even bounds, written twice: the plain
    value, then `round(clamp(…), 2px)` (browsers without `round()` keep the
    first). Fluid `--fs-*` tokens get their rounded form in the
    `@supports (font-size: round(1px, 2px))` block under `:root`.
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
  - Under 600px the Attention task list is a stack of cards (the
    `max-width: 599px` block, scoped to `.task-list`); 600px and up keep
    the list. The Inbox rows share the task buttons, so keep that scope.
  - Dark-mode shadows stay neutral and soft (the dark `--sh-*`,
    `--frost-shadow` and `--pill-shadow` tokens). Don't add coloured glow
    halos; `--accent-glow` is kept faint for ambient light inside panels.
- What people see: only the phone app. Phones get it full screen (`is-app`).
  Wider screens get it at a phone's size, 393 × 852 (an iPhone 15's screen),
  centred with nothing drawn around it (`is-app is-framed`, `src/frame.js`,
  section 5 of mobile.css). No iframe and no device art: the page itself is
  the app, so Figma's HTML capture can read it. The full desktop page is
  kept for development at `#desktop`, and every rule below still holds for it.
  - In frame mode `#screen` is the screen: it contains the app's fixed layers
    (the app, toasts, and Bloom GPT, which frame.js moves in). frame.js resolves our stylesheets
    (`<style data-bloom>`) for 393 × 852 at load: media queries become
    "all"/"not all" (hover and pointer answer as a phone: none, coarse), and
    vw/vh become px. It also shadows `matchMedia` for app.js and mobile.js.
    So write the app's CSS as for a phone, and never measure the window
    (`innerWidth`, `clientX`) where the screen is meant: subtract
    `frameOffset()`.
  - The page's `<dialog>`s open in the browser's top layer, outside
    `#screen`; in frame mode they place themselves over the screen from
    `--fx`/`--fb`, which frame.js keeps up to date.
  - Figma capture board ("Figma capture view" beside the screen, or
    `#figma`; `openCapture()` in mobile.js, section 6 of mobile.css): every
    screen in `CAPTURE` as its own 393-wide, full-length artboard, then the
    rest of the page is removed. It is flattened for HTML capture:
    entrances are written in at rest and motion stops (`stillCapture`), and
    nothing is left hidden, see-through, sticky, fixed or scrolling
    (`flattenCapture`). Sprite icons are drawn in place with their paint as
    attributes, and ids are unique. Add a new screen to `CAPTURE`; after any
    change, audit the board (no overlaps, hidden nodes, `<use>` or spills).
  - The screen keeps an iPhone's safe areas (54px top, 34px bottom) as empty
    space, so an iOS status bar can be laid over it in Figma. Safe areas go
    through `--safe-top` and `--safe-bottom`, never `env()` directly.
- The phone app (`src/mobile.js`, `src/mobile.css`) replaces the page under
  768px and on phones held sideways (`APP_QUERY` in frame.js, repeated in
  the head script, sets `is-app` on `<html>`). Once open it stays the app
  at any width, except on the `#desktop` page. It is the same product, not a
  redesign: reuse the page's tokens and components, and add a mobile variant
  of a component only where the desktop one can't work on a phone.
  - index.html wraps frame.js, app.js and mobile.js in one function, so
    they share scope. Watch for name clashes: a function declared in two
    files silently replaces the other one.
  - One source of truth: the app reads the page's data (task rows, `ib`,
    `people`, `slides`, policy cards, partners, sports, `perks`, the FAQ,
    the notification list) and acts through the page's functions
    (`quickResolve`, `openWish`, `setJoined`, `revealCode`, `sayHello`,
    `setDrillReminder`, `openRequestForm`, `markAllRead`…). Anything that
    changes data calls `sync()`, and the app re-renders its `data-live`
    regions. Copy for screens comes from the page's own headings.
  - No new requests on phones: no New request, and no Duplicate (it makes
    one). `openRequestForm()` refuses to open without an item in app mode.
    Everything else on requests stays.
  - Screens are `PAGES` entries (root tabs: home, tasks, explore, help,
    profile; everything else pushes onto the current tab's stack; search and
    notifications open as full-screen layers). Navigate with `data-go`
    (`policy/Data Security`, `tasks/approvals/sap`, `ann/3`…) and act with
    `data-act`. Bloom GPT's actions route to app screens in app mode
    (`APP_ACTS`).
  - Bottom bar: exactly Home, Tasks, Help, Explore, Profile, in that order
    (Help in the middle). Home wears the logo's flag (an inline vector in
    index.html, in the logo's own red/blue), Help the Bloom GPT orb, and
    Profile your photo (added from `me` in mobile.js). The header holds only
    the logo, Search and Notifications (round surfaces); no avatar, since
    Profile is in the bar. No footer on phones.
  - Explore has no People tile (People stays reachable from Home and
    search).
  - Inputs in the app are 16px (iOS zooms smaller ones). Touch targets are
    at least 44px. Check 320, 375, 390 and 430 wide (a phone-sized browser
    window or device mode), in both themes, and framed in a desktop window,
    where it is driven with a mouse (drag rails; no edge
    swipe or pull to refresh); the framed app should match a 393 × 852
    phone pixel for pixel.
