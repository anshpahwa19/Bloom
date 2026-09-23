# BlooMultiverse — Direction B · Interactive Employee Experience

A second design direction for the BlooMultiverse prototype: a scroll-driven
digital workplace with a floating, section-aware navigation instead of a
sidebar dashboard. Same content, features and interactions as the original.

**Live link:** https://claude.ai/artifact/RPNXEfBFNa8GupVeHBzqgZ (private;
share it from the page's Share menu). Every change is republished to this
same link.

Offline, open `BlooMultiverse-Interactive.html`. It is one self-contained file;
only Google Fonts load from the network.

## Structure

```
BlooMultiverse-Interactive.html   built deliverable (open this)
build.py                          inlines src/ into the single file
src/index.html                    markup, with @include markers
src/styles.css                    tokens, light/dark, chapters, motion, responsive
src/media.css                     every embedded image, declared once
src/app.js                        behaviour (vanilla JS)
src/assets/                       images extracted from the original
reference/                        the original prototype (Direction A)
```

Edit anything in `src/`, then run `python3 build.py`. It writes the offline
file and `hosted/BlooMultiverse.html`, the version that gets published to the
live link. That version has no `<html>/<head>/<body>` wrapper because the host
adds its own.

## The experience, top to bottom

| # | Chapter | What happens |
|---|---------|--------------|
| 01 | Home | Oversized greeting, live app constellation (click a node to filter tasks), floating “today” fragments, quick-links dock with magnification. The hero lifts and fades as you scroll. |
| 02 | Attention | Dark “live control center”: a large count, apps with share bars, and a task list. Hover an app to spotlight its tasks; select it to filter. Approve and reject work as before. |
| 03 | People | Editorial new-joiner spread: sticky portrait with a colour-wipe transition, quote, facts and a reel. Announcements follow as a birthday feed with confetti. |
| 04 | Policies | Horizontal discovery strip. Category index, the hovered card expands, and a progress rail. |
| — | Life at Bloom | Typographic interlude with drifting outline words. |
| 05 | Communities | Pinned horizontal reel: vertical scroll moves the cards sideways. Cards expand on hover, with a pointer spotlight. |
| 06 | Discounts | Draggable partner marketplace with tilt, big offer numbers and reveal-then-copy codes. |
| 07 | Perks | Editorial list; a sticky image masks between perks as you scroll. |
| 08 | FAQ | Calm support chapter: category tabs and an animated accordion. |
| — | Footer | Word-by-word statement, app stores, support, socials. |

Navigation is one floating capsule, centered from the first frame. It shows
only the chapter on screen (tracked with IntersectionObserver). The name rolls
up or down to the next as you scroll, and a ring around its number fills
through the chapter. Click the name for a jump list of all eight chapters.
The wordmark shrinks to the Bloom mark after the hero, and the capsule turns
dark over dark chapters. ☰ opens a full menu with Your space and Appearance
(theme and accent).

**Flag cursor.** On mouse and trackpad devices the pointer carries the logo's
ribbon flag: blue over red with a white gap. At rest it waves beside the
pointer. In motion it streams along your path and thins into a ribbon. Over
anything clickable it furls into a two-colour ring, and over draggable strips
the ring reads "Drag". A click makes the flag flutter and sends out a
blue-and-red ripple. Text fields and dialogs keep the system cursor. It is off
on touch devices and with reduced motion, and ☰ → Appearance → Flag cursor
turns it off.

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
chart follow the tab: bars by app on Inbox, a donut by type on the others.
Clicking a bar or legend row filters the list. The type colours are
validated for colour blindness and contrast in both themes.

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
