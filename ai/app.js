/* ==================================================================
   BlooMultiverse AI — app.js
   Vanilla JS. One file, grouped by concern:

   1.  Helpers
   2.  Appearance — theme and palette
   3.  Toasts, greeting
   4.  Rail — peek, pin, indicator, phone sheet
   5.  Chapters — section-aware context pill, spine, jump list
   6.  Menus — notifications, profile
   7.  Attention — tasks, filters, counts, Bloo's suggestion
   8.  Drawer — inbox, profile, help, task review
   9.  Announcements — birthday carousel, wish modal, timeline
   10. People — reel, portrait expansion, say hello
   11. Policies, FAQ, communities, discounts, perks
   12. Motion — reveal, scroll-linked, hero field
   13. Bloo AI — knowledge, intent, responses, lens, composer
   ================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------------
     1. Helpers
     --------------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const icon = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pad = (n) => String(n).padStart(2, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const behavior = () => (reduceMotion ? "auto" : "smooth");
  const isMobile = () => innerWidth <= 768;
  const isDesk = () => innerWidth > 1100;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const firstName = (name) => name.split(" ")[0];
  const listJoin = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

  if (/Mac|iPhone|iPad/.test(navigator.platform)) $$(".js-kbd").forEach((k) => { k.textContent = "⌘ K"; });

  /* ---------------------------------------------------------------
     2. Appearance — light / dark, crimson / azure
     --------------------------------------------------------------- */
  const THEME_KEY = "bloo-theme";
  const PALETTE_KEY = "bloo-palette";
  const themeSwitch = $("#theme-switch");
  const paletteSwitch = $("#palette-switch");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    themeSwitch.setAttribute("aria-checked", String(theme === "dark"));
  }
  applyTheme(root.getAttribute("data-theme") || "light");
  // A host page can restamp the theme; keep the switch in step with it
  new MutationObserver(() => themeSwitch.setAttribute("aria-checked", String(root.getAttribute("data-theme") === "dark")))
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  themeSwitch.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    store.set(THEME_KEY, next);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (store.get(THEME_KEY)) return; // an explicit choice wins over the OS
    applyTheme(e.matches ? "dark" : "light");
  });

  function applyPalette(palette) {
    if (palette === "azure") root.setAttribute("data-palette", "azure");
    else root.removeAttribute("data-palette");
    paletteSwitch.setAttribute("aria-checked", String(palette === "azure"));
  }
  applyPalette(root.getAttribute("data-palette") === "azure" ? "azure" : "crimson");
  paletteSwitch.addEventListener("click", () => {
    const next = root.getAttribute("data-palette") === "azure" ? "crimson" : "azure";
    applyPalette(next);
    store.set(PALETTE_KEY, next);
  });

  /* ---------------------------------------------------------------
     3. Toasts, greeting
     --------------------------------------------------------------- */
  const toastRegion = $("#toasts");
  function toast(message, iconId = "i-check") {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon(iconId)}<span>${message}</span>`;
    toastRegion.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
      if (reduceMotion) el.remove();
    }, 2800);
  }
  // Any element with data-toast shows a demo message (pages outside the prototype)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toast]");
    if (!t) return;
    if (t.tagName === "A") e.preventDefault();
    toast(t.dataset.toast, "i-sparkle");
  });

  const now = new Date();
  const hour = now.getHours();
  $("#greeting").textContent = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  $("#today-date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  /* ---------------------------------------------------------------
     4. Rail — compact AI navigation
     --------------------------------------------------------------- */
  const rail = $("#rail");
  const nav = $("#nav");
  const railIndicator = $(".rail__indicator");
  const pinBtn = $("#sidebar-toggle");
  const tooltip = $("#tooltip");
  const menuBtn = $("#menu-btn");
  let activeGroup = "home";
  let peekTimer = 0;
  let unpeekTimer = 0;

  const railExpanded = () => rail.classList.contains("is-peek") || (root.classList.contains("rail-pinned") && isDesk());

  function moveRailIndicator() {
    if (isMobile()) return;
    const item = $(`.rail__group[data-group="${activeGroup}"] > .rail__item`, nav);
    if (!item) { railIndicator.style.opacity = "0"; return; }
    const top = item.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    railIndicator.style.opacity = "1";
    railIndicator.style.height = `${item.offsetHeight}px`;
    railIndicator.style.transform = `translateY(${top}px)`;
  }
  // While the rail resizes, follow the item every frame (no lag)
  function trackIndicator(ms = 460) {
    const end = performance.now() + ms;
    railIndicator.style.transitionProperty = "width, opacity";
    const step = () => {
      moveRailIndicator();
      if (performance.now() < end) requestAnimationFrame(step);
      else railIndicator.style.transitionProperty = "";
    };
    requestAnimationFrame(step);
  }

  // Sub-lists open and close on their own timing: settle the indicator when any of them finishes
  rail.addEventListener("transitionend", (e) => {
    if (e.target === rail || e.target.classList.contains("rail__sub")) moveRailIndicator();
  });

  function setPeek(on) {
    if (isMobile() || rail.classList.contains("is-peek") === on) return;
    rail.classList.toggle("is-peek", on);
    hideTip();
    trackIndicator();
  }
  if (canHover) {
    rail.addEventListener("mouseenter", () => { clearTimeout(unpeekTimer); peekTimer = setTimeout(() => setPeek(true), 170); });
    rail.addEventListener("mouseleave", () => { clearTimeout(peekTimer); unpeekTimer = setTimeout(() => { if (!rail.contains(document.activeElement) || !rail.querySelector(":focus-visible")) setPeek(false); }, 240); });
  }
  rail.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) setPeek(true); });
  rail.addEventListener("focusout", (e) => { if (!rail.contains(e.relatedTarget) && !rail.matches(":hover")) setPeek(false); });

  function setPinned(on, save = true) {
    root.classList.toggle("rail-pinned", on);
    pinBtn.setAttribute("aria-pressed", String(on));
    pinBtn.dataset.tip = on ? "Collapse navigation" : "Keep navigation open";
    if (save) store.set("bloo-ai-rail", on ? "pinned" : "compact");
    trackIndicator(520);
    setTimeout(measure, 420);
  }
  setPinned(root.classList.contains("rail-pinned"), false);
  pinBtn.addEventListener("click", () => setPinned(!root.classList.contains("rail-pinned")));

  // Tooltips for the icon-only tools while the rail is compact
  function showTip(el) {
    if (railExpanded() || isMobile() || !el.dataset.tip) return;
    const r = el.getBoundingClientRect();
    tooltip.textContent = el.dataset.tip;
    tooltip.style.left = `${r.right + 12}px`;
    tooltip.style.top = `${r.top + r.height / 2}px`;
    tooltip.classList.add("is-visible");
  }
  function hideTip() { tooltip.classList.remove("is-visible"); }
  $$(".rail [data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", () => showTip(el));
    el.addEventListener("focus", () => showTip(el));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("blur", hideTip);
  });

  function setActiveNav(group, sub) {
    activeGroup = group || "home";
    $$(".rail__item", nav).forEach((i) => { i.classList.remove("is-active"); i.removeAttribute("aria-current"); });
    const item = $(`.rail__group[data-group="${activeGroup}"] > .rail__item`, nav);
    if (item) { item.classList.add("is-active"); if (item.tagName === "A") item.setAttribute("aria-current", "location"); }
    $$(".rail__subitem[data-sub]", nav).forEach((s) => {
      if (s.dataset.sub === sub) s.setAttribute("aria-current", "location"); else s.removeAttribute("aria-current");
    });
    moveRailIndicator();
  }

  // Phone: the rail is a bottom sheet
  function openNav() {
    body.classList.add("nav-open");
    menuBtn.setAttribute("aria-expanded", "true");
    setTimeout(() => $(".rail__close").focus(), 80);
  }
  function closeNav() {
    if (!body.classList.contains("nav-open")) return;
    body.classList.remove("nav-open");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.addEventListener("click", openNav);
  $$("[data-close-nav]").forEach((el) => el.addEventListener("click", closeNav));

  /* ---------------------------------------------------------------
     5. Chapters — IntersectionObserver drives "where am I"
     --------------------------------------------------------------- */
  const command = $("#top");
  const flow = $("#flow");
  const chapters = $$("[data-chapter]");
  const numbered = chapters.filter((c) => !c.hasAttribute("data-alias"));
  chapters.forEach((ch) => {
    // An alias (the Life at Bloom interlude) shares the next chapter's number
    const own = numbered.indexOf(ch);
    const next = own >= 0 ? own : numbered.indexOf(chapters.slice(chapters.indexOf(ch)).find((c) => !c.hasAttribute("data-alias")));
    ch.dataset.num = pad(next + 1);
  });
  $("#context-total").textContent = pad(numbered.length);

  // Jump list in the context pill + chapter index at the foot of the hero
  $("#context-list").innerHTML = numbered.map((ch) =>
    `<li><a href="#${ch.id}" data-chapter-link="${ch.id}"><span>${ch.dataset.num}</span><span>${escapeHtml(ch.dataset.title)}</span></a></li>`).join("");
  $("#command-chapters").innerHTML = numbered.filter((ch) => ch !== command).map((ch) =>
    `<li><a href="#${ch.id}" data-chapter-link="${ch.id}"><span>${ch.dataset.num}</span>${escapeHtml(ch.dataset.title)}</a></li>`).join("");

  const contextWhere = $("#context-where");
  const contextMenu = $("#context-menu");
  const contextNames = $(".context__names");
  let current = null;
  let nameEl = $("#context-name");

  // The section name rolls up; the latest name always wins a rapid change
  function swapContextName(text) {
    if (nameEl.textContent === text) return;
    if (reduceMotion) { nameEl.textContent = text; return; }
    const old = nameEl;
    const next = document.createElement("span");
    next.className = "context__name is-in";
    next.textContent = text;
    contextNames.appendChild(next);
    nameEl = next;
    old.classList.remove("is-current", "is-in");
    old.classList.add("is-out");
    old.removeAttribute("id");
    next.id = "context-name";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (nameEl !== next) return;
      next.classList.remove("is-in");
      next.classList.add("is-current");
    }));
    setTimeout(() => old.remove(), 460);
  }

  function setCurrent(ch) {
    if (!ch || ch === current) return;
    current?.classList.remove("is-current");
    current = ch;
    ch.classList.add("is-current");
    swapContextName(ch.dataset.title);
    $("#context-num").textContent = ch.dataset.num;
    contextWhere.setAttribute("aria-label", `Current section: ${ch.dataset.title}, ${ch.dataset.num} of ${pad(numbered.length)}. Jump to a section`);
    setActiveNav(ch.dataset.group, ch.dataset.sub);
    $$("#context-list a").forEach((a) => {
      const on = a.dataset.chapterLink === ch.id || (ch.hasAttribute("data-alias") && a.dataset.chapterLink === "sports");
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    requestAnimationFrame(frame);
  }

  const inBand = new Set();
  let spyLocked = false;
  let spyTimer = 0;
  function pickCurrent() {
    const hit = chapters.filter((c) => inBand.has(c));
    if (hit.length) setCurrent(hit[hit.length - 1]);
  }
  function lockSpy(ch) {
    spyLocked = true;
    setCurrent(ch);
    clearTimeout(spyTimer);
    spyTimer = setTimeout(unlockSpy, 1400);
  }
  function unlockSpy() { spyLocked = false; pickCurrent(); }

  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) inBand.add(en.target); else inBand.delete(en.target); });
      if (!spyLocked) pickCurrent();
    }, { rootMargin: "-42% 0px -52% 0px" });
    chapters.forEach((c) => spy.observe(c));

    // The context pill appears once the prompt has scrolled away
    const promptWatch = new IntersectionObserver(([en]) => {
      root.classList.toggle("show-context", !en.isIntersecting && en.boundingClientRect.top < 0);
    });
    promptWatch.observe($("#convo-home"));
  }
  setCurrent(command);

  function goTo(el, block = "start") {
    const ch = el.closest("[data-chapter]") || el;
    lockSpy(ch);
    if (el === command) scrollTo({ top: 0, behavior: behavior() });
    else el.scrollIntoView({ behavior: behavior(), block });
  }

  function toggleContextMenu(open = contextMenu.hidden) {
    contextMenu.hidden = !open;
    contextWhere.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(() => $("a[aria-current]", contextMenu)?.focus({ preventScroll: true }) || $("a", contextMenu).focus(), 30);
  }
  contextWhere.addEventListener("click", (e) => { e.stopPropagation(); toggleContextMenu(); });
  document.addEventListener("click", (e) => { if (!contextMenu.hidden && !e.target.closest(".context")) toggleContextMenu(false); });

  // In-page navigation: rail, jump list, hero index, brand
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-nav-link], a[data-chapter-link]");
    if (!link) return;
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    e.preventDefault();
    goTo(target);
    closeNav();
    if (!contextMenu.hidden) toggleContextMenu(false);
    if (!canHover) setPeek(false);
  });

  /* ---------------------------------------------------------------
     6. Menus — notifications, profile
     --------------------------------------------------------------- */
  const menus = $$("[data-menu]");
  function closeMenus(except) {
    menus.forEach((m) => {
      if (m === except) return;
      m.classList.remove("is-open");
      $("[data-menu-trigger]", m).setAttribute("aria-expanded", "false");
    });
  }
  menus.forEach((menu) => {
    const trigger = $("[data-menu-trigger]", menu);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !menu.classList.contains("is-open");
      closeMenus(menu);
      menu.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    });
    // Clicks inside the panel keep it open; menu items fall through to the
    // document handlers (drawers, toasts), which also close the menu
    $(".menu__panel", menu).addEventListener("click", (e) => {
      if (!e.target.closest(".menu__item")) e.stopPropagation();
    });
  });
  document.addEventListener("click", () => closeMenus());

  $("#mark-read").addEventListener("click", () => {
    $$(".notif.is-unread").forEach((n) => n.classList.remove("is-unread"));
    $("#bell-badge").classList.add("is-cleared");
    $("#bell").setAttribute("aria-label", "Notifications, none unread");
    toast("All notifications marked as read");
  });

  /* ---------------------------------------------------------------
     7. Attention — tasks from connected apps
     --------------------------------------------------------------- */
  const attention = $("#attention");
  const taskList = $("#task-list");
  const tabsEl = $("#attention-tabs");
  const moreBtn = $("#more-tasks");
  const counts = { salesforce: 15, uipath: 10, darwinbox: 5, sap: 2 };
  const sourceNames = { salesforce: "Salesforce", uipath: "UiPath", darwinbox: "Darwinbox", sap: "SAP" };
  const sourceMarks = { salesforce: "sf", uipath: "ui", darwinbox: "db", sap: "sap" };
  const taskRows = () => $$(".task:not(.task--skeleton)", taskList);
  const isOverdue = (row) => row.querySelector(".due--overdue") !== null;
  const isToday = (row) => row.querySelector(".due--today") !== null;
  const isOpen = (row) => !row.classList.contains("is-done");
  const taskTitle = (row) => $(".task__title", row).textContent;
  const taskDue = (row) => $(".due", row).textContent.trim();
  const totalCount = () => Object.values(counts).reduce((a, b) => a + b, 0);

  // Simulated fetch — the skeleton shows first
  setTimeout(() => {
    taskList.classList.remove("is-loading");
    taskList.setAttribute("aria-busy", "false");
    animateRows();
    measure();
  }, reduceMotion ? 0 : 1100);

  function animateRows() {
    let n = 0;
    taskRows().forEach((row) => {
      if (row.offsetParent === null) return;
      row.classList.remove("is-in");
      void row.offsetWidth; // restart the animation
      row.style.animationDelay = `${n++ * 45}ms`;
      row.classList.add("is-in");
    });
  }

  function moveTabIndicator(tabs = tabsEl) {
    const sel = $(".tab.is-selected", tabs);
    const ind = $(".tabs__indicator", tabs);
    if (!sel || !ind) return;
    ind.style.width = `${sel.offsetWidth}px`;
    ind.style.transform = `translateX(${sel.offsetLeft}px)`;
  }

  function filterAttention(source, scroll = false) {
    $$(".tab", tabsEl).forEach((t) => {
      const on = t.dataset.tab === source;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      if (on) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    moveTabIndicator();
    const showAll = taskList.classList.contains("show-all");
    let visible = 0;
    taskRows().forEach((row) => {
      const match = source === "all" || row.dataset.source === source;
      const extraHidden = source === "all" && row.classList.contains("is-extra") && !showAll;
      row.classList.toggle("is-hidden", !match);
      row.classList.toggle("is-shown", row.classList.contains("is-extra") && match && !extraHidden);
      if (match && !extraHidden) visible++;
    });
    $("#task-empty").hidden = visible > 0;
    moreBtn.hidden = source !== "all";
    $$(".app").forEach((a) => a.classList.toggle("is-filtered", a.dataset.app === source));
    animateRows();
    if (scroll && !inboxOpen) tabsEl.scrollIntoView({ behavior: behavior(), block: "center" });
  }

  tabsEl.addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) filterAttention(t.dataset.tab);
  });
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = $$(".tab", tabsEl);
    const i = tabs.findIndex((t) => t.classList.contains("is-selected"));
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    filterAttention(next.dataset.tab);
  });
  $$("[data-filter]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    filterAttention(el.dataset.filter, true);
  }));

  function setShowAll(open) {
    taskList.classList.toggle("show-all", open);
    moreBtn.setAttribute("aria-expanded", String(open));
    moreBtn.firstChild.textContent = open ? "Show fewer tasks " : "Show more tasks ";
  }
  moreBtn.addEventListener("click", () => {
    setShowAll(!taskList.classList.contains("show-all"));
    filterAttention("all");
  });

  addEventListener("resize", () => moveTabIndicator());
  document.fonts?.ready.then(() => moveTabIndicator());
  moveTabIndicator();

  // Bloo's read of the list: counts, today's number and the suggestion
  const suggestReview = $("#suggest-review");
  let suggestedRow = null;
  function refreshAttention() {
    const open = taskRows().filter(isOpen);
    const overdue = open.filter(isOverdue);
    const today = open.filter(isToday);
    const urgent = [...overdue, ...today];
    $("#attention-count").textContent = urgent.length;
    $("#stat-overdue").textContent = overdue.length;
    $("#stat-today").textContent = today.length;
    $("#noticed-overdue").textContent = overdue.length ? `${plural(overdue.length, "approval is", "approvals are")} overdue` : "Nothing is overdue";
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    $("#attention-lede").textContent = `${totalCount()} things are waiting across four of your apps. ${sourceNames[top]} needs you most today.`;

    suggestedRow = urgent[0] || null;
    const text = $("#bloo-suggests");
    if (!suggestedRow) {
      text.textContent = "You’re clear for today. The rest of this week’s work is in your inbox — I’ll flag anything that gets close.";
      suggestReview.hidden = true;
      return;
    }
    const parts = [];
    if (overdue.length) parts.push(plural(overdue.length, "overdue approval", "overdue approvals"));
    if (today.length) parts.push(plural(today.length, "item due today", "items due today"));
    const who = ($(".task__meta span", suggestedRow)?.textContent.match(/Requested by (.+)/) || [])[1];
    text.textContent = `You have ${parts.join(" and ")}. Start with “${taskTitle(suggestedRow)}”${who ? ` — ${who} is waiting on you.` : "."}`;
    suggestReview.hidden = false;
  }
  suggestReview.addEventListener("click", () => { if (suggestedRow) openDrawer("task", suggestedRow); });

  function decrementCount(source) {
    if (!counts[source]) return;
    counts[source]--;
    const total = totalCount();
    $("#pending-count").textContent = total;
    $(`.tab[data-tab="all"] .tab__count`).textContent = total;
    $(`.tab[data-tab="${source}"] .tab__count`).textContent = pad(counts[source]);
    const app = $(`.app[data-app="${source}"]`);
    $(".js-count", app).textContent = counts[source];
    $(".app__count", app).setAttribute("aria-label", `Show ${counts[source]} ${sourceNames[source]} tasks`);
    const signal = $(`.signal[data-signal="${source}"]`);
    $(".signal__count", signal).textContent = pad(counts[source]);
    signal.setAttribute("aria-label", `${sourceNames[source]}, ${counts[source]} waiting. Ask Bloo about them`);
    refreshAttention();
    if (inboxOpen) renderAppFilter();
  }

  function quickResolve(row, action) {
    if (!row || row.classList.contains("is-done")) return;
    row.classList.add("is-done");
    $$(".task__actions button", row).forEach((b) => { b.disabled = true; });
    decrementCount(row.dataset.source);
    recordDecision(row, action);
    toast(`${action === "approve" ? "Approved" : "Rejected"} and synced to ${sourceNames[row.dataset.source]}`, action === "approve" ? "i-check" : "i-x");
  }

  /* ---------------------------------------------------------------
     8. Drawer — task review, inbox, profile, help
     --------------------------------------------------------------- */
  const drawer = $("#drawer");
  const drawerTitle = $("#drawer-title");
  const drawerBody = $("#drawer-body");
  const drawerSub = $("#drawer-sub");
  const drawerActions = $("#drawer-actions");
  const attentionBody = $("#attention-body");
  const attentionBodyHome = { parent: attentionBody.parentNode, next: attentionBody.nextSibling };
  let lastFocus = null;
  let inboxOpen = false;

  const drawerViews = {
    inbox: () => ({
      title: "Inbox",
      sub: "Tasks from your apps and the requests you raise, in one place.",
      actions: `<button class="btn btn--primary" type="button" id="new-request">${icon("i-plus", "ico ico--sm")}New request</button>`,
      html: inboxShell()
    }),
    profile: () => ({
      title: "My profile",
      html: `<div class="d-profile"><span class="avatar img-rashid"></span><h3>Rashid Khan</h3><p class="meta">Sr. Engineer, Digital Platforms</p></div>
        <dl class="d-facts">
          <div><dt>Reporting manager</dt><dd>Mathew Raymond</dd></div>
          <div><dt>Date of joining</dt><dd>4 March 2021</dd></div>
          <div><dt>Location</dt><dd>Abu Dhabi</dd></div>
          <div><dt>Email</dt><dd>rashid.khan@bloom.ae</dd></div>
        </dl>
        <div class="d-actions"><button class="btn btn--primary" type="button" data-toast="Opening your full profile…">View full profile</button></div>`
    }),
    help: () => ({
      title: "Help & support",
      html: `${$$("#faq .faqs__panel").map((panel, g) => {
          const label = $("#" + panel.getAttribute("aria-labelledby")).firstChild.textContent.trim().replace(/&/g, "&amp;");
          const items = $$(".faqs__item", panel).map((d, i) =>
            `<details class="faq"${g === 0 && i === 0 ? " open" : ""}><summary>${$(".faqs__q span", d).innerHTML}${icon("i-chevron-down")}</summary><p>${$(".faqs__a p", d).innerHTML}</p></details>`).join("");
          return `<h3 class="d-faq__label">${label}</h3>${items}`;
        }).join("")}
        <div class="d-actions"><button class="btn btn--primary" type="button" data-toast="A support request has been started.">Contact support</button><button class="btn btn--quiet" type="button" data-toast="Opening the help centre…">Visit help centre</button></div>`
    }),
    task: (row) => {
      const src = row.dataset.source;
      return {
        title: "Review task",
        html: `<div class="d-task__row"><span class="app-mark app-mark--lg app-mark--${sourceMarks[src]}"></span><span class="tag">${sourceNames[src]}</span></div>
          <p class="d-task__title">${escapeHtml(taskTitle(row))}</p>
          <dl class="d-facts"><div><dt>Context</dt><dd>${escapeHtml($(".task__meta span", row).textContent)}</dd></div><div><dt>Due</dt><dd>${escapeHtml(taskDue(row))}</dd></div></dl>
          <p class="d-note"><span class="bloo-orb" aria-hidden="true"></span><span>Approving here updates the task in ${sourceNames[src]}. You can also open it there for the full record.</span></p>
          <div class="d-actions">
            <button class="btn btn--primary" type="button" id="approve-task"${row.classList.contains("is-done") ? " disabled" : ""}><span class="btn__label">${row.classList.contains("is-done") ? "Done" : "Approve"}</span><span class="spinner" aria-hidden="true"></span></button>
            <button class="btn btn--quiet" type="button" data-toast="Opening ${sourceNames[src]} in a new tab…">Open in ${sourceNames[src]} ${icon("i-external", "ico ico--sm")}</button>
            <button class="btn btn--quiet" type="button" disabled title="Only the task owner can reassign">Reassign</button>
          </div>`
      };
    }
  };

  let returnToInbox = false;
  function openDrawer(type, ctx) {
    closeAskLayer({ restoreFocus: false });
    // Reviewing a task from the inbox comes back to the inbox afterwards
    if (inboxOpen && type !== "inbox") { restoreAttention(); returnToInbox = true; }
    const view = drawerViews[type](ctx);
    if (!drawer.classList.contains("is-open")) lastFocus = document.activeElement;
    drawerTitle.textContent = view.title;
    drawerSub.textContent = view.sub || "";
    drawerSub.hidden = !view.sub;
    drawerActions.innerHTML = view.actions || "";
    drawerBody.innerHTML = view.html;
    drawerBody.scrollTop = 0;
    drawer.classList.add("is-open");
    drawer.classList.toggle("is-fullpage", type === "inbox");
    drawer.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
    closeMenus(); closeNav();
    setTimeout(() => $(".drawer__head .icon-btn").focus(), 60);

    if (type === "inbox") {
      const badge = $("#inbox-badge");
      if (badge) { badge.style.transform = "scale(0)"; setTimeout(() => badge.remove(), 250); }
      $("#inbox-panel-inbox").prepend(attentionBody);
      inboxOpen = true;
      initInbox();
    }
    if (type === "task") {
      $("#approve-task").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        btn.classList.add("is-loading");
        $(".btn__label", btn).textContent = "Approving";
        setTimeout(() => {
          btn.classList.remove("is-loading");
          closeDrawer();
          quickResolve(ctx, "approve"); // the original threw here; the row now resolves
        }, reduceMotion ? 0 : 900);
      });
    }
  }
  // The attention list goes back to its chapter, without the inbox's search
  function restoreAttention() {
    if (!inboxOpen) return;
    taskList.classList.remove("is-refining");
    taskRows().forEach((r) => r.classList.remove("is-nomatch", "is-duefiltered"));
    attentionBodyHome.parent.insertBefore(attentionBody, attentionBodyHome.next);
    inboxOpen = false;
    requestAnimationFrame(() => moveTabIndicator());
  }
  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;
    if (returnToInbox) { returnToInbox = false; openDrawer("inbox"); return; }
    restoreAttention();
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-drawer]");
    if (opener) { e.preventDefault(); openDrawer(opener.dataset.drawer); }
    const review = e.target.closest("[data-task]");
    if (review && !review.disabled) openDrawer("task", review.closest(".task"));
    const approveBtn = e.target.closest("[data-approve]");
    if (approveBtn && !approveBtn.disabled) quickResolve(approveBtn.closest(".task"), "approve");
    const rejectBtn = e.target.closest("[data-reject]");
    if (rejectBtn && !rejectBtn.disabled) quickResolve(rejectBtn.closest(".task"), "reject");
  });
  $$("[data-close-drawer]").forEach((el) => el.addEventListener("click", closeDrawer));

  /* ---------------------------------------------------------------
     8b. Inbox workspace — tasks, drafts, my requests, history
     --------------------------------------------------------------- */
  const REQ_TYPES = { tcdf: "TCDF", memo: "Internal Memo", rfp: "RFP" };
  const TYPE_ORDER = ["tcdf", "memo", "rfp"];
  const STATUS = {
    draft: { label: "Draft", icon: "i-edit", tone: "neutral" },
    pending: { label: "Pending approval", icon: "i-clock", tone: "warn" },
    review: { label: "In review", icon: "i-eye", tone: "info" },
    returned: { label: "Returned for changes", icon: "i-undo", tone: "alert" },
    approved: { label: "Approved", icon: "i-check", tone: "good" },
    rejected: { label: "Rejected", icon: "i-x", tone: "alert" },
    completed: { label: "Completed", icon: "i-check", tone: "neutral" }
  };
  const MIN = 60000;
  const DAY = 1440;
  const minsAgo = (m) => Date.now() - m * MIN;
  let reqSeq = 2044;
  const requests = [
    { id: 1, status: "draft", type: "tcdf", title: "Annual Service Agreement – Project Alpha", at: minsAgo(5 * DAY) },
    { id: 2, status: "draft", type: "memo", title: "Request for Budget Approval – Marketing Campaign", at: minsAgo(7 * DAY) },
    { id: 3, status: "draft", type: "rfp", title: "Payment Request – Annual Software License", at: minsAgo(15) },
    { id: 4, status: "draft", type: "tcdf", title: "Service Agreement Renewal – Facilities Maintenance", at: minsAgo(2 * DAY) },
    { id: 5, status: "draft", type: "memo", title: "Updated Site Access Hours – Mussafah Warehouse", at: minsAgo(180) },
    { id: 6, status: "draft", type: "tcdf", title: "Consultancy Agreement – Digital Platforms Audit", at: minsAgo(DAY + 200) },
    { id: 7, status: "draft", type: "tcdf", title: "Supply Contract – Site Equipment Q4", at: minsAgo(4 * DAY) },
    { id: 8, status: "draft", type: "memo", title: "Team Offsite – Venue and Budget Proposal", at: minsAgo(12 * DAY) },
    { id: 9, status: "pending", type: "tcdf", title: "Maintenance Contract – HVAC Systems, Tower B", at: minsAgo(DAY), ref: "REQ-2043", approver: "Mathew Raymond" },
    { id: 10, status: "review", type: "rfp", title: "RFP – Fleet Telematics Provider", at: minsAgo(3 * DAY), ref: "REQ-2041", approver: "Procurement Committee" },
    { id: 11, status: "pending", type: "memo", title: "New Joiner Onboarding – Digital Platforms", at: minsAgo(6 * DAY), ref: "REQ-2038", approver: "Mathew Raymond" },
    { id: 12, status: "returned", type: "tcdf", title: "Vendor Agreement – Cloud Hosting Renewal", at: minsAgo(9 * DAY), ref: "REQ-2035", approver: "Finance", note: "Needs the updated pricing schedule before it can be approved." },
    { id: 13, status: "approved", type: "tcdf", title: "Framework Agreement – Office Cleaning Services", at: minsAgo(20 * DAY), ref: "REQ-2029", approver: "Mathew Raymond" },
    { id: 14, status: "approved", type: "tcdf", title: "License Agreement – Design Software Seats", at: minsAgo(34 * DAY), ref: "REQ-2022", approver: "Mathew Raymond" },
    { id: 15, status: "rejected", type: "memo", title: "Parking Allocation Update – Tower B", at: minsAgo(41 * DAY), ref: "REQ-2018", approver: "Facilities" },
    { id: 16, status: "approved", type: "tcdf", title: "Service Agreement – Security Services, Site 4", at: minsAgo(52 * DAY), ref: "REQ-2011", approver: "Mathew Raymond" },
    { id: 17, status: "completed", type: "rfp", title: "RFP – Warehouse Racking Systems", at: minsAgo(60 * DAY), ref: "REQ-2007", approver: "Procurement Committee" },
    { id: 18, status: "approved", type: "memo", title: "Holiday Schedule – Operations Team", at: minsAgo(66 * DAY), ref: "REQ-2004", approver: "Mathew Raymond" }
  ];
  const decisions = []; // tasks approved or rejected from the inbox this session
  const TABS = {
    inbox: { label: "Inbox" },
    drafts: { label: "Drafts", statuses: ["draft"] },
    mine: { label: "My requests", statuses: ["pending", "review", "returned"] },
    history: { label: "History", statuses: ["approved", "rejected", "completed"] }
  };
  const ib = { tab: "inbox", q: "", type: "all", sort: "new", due: "all", confirm: null, open: null, flash: null };
  const typeLabel = (r) => r.app || REQ_TYPES[r.type];
  const byTab = (tab) => tab === "history"
    ? [...decisions, ...requests.filter((r) => TABS.history.statuses.includes(r.status))]
    : requests.filter((r) => (TABS[tab].statuses || []).includes(r.status));
  const tabCount = (tab) => (tab === "inbox" ? totalCount() : byTab(tab).length);

  function fmtAgo(at) {
    const m = Math.max(0, Math.round((Date.now() - at) / MIN));
    if (m < 1) return "Just now";
    if (m < 60) return `${m} ${m === 1 ? "min" : "mins"} ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
    const d = Math.round(m / DAY);
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d} days ago`;
    if (d < 30) { const w = Math.round(d / 7); return w === 1 ? "1 week ago" : `${w} weeks ago`; }
    const mo = Math.round(d / 30);
    return mo === 1 ? "1 month ago" : `${mo} months ago`;
  }

  function recordDecision(row, action) {
    decisions.unshift({ id: `d${decisions.length + 1}`, decision: true, status: action === "approve" ? "approved" : "rejected",
      title: taskTitle(row), app: sourceNames[row.dataset.source], mark: sourceMarks[row.dataset.source], at: Date.now() });
    if (inboxOpen) renderInbox();
  }

  function inboxShell() {
    return `<div class="inbox">
      <section class="inbox-card inbox-summary" id="inbox-summary" aria-live="polite"></section>
      <section class="inbox-card inbox-chart" aria-labelledby="chart-title">
        <header class="inbox-chart__head"><h3 id="chart-title">Requests by type</h3><span class="meta">All your requests</span></header>
        <div class="donut" id="donut"><svg viewBox="0 0 120 120" id="donut-svg" role="img"></svg>
          <p class="donut__center" aria-hidden="true"><strong id="donut-num"></strong><span id="donut-label"></span></p></div>
        <ul class="legend" id="legend"></ul>
      </section>
      <aside class="inbox-card suggests inbox-bloo" id="inbox-bloo" aria-label="Bloo suggests"></aside>
      <section class="inbox-main" aria-label="Your inbox">
        <div class="inbox-toolbar">
          <label class="inbox-search">${icon("i-search", "ico ico--sm")}<span class="sr-only">Search</span>
            <input id="inbox-search" type="search" autocomplete="off" placeholder="Search…"></label>
          <div class="inbox-app" id="inbox-app">
            <button class="inbox-filter__btn inbox-app__btn" type="button" id="inbox-app-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="inbox-app-menu"></button>
            <div class="inbox-filter__menu inbox-app__menu" id="inbox-app-menu" role="menu" aria-label="Filter tasks by app" hidden></div>
          </div>
          <div class="inbox-filter">
            <button class="inbox-filter__btn" type="button" id="inbox-filter-btn" aria-expanded="false" aria-controls="inbox-filter-menu">${icon("i-filter", "ico ico--sm")}<span class="inbox-filter__label">Filter</span><span class="inbox-filter__badge" id="inbox-filter-badge" hidden></span>${icon("i-chevron-down", "ico ico--xs")}</button>
            <div class="inbox-filter__menu" id="inbox-filter-menu" role="menu" aria-label="Filter" hidden></div>
          </div>
        </div>
        <div class="tabs inbox-tabs" role="tablist" aria-label="Inbox sections" id="inbox-tabs">
          <span class="tabs__indicator" aria-hidden="true"></span>
          ${Object.entries(TABS).map(([k, v]) => `<button class="tab" role="tab" type="button" id="inbox-tab-${k}" data-itab="${k}" aria-controls="${k === "inbox" ? "inbox-panel-inbox" : "inbox-panel-list"}" aria-selected="false" tabindex="-1">${v.label} <span class="tab__count"></span></button>`).join("")}
        </div>
        <div class="inbox-panel" id="inbox-panel-inbox" role="tabpanel" aria-labelledby="inbox-tab-inbox">
          <p class="inbox-empty" id="task-search-empty" hidden></p>
        </div>
        <div class="inbox-panel" id="inbox-panel-list" role="tabpanel" hidden>
          <div class="req-head" aria-hidden="true"><span>Requests</span><span class="req-head__status">Status</span><span>Actions</span></div>
          <ul class="req-list" id="req-list"></ul>
          <div class="inbox-empty" id="req-empty" hidden></div>
        </div>
      </section>
    </div>`;
  }

  function initInbox() {
    ib.confirm = null;
    ib.open = null;
    $("#inbox-search").value = ib.q;
    renderInbox();
    document.fonts?.ready.then(() => moveTabIndicator($("#inbox-tabs")));
  }

  function renderInbox() {
    if (!inboxOpen) return;
    $$("#inbox-tabs .tab").forEach((t) => {
      const on = t.dataset.itab === ib.tab;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(".tab__count", t).textContent = tabCount(t.dataset.itab);
    });
    $("#inbox-panel-inbox").hidden = ib.tab !== "inbox";
    $("#inbox-panel-list").hidden = ib.tab === "inbox";
    $("#inbox-panel-list").setAttribute("aria-labelledby", `inbox-tab-${ib.tab}`);
    $("#inbox-search").placeholder = ib.tab === "inbox" ? "Search tasks…" : `Search ${TABS[ib.tab].label.toLowerCase()}…`;
    moveTabIndicator($("#inbox-tabs"));
    $("#inbox-app").hidden = ib.tab !== "inbox";
    renderSummary();
    renderChart();
    renderBloo();
    renderAppFilter();
    renderFilter();
    renderPanel();
  }

  // On the Inbox page the app tabs become one dropdown; home keeps its tabs.
  // Both drive the same list through filterAttention().
  const currentApp = () => $(".tab.is-selected", tabsEl)?.dataset.tab || "all";
  function renderAppFilter() {
    const cur = currentApp();
    const lead = (k) => (k === "all" ? `<span class="inbox-app__all">${icon("i-grid", "ico ico--xs")}</span>` : `<span class="app-mark app-mark--${sourceMarks[k]}"></span>`);
    const name = (k) => (k === "all" ? "All apps" : sourceNames[k]);
    const n = (k) => (k === "all" ? totalCount() : counts[k]);
    $("#inbox-app-btn").innerHTML = `${lead(cur)}<span class="inbox-app__name">${name(cur)}</span><span class="inbox-app__count">${n(cur)}</span>${icon("i-chevron-down", "ico ico--xs")}`;
    $("#inbox-app-btn").setAttribute("aria-label", `App: ${name(cur)}, ${n(cur)} tasks. Change app`);
    $("#inbox-app-menu").innerHTML = `<p class="filter-group">App</p>` + ["all", ...Object.keys(sourceNames)].map((k) =>
      `<button class="filter-opt inbox-app__opt" type="button" role="menuitemradio" aria-checked="${k === cur}" data-appf="${k}">${lead(k)}<span class="inbox-app__opt-name">${name(k)}</span><span class="inbox-app__n">${n(k)}</span>${icon("i-check", "ico ico--xs")}</button>`).join("");
  }
  function closeInboxMenus(except) {
    [["#inbox-filter-menu", "#inbox-filter-btn"], ["#inbox-app-menu", "#inbox-app-btn"]].forEach(([m, b]) => {
      if (m === except || !$(m)) return;
      $(m).hidden = true;
      $(b).setAttribute("aria-expanded", "false");
    });
  }

  function renderSummary() {
    const open = taskRows().filter(isOpen);
    const drafts = byTab("drafts");
    const mine = byTab("mine");
    const hist = byTab("history");
    const stale = drafts.filter((r) => Date.now() - r.at > 7 * DAY * MIN).length;
    const returned = mine.filter((r) => r.status === "returned").length;
    const cfg = {
      inbox: (() => {
        const app = currentApp();
        const rows = open.filter((r) => app === "all" || r.dataset.source === app);
        return { ico: "i-inbox", label: app === "all" ? "Waiting on you" : `Waiting in ${sourceNames[app]}`, n: app === "all" ? totalCount() : counts[app],
          sub: `${rows.filter(isOverdue).length} overdue · ${rows.filter(isToday).length} due today` };
      })(),
      drafts: { ico: "i-edit", label: "Draft count", n: drafts.length, sub: stale ? `${plural(stale, "draft hasn’t", "drafts haven’t")} been touched in over a week` : "All edited in the last week" },
      mine: { ico: "i-clock", label: "In progress", n: mine.length, sub: returned ? `${returned} returned for changes` : "With approvers now" },
      history: { ico: "i-check", label: "Completed", n: hist.length, sub: `${hist.filter((r) => r.status === "approved").length} approved · ${hist.filter((r) => r.status === "rejected").length} rejected` }
    }[ib.tab];
    $("#inbox-summary").innerHTML = `<span class="inbox-summary__ico">${icon(cfg.ico)}</span>
      <div><p class="inbox-summary__label">${cfg.label}</p><p class="inbox-summary__num">${cfg.n}</p></div>
      <p class="inbox-summary__sub">${cfg.sub}</p>`;
  }

  // Donut: part-to-whole at a glance, 3 segments, 2-unit surface gaps.
  // Hover or focus a segment or legend row to read it in the centre.
  function renderChart() {
    const counts = TYPE_ORDER.map((k) => requests.filter((r) => r.type === k).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const gap = counts.filter(Boolean).length > 1 ? 1.4 : 0;
    let off = 0;
    $("#donut-svg").innerHTML = `<circle class="donut__track" cx="60" cy="60" r="46"/>` + TYPE_ORDER.map((k, i) => {
      if (!counts[i]) return "";
      const len = (counts[i] / total) * 100;
      const dash = Math.max(len - gap, 0.6);
      const seg = `<circle class="donut__seg donut__seg--${k}" data-type="${k}" cx="60" cy="60" r="46" pathLength="100" stroke-dasharray="${dash.toFixed(2)} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${REQ_TYPES[k]}: ${counts[i]}</title></circle>`;
      off += len;
      return seg;
    }).join("");
    $("#donut-svg").setAttribute("aria-label", `Requests by type: ${TYPE_ORDER.map((k, i) => `${REQ_TYPES[k]} ${counts[i]}`).join(", ")}, ${total} in total`);
    $("#legend").innerHTML = TYPE_ORDER.map((k, i) => `<li><button class="legend__row" type="button" data-type="${k}">
      <span class="legend__swatch legend__swatch--${k}" aria-hidden="true"></span><span class="legend__name">${REQ_TYPES[k]}</span>
      <span class="legend__n">${counts[i]}</span><span class="legend__pct">${total ? Math.round((counts[i] / total) * 100) : 0}%</span></button></li>`).join("");
    chartFocus(null, counts, total);
  }
  function chartFocus(type, counts, total) {
    const donut = $("#donut");
    if (!donut) return;
    counts = counts || TYPE_ORDER.map((k) => requests.filter((r) => r.type === k).length);
    total = total ?? counts.reduce((a, b) => a + b, 0);
    donut.classList.toggle("is-focus", !!type);
    $$(".donut__seg", donut).forEach((s) => s.classList.toggle("is-on", s.dataset.type === type));
    $$(".legend__row").forEach((r) => r.classList.toggle("is-on", r.dataset.type === type));
    const i = TYPE_ORDER.indexOf(type);
    $("#donut-num").textContent = type ? counts[i] : total;
    $("#donut-label").textContent = type ? `${REQ_TYPES[type]} · ${total ? Math.round((counts[i] / total) * 100) : 0}%` : "requests";
  }

  function renderBloo() {
    const drafts = byTab("drafts").sort((a, b) => b.at - a.at);
    const mine = byTab("mine");
    const returned = mine.find((r) => r.status === "returned");
    const hist = byTab("history").filter((r) => !r.decision);
    let text = "";
    let action = "";
    if (ib.tab === "inbox") {
      text = $("#bloo-suggests").textContent;
      if (suggestedRow) action = `<button class="btn btn--primary btn--sm" type="button" data-ibloo="review">Review it${icon("i-arrow", "ico ico--sm btn__arrow")}</button>`;
    } else if (ib.tab === "drafts") {
      if (drafts[0]) {
        text = `“${escapeHtml(drafts[0].title)}” was saved ${fmtAgo(drafts[0].at).toLowerCase()}. Pick up where you left off?`;
        action = `<button class="btn btn--primary btn--sm" type="button" data-ibloo="continue" data-id="${drafts[0].id}">Continue editing${icon("i-arrow", "ico ico--sm btn__arrow")}</button>`;
      } else text = "No drafts right now. Start a new request whenever you’re ready.";
    } else if (ib.tab === "mine") {
      if (returned) {
        text = `“${escapeHtml(returned.title)}” was returned by ${returned.approver}: ${escapeHtml(returned.note.replace(/\.$/, "").toLowerCase())}.`;
        action = `<button class="btn btn--primary btn--sm" type="button" data-ibloo="continue" data-id="${returned.id}">Edit and resubmit${icon("i-arrow", "ico ico--sm btn__arrow")}</button>`;
      } else text = `${plural(mine.length, "request is", "requests are")} with approvers. I’ll let you know when anything changes.`;
    } else {
      const ok = hist.filter((r) => r.status === "approved").length;
      text = `${ok} of your last ${hist.length} requests were approved. Decisions you make on tasks here are added to this history too.`;
    }
    $("#inbox-bloo").innerHTML = `<p class="suggests__who"><span class="bloo-orb" aria-hidden="true"></span>Bloo suggests</p>
      <p class="suggests__text">${text}</p>${action ? `<div class="suggests__actions">${action}</div>` : ""}`;
  }

  function renderFilter() {
    const menu = $("#inbox-filter-menu");
    const opt = (group, value, label, on) => `<button class="filter-opt" type="button" role="menuitemradio" aria-checked="${on}" data-fgroup="${group}" data-fvalue="${value}"><span>${label}</span>${icon("i-check", "ico ico--xs")}</button>`;
    let active = 0;
    if (ib.tab === "inbox") {
      active = ib.due !== "all" ? 1 : 0;
      menu.innerHTML = `<p class="filter-group">Due</p>${[["all", "Any time"], ["overdue", "Overdue"], ["today", "Due today"], ["later", "Later this week"]].map(([v, l]) => opt("due", v, l, ib.due === v)).join("")}`;
    } else {
      active = (ib.type !== "all" ? 1 : 0) + (ib.sort !== "new" ? 1 : 0);
      menu.innerHTML = `<p class="filter-group">Type</p>${[["all", "All types"], ...TYPE_ORDER.map((k) => [k, REQ_TYPES[k]])].map(([v, l]) => opt("type", v, l, ib.type === v)).join("")}
        <p class="filter-group">Sort</p>${[["new", "Newest first"], ["old", "Oldest first"]].map(([v, l]) => opt("sort", v, l, ib.sort === v)).join("")}`;
    }
    if (active) menu.insertAdjacentHTML("beforeend", `<button class="filter-reset" type="button" data-freset>Reset filters</button>`);
    const badge = $("#inbox-filter-badge");
    badge.hidden = !active;
    badge.textContent = active;
    $("#inbox-filter-btn").setAttribute("aria-label", active ? `Filter, ${active} active` : "Filter");
  }

  function renderPanel() {
    if (ib.tab === "inbox") { refineTasks(); return; }
    const q = ib.q.trim().toLowerCase();
    const list = byTab(ib.tab)
      .filter((r) => (ib.type === "all" || r.type === ib.type))
      .filter((r) => !q || `${r.title} ${typeLabel(r)} ${r.ref || ""} ${STATUS[r.status].label}`.toLowerCase().includes(q))
      .sort((a, b) => (ib.sort === "new" ? b.at - a.at : a.at - b.at));
    const listEl = $("#req-list");
    listEl.classList.toggle("is-drafts", ib.tab === "drafts");
    $(".req-head").classList.toggle("is-drafts", ib.tab === "drafts");
    listEl.innerHTML = list.map(rowHTML).join("");
    listEl.hidden = !list.length;
    $(".req-head").hidden = !list.length;
    const empty = $("#req-empty");
    empty.hidden = !!list.length;
    if (!list.length) {
      const filtered = q || ib.type !== "all";
      empty.innerHTML = filtered
        ? `<p>Nothing in ${TABS[ib.tab].label} matches${q ? ` “${escapeHtml(ib.q.trim())}”` : ""}${ib.type !== "all" ? ` for ${REQ_TYPES[ib.type]}` : ""}.</p><button class="text-btn" type="button" data-freset>Clear search and filters</button>`
        : ib.tab === "drafts" ? `<p>No drafts. Start a new request and save it here until it’s ready.</p><button class="btn btn--primary btn--sm" type="button" data-new-request>${icon("i-plus", "ico ico--sm")}New request</button>`
        : `<p>Nothing here yet.</p>`;
    }
    if (ib.flash) {
      const row = $(`.req[data-id="${ib.flash}"]`, listEl);
      ib.flash = null;
      if (row) { row.classList.add("is-flash"); row.scrollIntoView({ block: "nearest", behavior: behavior() }); }
    }
  }

  function rowHTML(r) {
    const st = STATUS[r.status];
    const confirming = ib.confirm && ib.confirm.id === r.id;
    const open = ib.open === r.id;
    const lead = r.decision
      ? `<span class="req__icon req__icon--app"><span class="app-mark app-mark--${r.mark}"></span></span>`
      : `<span class="req__icon req__icon--${r.type}">${icon("i-doc", "ico ico--sm")}</span>`;
    const meta = [typeLabel(r), fmtAgo(r.at), r.ref].filter(Boolean).map((m, i) => (i ? `<span>${escapeHtml(m)}</span>` : escapeHtml(m))).join("");
    const status = r.status === "draft" ? "" : `<span class="status status--${st.tone}">${icon(st.icon, "ico ico--xs")}${r.decision ? (r.status === "approved" ? "You approved" : "You rejected") : st.label}</span>`;
    const btn = (act, label, ico, cls = "req-btn--quiet", extra = "") => `<button class="req-btn ${cls}" type="button" data-req="${act}"${extra}>${icon(ico, "ico ico--xs")}${label}</button>`;
    let actions;
    if (confirming) {
      const del = ib.confirm.kind === "delete";
      actions = `<span class="req__confirm">${del ? "Delete this draft?" : "Withdraw this request?"}</span>
        ${btn("cancel", "Keep", "i-x")}${btn(del ? "delete-yes" : "withdraw-yes", del ? "Delete" : "Withdraw", del ? "i-trash" : "i-undo", "req-btn--danger")}`;
    } else if (r.status === "draft") {
      actions = btn("edit", "Edit", "i-edit", "req-btn--edit") + btn("delete", "Delete", "i-trash", "req-btn--delete");
    } else if (r.status === "returned") {
      actions = btn("edit", "Edit & resubmit", "i-edit", "req-btn--edit") + btn("view", open ? "Hide" : "View", "i-eye", "req-btn--quiet", ` aria-expanded="${open}"`);
    } else if (r.status === "pending" || r.status === "review") {
      actions = btn("view", open ? "Hide" : "View", "i-eye", "req-btn--quiet", ` aria-expanded="${open}"`) + btn("withdraw", "Withdraw", "i-undo", "req-btn--delete");
    } else {
      actions = btn("view", open ? "Hide" : "View", "i-eye", "req-btn--quiet", ` aria-expanded="${open}"`);
    }
    const detail = open ? `<div class="req__detail">
        <dl class="req__facts">
          ${r.ref ? `<div><dt>Reference</dt><dd>${r.ref}</dd></div>` : ""}
          <div><dt>${r.decision ? "Source" : "Type"}</dt><dd>${escapeHtml(typeLabel(r))}</dd></div>
          <div><dt>${r.decision ? "Decided" : r.status === "draft" ? "Last edited" : "Submitted"}</dt><dd>${fmtAgo(r.at)}</dd></div>
          ${r.approver ? `<div><dt>Approver</dt><dd>${escapeHtml(r.approver)}</dd></div>` : ""}
          <div><dt>Status</dt><dd>${escapeHtml(st.label)}</dd></div>
        </dl>
        ${r.note ? `<p class="req__note">${icon("i-undo", "ico ico--xs")}${escapeHtml(r.note)}</p>` : ""}
        ${r.details ? `<p class="req__details">${escapeHtml(r.details)}</p>` : ""}
      </div>` : "";
    return `<li class="req${confirming ? " is-confirming" : ""}${open ? " is-open" : ""}" data-id="${r.id}">
      <div class="req__main">${lead}
        <div class="req__txt"><p class="req__title">${escapeHtml(r.title)}</p><p class="req__meta">${meta}</p></div>
        ${ib.tab === "drafts" ? "" : `<div class="req__status">${status}</div>`}
        <div class="req__actions">${actions}</div>
      </div>${detail}</li>`;
  }

  // Search and the due filter narrow the task list without touching the app tabs
  function refineTasks() {
    const q = ib.q.trim().toLowerCase();
    taskList.classList.toggle("is-refining", !!q || ib.due !== "all");
    taskRows().forEach((r) => {
      r.classList.toggle("is-nomatch", !!q && !r.textContent.toLowerCase().includes(q));
      const due = isOverdue(r) ? "overdue" : isToday(r) ? "today" : "later";
      r.classList.toggle("is-duefiltered", ib.due !== "all" && due !== ib.due);
    });
    const empty = $("#task-search-empty");
    if (!empty) return;
    const refining = !!q || ib.due !== "all";
    const visible = taskRows().filter((r) => r.offsetParent !== null).length;
    empty.hidden = !refining || visible > 0 || taskList.classList.contains("is-loading");
    empty.innerHTML = `No tasks match${q ? ` “${escapeHtml(ib.q.trim())}”` : " this filter"}. <button class="text-btn" type="button" data-freset>Clear search and filters</button>`;
  }

  function selectInboxTab(tab, focus = false) {
    ib.tab = tab;
    ib.confirm = null;
    ib.open = null;
    renderInbox();
    if (focus) $(`#inbox-tab-${tab}`).focus();
  }
  function openInbox(tab = "inbox") {
    if (!inboxOpen || !drawer.classList.contains("is-open")) openDrawer("inbox");
    selectInboxTab(tab);
  }
  const findReq = (id) => requests.find((r) => String(r.id) === String(id));

  // Inbox events — delegated, since the view is re-rendered
  drawer.addEventListener("click", (e) => {
    if (!inboxOpen) return;
    const tab = e.target.closest("[data-itab]");
    if (tab) { selectInboxTab(tab.dataset.itab); return; }
    // Filter clicks stay inside: the menu re-renders, so an outside-click
    // check would otherwise see a detached target and close it
    if (e.target.closest(".inbox-filter, .inbox-app")) e.stopPropagation();
    const menuBtn = e.target.closest("#inbox-filter-btn, #inbox-app-btn");
    if (menuBtn) {
      const menu = $(`#${menuBtn.getAttribute("aria-controls")}`);
      closeInboxMenus(`#${menu.id}`);
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute("aria-expanded", String(!menu.hidden));
      if (!menu.hidden) $(".filter-opt[aria-checked=\"true\"]", menu)?.focus();
      return;
    }
    const appOpt = e.target.closest("[data-appf]");
    if (appOpt) {
      filterAttention(appOpt.dataset.appf);
      closeInboxMenus();
      renderAppFilter(); renderSummary(); refineTasks();
      $("#inbox-app-btn").focus();
      return;
    }
    const f = e.target.closest("[data-fgroup]");
    if (f) {
      ib[f.dataset.fgroup] = f.dataset.fvalue;
      renderFilter(); renderPanel();
      return;
    }
    if (e.target.closest("[data-freset]")) {
      Object.assign(ib, { q: "", type: "all", sort: "new", due: "all" });
      $("#inbox-search").value = "";
      closeInboxMenus();
      if (ib.tab === "inbox" && currentApp() !== "all") { filterAttention("all"); renderAppFilter(); renderSummary(); }
      renderFilter(); renderPanel();
      return;
    }
    if (e.target.closest("[data-new-request]")) { openRequestForm(); return; }
    const bloo = e.target.closest("[data-ibloo]");
    if (bloo) {
      if (bloo.dataset.ibloo === "review" && suggestedRow) openDrawer("task", suggestedRow);
      else openRequestForm(findReq(bloo.dataset.id));
      return;
    }
    const act = e.target.closest("[data-req]");
    if (act) {
      const r = findReq(act.closest(".req").dataset.id) || decisions.find((d) => d.id === act.closest(".req").dataset.id);
      const kind = act.dataset.req;
      if (kind === "edit") openRequestForm(r);
      else if (kind === "view") ib.open = ib.open === r.id ? null : r.id;
      else if (kind === "delete" || kind === "withdraw") ib.confirm = { id: r.id, kind };
      else if (kind === "cancel") ib.confirm = null;
      else if (kind === "delete-yes") {
        requests.splice(requests.indexOf(r), 1);
        ib.confirm = null;
        toast(`Draft deleted: ${escapeHtml(r.title)}`, "i-trash");
      } else if (kind === "withdraw-yes") {
        Object.assign(r, { status: "draft", at: Date.now() });
        delete r.ref;
        ib.confirm = null;
        toast("Request withdrawn and moved back to your drafts", "i-undo");
      }
      if (kind !== "edit") {
        renderInbox();
        // Keep keyboard focus on the row that changed, or its tab if it left
        ($(`.req[data-id="${r.id}"] .req-btn`) || $("#inbox-tabs .tab.is-selected"))?.focus();
      }
    }
  });
  drawer.addEventListener("input", (e) => {
    if (e.target.id !== "inbox-search") return;
    ib.q = e.target.value;
    renderPanel();
  });
  drawer.addEventListener("keydown", (e) => {
    const opt = e.target.closest?.(".inbox-filter__menu .filter-opt");
    if (opt && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const opts = $$(".filter-opt", opt.closest(".inbox-filter__menu"));
      opts[(opts.indexOf(opt) + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length].focus();
      e.preventDefault();
      return;
    }
    const tab = e.target.closest?.("#inbox-tabs .tab");
    if (tab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const keys = Object.keys(TABS);
      const i = keys.indexOf(ib.tab);
      selectInboxTab(keys[(i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length], true);
      e.preventDefault();
    }
  });
  const legendFocus = (e) => {
    const t = e.target.closest?.("[data-type]");
    if (inboxOpen && t && t.closest(".inbox-chart")) chartFocus(t.dataset.type);
  };
  drawer.addEventListener("pointerover", legendFocus);
  drawer.addEventListener("focusin", legendFocus);
  drawer.addEventListener("pointerout", (e) => { if (inboxOpen && e.target.closest?.(".inbox-chart [data-type]") && !e.relatedTarget?.closest?.(".inbox-chart [data-type]")) chartFocus(null); });
  drawer.addEventListener("focusout", (e) => { if (inboxOpen && e.target.closest?.(".inbox-chart [data-type]")) chartFocus(null); });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#new-request")) { openRequestForm(); return; }
    if ($("#inbox-filter-menu") && !e.target.closest(".inbox-filter, .inbox-app")) closeInboxMenus();
  });

  /* New request / edit draft */
  const reqModal = $("#request-modal");
  const reqName = $("#request-name");
  const reqDetails = $("#request-details");
  const reqError = $("#request-error");
  let editing = null;
  function openRequestForm(r) {
    closeAskLayer({ restoreFocus: false });
    editing = r || null;
    const resubmit = r && r.status === "returned";
    $("#request-title").textContent = !r ? "New request" : resubmit ? "Edit and resubmit" : "Edit draft";
    $("#request-sub").textContent = resubmit ? `Returned by ${r.approver}: ${r.note}` : "Save it as a draft, or submit it for approval.";
    $(`#request-type-${r ? r.type : "tcdf"}`).checked = true;
    reqName.value = r ? r.title : "";
    reqDetails.value = r?.details || "";
    reqError.hidden = true;
    reqName.removeAttribute("aria-invalid");
    $("#request-draft").hidden = !!resubmit;
    $("#request-submit").textContent = resubmit ? "Resubmit request" : "Submit request";
    reqModal.showModal();
    setTimeout(() => reqName.focus(), 30);
  }
  function saveRequest(submit) {
    const title = reqName.value.trim();
    if (!title) {
      reqError.hidden = false;
      reqName.setAttribute("aria-invalid", "true");
      reqName.focus();
      return;
    }
    const type = $('input[name="request-type"]:checked').value;
    const details = reqDetails.value.trim();
    let r = editing;
    if (!r) { r = { id: Date.now() }; requests.push(r); }
    Object.assign(r, { type, title, details, at: Date.now() });
    if (submit) {
      Object.assign(r, { status: "pending", ref: r.ref || `REQ-${++reqSeq}`, approver: r.approver || "Mathew Raymond" });
      delete r.note;
    } else r.status = "draft";
    reqModal.close();
    toast(submit ? `Submitted for approval · ${r.ref}` : "Saved to your drafts", submit ? "i-check" : "i-edit");
    ib.flash = r.id;
    if (inboxOpen) selectInboxTab(submit ? "mine" : "drafts");
    editing = null;
  }
  $("#request-form").addEventListener("submit", (e) => { e.preventDefault(); saveRequest(true); });
  $("#request-draft").addEventListener("click", () => saveRequest(false));
  $$("[data-close-request]").forEach((b) => b.addEventListener("click", () => reqModal.close()));
  reqName.addEventListener("input", () => { if (reqName.value.trim()) { reqError.hidden = true; reqName.removeAttribute("aria-invalid"); } });

  /* ---------------------------------------------------------------
     9. Announcements — birthdays, wish modal, timeline
     --------------------------------------------------------------- */
  const birthdays = [
    { name: "Ahmed Obaid", role: "Contact Center Agent", img: "img-rashid", initials: "AO" },
    { name: "Mariam Al Hashimi", role: "Finance Analyst", img: "img-av-mh", initials: "MH" },
    { name: "Yousef Karim", role: "Site Engineer", img: "img-av-yousef", initials: "YK" }
  ];
  const celebrate = $("#celebrate");
  const bTrack = $("#bday-track");
  const bDots = $("#bday-dots");
  let bIndex = 0;
  let bTimer = 0;

  bTrack.innerHTML = birthdays.map((p, i) => `
    <article class="bday" aria-roledescription="slide" aria-label="${i + 1} of ${birthdays.length}" ${i ? 'aria-hidden="true"' : ""}>
      <div class="bday__copy">
        <p class="bday__kicker">Birthday today</p>
        <h3 class="bday__title">Happy birthday, <span>${firstName(p.name)}</span></h3>
        <p class="bday__role">${p.name}, ${p.role}</p>
        <p class="bday__msg">Let’s make the day memorable with your warm wishes.</p>
        <button class="btn btn--light" type="button" data-wish="${i}" ${i ? 'tabindex="-1"' : ""}>${icon("i-gift", "ico ico--sm")}<span>Send birthday wish</span></button>
      </div>
      <figure class="bday__photo" aria-hidden="true">${birthdays.filter((_, n) => n !== i).map((o, n) => `<span class="bday__back bday__back--${n} ${o.img}"></span>`).join("")}<span class="bday__img ${p.img}"></span><span class="bday__badge">${icon("i-gift")}</span></figure>
    </article>`).join("");
  // Named avatar tabs replace the dots: who is celebrating, at a glance
  bDots.innerHTML = birthdays.map((p, i) => `<button class="bday-tab" type="button" role="tab" aria-label="Show ${p.name}" aria-selected="${i === 0}"><span class="bday-tab__img ${p.img}"></span><span class="bday-tab__name">${firstName(p.name)}</span></button>`).join("");

  function goBday(i) {
    bIndex = (i + birthdays.length) % birthdays.length;
    bTrack.style.transform = `translateX(-${bIndex * 100}%)`;
    $$(".bday", bTrack).forEach((s, n) => {
      s.setAttribute("aria-hidden", String(n !== bIndex));
      $("button", s).tabIndex = n === bIndex ? 0 : -1;
    });
    $$(".bday-tab", bDots).forEach((d, n) => d.setAttribute("aria-selected", String(n === bIndex)));
  }
  const stopBday = () => clearInterval(bTimer);
  const startBday = () => { if (!reduceMotion) { stopBday(); bTimer = setInterval(() => goBday(bIndex + 1), 6000); } };
  $$("[data-bday]").forEach((b) => b.addEventListener("click", () => { goBday(bIndex + (b.dataset.bday === "next" ? 1 : -1)); startBday(); }));
  $$(".bday-tab", bDots).forEach((d, i) => d.addEventListener("click", () => { goBday(i); startBday(); }));
  celebrate.addEventListener("mouseenter", stopBday);
  celebrate.addEventListener("mouseleave", startBday);
  celebrate.addEventListener("focusin", stopBday);
  celebrate.addEventListener("focusout", startBday);
  startBday();

  const modal = $("#wish-modal");
  const wishText = $("#wish-text");
  const wishCount = $("#wish-count");
  const wishSend = $("#wish-send");
  // The same card sends birthday wishes and anniversary congratulations
  const ANNIV = { name: "Khalid Rashed", role: "Facilities Manager, Operations", img: "img-av-elder", initials: "KR", years: 10 };
  const annivBtn = $("#anniv-btn");
  const CARDS = {
    birthday: { text: "Happy birthday! Wishing you a wonderful year ahead.", presets: ["Have a great day! 🎉", "Many happy returns", "Cake is on you today"], sent: "Wish sent" },
    anniversary: { text: `Congratulations on ${ANNIV.years} years, ${firstName(ANNIV.name)}! Thank you for everything you do.`, presets: ["Here’s to the next ten! 🎉", "Thank you for everything", "Congratulations!"], sent: "Congratulated" }
  };
  let wishTo = null;
  const updateCount = () => { wishCount.textContent = wishText.value.length; wishSend.disabled = !wishText.value.trim(); };
  wishText.addEventListener("input", updateCount);
  $("#wish-presets").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { wishText.value = c.textContent; updateCount(); wishText.focus(); } });

  function openCard(kind, person, btn, title) {
    closeAskLayer({ restoreFocus: false });
    wishTo = { kind, person, btn };
    $("#wish-title").textContent = title;
    $("#wish-role").textContent = `${person.name}, ${person.role}`;
    const av = $("#wish-avatar");
    av.className = `avatar avatar--xl ${person.img}`;
    av.textContent = person.initials;
    wishText.value = CARDS[kind].text;
    $("#wish-presets").innerHTML = CARDS[kind].presets.map((t) => `<button class="chip" type="button">${escapeHtml(t)}</button>`).join("");
    $("#wish-send .btn__label").textContent = kind === "birthday" ? "Send wish" : "Send congratulations";
    updateCount();
    stopBday();
    modal.showModal();
  }
  function openWish(i) {
    const btn = $(`[data-wish="${i}"]`, bTrack);
    if (btn.classList.contains("is-sent")) { toast(`You’ve already wished ${firstName(birthdays[i].name)} today`, "i-gift"); return; }
    openCard("birthday", birthdays[i], btn, `Wish ${firstName(birthdays[i].name)} a happy birthday`);
  }
  function openCongrats() {
    if (annivBtn.classList.contains("is-sent")) { toast(`You’ve already congratulated ${firstName(ANNIV.name)}`, "i-award"); return; }
    openCard("anniversary", ANNIV, annivBtn, `Congratulate ${firstName(ANNIV.name)} on ${ANNIV.years} years`);
  }
  annivBtn.addEventListener("click", openCongrats);
  bTrack.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wish]");
    if (b && !b.classList.contains("is-sent")) openWish(Number(b.dataset.wish));
  });
  wishSend.addEventListener("click", () => {
    if (!wishTo) return;
    wishSend.classList.add("is-loading");
    $(".btn__label", wishSend).textContent = "Sending";
    setTimeout(() => {
      wishSend.classList.remove("is-loading");
      modal.close();
      const { kind, person, btn } = wishTo;
      btn.classList.add("is-sent");
      btn.innerHTML = `${icon("i-check", "ico ico--sm")}<span>${CARDS[kind].sent}</span>`;
      toast(kind === "birthday" ? `Your wish is on its way to ${firstName(person.name)}` : `Your congratulations are on their way to ${firstName(person.name)}`, kind === "birthday" ? "i-gift" : "i-award");
      startBday();
    }, reduceMotion ? 0 : 900);
  });
  modal.addEventListener("close", startBday);

  // Announcement carousel: one tile at a time
  const annTrack = $("#ann-track");
  const annTiles = $$(".ann", annTrack);
  const annTabs = $$(".ann-tab");
  let annIndex = 0;
  function showAnn(i, smooth = true) {
    annIndex = (i + annTiles.length) % annTiles.length;
    annTrack.scrollTo({ left: annTiles[annIndex].offsetLeft - annTiles[0].offsetLeft, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    markAnn();
  }
  function markAnn() {
    annTabs.forEach((t, n) => t.setAttribute("aria-selected", String(n === annIndex)));
    annTiles.forEach((t, n) => t.toggleAttribute("inert", n !== annIndex));
    $("#ann-count").textContent = `${annIndex + 1} / ${annTiles.length}`;
  }
  annTabs.forEach((t) => t.addEventListener("click", () => showAnn(Number(t.dataset.annGo))));
  $$("[data-ann-step]").forEach((b) => b.addEventListener("click", () => showAnn(annIndex + Number(b.dataset.annStep))));
  let annScrollT = 0;
  annTrack.addEventListener("scroll", () => { clearTimeout(annScrollT); annScrollT = setTimeout(() => {
    const i = Math.round(annTrack.scrollLeft / annTrack.clientWidth);
    if (i !== annIndex) { annIndex = Math.min(i, annTiles.length - 1); markAnn(); }
  }, 90); });
  annTiles.forEach((t, n) => t.addEventListener("focusin", () => { if (n !== annIndex) showAnn(n); }));
  markAnn();

  // Fire drill and Eid tiles
  const drillBtn = $("#drill-cal");
  function addDrill() {
    if (drillBtn.classList.contains("is-sent")) { toast("The fire drill is already in your calendar", "i-calendar"); return; }
    drillBtn.classList.add("is-sent");
    drillBtn.innerHTML = `${icon("i-check", "ico ico--sm")}<span>In your calendar</span>`;
    toast("Fire drill added to your calendar · 26 Sep, 10:30 AM", "i-calendar");
  }
  drillBtn.addEventListener("click", addDrill);
  $("#eid-rewards").addEventListener("click", () => goTo($("#discounts")));

  // Timeline shortcuts
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto-bday]");
    if (b) { showAnn(0); goBday(Number(b.dataset.gotoBday)); goTo(celebrate, "center"); setTimeout(() => $(`[data-wish="${bIndex}"]`, bTrack).focus({ preventScroll: true }), reduceMotion ? 0 : 600); }
    const p = e.target.closest("[data-goto-person]");
    if (p) { showPerson(Number(p.dataset.gotoPerson)); goTo($("#people")); }
    const pol = e.target.closest("[data-goto-policy]");
    if (pol) spotlight($(`[data-policy="${pol.dataset.gotoPolicy}"]`));
  });

  /* ---------------------------------------------------------------
     10. People — reel, portrait expansion, say hello
     --------------------------------------------------------------- */
  const people = [
    { name: "Abdulazeez Aladwan", role: "Projects Affairs Manager", team: "Projects Affairs", manager: "Mathew Raymond", doj: "21 September 2026", week: "Joined this week", img: "img-joiner-abdulazeez",
      quote: "I spent seven years in office administration and procurement. Here I’ll look after how our projects are run, budgeted and delivered." },
    { name: "Sara Al Mansoori", role: "Product Designer", team: "Digital Platforms", manager: "Rashid Khan", doj: "14 September 2026", week: "Joined last week", img: "img-av-sa",
      quote: "I design tools people use every day. My first project is making our internal apps feel as simple as the ones on your phone." },
    { name: "Mohammed Rahim", role: "Procurement Specialist", team: "Supply Chain", manager: "Omar Haddad", doj: "10 September 2026", week: "Joined this month", img: "img-joiner-mohammed",
      quote: "Good procurement is invisible when it works. I’m here to make sure the right materials reach every site on time." },
    { name: "Hana Yusuf", role: "Data Analyst", team: "Finance", manager: "Mariam Al Hashimi", doj: "7 September 2026", week: "Joined this month", img: "img-av-ha",
      quote: "I turn numbers into decisions. Ask me anything about dashboards, forecasting, or the best karak in Abu Dhabi." },
    { name: "Daniel Okafor", role: "Automation Engineer", team: "Digital Platforms", manager: "Rashid Khan", doj: "1 September 2026", week: "Joined this month", img: "img-joiner-daniel",
      quote: "I build the bots that take repetitive work off your plate, so you can spend your time on the parts that need a person." }
  ];
  const ME = "Rashid Khan";
  const peopleSec = $("#people");
  const stage = $("#people-stage");
  const reel = $("#people-reel");
  const helloBtn = $("#say-hello");
  const portrait = $(".people__portrait");
  const greeted = new Set();
  let pIndex = 0;

  reel.innerHTML = people.map((p, i) => `<button class="reel-item" type="button" role="tab" aria-selected="${i === 0}" data-person="${i}" data-lens-item><span class="media ${p.img}"></span><span class="reel-item__name">${p.name}<span class="reel-item__role">${p.role}</span></span></button>`).join("");
  const reelItems = $$(".reel-item", reel);

  const introFor = (p) => `${firstName(p.name)} joined ${p.team} on ${p.doj}${p.manager === ME ? " and reports to you — a hello from their manager goes a long way." : `, reporting to ${p.manager}.`}`;

  function paintPortrait() {
    $("#people-img").className = `people__img media ${people[pIndex].img}`;
  }
  function paintStory() {
    const p = people[pIndex];
    $("#people-intro").textContent = introFor(p);
    $("#people-quote").textContent = p.quote;
    $("#people-name").textContent = p.name;
    $("#people-role").textContent = p.role;
    $("#people-manager").textContent = p.manager;
    $("#people-doj").textContent = p.doj;
    $("#people-team").textContent = p.team;
    $("#people-week").textContent = p.week;
    $("#people-counter").textContent = `${pIndex + 1} / ${people.length}`;
    reelItems.forEach((r, i) => r.setAttribute("aria-selected", String(i === pIndex)));
    const sent = greeted.has(pIndex);
    helloBtn.classList.toggle("is-sent", sent);
    $("span", helloBtn).textContent = sent ? "Hello sent" : `Say hello to ${firstName(p.name)}`;
  }

  // The chosen portrait grows out of its reel thumbnail (FLIP)
  function showPerson(i) {
    const prev = pIndex;
    pIndex = (i + people.length) % people.length;
    if (prev === pIndex) { paintPortrait(); paintStory(); return; }
    if (reduceMotion) { paintPortrait(); paintStory(); return; }
    const from = $(".media", reelItems[pIndex]).getBoundingClientRect();
    const to = portrait.getBoundingClientRect();
    const onScreen = (r) => r.bottom > 0 && r.top < innerHeight;
    stage.classList.add("is-swapping");
    setTimeout(() => { paintStory(); stage.classList.remove("is-swapping"); }, 240);
    if (!onScreen(from) || !onScreen(to) || !to.width) { setTimeout(paintPortrait, 200); return; }
    const ghost = document.createElement("div");
    ghost.className = `people__ghost media ${people[pIndex].img}`;
    Object.assign(ghost.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
    body.appendChild(ghost);
    ghost.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "60px" },
      { transform: "none", borderRadius: "34px" }
    ], { duration: 640, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => {
      paintPortrait();
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = () => ghost.remove();
    };
  }
  $$("[data-people]").forEach((b) => b.addEventListener("click", () => showPerson(pIndex + (b.dataset.people === "next" ? 1 : -1))));
  reelItems.forEach((r, i) => r.addEventListener("click", () => showPerson(i)));
  reel.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    showPerson(pIndex + (e.key === "ArrowRight" ? 1 : -1));
    reelItems[pIndex].focus();
  });
  helloBtn.addEventListener("click", () => {
    if (greeted.has(pIndex)) return;
    greeted.add(pIndex);
    paintStory();
    toast(`You said hello to ${firstName(people[pIndex].name)}`, "i-wave");
  });
  paintPortrait();
  paintStory();

  /* ---------------------------------------------------------------
     11. Policies, FAQ, communities, discounts, perks
     --------------------------------------------------------------- */
  const policiesSec = $("#policies");
  const policiesGrid = $(".policies", policiesSec);
  function filterPolicies(cat) {
    $$("#policy-chips .chip").forEach((c) => {
      const on = c.dataset.cat === cat;
      c.classList.toggle("is-selected", on);
      c.setAttribute("aria-pressed", String(on));
      c.classList.remove("is-suggested");
    });
    $$(".policy", policiesSec).forEach((p) => {
      const show = cat === "all" || p.dataset.cat === cat;
      const was = p.classList.contains("is-filtered");
      p.classList.toggle("is-filtered", !show);
      if (show && was !== !show && !reduceMotion) p.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    $$("[data-policy-group]", policiesSec).forEach((g) => {
      g.classList.toggle("is-empty", !$$(".policy", g).some((p) => !p.classList.contains("is-filtered")));
    });
    policiesGrid.classList.toggle("no-feature", $(".policy--feature").classList.contains("is-filtered"));
    measure();
  }
  $("#policy-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) filterPolicies(chip.dataset.cat);
  });

  // FAQ tabs + accordions
  const faqSec = $("#faq");
  const faqTabs = $("#faq-tabs");
  function selectFaq(tab, focus = false) {
    $$(".tab", faqTabs).forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = $("#" + t.getAttribute("aria-controls"));
      const wasHidden = panel.hidden;
      panel.hidden = !on;
      if (on && wasHidden && !reduceMotion) panel.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    if (focus) tab.focus();
    moveTabIndicator(faqTabs);
  }
  faqTabs.addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) selectFaq(t); });
  faqTabs.addEventListener("keydown", (e) => {
    const tabs = $$(".tab", faqTabs);
    const i = tabs.indexOf(document.activeElement);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined || i < 0) return;
    e.preventDefault();
    selectFaq(tabs[(next + tabs.length) % tabs.length], true);
  });
  moveTabIndicator(faqTabs);
  addEventListener("resize", () => moveTabIndicator(faqTabs));
  document.fonts?.ready.then(() => moveTabIndicator(faqTabs));

  // Communities — expanding panels with a pointer light
  const sportsSec = $("#sports");
  const sports = $$(".sport");
  function openSport(s) {
    sports.forEach((x) => {
      const on = x === s;
      x.classList.toggle("is-open", on);
      $(".sport__hit", x).setAttribute("aria-expanded", String(on));
    });
  }
  sports.forEach((s) => {
    if (canHover) s.addEventListener("mouseenter", () => openSport(s));
    $(".sport__hit", s).addEventListener("click", () => openSport(s));
    $(".sport__hit", s).addEventListener("focus", () => openSport(s));
    if (canHover && !reduceMotion) s.addEventListener("pointermove", (e) => {
      const r = s.getBoundingClientRect();
      s.style.setProperty("--px", `${e.clientX - r.left}px`);
      s.style.setProperty("--py", `${e.clientY - r.top}px`);
    });
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-join]");
    if (!b) return;
    const joined = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(joined));
    b.textContent = joined ? "Joined" : "Join group";
    const name = $(".sport__name", b.closest(".sport")).textContent;
    toast(joined ? `You joined ${name}. The schedule is on its way to your inbox.` : `You left ${name}.`, joined ? "i-check" : "i-x");
  });

  // Discounts — reveal, then copy
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".partner__code");
    if (!b) return;
    if (!b.classList.contains("is-revealed")) {
      b.classList.add("is-revealed");
      b.innerHTML = `${b.dataset.code} ${icon("i-copy", "ico ico--xs")}`;
      b.setAttribute("aria-label", `Copy code ${b.dataset.code}`);
      return;
    }
    try { await navigator.clipboard.writeText(b.dataset.code); toast(`Code ${b.dataset.code} copied`, "i-copy"); }
    catch { toast(`Your code is ${b.dataset.code}`, "i-copy"); }
  });

  // Perks — horizontal exploration with progress and inner parallax
  const perkTrack = $("#perk-track");
  const perkProgress = $("#perk-progress");
  const perkMedia = $$(".perk__media", perkTrack);
  function onPerkScroll() {
    const max = perkTrack.scrollWidth - perkTrack.clientWidth;
    perkProgress.style.transform = `scaleX(${max > 0 ? clamp((perkTrack.scrollLeft + perkTrack.clientWidth) / perkTrack.scrollWidth, .15, 1) : 1})`;
    if (reduceMotion) return;
    const mid = perkTrack.getBoundingClientRect().left + perkTrack.clientWidth / 2;
    perkMedia.forEach((m) => {
      const r = m.parentElement.getBoundingClientRect();
      m.style.transform = `translateX(${((r.left + r.width / 2) - mid) * -0.06}px)`;
    });
  }
  perkTrack.addEventListener("scroll", () => requestAnimationFrame(onPerkScroll), { passive: true });
  $$("[data-scroll]").forEach((b) => b.addEventListener("click", () => {
    const t = document.getElementById(b.dataset.scroll);
    t.scrollBy({ left: Number(b.dataset.dir) * t.clientWidth * 0.75, behavior: behavior() });
  }));

  /* ---------------------------------------------------------------
     12. Motion — reveal, scroll-linked, hero field
     --------------------------------------------------------------- */
  $$(".reveal-item").forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal-item"));
    el.style.setProperty("--i", sibs.indexOf(el));
  });
  const revealEls = $$(".reveal, .chap-head, .support__hero, .reveal-item");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    revealEls.forEach((r) => io.observe(r));
  } else {
    revealEls.forEach((r) => r.classList.add("is-visible"));
  }

  // One rAF loop; geometry cached on resize; only transforms written
  const spineFill = $("#spine-fill");
  const contextFill = $("#context-fill");
  const glows = $$(".field__glow").map((el) => ({ el, speed: Number(el.dataset.speed) || 0 }));
  const heroFade = $$(".signals, .command__index");
  const interlude = $("#life");
  const driftEl = $("[data-drift]");
  let geo = { vh: innerHeight, chapters: new Map(), flow: { top: 0, h: 1 }, hero: 1, parallax: [], nums: [], drift: null };
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;

  function measure() {
    geo.vh = innerHeight;
    geo.chapters = new Map(chapters.map((ch) => [ch, { top: docTop(ch), h: ch.offsetHeight }]));
    geo.flow = { top: docTop(flow), h: flow.offsetHeight || 1 };
    geo.hero = command.offsetHeight || 1;
    geo.parallax = $$("[data-parallax]").map((el) => ({ el, f: Number(el.dataset.parallax), top: docTop(el.parentElement), h: el.parentElement.offsetHeight }));
    geo.nums = $$(".chap-head__num").map((el) => ({ el, top: docTop(el.parentElement) }));
    geo.drift = { top: docTop(interlude), h: interlude.offsetHeight };
    drawLines();
    moveRailIndicator();
    frame();
  }

  function frame() {
    const y = scrollY;
    const vh = geo.vh;
    const g = current && geo.chapters.get(current);
    if (g) contextFill.style.transform = `scaleX(${clamp((y + vh * 0.45 - g.top) / g.h)})`;
    spineFill.style.transform = `scaleY(${clamp((y + vh * 0.5 - geo.flow.top) / geo.flow.h)})`;
    if (reduceMotion) return;
    if (y < geo.hero * 1.2) {
      glows.forEach((gl) => { gl.el.style.translate = `0 ${y * gl.speed}px`; });
      const fade = String(1 - clamp(y / (geo.hero * 0.45)));
      heroFade.forEach((el) => { el.style.opacity = fade; });
    }
    geo.parallax.forEach((p) => {
      if (p.top + p.h < y - 200 || p.top > y + vh + 200) return;
      p.el.style.translate = `0 ${((p.top + p.h / 2) - (y + vh / 2)) * -p.f}px`;
    });
    geo.nums.forEach((n) => {
      if (n.top < y - vh || n.top > y + vh * 2) return;
      n.el.style.translate = `0 ${(n.top - (y + vh / 2)) * 0.07}px`;
    });
    // Life at Bloom: a highlight sweeps through the letters as you pass
    if (driftEl && geo.drift) {
      const p = clamp((y + vh - geo.drift.top) / (vh + geo.drift.h));
      driftEl.style.setProperty("--sweep", `${(1 - p) * 100}%`);
    }
  }

  let ticking = false;
  addEventListener("scroll", () => {
    if (spyLocked) { clearTimeout(spyTimer); spyTimer = setTimeout(unlockSpy, 160); }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { frame(); ticking = false; });
  }, { passive: true });
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measure(); onPerkScroll(); if (!isMobile()) closeNav(); }, 120);
    hideTip();
  });
  if ("ResizeObserver" in window) {
    let roTimer = 0;
    new ResizeObserver(() => { clearTimeout(roTimer); roTimer = setTimeout(measure, 80); }).observe(body);
  }
  addEventListener("load", measure);
  document.fonts?.ready.then(measure);

  // Hero field — cursor light and the lines from each app into the prompt
  const fieldCursor = $("#field-cursor");
  const linesSvg = $("#field-lines");
  const composer = $("#composer");
  if (canHover && !reduceMotion) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const lerp = () => {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      fieldCursor.style.setProperty("--mx", `${cx}px`);
      fieldCursor.style.setProperty("--my", `${cy}px`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(lerp) : 0;
    };
    command.addEventListener("pointermove", (e) => {
      const r = command.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!command.classList.contains("has-pointer")) { cx = tx; cy = ty; command.classList.add("has-pointer"); }
      if (!raf) raf = requestAnimationFrame(lerp);
    });
    command.addEventListener("pointerleave", () => command.classList.remove("has-pointer"));
  }
  function drawLines() {
    if (innerWidth <= 1280 || !command.contains(composer)) { linesSvg.innerHTML = ""; return; }
    const box = command.getBoundingClientRect();
    const c = composer.getBoundingClientRect();
    if (!c.width) return;
    linesSvg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    const cyMid = c.top - box.top + c.height / 2;
    linesSvg.innerHTML = $$(".signal .app-mark").map((m) => {
      const r = m.getBoundingClientRect();
      const sx = r.left - box.left + r.width / 2;
      const sy = r.top - box.top + r.height / 2;
      const left = sx < box.width / 2;
      const ex = left ? c.left - box.left - 4 : c.right - box.left + 4;
      const k = (ex - sx) * 0.55;
      return `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx + k).toFixed(1)},${sy.toFixed(1)} ${(ex - k).toFixed(1)},${cyMid.toFixed(1)} ${ex.toFixed(1)},${cyMid.toFixed(1)}"/><circle cx="${ex.toFixed(1)}" cy="${cyMid.toFixed(1)}" r="2.5"/>`;
    }).join("");
  }

  /* ---------------------------------------------------------------
     13. Bloo AI
     A deterministic front-end simulation: intent detection over the
     page's own data, a response, then an AI Lens over the page.
     --------------------------------------------------------------- */

  /* Knowledge — read from the page, so answers always match it */
  const APPS = Object.keys(sourceNames);
  const POLICIES = $$(".policy", policiesSec).map((el) => ({
    key: el.dataset.policy,
    el,
    title: $(".policy__title, .library__title", el).textContent,
    desc: $(".policy__body p, .policy--row p, .library__desc", el).textContent,
    cat: el.dataset.cat,
    leave: el.dataset.cat === "people"
  }));
  const POLICY_WORDS = {
    security: ["security", "data", "phishing", "suspicious", "password", "email", "cyber", "protect"],
    management: ["management", "change management", "approval process", "process"],
    brand: ["brand", "logo", "identity", "voice"],
    conduct: ["conduct", "behaviour", "behavior", "ethics", "concern", "harassment"],
    travel: ["travel", "expense", "expenses", "claim", "business trip", "reimburse"],
    "annual-leave": ["annual", "vacation", "holiday", "holidays", "days off"],
    "sick-leave": ["sick", "unwell", "ill", "medical certificate"],
    wfh: ["work from home", "wfh", "remote", "working from home", "hybrid"]
  };
  const SPORTS = sports.map((el) => ({ key: el.dataset.sport, el, name: $(".sport__name", el).textContent, members: Number(el.dataset.members) }));
  const PERKS = $$(".perk", perkTrack).map((el) => ({ key: el.dataset.perk, el, title: $(".perk__title", el).textContent, desc: $(".perk__body p", el).textContent, img: [...$(".perk__media", el).classList].find((c) => c.startsWith("img-")) }));
  const PARTNERS = $$(".partner").map((el) => ({
    key: el.dataset.partner, el, topics: el.dataset.topics.split(" "),
    name: $(".partner__name", el).textContent, cat: $(".partner__cat", el).textContent,
    // Some partners give a percentage, the rest a special offer: offer is 0 for those
    offer: Number($(".offer strong", el).textContent.match(/^(\d+)%$/)?.[1] || 0),
    img: [...$(".partner__logo", el).classList].find((c) => c.startsWith("img-"))
  }));
  PARTNERS.forEach((x) => { x.deal = x.offer ? `${x.offer}% off` : "Special offer"; });
  const FAQS = $$(".faqs__item", faqSec).map((el) => ({
    el, q: $(".faqs__q span", el).textContent, a: $(".faqs__a p", el).textContent,
    tab: $(`#${el.closest(".faqs__panel").getAttribute("aria-labelledby")}`)
  }));
  const NEWS = {
    birthdays: $('.tl[data-news="birthdays"]'),
    joiner: $('.tl[data-news="joiner"]'),
    policy: $('.tl[data-news="policy"]'),
    newsletter: $('.tl[data-news="newsletter"]'),
    anniversary: $("#ann-anniv"),
    drill: $("#ann-drill"),
    eid: $("#ann-eid")
  };

  /* Language helpers */
  const STOP = new Set("a an the i me my to for of in on at is are am be do does did can could would should will what whats what's which who whom how where when show find tell give get take please about any some there this that these those it its with and or from our your you we us need needs want".split(" "));
  const normalize = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9%'&\s-]/g, " ").replace(/\s+/g, " ").trim();
  const has = (q, phrase) => new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(q);
  const tokens = (s) => normalize(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t));

  const INTENTS = [
    { id: "attention", label: "Your attention",
      strong: ["attention", "to do", "todo", "task", "tasks", "approve", "approval", "approvals", "pending", "overdue", "urgent", "priority", "priorities", "need to complete", "waiting on me", "needs me", "need me"],
      weak: ["today", "due", "need", "needs", "action", "actions", "complete", "first", "waiting", "work"] },
    { id: "policies", label: "Policies",
      strong: ["policy", "policies", "leave", "holiday", "vacation", "sick", "work from home", "wfh", "remote work", "guideline", "guidelines", "conduct", "handbook", "expense", "expenses", "rules"],
      weak: ["security", "brand", "travel", "management", "allowed", "can i", "document", "documents", "annual", "remote"] },
    { id: "news", label: "Announcements",
      strong: ["what's new", "whats new", "what is new", "news", "announcement", "announcements", "update", "updates", "updated", "changed", "birthday", "birthdays", "happening", "latest", "anniversary", "anniversaries", "fire drill", "drill", "eid", "newsletter"],
      weak: ["new", "this week", "week", "celebrate", "celebrating", "wish"] },
    { id: "people", label: "New joiners",
      strong: ["colleague", "colleagues", "who joined", "joined", "joiner", "joiners", "new hire", "new hires", "new people", "meet", "say hello", "someone"],
      weak: ["who", "team", "person", "people", "hello", "welcome", "find"] },
    { id: "communities", label: "Communities",
      strong: ["community", "communities", "sport", "sports", "club", "clubs", "group", "groups", "fitness", "hobby", ...SPORTS.map((s) => s.key)],
      weak: ["play", "enjoy", "join", "exercise", "weekend", "fun"] },
    { id: "perks", label: "Perks",
      strong: ["benefit", "benefits", "perk", "perks", "insurance", "medical", "air ticket", "air tickets", "ticket", "tickets", "flight", "flights", "mimojo", "mazaya", "cashback", "covered"],
      weak: ["health", "family", "clinic"] },
    { id: "discounts", label: "Discounts",
      strong: ["discount", "discounts", "offer", "offers", "deal", "deals", "code", "codes", "coupon", "voucher", "hotel", "hotels", "restaurant", "restaurants", "retail", "partner", "partners", "savings", "save money"],
      weak: ["food", "shopping", "dining", "travel", "stay", "spa", "fuel", "groceries", "employee"] },
    { id: "requests", label: "Inbox",
      strong: ["draft", "drafts", "my requests", "new request", "raise a request", "create a request", "start a request", "request history", "tcdf", "internal memo", "memo", "rfp"],
      weak: ["request", "requests", "submit", "submitted", "history", "withdraw", "returned"] },
    { id: "help", label: "FAQ",
      strong: ["help", "support", "faq", "faqs", "contact", "stuck", "problem", "issue"],
      weak: ["how do i", "how can i", "where can i", "how to", "question"] },
    { id: "profile", label: "My profile", strong: ["my profile", "profile", "my details", "about me", "my manager", "my account", "who am i"], weak: [] },
    { id: "inbox", label: "Inbox", strong: ["inbox", "open my inbox"], weak: [] }
  ];
  const INTENT_LABEL = Object.fromEntries(INTENTS.map((i) => [i.id, i.label]));
  Object.assign(INTENT_LABEL, { theme: "Appearance", search: "Search", task: "Your attention", drawer: "Open" });

  function findPerson(q) {
    for (let i = 0; i < people.length; i++) {
      const parts = normalize(people[i].name).split(" ");
      if (has(q, normalize(people[i].name)) || has(q, parts[0])) return { kind: "joiner", index: i };
    }
    for (let i = 0; i < birthdays.length; i++) {
      const parts = normalize(birthdays[i].name).split(" ");
      if (has(q, normalize(birthdays[i].name)) || has(q, parts[0])) return { kind: "birthday", index: i };
    }
    return null;
  }
  function bestFaq(q) {
    const qt = new Set(tokens(q));
    if (!qt.size) return null;
    let best = null;
    FAQS.forEach((f) => {
      const ft = tokens(f.q);
      const hit = ft.filter((t) => qt.has(t)).length;
      const score = hit / Math.max(ft.length, 2);
      if (!best || score > best.score) best = { faq: f, score };
    });
    return best && best.score >= 0.6 ? best.faq : null;
  }

  /* Plan — what the question is about */
  function plan(raw) {
    const q = normalize(raw);
    if (/\b(dark|light|night)\s*(mode|theme)\b/.test(q) || /\b(switch|change|turn)\b.*\b(dark|light)\b/.test(q)) {
      return { intent: "theme", mode: /\blight\b/.test(q) ? "light" : "dark" };
    }
    const scores = {};
    INTENTS.forEach((it) => {
      scores[it.id] = it.strong.reduce((s, w) => s + (has(q, w) ? 3 : 0), 0) + it.weak.reduce((s, w) => s + (has(q, w) ? 1 : 0), 0);
    });
    const app = APPS.find((a) => has(q, a));
    const person = findPerson(q);
    const sport = SPORTS.find((s) => has(q, s.key));
    const partner = PARTNERS.find((p) => has(q, normalize(p.name)) || has(q, p.key));
    const perk = PERKS.find((p) => has(q, p.key));
    const faq = bestFaq(q);
    // Which announcement tile, if any (Eid leave beats the leave policies)
    const annc = /\b(fire drill|drill|evacuation|fire safety|fire alarm)\b/.test(q) ? "drill"
      : /\beid\b|\badha\b/.test(q) ? "eid"
      : /\banniversar/.test(q) || has(q, "khalid") ? "anniversary"
      : /\bnewsletter\b/.test(q) ? "newsletter" : null;
    if (annc) scores.news += 6;
    if (app) scores.attention += 4;
    if (person) scores[person.kind === "birthday" ? "news" : "people"] += 5;
    if (partner) scores.discounts += 4;
    if (faq) scores.help += 6;
    const best = INTENTS.reduce((a, b) => (scores[b.id] > scores[a.id] ? b : a));
    if (!scores[best.id]) return { intent: "search", q };
    return { intent: best.id, q, app, person, sport, partner, perk, faq, annc };
  }

  /* Result builders */
  const result = (label, meta, lead, act, metaClass = "") => ({ label, meta, lead, act, metaClass });
  const taskResult = (row) => result(taskTitle(row), taskDue(row), { mark: sourceMarks[row.dataset.source] }, () => openDrawer("task", row), isOverdue(row) ? "alert" : isToday(row) ? "today" : "");
  const policyResult = (p) => result(p.title, p.leave ? "Time off" : p.cat[0].toUpperCase() + p.cat.slice(1), { icon: p.leave ? "i-calendar" : "i-book" }, () => spotlight(p.el));
  const personResult = (i) => result(people[i].name, `${people[i].role} · ${people[i].week}`, { avatar: people[i].img }, () => { showPerson(i); spotlight(portrait); });
  const bdayResult = (i) => result(`${birthdays[i].name}’s birthday`, birthdays[i].role, { avatar: birthdays[i].img }, () => { goBday(i); spotlight(celebrate, () => openWish(i)); });
  const sportResult = (s) => result(s.name, `${s.members} members`, { icon: "i-ball" }, () => { openSport(s.el); spotlight(s.el); });
  const showPerk = (p) => perkTrack.scrollTo({ left: perkTrack.scrollLeft + p.el.getBoundingClientRect().left - perkTrack.getBoundingClientRect().left - 4, behavior: behavior() });
  const perkResult = (p) => result(p.title, "Workplace perk", { img: p.img }, () => { showPerk(p); spotlight(p.el); });
  const partnerResult = (p) => result(p.name, `${p.deal} · ${p.cat}`, { logo: p.img }, () => spotlight(p.el));
  const faqResult = (f) => result(f.q, "FAQ", { icon: "i-help" }, () => openFaq(f));
  const actionResult = (label, meta, iconId, act) => result(label, meta, { icon: iconId }, act);

  function openFaq(f) {
    selectFaq(f.tab);
    f.el.open = true;
    spotlight(f.el);
  }

  /* Respond — build Bloo's answer and its lens */
  function respond(p, text) {
    switch (p.intent) {
      case "attention": return respondAttention(p);
      case "task": return respondTask(p.row);
      case "policies": return respondPolicies(p);
      case "news": return respondNews(p);
      case "people": return respondPeople(p);
      case "communities": return respondCommunities(p);
      case "perks": return respondPerks(p);
      case "discounts": return respondDiscounts(p);
      case "help": return respondHelp(p);
      case "requests": return respondRequests(p);
      case "profile": return {
        kicker: "My profile", think: ["Opening your profile"], source: "Read your Darwinbox record",
        title: "Here’s <em>your profile</em>",
        text: "Rashid Khan, Sr. Engineer in Digital Platforms. You report to Mathew Raymond and joined on 4 March 2021.",
        results: [actionResult("Open my profile", "Role, team and contact details", "i-user", () => openDrawer("profile"))],
        go: { label: "Opening your profile", run: () => openDrawer("profile") }
      };
      case "inbox": return {
        kicker: "Inbox", think: ["Collecting tasks from 4 apps"], source: "Checked 4 connected apps",
        title: `<em>${totalCount()}</em> tasks in your inbox`,
        text: "Your tasks from every connected app, in one place — approve and reject without switching systems.",
        results: [actionResult("Open inbox", "Full-page view", "i-inbox", () => openDrawer("inbox"))],
        go: { label: "Opening your inbox", run: () => openDrawer("inbox") }
      };
      case "drawer": return {
        kicker: "Help & support", think: ["Opening help"], source: "Found it",
        title: p.drawer === "help" ? "Opening <em>Help &amp; support</em>" : p.drawer === "profile" ? "Opening <em>your profile</em>" : "Opening <em>your inbox</em>",
        text: p.drawer === "help" ? "Every FAQ in one place, plus a way to reach the support team." : p.drawer === "profile" ? "Your role, team and contact details." : "Your tasks from every connected app, in one place.",
        results: [], go: { label: "Opening", run: () => openDrawer(p.drawer) }
      };
      case "theme": {
        applyTheme(p.mode);
        store.set(THEME_KEY, p.mode);
        return {
          kicker: "Appearance", think: ["Adjusting the lights"], source: "Done",
          title: `<em>${p.mode === "dark" ? "Dark" : "Light"} theme</em> is on`,
          text: "Switch back any time from Appearance at the bottom of the navigation, or just ask me.",
          results: []
        };
      }
      default: return respondSearch(text);
    }
  }

  function respondAttention(p) {
    const open = taskRows().filter(isOpen);
    if (p.app) {
      const name = sourceNames[p.app];
      const list = open.filter((r) => r.dataset.source === p.app);
      return {
        kicker: `Your attention · ${name}`, think: [`Opening ${name}`, "Sorting by due date"], source: `Read ${name}`,
        title: `<em>${counts[p.app]}</em> ${name} ${counts[p.app] === 1 ? "task is" : "tasks are"} waiting`,
        text: `${plural(list.length, "is", "are")} in your list right now, most urgent first. Approving here syncs back to ${name}.`,
        results: list.map(taskResult), target: attention, nav: "Your attention",
        before: () => filterAttention(p.app),
        lens: { sections: [attention], matches: list, tag: name, cleanup: () => filterAttention("all"),
          note: { key: "attention", text: `Showing <strong>${name}</strong> only — ${plural(list.length, "task", "tasks")} in your list`, chips: [] } }
      };
    }
    const q = p.q || "";
    const all = /\b(all|my)\s+tasks\b|\bshow (me )?(my )?tasks\b|\blist\b/.test(q) && !/(attention|urgent|today|overdue|need)/.test(q);
    if (all) {
      const wasAll = taskList.classList.contains("show-all");
      const later = open.filter((r) => !isOverdue(r) && !isToday(r));
      return {
        kicker: "Your tasks", think: ["Reading Salesforce, UiPath, SAP and Darwinbox", "Grouping by due date"], source: "Checked 4 connected apps",
        title: `<em>${totalCount()}</em> tasks across your apps`,
        text: `${open.length} are in your list: <strong>${open.filter(isOverdue).length} overdue</strong>, ${open.filter(isToday).length} due today and ${later.length} later this week. The rest are in your inbox.`,
        results: open.map(taskResult), target: attention, nav: "Your attention",
        before: () => { setShowAll(true); filterAttention("all"); },
        lens: { sections: [attention], matches: open, tag: "Task",
          cleanup: () => { setShowAll(wasAll); filterAttention("all"); },
          note: { key: "attention", text: `All <strong>${open.length} tasks</strong> in your list, most urgent first`, chips: [{ label: "Open inbox", act: () => openDrawer("inbox") }] } }
      };
    }
    const overdue = open.filter(isOverdue);
    const today = open.filter(isToday);
    const urgent = [...overdue, ...today];
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!urgent.length) {
      return {
        kicker: "Your attention", think: ["Reading your 4 apps"], source: "Checked 4 connected apps",
        title: "You’re <em>all caught up</em> for today",
        text: "Nothing is overdue or due today. The rest of this week’s work is waiting in your inbox.",
        results: [actionResult("Open inbox", `${totalCount()} tasks`, "i-inbox", () => openDrawer("inbox"))],
        target: attention, nav: "Your attention",
        lens: { sections: [attention], matches: [], note: { key: "attention", text: "Nothing urgent — you’re clear for today", chips: [] } }
      };
    }
    const bits = [];
    if (overdue.length) bits.push(`<strong>${overdue.length} overdue</strong>`);
    if (today.length) bits.push(`${today.length} due today`);
    return {
      kicker: "Your attention", think: ["Reading Salesforce, UiPath, SAP and Darwinbox", "Sorting by what’s due first"], source: "Checked 4 connected apps",
      title: `<em>${urgent.length}</em> ${urgent.length === 1 ? "thing needs" : "things need"} your attention`,
      text: `${bits.join(" and ")}. ${sourceNames[top]} needs you most — start with “${escapeHtml(taskTitle(urgent[0]))}”.`,
      results: urgent.map(taskResult), target: attention, nav: "Your attention",
      lens: { sections: [attention], matches: urgent, tag: "Needs you",
        note: { key: "attention", text: `<strong>${urgent.length} things</strong> need you today — the rest can wait`, chips: [
          { label: "Review the first", act: () => openDrawer("task", urgent[0]) },
          { label: "Open inbox", act: () => openDrawer("inbox") }] } }
    };
  }

  function respondTask(row) {
    const src = row.dataset.source;
    return {
      kicker: `Task · ${sourceNames[src]}`, think: [`Opening ${sourceNames[src]}`], source: `Read ${sourceNames[src]}`,
      title: escapeHtml(taskTitle(row)),
      text: `${escapeHtml($(".task__meta span", row).textContent)} · <strong>${escapeHtml(taskDue(row))}</strong>. Approving syncs straight back to ${sourceNames[src]}.`,
      results: [
        actionResult("Review task", "Details and actions", "i-arrow", () => openDrawer("task", row)),
        actionResult("Approve now", sourceNames[src], "i-check", () => quickResolve(row, "approve"))],
      target: attention, nav: "Your attention",
      before: () => { if (row.classList.contains("is-extra")) setShowAll(true); filterAttention("all"); },
      lens: { sections: [attention], matches: [row], tag: sourceNames[src], note: { key: "attention", text: "The task you asked about", chips: [] } }
    };
  }

  function respondPolicies(p) {
    const q = p.q || "";
    let keys = p.keys || POLICIES.filter((pol) => (POLICY_WORDS[pol.key] || []).some((w) => has(q, w))).map((pol) => pol.key);
    // "leave" on its own means every time-off policy; "sick leave" means just that one
    const leaveKeys = POLICIES.filter((x) => x.leave).map((x) => x.key);
    if (!p.keys && /\b(leave|leaves|time off|days off)\b/.test(q) && !keys.some((k) => leaveKeys.includes(k))) keys = [...new Set([...leaveKeys, ...keys])];
    const list = keys.length ? POLICIES.filter((x) => keys.includes(x.key)) : POLICIES;
    const isLeave = list.length && list.every((x) => x.leave);
    const changed = /\b(changed|change|updated|update|new)\b/.test(q) && keys.length === 1 && keys[0] === "security";
    const base = { kicker: "Policies", think: ["Searching 24 policies", keys.length ? `Matching “${q.replace(/^(show me |find |find me |show )/, "")}”` : "Ranking by what’s read most"], source: "Searched 24 policies", target: policiesSec, nav: "Policies" };
    if (!keys.length) {
      return { ...base,
        title: `<em>${POLICIES.length}</em> policies to explore`,
        text: "Data Security is the most read this month. Tell me a topic — leave, travel or security — and I’ll narrow it down.",
        results: POLICIES.map(policyResult),
        lens: { sections: [policiesSec], matches: [], note: { key: "policies", text: "Ask about a topic and I’ll narrow the library", chips: [
          { label: "Leave", act: () => ask("Show me policies about leave") },
          { label: "Travel", act: () => ask("Show me the travel policy") },
          { label: "Security", act: () => ask("Show me the Data Security policy") }] } }
      };
    }
    const one = list.length === 1 ? list[0] : null;
    const title = changed ? "What changed in <em>Data Security</em>"
      : one ? `Here’s the <em>${escapeHtml(one.title)}</em> policy`
      : `<em>${list.length}</em> relevant policies`;
    const text = changed ? "It now includes an updated guide for reporting suspicious messages, alongside how to protect your email, files and customer data. Updated 12 Sep 2026."
      : one ? `${escapeHtml(one.desc)}`
      : isLeave ? "There isn’t one single leave policy — these three cover time off and working away from the office."
      : `I found ${list.length} policies that match. They’re highlighted in the library below.`;
    const catChip = isLeave ? $('#policy-chips [data-cat="people"]') : one ? $(`#policy-chips [data-cat="${one.cat}"]`) : null;
    return { ...base, title, text,
      results: list.map(policyResult), focus: one ? one.el : null,
      lens: { sections: [policiesSec], matches: list.map((x) => x.el), tag: isLeave ? "Leave" : "Match", suggest: catChip,
        note: { key: "policies", text: isLeave ? `<strong>Leave policies</strong> — ${list.length} match your question` : `<strong>${plural(list.length, "policy", "policies")}</strong> match your question`,
          chips: list.map((x) => ({ label: x.title, act: () => spotlight(x.el) })) } }
    };
  }

  // birthdays + this week's joiners + policy change + anniversary, fire drill, Eid and newsletter
  const newsUpdates = () => birthdays.length + people.filter((x) => x.week === "Joined this week").length + 1 + 4;
  $("#news-count").textContent = `${newsUpdates()} updates`;

  function respondNews(p) {
    const q = p.q || "";
    const annSec = $("#announcements");
    const base = { kicker: "What’s new", source: "Read this week’s announcements", target: annSec, nav: "Announcements" };
    const one = (el, tag, note, chips = []) => ({ sections: [annSec], matches: [el], tag, note: { key: "announcements", text: note, chips } });
    if (p.annc === "drill") {
      return { ...base, think: ["Checking this week’s notices"],
        title: "Fire drill on <em>26 Sep</em>",
        text: "The workplace fire safety drill runs from 10:30 to 11:00 AM. Regular drills keep everyone safe and prepared.",
        results: [actionResult("Add the drill to your calendar", "26 Sep · 10:30 – 11:00 AM", "i-calendar", addDrill)],
        before: () => showAnn(2), focus: NEWS.drill, lens: one(NEWS.drill, "26 Sep", "<strong>Fire drill</strong> · 26 Sep, 10:30 – 11:00 AM", [{ label: "Add to calendar", act: addDrill }]) };
    }
    if (p.annc === "eid") {
      return { ...base, think: ["Checking holidays"],
        title: "<em>Eid al-Adha</em> leave: 25 – 29 May",
        text: "Eid leaves run from 25 May to 29 May. Eid Mubarak!",
        results: [actionResult("View rewards", "Perks and partner offers", "i-gift", () => goTo($("#discounts")))],
        before: () => showAnn(3), focus: NEWS.eid, lens: one(NEWS.eid, "Holiday", "<strong>Eid al-Adha</strong> · leave from 25 to 29 May", [{ label: "View rewards", act: () => goTo($("#discounts")) }]) };
    }
    if (p.annc === "anniversary") {
      return { ...base, think: ["Checking today’s celebrations"],
        title: `<em>${firstName(ANNIV.name)}</em>’s ${ANNIV.years}-year work anniversary`,
        text: `${ANNIV.name}, ${ANNIV.role}, marks ${ANNIV.years} years at Bloom today. A note of thanks goes a long way.`,
        results: [actionResult(`Congratulate ${firstName(ANNIV.name)}`, "Opens the card", "i-award", openCongrats)],
        before: () => showAnn(1), focus: NEWS.anniversary, lens: one(NEWS.anniversary, "Today", `<strong>${firstName(ANNIV.name)}</strong> · ${ANNIV.years} years at Bloom`, [{ label: `Congratulate ${firstName(ANNIV.name)}`, act: openCongrats }]) };
    }
    if (p.annc === "newsletter") {
      const read = () => toast("Opening the company newsletter…", "i-news");
      return { ...base, think: ["Checking this week’s notices"],
        title: "The company <em>newsletter</em> is out",
        text: "Your updates on news, achievements and stories that matter.",
        results: [actionResult("Read it now", "Company newsletter", "i-news", read)],
        focus: NEWS.newsletter, lens: one(NEWS.newsletter, "New", "<strong>Company newsletter</strong> · out this week", [{ label: "Read it now", act: read }]) };
    }
    if (p.person?.kind === "birthday") {
      const i = p.person.index;
      const b = birthdays[i];
      return { ...base, think: ["Checking today’s celebrations"],
        title: `It’s <em>${firstName(b.name)}</em>’s birthday today`,
        text: `${b.name}, ${b.role}. Send a wish before the day ends — it takes a few seconds.`,
        results: [actionResult(`Send ${firstName(b.name)} a birthday wish`, "Opens the wish card", "i-gift", () => openWish(i))],
        before: () => { showAnn(0); goBday(i); stopBday(); },
        lens: { sections: [$("#announcements")], matches: [celebrate, NEWS.birthdays], tag: "Today",
          note: { key: "announcements", text: `<strong>${firstName(b.name)}</strong> is celebrating today`, chips: [{ label: "Send a wish", act: () => openWish(i) }] } }
      };
    }
    if (/\bbirthday|birthdays|celebrat/.test(q)) {
      return { ...base, think: ["Checking today’s celebrations"],
        title: `<em>${birthdays.length}</em> birthdays today`,
        text: `${listJoin(birthdays.map((b) => b.name))} are celebrating. A short wish goes a long way.`,
        results: birthdays.map((_, i) => bdayResult(i)),
        lens: { sections: [$("#announcements")], matches: [celebrate, NEWS.birthdays], tag: "Today",
          note: { key: "announcements", text: `<strong>${birthdays.length} birthdays</strong> today`, chips: birthdays.map((b, i) => ({ label: `Wish ${firstName(b.name)}`, act: () => openWish(i) })) } }
      };
    }
    const joinedThisWeek = people.map((x, i) => ({ x, i })).filter(({ x }) => x.week === "Joined this week");
    const policy = POLICIES.find((x) => x.key === "security");
    const updates = newsUpdates();
    return { ...base, think: ["Scanning announcements", "Checking people and policy changes"],
      title: `<em>${updates}</em> updates this week`,
      text: `${plural(birthdays.length, "birthday", "birthdays")} and ${firstName(ANNIV.name)}’s ${ANNIV.years}-year anniversary today, a fire drill on 26 Sep, Eid leave from 25 to 29 May, ${plural(joinedThisWeek.length, "new joiner", "new joiners")}, the company newsletter and a Data Security policy update.`,
      results: [
        ...birthdays.map((_, i) => bdayResult(i)),
        actionResult(`${firstName(ANNIV.name)}’s ${ANNIV.years}-year anniversary`, "Work anniversary", "i-award", () => spotlight(NEWS.anniversary)),
        actionResult("Fire safety drill", "26 Sep · 10:30 – 11:00 AM", "i-flame", () => spotlight(NEWS.drill)),
        actionResult("Eid al-Adha leave", "25 May to 29 May", "i-moon", () => spotlight(NEWS.eid)),
        ...joinedThisWeek.map(({ i }) => result(`${people[i].name} joined ${people[i].team}`, "New joiner", { avatar: people[i].img }, () => { showPerson(i); spotlight(portrait); })),
        actionResult("The company newsletter is out", "Newsletter", "i-news", () => spotlight(NEWS.newsletter)),
        result("Data Security policy updated", "Reporting suspicious messages", { icon: "i-shield" }, () => spotlight(policy.el))],
      lens: { sections: [$("#announcements"), peopleSec, policiesSec],
        matches: [celebrate, NEWS.anniversary, NEWS.drill, NEWS.eid, NEWS.birthdays, NEWS.joiner, NEWS.policy, NEWS.newsletter, ...joinedThisWeek.map(({ i }) => reelItems[i]), policy.el], tag: "New",
        note: { key: "announcements", text: `<strong>${updates} things changed</strong> this week — they’re highlighted across the page`, chips: [
          { label: "Send wishes", act: () => { goBday(0); spotlight(celebrate); } },
          { label: `Congratulate ${firstName(ANNIV.name)}`, act: openCongrats },
          { label: `Say hello to ${firstName(people[joinedThisWeek[0]?.i ?? 0].name)}`, act: () => { showPerson(joinedThisWeek[0]?.i ?? 0); spotlight(portrait); } },
          { label: "What changed in Data Security", act: () => ask("What changed in the Data Security policy?") }] } }
    };
  }

  function respondPeople(p) {
    const q = p.q || "";
    const base = { kicker: "New joiners", source: "Looked through 5 new joiners", target: peopleSec, nav: "New joiners" };
    if (p.person?.kind === "joiner") {
      const i = p.person.index;
      const x = people[i];
      return { ...base, think: [`Finding ${firstName(x.name)}`],
        title: `Meet <em>${firstName(x.name)}</em>`,
        text: `${x.name} is our new ${x.role} in ${x.team}. Joined ${x.doj}, ${x.manager === ME ? "and reports to you." : `reporting to ${x.manager}.`}`,
        results: [actionResult(greeted.has(i) ? `You said hello to ${firstName(x.name)}` : `Say hello to ${firstName(x.name)}`, x.week, "i-wave", () => { showPerson(i); setTimeout(() => helloBtn.click(), reduceMotion ? 0 : 300); spotlight(portrait); })],
        before: () => showPerson(i),
        lens: { sections: [peopleSec], matches: [portrait, reelItems[i]], tag: x.week.replace("Joined ", ""),
          note: { key: "people", text: `<strong>${x.name}</strong> — ${x.role}, ${x.team}`, chips: [] } }
      };
    }
    if (/this week/.test(q) || /\bjoined\b/.test(q)) {
      const hits = people.map((x, i) => ({ x, i })).filter(({ x }) => x.week === "Joined this week");
      const first = hits[0];
      return { ...base, think: ["Checking start dates"],
        title: `<em>${hits.length}</em> ${hits.length === 1 ? "person" : "people"} joined this week`,
        text: first ? `${first.x.name} started on ${first.x.doj} as ${first.x.role}. ${people.length - hits.length} more joined earlier this month.` : "No one new this week — five people joined earlier this month.",
        results: people.map((_, i) => personResult(i)),
        before: () => { if (first) showPerson(first.i); },
        lens: { sections: [peopleSec], matches: [portrait, ...hits.map(({ i }) => reelItems[i])], tag: "This week",
          note: { key: "people", text: `<strong>${hits.length} joined this week</strong>, ${people.length} this month`, chips: people.map((x, i) => ({ label: firstName(x.name), act: () => { showPerson(i); spotlight(portrait); } })) } }
      };
    }
    const mine = people.filter((x) => x.manager === ME);
    return { ...base, think: ["Looking through this month’s joiners"],
      title: `<em>${people.length}</em> new colleagues to meet`,
      text: `Five people joined this month. ${mine.length ? `${listJoin(mine.map((x) => firstName(x.name)))} report to you — worth a hello.` : "Say hello and make their first weeks easier."}`,
      results: people.map((_, i) => personResult(i)),
      lens: { sections: [peopleSec], matches: reelItems, tag: "New",
        note: { key: "people", text: `<strong>${people.length} people</strong> joined this month`, chips: people.map((x, i) => ({ label: firstName(x.name), act: () => { showPerson(i); spotlight(portrait); } })) } }
    };
  }

  function respondCommunities(p) {
    const q = p.q || "";
    const sorted = [...SPORTS].sort((a, b) => b.members - a.members);
    const base = { kicker: "Sports & communities", source: `Browsed ${SPORTS.length} communities`, target: sportsSec, nav: "Communities" };
    if (p.sport) {
      const s = p.sport;
      return { ...base, think: [`Finding the ${s.name} group`],
        title: `<em>${s.name}</em> · ${s.members} members`,
        text: `${s.name} is one of six groups that meet every week. Join and the schedule lands in your inbox.`,
        results: [actionResult(`Join ${s.name}`, `${s.members} members`, "i-plus", () => { openSport(s.el); const b = $("[data-join]", s.el); if (b.getAttribute("aria-pressed") !== "true") b.click(); spotlight(s.el); })],
        before: () => openSport(s.el),
        lens: { sections: [sportsSec], matches: [s.el], tag: "Match", note: { key: "sports", text: `<strong>${s.name}</strong> meets every week`, chips: [] } }
      };
    }
    const enjoy = /\b(enjoy|might|recommend|suggest|like)\b/.test(q);
    const calm = SPORTS.find((s) => s.key === "yoga");
    return { ...base, think: ["Browsing six communities", enjoy ? "Matching groups to you" : "Ranking by members"],
      title: `<em>${SPORTS.length}</em> communities to explore`,
      text: enjoy
        ? `${sorted[0].name} is the most popular with ${sorted[0].members} members. If you’d like something calmer, ${calm.name} has ${calm.members}.`
        : `${sorted[0].name} is the biggest with ${sorted[0].members} members, then ${sorted[1].name} and ${sorted[2].name}.`,
      results: sorted.map(sportResult),
      before: () => openSport(sorted[0].el),
      lens: { sections: [sportsSec, interlude], matches: sorted.map((s) => s.el), tag: "Explore",
        note: { key: "sports", text: `<strong>${SPORTS.length} communities</strong> meet every week`, chips: sorted.map((s) => ({ label: s.name, act: () => { openSport(s.el); spotlight(s.el); } })) } }
    };
  }

  function respondPerks() {
    return { kicker: "Perks", think: ["Checking what comes with your role"], source: "Read your benefits",
      title: `<em>${PERKS.length}</em> benefits come with your role`,
      text: "You and your family are covered by medical insurance, and your annual ticket home is ready to book. Mimojo and Mazaya add cashback and member prices.",
      results: PERKS.map(perkResult), target: $("#discounts"), nav: "Discounts & perks",
      before: () => showPerk(PERKS[0]),
      lens: { sections: [$("#discounts")], matches: PERKS.map((x) => x.el), tag: "Yours",
        note: { key: "discounts", text: `<strong>${PERKS.length} perks</strong> included with your role`, chips: PERKS.map((x) => ({ label: x.title, act: () => perkResult(x).act() })) } }
    };
  }

  function respondDiscounts(p) {
    const q = p.q || "";
    const disc = $("#discounts");
    const base = { kicker: "Discounts & perks", source: `Compared ${PARTNERS.length} partner offers`, target: disc, nav: "Discounts & perks" };
    if (p.partner) {
      const x = p.partner;
      return { ...base, think: [`Finding ${x.name}`],
        title: `<em>${x.deal}</em> at ${escapeHtml(x.name)}`,
        text: `${x.cat}. Show your Bloom ID in store, or use the code online.`,
        results: [result("Reveal the code", x.name, { logo: x.img }, () => { const b = $(".partner__code", x.el); if (!b.classList.contains("is-revealed")) b.click(); spotlight(x.el); })],
        focus: x.el,
        lens: { sections: [disc], matches: [x.el], tag: x.deal, note: { key: "discounts", text: `<strong>${escapeHtml(x.name)}</strong> — ${x.deal.toLowerCase()}`, chips: [] } }
      };
    }
    const travel = /\b(travel|hotel|hotels|stay|stays|trip|trips|holiday|flight|flights|spa)\b/.test(q);
    const food = /\b(food|restaurant|restaurants|dining|eat|eating|grocer|groceries|cafe|cafes|coffee)\b/.test(q);
    if (travel || food) {
      const topic = travel ? "travel" : "food";
      const partners = PARTNERS.filter((x) => x.topics.includes(topic)).sort((a, b) => b.offer - a.offer);
      const perks = PERKS.filter((x) => (travel ? ["air", "mazaya"] : ["mimojo"]).includes(x.key));
      const n = partners.length + perks.length;
      return { ...base, think: ["Comparing partner offers", `Matching ${topic}`],
        title: `<em>${n}</em> ${travel ? "travel" : "food & dining"} offers`,
        text: travel
          ? `${partners.length} hotel partners${partners[0].offer ? ` at up to ${partners[0].offer}% off` : ""} — ${listJoin(partners.map((x) => x.name))} — plus your annual air ticket and Mazaya member prices.`
          : `${listJoin(partners.map((x) => `${x.name} (${x.deal.toLowerCase()})`))}, plus Mimojo cashback at cafés near you.`,
        results: [...partners.map(partnerResult), ...perks.map(perkResult)],
        before: () => { if (perks[0]) showPerk(perks[0]); },
        lens: { sections: [disc], matches: [...partners.map((x) => x.el), ...perks.map((x) => x.el)], tag: travel ? "Travel" : "Food",
          note: { key: "discounts", text: `<strong>${n} ${travel ? "travel" : "food"} offers</strong> — partners and perks together`, chips: [...partners, ...perks].map((x) => ({ label: x.name || x.title, act: () => spotlight(x.el) })) } }
      };
    }
    const sorted = [...PARTNERS].sort((a, b) => b.offer - a.offer);
    const best = sorted.filter((x) => x.offer && x.offer === sorted[0].offer);
    const specials = PARTNERS.filter((x) => !x.offer).length;
    return { ...base, think: ["Comparing partner offers"],
      title: `<em>${PARTNERS.length}</em> partner offers`,
      text: `${best.length ? `The best ${best.length > 1 ? "are" : "is"} ${best[0].offer}% off at ${listJoin(best.map((x) => x.name))}` : "Every partner has an offer for you"}${specials ? `, and ${specials} more ${specials > 1 ? "partners have special offers" : "partner has a special offer"}` : ""}. Show your Bloom ID in store, or use the code online.`,
      results: sorted.map(partnerResult),
      lens: { sections: [disc], matches: sorted.map((x) => x.el),
        note: { key: "discounts", text: `<strong>${PARTNERS.length} partner offers</strong>, best first`, chips: [{ label: "Travel", act: () => ask("Show me travel discounts") }, { label: "Food & dining", act: () => ask("Show me food discounts") }] } }
    };
  }

  function respondHelp(p) {
    const base = { kicker: "Help", source: `Matched against ${FAQS.length} answers`, target: faqSec, nav: "FAQ" };
    if (p.faq) {
      const f = p.faq;
      return { ...base, kicker: "From the FAQ", think: ["Looking through the FAQ"],
        title: escapeHtml(f.q), text: escapeHtml(f.a),
        results: [faqResult(f), actionResult("Contact support", "A person picks it up", "i-help", () => toast("A support request has been started.", "i-sparkle"))],
        focus: f.el, before: () => { selectFaq(f.tab); f.el.open = true; },
        lens: { sections: [faqSec], matches: [f.el], tag: "Answer", note: { key: "faq", text: "The answer is open below", chips: [] } }
      };
    }
    return { ...base, think: ["Looking for the right help"],
      title: "Here’s <em>how I can help</em>",
      text: `Ask me anything, or browse the ${FAQS.length} quick answers below. For anything else, contact support and a person will pick it up.`,
      results: [
        actionResult("Browse the FAQ", `${FAQS.length} answers`, "i-help", () => spotlight(faqSec.querySelector(".faqs"))),
        actionResult("Help & support", "FAQs and contacts", "i-book", () => openDrawer("help")),
        actionResult("Contact support", "A person picks it up", "i-users", () => toast("A support request has been started.", "i-sparkle"))],
      lens: { sections: [faqSec, $("#support")], matches: [], note: { key: "faq", text: "Every answer, grouped by topic", chips: FAQS.slice(0, 4).map((f) => ({ label: f.q, act: () => openFaq(f) })) } }
    };
  }

  function respondRequests(p) {
    const q = p.q || "";
    const tabOf = (r) => (r.status === "draft" ? "drafts" : TABS.mine.statuses.includes(r.status) ? "mine" : "history");
    const base = { kicker: "Inbox", source: `Checked your ${requests.length} requests`, think: ["Opening your requests"] };
    if (p.focus) {
      const r = findReq(p.focus);
      if (r) {
        const st = STATUS[r.status];
        const editable = r.status === "draft" || r.status === "returned";
        return { ...base, kicker: `${r.status === "draft" ? "Draft" : "Request"} · ${REQ_TYPES[r.type]}`,
          title: escapeHtml(r.title),
          text: r.status === "draft" ? `Saved ${fmtAgo(r.at).toLowerCase()}. Pick up where you left off, or delete it if it’s no longer needed.`
            : `${st.label}${r.approver ? ` · ${escapeHtml(r.approver)}` : ""}${r.ref ? ` · ${r.ref}` : ""}.${r.note ? ` ${escapeHtml(r.note)}` : ""}`,
          results: [editable ? actionResult(r.status === "draft" ? "Continue editing" : "Edit and resubmit", REQ_TYPES[r.type], "i-edit", () => { openInbox(tabOf(r)); openRequestForm(r); })
            : actionResult("Show it in your inbox", st.label, "i-eye", () => { ib.open = r.id; ib.flash = r.id; openInbox(tabOf(r)); })],
          go: { label: "Opening your inbox", run: () => { ib.flash = r.id; openInbox(tabOf(r)); } } };
      }
    }
    if (/\b(new|raise|create|start|make)\b/.test(q)) {
      return { ...base, think: ["Preparing a new request"],
        title: "Let’s start a <em>new request</em>",
        text: "Pick TCDF, Internal Memo or RFP and add a title. Save it as a draft, or submit it straight to your approver.",
        results: [actionResult("New request", "TCDF · Internal Memo · RFP", "i-plus", () => openRequestForm())],
        go: { label: "Opening a new request", run: () => openRequestForm() } };
    }
    const type = TYPE_ORDER.find((k) => has(q, k) || has(q, normalize(REQ_TYPES[k])));
    const list = (tab) => byTab(tab).filter((r) => !type || r.type === type).sort((a, b) => b.at - a.at);
    const reqResult = (r) => result(r.title, `${typeLabel(r)} · ${r.status === "draft" ? fmtAgo(r.at) : STATUS[r.status].label}`, { icon: "i-doc" },
      () => { if (r.status === "draft" || r.status === "returned") { openInbox(tabOf(r)); openRequestForm(r); } else { ib.open = r.id; ib.flash = r.id; openInbox(tabOf(r)); } });
    const open = (tab) => ({ label: `Opening ${TABS[tab].label}`, run: () => { ib.type = type || "all"; openInbox(tab); } });
    const tLabel = type ? `${REQ_TYPES[type]} ` : "";
    if (/\bdrafts?\b/.test(q) || (type && !/\b(my requests|history|approved|submitted)\b/.test(q) && list("drafts").length)) {
      const d = list("drafts");
      const stale = d.filter((r) => Date.now() - r.at > 7 * DAY * MIN).length;
      return { ...base, kicker: "Inbox · Drafts",
        title: `<em>${d.length}</em> ${tLabel}${d.length === 1 ? "draft" : "drafts"} waiting`,
        text: d.length ? `The newest is “${escapeHtml(d[0].title)}”, saved ${fmtAgo(d[0].at).toLowerCase()}.${stale ? ` ${plural(stale, "hasn’t", "haven’t")} been touched in over a week.` : ""}` : "No drafts right now.",
        results: d.map(reqResult), go: open("drafts") };
    }
    if (/\b(history|approved|rejected|completed|past|decided)\b/.test(q)) {
      const h = list("history");
      return { ...base, kicker: "Inbox · History",
        title: `<em>${h.length}</em> ${tLabel}${h.length === 1 ? "item" : "items"} in your history`,
        text: `${h.filter((r) => r.status === "approved").length} approved and ${h.filter((r) => r.status === "rejected").length} rejected, newest first.`,
        results: h.map(reqResult), go: open("history") };
    }
    const m = list("mine");
    const returned = m.find((r) => r.status === "returned");
    return { ...base, kicker: "Inbox · My requests",
      title: `<em>${m.length}</em> ${tLabel}${m.length === 1 ? "request" : "requests"} in progress`,
      text: returned ? `“${escapeHtml(returned.title)}” was returned by ${returned.approver}: ${escapeHtml(returned.note)} The rest are with approvers.` : "All of them are with approvers. I’ll let you know when anything changes.",
      results: m.map(reqResult), go: open("mine") };
  }

  function respondSearch(text) {
    const hits = searchIndex(text).filter((it) => it.plan || it.drawer);
    if (!hits.length) {
      return { kicker: "Bloo", think: ["Searching everything"], source: "Searched BlooMultiverse",
        title: "I couldn’t find that <em>yet</em>",
        text: "Try asking about your tasks, a policy, a colleague, perks or communities.",
        results: ["What needs my attention?", "Show me policies about leave", "What's new?", "Find communities"].map((s) => actionResult(s, "Ask", "i-sparkle", () => ask(s)))
      };
    }
    return { kicker: "Search", think: ["Searching everything"], source: "Searched BlooMultiverse",
      title: `I found <em>${hits.length}</em> ${hits.length === 1 ? "match" : "matches"}`,
      text: `Here’s what matches “${escapeHtml(text)}” across BlooMultiverse.`,
      results: hits.slice(0, 8).map((it) => result(it.label, it.meta, it.lead, () => chooseItem(it)))
    };
  }

  /* Search index — also powers the suggestions */
  const INDEX = [
    ...APPS.map((a) => ({ group: "Apps", label: sourceNames[a], meta: () => `${counts[a]} waiting`, lead: { mark: sourceMarks[a] }, plan: { intent: "attention", app: a } })),
    ...taskRows().map((row) => ({ group: "Tasks", label: taskTitle(row), meta: `${sourceNames[row.dataset.source]} · ${$(".task__meta span", row).textContent}`, lead: { mark: sourceMarks[row.dataset.source] }, plan: { intent: "task", row } })),
    ...POLICIES.map((x) => ({ group: "Policies", label: x.title, meta: x.leave ? "Time off" : x.cat[0].toUpperCase() + x.cat.slice(1), lead: { icon: "i-book" }, plan: { intent: "policies", keys: [x.key] } })),
    ...people.map((x, i) => ({ group: "People", label: x.name, meta: x.role, lead: { avatar: x.img }, plan: { intent: "people", person: { kind: "joiner", index: i } } })),
    ...birthdays.map((x, i) => ({ group: "People", label: x.name, meta: "Birthday today", lead: { avatar: x.img }, plan: { intent: "news", person: { kind: "birthday", index: i } } })),
    { group: "People", label: ANNIV.name, meta: `${ANNIV.years}-year work anniversary`, lead: { avatar: ANNIV.img }, plan: { intent: "news", annc: "anniversary" } },
    { group: "Announcements", label: "Fire safety drill", meta: "26 Sep · 10:30 AM", lead: { icon: "i-flame" }, plan: { intent: "news", annc: "drill" } },
    { group: "Announcements", label: "Eid al-Adha leave", meta: "25 – 29 May", lead: { icon: "i-moon" }, plan: { intent: "news", annc: "eid" } },
    { group: "Announcements", label: "Company newsletter", meta: "Out this week", lead: { icon: "i-news" }, plan: { intent: "news", annc: "newsletter" } },
    ...SPORTS.map((s) => ({ group: "Communities", label: s.name, meta: `${s.members} members`, lead: { icon: "i-ball" }, plan: { intent: "communities", sport: s } })),
    ...PERKS.map((x) => ({ group: "Perks", label: x.title, meta: "Workplace perk", lead: { icon: "i-shield" }, plan: { intent: "perks" } })),
    ...PARTNERS.map((x) => ({ group: "Discounts", label: x.name, meta: x.deal, lead: { logo: x.img }, plan: { intent: "discounts", partner: x } })),
    ...FAQS.map((f) => ({ group: "Help", label: f.q, meta: "FAQ", lead: { icon: "i-help" }, plan: { intent: "help", faq: f } })),
    { group: "Help", label: "Help & support", meta: "FAQs and contacts", lead: { icon: "i-help" }, drawer: "help" },
    { group: "Help", label: "My profile", meta: "Role, team and contact details", lead: { icon: "i-user" }, drawer: "profile" },
    { group: "Help", label: "Inbox", meta: "Every task, one place", lead: { icon: "i-inbox" }, drawer: "inbox" }
  ];
  const metaOf = (it) => (typeof it.meta === "function" ? it.meta() : it.meta);
  const requestItems = () => requests.map((r) => ({ group: "Requests", label: r.title, meta: `${REQ_TYPES[r.type]} · ${STATUS[r.status].label}`, lead: { icon: "i-doc" }, plan: { intent: "requests", focus: r.id } }));
  function searchIndex(text) {
    const q = normalize(text);
    const qt = tokens(text);
    if (!q) return [];
    return [...INDEX, ...requestItems()].map((it) => {
      const hay = normalize(`${it.label} ${metaOf(it)} ${it.group}`);
      let score = hay.includes(q) ? 10 : 0;
      if (normalize(it.label).startsWith(q)) score += 5;
      qt.forEach((t) => { if (hay.includes(t)) score += 2; });
      return { it, score };
    }).filter((x) => x.score >= (qt.length > 1 ? 4 : 2)).sort((a, b) => b.score - a.score).map((x) => x.it);
  }
  function chooseItem(it) {
    if (it.drawer) { ask(it.label, { plan: { intent: "drawer", drawer: it.drawer } }); return; }
    ask(it.label, { plan: it.plan });
  }

  const PROMPTS = [
    "What needs my attention?", "Show me everything I need to complete today", "Show my tasks",
    "Show me policies about leave", "Find the work from home policy", "What changed in the Data Security policy?",
    "What's new this week?", "Who has a birthday today?", "Who joined the team this week?", "Find a colleague",
    "Find me a community I might enjoy", "Help me find a sports community", "Show my benefits",
    "Show me travel discounts", "Show me employee discounts", "Take me to my profile", "Open my inbox",
    "Show my drafts", "Show my requests", "Raise a new request", "Show my request history",
    "How do I update my personal information?", "Switch to dark mode"
  ];

  /* The conversation block, thread and lens UI */
  const convo = $("#convo");
  const convoHome = $("#convo-home");
  const input = $("#ask-input");
  const suggest = $("#ask-suggest");
  const thread = $("#thread");
  const lensBar = $("#lens-bar");
  const contextLens = $("#context-lens");
  const askLayer = $("#ask-layer");
  const askPanel = $(".ask-layer__panel", askLayer);
  thread.removeAttribute("aria-live");
  const live = document.createElement("p");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  body.appendChild(live);

  let acts = [];
  let lens = null;
  let askToken = 0;
  let goTimer = 0;
  let pendingGo = null;

  function leadHtml(l) {
    if (!l) return `<span class="result__lead">${icon("i-sparkle", "ico ico--sm")}</span>`;
    if (l.mark) return `<span class="app-mark app-mark--${l.mark}"></span>`;
    if (l.avatar) return `<span class="avatar ${l.avatar}"></span>`;
    if (l.img) return `<span class="result__lead result__lead--img ${l.img}"></span>`;
    if (l.logo) return `<span class="result__lead result__lead--logo ${l.logo}"></span>`;
    return `<span class="result__lead">${icon(l.icon || "i-sparkle", "ico ico--sm")}</span>`;
  }
  const actBtn = (fn) => { acts.push(fn); return acts.length - 1; };

  // Move attention to an element: scroll it into view, then pulse it
  function spotlight(el, then) {
    const tile = el?.closest?.("#ann-track > .ann"); if (tile) showAnn(annTiles.indexOf(tile));
    if (!el) return;
    closeAskLayer({ restoreFocus: false });
    const ch = el.closest("[data-chapter]");
    if (ch) lockSpy(ch);
    el.scrollIntoView({ behavior: behavior(), block: "center" });
    setTimeout(() => {
      el.classList.remove("is-pulse");
      void el.offsetWidth;
      el.classList.add("is-pulse");
      setTimeout(() => el.classList.remove("is-pulse"), 2900);
      then?.();
    }, reduceMotion ? 0 : 650);
  }

  function renderUser(text) {
    thread.innerHTML = `<div class="turn turn--user"><p>${escapeHtml(text)}</p></div>
      <div class="turn turn--bloo is-thinking"><p class="turn__who"><span class="bloo-orb" aria-hidden="true"></span><strong>Bloo</strong><span class="turn__source">is thinking</span></p><p class="turn__think"></p></div>`;
    return $(".turn--bloo", thread);
  }

  function renderAnswer(turn, res) {
    acts = [];
    turn.classList.remove("is-thinking");
    $(".turn__source", turn).textContent = `· ${res.source || "Done"}`;
    $(".turn__think", turn).remove();
    const shown = res.results.slice(0, 6);
    const more = res.results.length - shown.length;
    const go = res.target || res.go;
    const where = res.go ? res.go.label : `Taking you to ${res.nav}`;
    turn.insertAdjacentHTML("beforeend", `
      <div class="turn__answer">
        <p class="turn__kicker">${icon("i-sparkle", "ico ico--xs")}${escapeHtml(res.kicker)}</p>
        <p class="turn__title">${res.title}</p>
        <p class="turn__text">${res.text}</p>
        ${shown.length ? `<div class="results">${shown.map((r, i) => `
          <button class="result" type="button" data-act="${actBtn(r.act)}" style="--i:${i}">
            ${leadHtml(r.lead)}<span class="result__label">${escapeHtml(r.label)}</span>
            <span class="result__meta${r.metaClass ? ` result__meta--${r.metaClass}` : ""}">${escapeHtml(r.meta || "")}</span>${icon("i-arrow", "ico ico--sm")}
          </button>`).join("")}</div>` : ""}
        ${more > 0 ? `<p class="results__more">and ${more} more — highlighted on the page</p>` : ""}
        <div class="turn__foot">
          ${go ? `<span class="turn__go"><span class="turn__go-bar" aria-hidden="true"></span><span class="turn__go-label">${escapeHtml(where)}</span></span>
          <button class="text-btn" type="button" data-stay>Stay here</button>` : ""}
          ${res.lens ? `<button class="text-btn text-btn--accent" type="button" data-clear-lens>${icon("i-x", "ico ico--xs")}Clear lens</button>` : ""}
        </div>
      </div>`);
    live.textContent = `${$(".turn__title", turn).textContent}. ${$(".turn__text", turn).textContent}`;
  }

  function markTag(el, text, i) {
    const tag = document.createElement("span");
    tag.className = "match-tag";
    tag.style.setProperty("--mi", i);
    tag.innerHTML = `${icon("i-sparkle", "ico ico--xs")}${escapeHtml(text)}`;
    // List rows carry the tag inside the row, so it never sits over the row above or the text beside it
    const lead = $(".task__body, .partner__txt", el);
    if (lead) lead.prepend(tag);
    else if (el.matches(".policy--row")) $(".tag", el).after(tag);
    else if (el.matches(".policy--index")) el.prepend(tag);
    else if (el.matches(".celebrate")) $(".celebrate__count", el).after(tag);
    else if (el.matches(".ann")) $(".ann__kicker", el).after(tag);
    else ($(".policy__frame, .perk__frame", el) || (el.tagName === "DETAILS" ? $("summary", el) : el)).appendChild(tag);
  }

  function applyLens(res, query) {
    lens = res.lens;
    root.classList.add("lens-on");
    const sections = new Set(lens.sections);
    chapters.forEach((ch) => {
      ch.classList.toggle("is-lensed", sections.has(ch));
      ch.classList.toggle("is-quiet", !sections.has(ch) && ch !== command);
    });
    [...lens.matches].forEach((el, i) => {
      el.classList.add("is-match");
      el.style.setProperty("--mi", i);
      if (lens.tag) markTag(el, lens.tag, i);
    });
    lens.suggest?.classList.add("is-suggested");
    if (lens.note) {
      const slot = $(`[data-lens-note="${lens.note.key}"]`);
      if (slot) {
        slot.innerHTML = `<p class="lens-note__text"><span class="bloo-orb" aria-hidden="true"></span><span>${lens.note.text}</span></p>
          ${lens.note.chips.length ? `<div class="lens-note__chips">${lens.note.chips.map((c) => `<button class="lens-note__chip" type="button" data-act="${actBtn(c.act)}">${escapeHtml(c.label)}</button>`).join("")}</div>` : ""}
          <button class="text-btn lens-note__clear" type="button" data-clear-lens>${icon("i-x", "ico ico--xs")}Clear lens</button>`;
        slot.hidden = false;
      }
    }
    $("#lens-bar-query").textContent = query;
    lensBar.hidden = false;
    $("#context-lens-text").textContent = `Lens: ${res.nav || res.kicker}`;
    contextLens.hidden = false;
    // Navigation knows about the lens too
    lens.sections.forEach((s) => {
      $(`.rail__group[data-group="${s.dataset.group}"] > .rail__item`, nav)?.classList.add("has-lens");
      if (s.dataset.sub) $(`.rail__subitem[data-sub="${s.dataset.sub}"]`, nav)?.classList.add("has-lens");
      $$(`[data-chapter-link="${s.id}"]`).forEach((a) => a.classList.add("is-lensed"));
    });
    $$(".prompt").forEach((pr) => pr.classList.toggle("is-active", normalize(pr.dataset.ask) === normalize(query)));
    measure();
  }

  function clearLens({ silent = false } = {}) {
    if (!lens) return;
    lens.cleanup?.();
    lens = null;
    root.classList.remove("lens-on");
    chapters.forEach((ch) => ch.classList.remove("is-lensed", "is-quiet"));
    $$(".is-match").forEach((el) => { el.classList.remove("is-match"); el.style.removeProperty("--mi"); });
    $$(".match-tag").forEach((t) => t.remove());
    $$(".is-suggested").forEach((el) => el.classList.remove("is-suggested"));
    $$("[data-lens-note]").forEach((n) => { n.hidden = true; n.innerHTML = ""; });
    $$(".has-lens, .is-lensed").forEach((el) => el.classList.remove("has-lens", "is-lensed"));
    $$(".prompt.is-active").forEach((p) => p.classList.remove("is-active"));
    lensBar.hidden = true;
    contextLens.hidden = true;
    $$("[data-clear-lens]", thread).forEach((b) => b.remove());
    cancelGo(true);
    measure();
    if (!silent) { toast("AI Lens cleared — everything is back in view", "i-sparkle"); live.textContent = "AI Lens cleared."; }
  }

  function cancelGo(silent) {
    clearTimeout(goTimer);
    if (!pendingGo) return;
    const { turn, res } = pendingGo;
    pendingGo = null;
    const goEl = $(".turn__go", turn);
    const stay = $("[data-stay]", turn);
    if (!goEl) return;
    goEl.classList.add("is-done");
    if (silent) { goEl.remove(); stay?.remove(); return; }
    $(".turn__go-label", goEl).textContent = "Staying here";
    if (stay) {
      stay.removeAttribute("data-stay");
      stay.classList.add("text-btn--accent");
      stay.innerHTML = `${res.go ? "Open it" : `Take me to ${escapeHtml(res.nav)}`} ${icon("i-arrow", "ico ico--xs")}`;
      stay.dataset.act = actBtn(() => navigate(res));
    }
  }

  function navigate(res) {
    if (res.go) { res.go.run(); return; }
    closeAskLayer({ restoreFocus: false });
    goTo(res.target);
    if (res.focus) setTimeout(() => spotlight(res.focus), reduceMotion ? 0 : 900);
    // Let the rail show where Bloo took you (desktop, compact rail)
    if (isDesk() && canHover && !root.classList.contains("rail-pinned") && !rail.matches(":hover")) {
      setTimeout(() => setPeek(true), reduceMotion ? 0 : 450);
      setTimeout(() => { if (!rail.matches(":hover") && !rail.contains(document.activeElement)) setPeek(false); }, reduceMotion ? 1500 : 2200);
    }
  }

  function scheduleGo(turn, res) {
    const dur = reduceMotion ? 1200 : 1700;
    pendingGo = { turn, res };
    $(".turn__go", turn)?.style.setProperty("--go", `${dur}ms`);
    goTimer = setTimeout(() => {
      if (!pendingGo) return;
      pendingGo = null;
      const goEl = $(".turn__go", turn);
      if (goEl) { goEl.classList.add("is-done"); $(".turn__go-label", goEl).textContent = res.go ? "Opened" : `Showing ${res.nav}`; }
      $("[data-stay]", turn)?.remove();
      navigate(res);
    }, dur);
  }
  // Manual scrolling or keys during the countdown mean "stay here"
  ["wheel", "touchmove"].forEach((ev) => addEventListener(ev, () => { if (pendingGo) cancelGo(); }, { passive: true }));
  addEventListener("keydown", (e) => { if (pendingGo && ["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", " "].includes(e.key) && e.target === body) cancelGo(); });

  /* Ask — the whole interaction */
  async function ask(raw, opts = {}) {
    const text = String(raw || "").trim();
    if (!text) { input.focus(); return; }
    const token = ++askToken;
    closeSuggest();
    input.value = "";
    composer.classList.remove("has-value");
    cancelGo(true);
    clearLens({ silent: true });
    root.classList.add("is-asking");
    composer.classList.add("is-busy");
    command.classList.add("is-thinking");

    const p = opts.plan ? { q: normalize(text), ...opts.plan } : plan(text);
    const turn = renderUser(text);
    const res = respond(p, text);
    for (const step of res.think || ["Thinking"]) {
      $(".turn__think", turn).textContent = `${step}…`;
      await sleep(560);
      if (token !== askToken) return;
    }
    await sleep(140);
    if (token !== askToken) return;
    res.before?.();
    renderAnswer(turn, res);
    composer.classList.remove("is-busy");
    command.classList.remove("is-thinking");
    root.classList.remove("is-asking");
    if (res.lens) applyLens(res, text);
    if (res.target || res.go) scheduleGo(turn, res);
    requestAnimationFrame(drawLines);
  }

  // Result, lens-note and "take me there" buttons
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) { acts[Number(a.dataset.act)]?.(); return; }
    if (e.target.closest("[data-stay]")) { cancelGo(); return; }
    if (e.target.closest("[data-clear-lens]")) clearLens();
  });

  /* Composer — suggestions, keyboard, focus */
  let sugg = [];
  let sActive = -1;
  function renderSuggest() {
    const q = input.value.trim();
    composer.classList.toggle("has-value", !!q);
    sugg = [];
    let html = "";
    const option = (it, inner) => {
      const i = sugg.push(it) - 1;
      return `<button type="button" class="suggest__item${it.type === "ask" ? " suggest__item--ask" : ""}" role="option" id="sugg-${i}" data-i="${i}" aria-selected="false">${inner}</button>`;
    };
    if (!q) {
      html += `<p class="suggest__group">Try asking</p>`;
      ["What needs my attention?", "Show me policies about leave", "What's new?", "Find communities", "Show me travel discounts"].forEach((t) => {
        html += option({ type: "prompt", text: t }, `<span class="suggest__lead">${icon("i-sparkle", "ico ico--sm")}</span><span>${escapeHtml(t)}</span>`);
      });
      html += `<p class="suggest__group">Jump to an app</p>`;
      INDEX.filter((it) => it.group === "Apps").forEach((it) => {
        html += option({ type: "item", it }, `${leadHtml(it.lead)}<span>${escapeHtml(it.label)}</span><small>${escapeHtml(metaOf(it))}</small>`);
      });
      sActive = -1;
    } else {
      const guess = plan(q);
      html += option({ type: "ask", text: q }, `<span class="suggest__lead suggest__lead--ai"><span class="bloo-orb" aria-hidden="true"></span></span><span>Ask Bloo <strong>“${escapeHtml(q)}”</strong></span><small>${escapeHtml(guess.intent === "search" ? "Search everything" : `→ ${INTENT_LABEL[guess.intent]}`)}</small>`);
      const nq = normalize(q);
      const prompts = PROMPTS.filter((t) => normalize(t).includes(nq) && normalize(t) !== nq).slice(0, 3);
      if (prompts.length) {
        html += `<p class="suggest__group">Suggested</p>`;
        prompts.forEach((t) => { html += option({ type: "prompt", text: t }, `<span class="suggest__lead">${icon("i-sparkle", "ico ico--sm")}</span><span>${highlight(t, q)}</span>`); });
      }
      let group = "";
      searchIndex(q).slice(0, 7).forEach((it) => {
        if (it.group !== group) { group = it.group; html += `<p class="suggest__group">${escapeHtml(group)}</p>`; }
        html += option({ type: "item", it }, `${leadHtml(it.lead)}<span>${highlight(it.label, q)}</span><small>${escapeHtml(metaOf(it))}</small>`);
      });
      sActive = 0;
    }
    suggest.innerHTML = html;
    paintActive();
  }
  function highlight(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, i)) + "<mark>" + escapeHtml(text.slice(i, i + q.length)) + "</mark>" + escapeHtml(text.slice(i + q.length));
  }
  function paintActive() {
    $$(".suggest__item", suggest).forEach((b, i) => {
      const on = i === sActive;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
      if (on) b.scrollIntoView({ block: "nearest" });
    });
    if (sActive >= 0) input.setAttribute("aria-activedescendant", `sugg-${sActive}`);
    else input.removeAttribute("aria-activedescendant");
  }
  function openSuggest() {
    renderSuggest();
    composer.classList.add("is-open");
    input.setAttribute("aria-expanded", "true");
  }
  function closeSuggest() {
    composer.classList.remove("is-open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function pick(s) {
    if (!s) return;
    if (s.type === "item") chooseItem(s.it);
    else ask(s.text);
  }

  input.addEventListener("focus", () => {
    openSuggest();
    if (command.contains(composer)) command.classList.add("is-focused");
  });
  input.addEventListener("blur", () => setTimeout(() => {
    if (document.activeElement !== input) { closeSuggest(); command.classList.remove("is-focused"); }
  }, 140));
  input.addEventListener("input", () => { openSuggest(); });
  input.addEventListener("keydown", (e) => {
    const n = sugg.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!composer.classList.contains("is-open")) openSuggest();
      if (!n) return;
      sActive = (sActive + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      paintActive();
    } else if (e.key === "Escape") {
      if (composer.classList.contains("is-open")) { e.stopPropagation(); closeSuggest(); }
    } else if (e.key === "Tab") {
      closeSuggest();
    }
  });
  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (composer.classList.contains("is-open") && sActive >= 0 && sugg[sActive]) pick(sugg[sActive]);
    else ask(input.value);
  });
  suggest.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus while clicking
  suggest.addEventListener("click", (e) => {
    const b = e.target.closest(".suggest__item");
    if (b) pick(sugg[Number(b.dataset.i)]);
  });

  // Placeholder that types example questions while the prompt is idle
  const ghost = $("#composer-ghost");
  const GHOST = ["Ask Bloo anything…", "What needs my attention?", "Find the work from home policy", "Who joined the team this week?", "Show me travel discounts", "What's new this week?"];
  if (!reduceMotion) {
    composer.classList.add("ghost-on");
    (async () => {
      let k = 0;
      const idle = () => document.activeElement !== input && !input.value && !document.hidden;
      for (;;) {
        // Once Bloo has answered, the prompt invites a follow-up instead
        if (thread.childElementCount) {
          ghost.textContent = "Ask a follow-up…";
          while (thread.childElementCount) await new Promise((r) => setTimeout(r, 800));
        }
        const t = GHOST[k++ % GHOST.length];
        for (let i = 1; i <= t.length; i++) { ghost.textContent = t.slice(0, i); await new Promise((r) => setTimeout(r, k === 1 ? 0 : 42)); }
        await new Promise((r) => setTimeout(r, k === 1 ? 2200 : 1900));
        while (!idle()) await new Promise((r) => setTimeout(r, 600));
        for (let i = t.length; i >= 0; i--) { ghost.textContent = t.slice(0, i); await new Promise((r) => setTimeout(r, 18)); }
        await new Promise((r) => setTimeout(r, 320));
      }
    })();
  } else {
    ghost.remove();
  }

  // Type a prompt into the composer, then ask — the chip becomes the question
  async function typeAndAsk(text) {
    const token = ++askToken;
    if (!reduceMotion) {
      input.value = "";
      for (let i = 1; i <= text.length; i++) {
        input.value = text.slice(0, i);
        composer.classList.add("has-value");
        await new Promise((r) => setTimeout(r, 14));
        if (token !== askToken) return;
      }
      await new Promise((r) => setTimeout(r, 140));
      if (token !== askToken) return;
    }
    ask(text);
  }

  /* Ask layer — Ctrl K from anywhere lifts the conversation over the page */
  let askOpen = false;
  let askReturn = null;
  function openAskLayer({ focus = true } = {}) {
    if (askOpen) { if (focus) input.focus(); return; }
    askOpen = true;
    askReturn = document.activeElement;
    convoHome.style.minHeight = `${convo.offsetHeight}px`;
    $("#convo-float").appendChild(convo);
    askLayer.hidden = false;
    body.style.overflow = "hidden";
    root.classList.add("is-asking-layer");
    command.classList.remove("is-focused");
    closeMenus(); closeNav();
    if (!contextMenu.hidden) toggleContextMenu(false);
    if (focus) requestAnimationFrame(() => input.focus());
  }
  function closeAskLayer({ restoreFocus = true } = {}) {
    if (!askOpen) return;
    askOpen = false;
    closeSuggest();
    convoHome.appendChild(convo);
    convoHome.style.minHeight = "";
    askLayer.hidden = true;
    body.style.overflow = drawer.classList.contains("is-open") ? "hidden" : "";
    root.classList.remove("is-asking-layer");
    if (restoreFocus && askReturn?.isConnected) askReturn.focus({ preventScroll: true });
    requestAnimationFrame(drawLines);
  }
  function requestAsk() {
    const r = convoHome.getBoundingClientRect();
    const visible = r.top > 40 && r.top < innerHeight - 120;
    if (visible && !askOpen) { input.focus(); input.select(); }
    else openAskLayer();
  }
  $$("[data-close-ask]").forEach((el) => el.addEventListener("click", () => closeAskLayer()));

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-ask]")) { e.preventDefault(); requestAsk(); return; }
    const q = e.target.closest("[data-ask]");
    if (!q) return;
    e.preventDefault();
    // Inside the hero the chip types into the prompt; elsewhere the Ask layer opens
    if (command.contains(q) && command.contains(composer)) typeAndAsk(q.dataset.ask);
    else { openAskLayer({ focus: false }); typeAndAsk(q.dataset.ask); }
  });
  $$("[data-ask-form]").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    const field = $("input", form);
    const text = field.value.trim() || form.dataset.fallback;
    field.value = "";
    field.blur();
    openAskLayer({ focus: false });
    typeAndAsk(text);
  }));

  /* Keyboard — Ctrl/⌘ K, Escape, focus containment */
  const focusables = (el) => $$('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])', el).filter((x) => x.offsetParent !== null);
  function trap(e, container) {
    const f = focusables(container);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (modal.open) return;
      if (drawer.classList.contains("is-open")) closeDrawer();
      requestAsk();
      return;
    }
    if (document.querySelector("dialog[open]")) return; // native dialogs handle Tab and Esc
    if (e.key === "Tab") {
      if (askOpen) trap(e, askPanel);
      else if (drawer.classList.contains("is-open")) trap(e, $(".drawer__panel"));
      else if (body.classList.contains("nav-open")) trap(e, rail);
      return;
    }
    if (e.key !== "Escape") return;
    if (askOpen) { closeAskLayer(); return; }
    const openMenu = $$("#inbox-filter-menu, #inbox-app-menu").find((m) => !m.hidden);
    if (openMenu) { closeInboxMenus(); $(`[aria-controls="${openMenu.id}"]`).focus(); return; }
    if (drawer.classList.contains("is-open")) { returnToInbox = false; closeDrawer(); return; }
    if (!contextMenu.hidden) { toggleContextMenu(false); contextWhere.focus(); return; }
    if (document.activeElement === input) { input.blur(); return; }
    closeMenus(); closeNav(); setPeek(false);
  });

  refreshAttention();
  measure();
})();
