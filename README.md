# BlooMultiverse — Direction B · Interactive Employee Experience

A second design direction for the BlooMultiverse prototype: a scroll-driven
digital workplace with a floating, section-aware navigation instead of a
sidebar dashboard. Same content, features and interactions as the original.

**Live link:** https://claude.ai/artifact/RPNXEfBFNa8GupVeHBzqgZ (private;
share it from the page's Share menu). Every change is republished to this
same link.

Offline, open `BlooMultiverse-Interactive.html`. It is one self-contained file;
only Google Fonts load from the network.

**What you see:** only the phone app. On a phone, full screen. On a desktop
or tablet, at a phone's size (393 × 852, an iPhone 15's screen) in the
middle of the window, with no device drawn around it, so the page can be
captured as it is (for example with Figma's HTML capture).
The full desktop page is kept for development: add `#desktop` to the address
(for example `BlooMultiverse-Interactive.html#desktop`).

## Structure

```
BlooMultiverse-Interactive.html   built deliverable (open this)
build.py                          inlines src/ into the single file
src/index.html                    markup, with @include markers
src/styles.css                    tokens, light/dark, chapters, motion, responsive
src/mobile.css                    the phone app: shell, sheets, screens
src/media.css                     every embedded image, declared once
src/frame.js                      the phone-sized screen that wider screens get
src/app.js                        behaviour (vanilla JS)
src/mobile.js                     the phone app (shares app.js's scope)
src/assets/                       images extracted from the original
reference/                        the original prototype (Direction A)
```

index.html wraps `frame.js`, `app.js` and `mobile.js` in one function, so
the phone app reads the same data and calls the same functions as the page.

Edit anything in `src/`, then run `python3 build.py`. It writes the offline
file and `hosted/BlooMultiverse.html`, the version that gets published to the
live link. That version has no `<html>/<head>/<body>` wrapper because the host
adds its own.

## The experience, top to bottom

| # | Chapter | What happens |
|---|---------|--------------|
| 01 | Home | Oversized greeting, live app constellation (click a node to filter tasks), floating “today” fragments, quick-links dock with magnification. The hero lifts and fades as you scroll. |
| 02 | Attention | Dark “live control center”: a large count, apps with share bars, and a task list. Hover an app to spotlight its tasks; select it to filter. Approve and reject work as before. |
| 03 | People | Editorial new-joiner spread: sticky portrait with a colour-wipe transition, quote, facts and a reel. Announcements follow with four tiles (birthdays, a work anniversary, a fire drill and Eid Al Adha). Each opens its own slide and tints the chapter. |
| 04 | Policies | Horizontal discovery strip. Category index, the hovered card expands, and a progress rail. |
| — | Life at Bloom | Typographic interlude with drifting outline words. |
| 05 | Communities | Pinned horizontal reel: vertical scroll moves the cards sideways. Cards expand on hover, with a pointer spotlight. |
| 06 | Discounts | Draggable partner marketplace with tilt, big offer numbers and reveal-then-copy codes. |
| 07 | Perks | Category chips, a compact perk index and a sticky spotlight. The spotlight wipes to each perk and autoplays until you pick one. Built from one list, so it scales to any number of perks. |
| 08 | FAQ | Calm support chapter: category tabs and an animated accordion. |
| — | Footer | Word-by-word statement, app stores, support, socials. |

Navigation is one floating capsule, centered from the first frame. It shows
only the chapter on screen (tracked with IntersectionObserver). The name rolls
up or down to the next as you scroll, and a ring around its number fills
through the chapter. Click the name for a jump list of all eight chapters.
The wordmark shrinks to the Bloom mark after the hero, and the capsule turns
dark over dark chapters. ☰ opens a full menu with Your space and Appearance
(theme and accent).

**Bloom GPT.** The AI assistant has its own button in the nav capsule (and
☰ menu). It opens a full page from that button:
- **Landing:** a greeting, "Your workday, in one conversation", a composer
  whose placeholder types example questions, twelve suggested prompts, and a
  "Bloom GPT noticed" strip (overdue approvals, today's birthday, the updated
  Data Security policy).
- **Answers:** it answers from the page's own data (tasks, people,
  announcements, policies, perks, discounts, communities, drafts, FAQs) with
  cards.
- **Actions:** approve a task (the counts everywhere update), open a person,
  policy, perk or community, copy a discount code, set the fire-drill
  reminder, jump to your drafts or profile.
- **Search:** every search (Ctrl/⌘ K) also offers "Ask Bloom GPT" with what
  you typed.

It is scripted, not a live model; unknown questions get a list of what it
can do.

**Flag cursor.** On mouse and trackpad devices the pointer carries the logo's
ribbon flag: red over blue with a white gap. At rest it waves beside the
pointer. In motion it streams along your path and thins into a ribbon. Over
anything clickable it furls into a two-colour ring, and over draggable strips
the ring reads "Drag". A click makes the flag flutter and sends out a
red-and-blue ripple. Text fields and dialogs keep the system cursor. It is off
on touch devices and with reduced motion, and ☰ → Appearance → Flag cursor
turns it off.

**Announcements.** The feed has one tile per kind:
- **Birthdays:** one slide per person. The tile counts through them
  (`02 / 03`) and "Also today" jumps between them. Send a wish from the
  wish dialog.
- **Work anniversary:** one dot per year circles the portrait. "Say
  congratulations" uses the same dialog, with its own wording.
- **Fire drill:** a pulsing alarm, the date and time, "Remind me" and the
  evacuation plan.
- **Eid Al Adha:** a gold crescent with swinging lanterns, the holiday dates
  and View rewards.

The chapter takes each kind's colour (brand blue, violet, fire red, emerald).
It autoplays with a timer on the active tile and pauses while you hover or
focus. Search finds each announcement.

**Perks at any scale.** The chapter is rendered from one `perks` list in
`src/app.js`, which also feeds search. The index shows six perks with
**Show all** for the rest. Category chips (with counts) filter it, and the
spotlight's arrows, counter and progress follow the filter.
- **Autoplay:** the spotlight steps through the visible perks, and the rule
  above the active row fills as its timer. It pauses while you point at or
  tab through the chapter, and stops once you pick a perk.
- **Perks without a photo** get generated art in their category colour.
- **Phones:** the chips become one swipeable line, the spotlight takes
  swipes, and tapping a row brings the spotlight into view.
- **Sample perks:** only the first four are from the original. The other
  eight are placeholders that show the layout with more perks; delete them
  from the list to go back to four.

**Inbox (requests workspace).** The inbox button in the nav, the hero and the
menu opens a full-screen page, revealed in a circle from the button pressed.
It has four tabs:

- **Inbox**: tasks waiting on you from Salesforce, UiPath, Darwinbox and SAP.
  These are the same rows as the Attention section, so approving or rejecting
  in either place updates both.
- **Draft**: Edit, and Delete with a confirm step.
- **My requests**: step progress and status, View, and Remind, or Revise when
  a request is returned.
- **History**: the outcome, View and Duplicate.

Around the tabs sit a search field, a filter (type or app, plus sort) and New
request. New request opens a form with type (TCDF, Internal Memo, RFP), title
and details, then Save draft or Submit for approval. A summary card and a
donut chart follow the tab: by app on Inbox, by request type on the others.
Hovering a slice or legend row shows its count; clicking one filters the
list. The chart colours are validated for colour blindness and contrast in
both themes.

## On phones: the BlooMultiverse app

Under 768px wide (and on phones held sideways) the page gives way to an
app built from the same design system: the same tokens, fonts, radii,
glass, cards, chips, tabs, buttons, avatars, images and motion, recomposed
for one hand.

**Wider screens show the app at a phone's size.** The page itself becomes
the app on a 393 × 852 screen, centred, with no iframe and no device art.
`frame.js` gives the app a phone-sized viewport: `<body>` is the screen, and
the stylesheets' media queries and viewport units are resolved for 393 × 852
at load, so it lays out exactly as on that phone, pixel for pixel. The
screen keeps an iPhone's status-bar and home-indicator space (54px and
34px). Rails, carousels and the joiner portrait can be dragged with a
mouse, and scrollbars stay hidden, as on a phone. On the `#desktop` page,
☰ → **Mobile app** goes back to the app.

- **Header:** the logo, then Search and Notifications on round surfaces.
  It frosts once content slides under it. Pushed pages swap it for Back
  and their title, centred.
- **Bottom bar:** Home, Tasks, Help, Explore and Profile in a frosted
  capsule above the home indicator, with a sliding accent pill and a
  count on Tasks. Home wears the logo's flag (redrawn as a vector, so it
  stays sharp), Help sits in the middle with the Bloom GPT orb, and
  Profile shows your photo. Each tab keeps its own stack of pages and its
  scroll position. Tapping the current tab goes back to its top.
- **Home:** the greeting with today's moments, a dark "Needs your
  attention" card (the pending count, the apps, then the pending approval,
  the important action and the pending task), Quick links as a
  launcher, the announcements as swipeable cards, new joiners, the
  updated policy, and a perk and two offers. Pull down to sync.
- **Tasks:** a summary with the donut (by app, or by request type), search,
  a filter-and-sort sheet, and five tabs: All, Approvals, Pending, Drafts
  and My requests. Approve, Reject (with a confirmation), View, Remind,
  Revise, Edit and Delete (with a confirmation). Task and request details
  are full pages with their actions docked above the bottom bar, and
  "Next task" after you approve.
  **There is no New request on phones**, and no Duplicate (it makes a new
  request). Everything else on requests is there.
- **Explore:** Policies, Communities, Discounts and Perks, each with a
  list page and a detail page (policy library with search and categories,
  groups you can join, offers with codes, perks by category). People, the
  colleague directory and profiles, opens from Home's new joiners and
  from search.
- **Help:** Bloom GPT (the page's own assistant, with suggested prompts),
  the FAQ and Help & support. Bloom GPT's actions open app screens.
- **Profile:** you, My profile, My details, My team, notification
  settings, theme and accent, language, Help, FAQ and Sign out.
- **Notifications** and **Search** open full-screen from the header.
  Search keeps recent searches, suggests, groups results as you type, has
  a full results view with filters, and offers Bloom GPT when nothing
  matches.
- **Native patterns:** bottom sheets you can drag down, swipe back from
  the left edge, Android's back button closes the top layer, pull to
  refresh, skeletons while tasks load, empty and no-result states, an
  offline banner, and safe areas on every edge. The footer is left out.

The app never copies data. Approving on a phone updates the page's own
task rows, a wish updates the page's slide, joining a group presses the
page's own Join button, and so on; `sync()` in `app.js` tells the app to
re-render.

## Kept from the original

Search (Ctrl/⌘ K, now a command palette), notifications, profile menu,
full-page inbox (now the requests workspace), task drawer, approve/reject, app filters, show more,
policy filters, people carousel, birthday carousel and wish modal,
join group, discount codes, FAQ tabs, help drawer, theme and palette
switching, and toasts.

Two small fixes along the way. Approving from the task drawer threw an error
in the original; it now resolves the row. The profile-menu items (My profile,
Help & support) now open their drawers.

## Accessibility and motion

- Honours `prefers-reduced-motion`: parallax, pinning and entrances are
  removed, and every feature still works.
- Keyboard: tabs support arrow keys, and focusing a community card scrolls
  it into view. Esc closes the top layer, and focus is trapped in the menu
  overlay.
- The scroll work runs in one `requestAnimationFrame` loop. Geometry is
  cached on resize, and only transforms and opacity are written.
