# BlooMultiverse — design directions

Two alternative directions for the BlooMultiverse prototype
(`reference/BlooMultiverse-preview_10.html`, Direction A). Both keep every piece
of the original's content, data and interactions.

| File | Direction | Source |
|------|-----------|--------|
| `BlooMultiverse-AI.html` | **C · AI employee experience** — tell Bloo what you need | `ai/` |
| `BlooMultiverse-Interactive.html` | **B · Interactive employee experience** — scroll-driven workplace | `src/` |

Each is one self-contained file; only Google Fonts load from the network.

## Structure

```
BlooMultiverse-AI.html            Direction C, built (open this)
BlooMultiverse-Interactive.html   Direction B, built
build.py                          inlines each source folder into its single file
ai/index.html                     C markup, with @include markers
ai/styles.css                     C tokens, light/dark, rail, AI surfaces, chapters, motion
ai/app.js                         C behaviour, including the Bloo AI simulation
src/                              Direction B source (index.html, styles.css, app.js)
src/media.css                     every embedded image, declared once (shared by B and C)
src/assets/                       images extracted from the original
reference/                        the original prototype (Direction A)
```

Edit anything in `ai/` or `src/`, then run `python3 build.py`.

## Live preview (Direction C)

Direction C is hosted as a private claude.ai page. Every change is published
to the same link:
**https://claude.ai/artifact/KzMq66uZxh7puiANuVuMRJ**

To update it, edit `ai/`, then run
`python3 build.py --fragment <path>/bloomultiverse-ai.html`. This writes the page
without its document wrapper, because the host supplies that. Republish that file
to the URL above. Viewers who already have the page open get the new version
automatically. The page is private until it is shared from its Share menu.

---

# Direction C · AI employee experience

The page no longer asks people to navigate an HR platform. It opens on one
prompt, "Your workday, in one conversation.", and everything below reorganises
around what the employee asks.

## How the AI works

There is no backend. `ai/app.js` runs a deterministic simulation over the page's own data:

1. **Intent.** A keyword and phrase scorer maps the question to one of: attention,
   policies, announcements, people, communities, perks, discounts, help, profile,
   inbox or theme. It also picks out entities: app names, people, sports, partners,
   leave topics and FAQ matches. Anything else falls back to a search of the whole index.
2. **Thinking.** The orb spins, the prompt shows a progress beam, the hero's
   app lines pulse, and short "Reading Salesforce, UiPath…" steps shimmer in.
3. **Answer.** Bloo gives a headline, a sentence of context and result rows.
   All of it is built from the live DOM, so counts change as you approve tasks.
4. **AI Lens.** Relevant chapters brighten and get a context note with chips.
   Matching items are tagged ✦. Everything else goes quiet (reduced opacity,
   full again on hover) and nothing is hidden.
5. **Navigation.** After 1.7 s Bloo scrolls to the chapter, unless you choose
   *Stay here* or scroll yourself. The rail briefly opens to show where you are
   (for example Explore › Policies ✦ AI).
6. **Clear.** The lens bar, the context pill chip or any *Clear lens* button restores the page.

Demo states: "What needs my attention?" (5 things, 4 after one approval), "Show
me policies about leave" (3 relevant policies), "What's new?" (5 updates across 3
chapters), "Find communities" (6), "Show me travel discounts" (4), "Who joined
the team this week?", "Find the work from home policy", "How do I update my
personal information?" (answers from the FAQ), "Show my Salesforce tasks", "Take
me to my profile" (opens the drawer), "Switch to dark mode".

**Ctrl/⌘ K** focuses the prompt when it is on screen. Anywhere else it lifts the
same conversation (prompt, lens bar and thread) into an Ask layer over the page,
so there is only one prompt. The suggestions merge Bloo prompts with the
original search index (apps, tasks, policies, people, communities, perks,
partners, FAQs), and all of them work from the keyboard.

## Inbox workspace

The rail's Inbox (and any "Open inbox" button) opens a full-page workspace:

- **Tabs:** Inbox (tasks from connected apps, with the original app filters,
  approve and reject), Drafts, My requests and History. Each tab shows a count.
- **Summary card:** follows the tab (Waiting on you, Draft count, In progress,
  Completed).
- **Requests by type:** a donut with a legend of counts and percentages. Hover or
  focus a segment or legend row to read it in the centre. The TCDF, Internal Memo
  and RFP colours pass the colour-blind-safety checks in both themes.
- **Bloo suggests:** a tip tied to the active tab: continue the newest draft,
  fix a returned request, or review the most urgent task.
- **Search and Filter:** search covers the active tab. Filter by due date on
  tasks; by type and sort order on requests.
- **Row actions:** Edit and Delete for drafts (delete asks inline). View and
  Withdraw for requests in flight (withdraw moves the request back to drafts).
  Edit & resubmit for returned requests. View for history. Approving or
  rejecting a task adds it to History.
- **New request:** a form with type, title and optional details. You can save a
  draft or submit it, which gives it a reference and status "Pending approval".
- **Bloo:** understands "Show my drafts", "Show my requests", "Show my request
  history", "Raise a new request" and type names. Every request is searchable
  from the prompt.

The request data is a front-end sample, like the rest of the prototype.

## Navigation and scroll

- **Rail:** 84 px wide, showing icons with short labels: Home, Ask, Inbox, My space,
  Explore, Life, Support. Hover or keyboard focus expands it over the page with full
  labels and sub-destinations. The pin keeps it open, which replaces the original
  sidebar collapse. On phones it becomes a bottom sheet.
- **Context pill:** appears once the prompt scrolls away. It shows Ask Bloo,
  the current chapter (for example "● Policies ── 03 / 09") with progress, and the
  active lens. Click it for a jump list. IntersectionObserver drives the current
  chapter, and the rail follows it.
- **Spine:** a thread runs down the page. Each chapter's node lights up, and it
  fills as you read.
- **Motion:** staggered reveals, hero light and parallax, and a drifting "Life at
  Bloom" title. One rAF loop writes only transforms and opacity. All of it is
  removed under `prefers-reduced-motion`.

## Chapters

01 Ask Bloo (command centre) · 02 Your attention · 03 Policies · 04 Announcements
· 05 New joiners · Life at Bloom · 06 Sports & communities · 07 Discounts & perks ·
08 FAQ · 09 Support.

## Preserved, and fixed along the way

All sections, data, imagery, drawers, the modal, toasts, theme and palette switching (same
storage keys), notifications, profile menu, full-page inbox, approve and reject,
app filters, show more, policy filters, the people and birthday carousels, the wish
modal, join group, discount codes, FAQ tabs and accordions, and Ctrl K.

- Approving from the task drawer threw an error in the original. It now resolves the row.
- Profile-menu items (My profile, Help & support, Sign out) never reached their handlers. They work now.

Content notes:
- Three time-off entries (Annual Leave, Sick Leave, Work From Home) were added to
  the policy library ("Also in the library") so the leave demo has something to find.
  Their copy is placeholder.
- FAQ answers that pointed at the old layout ("search bar at the top", "next to
  Quick links") were reworded for the new one.

---

# Direction B · Interactive employee experience

A scroll-driven digital workplace with a floating, section-aware navigation instead of a
sidebar dashboard.

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

The floating capsule tracks the current chapter with IntersectionObserver.
The active pill slides between links and fills with that chapter’s progress.
The capsule compacts after the hero and turns dark over dark chapters. On
tablet and phone it shows the current chapter name, and ☰ opens a full menu
with Your space and Appearance (theme and accent).

## Kept from the original

Search (Ctrl/⌘ K, now a command palette), notifications, profile menu,
full-page inbox, task drawer, approve/reject, app filters, show more,
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
