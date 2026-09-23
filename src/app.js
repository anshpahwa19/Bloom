/* ==================================================================
   BlooMultiverse — Direction B · app.js
   Vanilla JS for what CSS can't do alone: theme & palette, the
   section-aware floating navigation, search, drawers, carousels,
   filters and the scroll choreography — one requestAnimationFrame
   loop reading cached geometry, writing only transforms & opacity.
   ================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const root = document.documentElement;
  const body = document.body;
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = mqReduce.matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const icon = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const pad = (n) => String(n).padStart(2, "0");
  const smooth = () => (reduceMotion ? "auto" : "smooth");
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };
  // One scroll/animation frame at a time — frame() is defined with the scroll choreography below
  let ticking = false;
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------------------------------------------------------
     Theme (light / dark) and accent palette (azure / crimson)
     --------------------------------------------------------------- */
  const THEME_KEY = "bloo-theme";
  const PALETTE_KEY = "bloo-x-palette";
  const themeSwitches = $$("[data-theme-switch]");
  const paletteSwitches = $$("[data-palette-switch]");
  const themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    syncThemeControls();
  }
  function syncThemeControls() {
    const isDark = root.getAttribute("data-theme") === "dark";
    themeSwitches.forEach((s) => {
      s.setAttribute("aria-checked", String(isDark));
      if (s.dataset.themeSwitch === "icon") s.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    });
    if (themeMeta) themeMeta.content = isDark ? "#05081A" : "#F6F4EF";
  }
  function applyPalette(palette) {
    const crimson = palette === "crimson";
    if (crimson) root.setAttribute("data-palette", "crimson");
    else root.removeAttribute("data-palette");
    paletteSwitches.forEach((s) => s.setAttribute("aria-checked", String(crimson)));
  }

  // The new theme grows out of the control that was pressed (View Transitions API)
  function withReveal(update, origin) {
    if (!document.startViewTransition || reduceMotion) { update(); return; }
    const r = origin.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(update);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 820, easing: "cubic-bezier(.16,1,.3,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }

  applyTheme(root.getAttribute("data-theme") || "light");
  new MutationObserver(syncThemeControls).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  applyPalette(root.getAttribute("data-palette") === "crimson" ? "crimson" : "azure");
  themeSwitches.forEach((s) => s.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    withReveal(() => applyTheme(next), s);
    store.set(THEME_KEY, next);
  }));
  paletteSwitches.forEach((s) => s.addEventListener("click", () => {
    const next = root.getAttribute("data-palette") === "crimson" ? "azure" : "crimson";
    withReveal(() => applyPalette(next), s);
    store.set(PALETTE_KEY, next);
  }));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (store.get(THEME_KEY)) return; // an explicit choice wins over the OS setting
    applyTheme(e.matches ? "dark" : "light");
  });

  /* ---------------------------------------------------------------
     Toasts + tiny celebratory bursts
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
    }, 2800);
  }
  // Any element with data-toast shows a demo message (links to pages outside the prototype)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toast]");
    if (!t) return;
    if (t.tagName === "A") e.preventDefault();
    toast(t.dataset.toast, "i-sparkle");
  });

  const fxLayer = document.createElement("div");
  fxLayer.className = "confetti confetti--fixed";
  fxLayer.setAttribute("aria-hidden", "true");
  body.appendChild(fxLayer);
  const burstColors = ["#FFD66B", "#FF8FA0", "#5FE3FF", "#FFFFFF", "#8FA8FF", "#B9A8FF"];
  function burst(container, x, y, n = 18, spread = 200) {
    if (reduceMotion || !container) return;
    const bits = [];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.35 + Math.random() * 0.65);
      p.style.cssText = `--x:${x}px;--y:${y}px;--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d - 50).toFixed(1)}px;` +
        `--rot:${Math.round(Math.random() * 540 - 270)}deg;--c:${burstColors[i % burstColors.length]};` +
        `--w:${(4 + Math.random() * 5).toFixed(1)}px;--h:${(5 + Math.random() * 9).toFixed(1)}px;--dur:${(0.9 + Math.random() * 0.6).toFixed(2)}s`;
      bits.push(p);
    }
    container.append(...bits);
    setTimeout(() => bits.forEach((b) => b.remove()), 1700);
  }
  const burstFrom = (el, n, spread) => {
    const r = el.getBoundingClientRect();
    burst(fxLayer, r.left + r.width / 2, r.top + r.height / 2, n, spread);
  };

  /* ---------------------------------------------------------------
     Greeting + date
     --------------------------------------------------------------- */
  const now = new Date();
  const h = now.getHours();
  $("#greeting").textContent = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  $("#today-date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  /* ---------------------------------------------------------------
     Floating navigation — section awareness
     IntersectionObserver decides the active chapter (a thin band at
     42% of the viewport); the rAF loop below fills its progress line.
     --------------------------------------------------------------- */
  const navLinks = $$(".jump__item");
  const whereBtn = $("#where");
  const whereRoll = $("#where-roll");
  const whereNum = $("#where-num");
  const whereFill = $("#where-fill");
  const moLinks = $$(".mo__link");
  const groups = navLinks.map((link, i) => ({
    link, i, label: link.dataset.label, top: 0, bottom: 1,
    els: link.dataset.spy.split(" ").map((id) => document.getElementById(id)).filter(Boolean)
  }));
  const groupOf = new Map();
  groups.forEach((g) => g.els.forEach((el) => groupOf.set(el, g)));
  const groupFor = (el) => groups.find((g) => g.els.some((s) => s.contains(el)));
  let activeGroup = null;
  let spyLockUntil = 0;

  // The capsule shows one section name; a new one rolls in from the
  // direction you are scrolling while the old one rolls out.
  const sizeWhere = () => {
    const cur = $(".where__label:not(.is-leaving)", whereRoll);
    if (cur) whereRoll.style.width = `${cur.offsetWidth}px`;
  };
  function rollWhere(label, dir) {
    const old = $(".where__label:not(.is-leaving)", whereRoll);
    if (old && old.textContent === label) { sizeWhere(); return; }
    const next = document.createElement("span");
    next.className = "where__label";
    next.textContent = label;
    old?.classList.add("is-leaving");
    whereRoll.appendChild(next);
    sizeWhere();
    if (!old) return;
    if (reduceMotion || !next.animate) { old.remove(); return; }
    const d = dir < 0 ? -1 : 1;
    const opts = { duration: 620, easing: "cubic-bezier(.16,1,.3,1)" };
    next.animate([{ transform: `translateY(${d * 105}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], opts);
    whereNum.animate([{ opacity: 0, transform: `translateY(${d * 6}px)` }, { opacity: 1, transform: "none" }], opts);
    old.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${-d * 105}%)`, opacity: 0 }], { ...opts, fill: "forwards" })
      .onfinish = () => old.remove();
  }

  function setActiveGroup(g) {
    if (!g || g === activeGroup) return;
    const dir = activeGroup ? g.i - activeGroup.i : 0;
    activeGroup = g;
    navLinks.forEach((l) => {
      const on = l === g.link;
      l.classList.toggle("is-active", on);
      if (on) l.setAttribute("aria-current", "location"); else l.removeAttribute("aria-current");
    });
    moLinks.forEach((m) => m.classList.toggle("is-current", m.getAttribute("href") === g.link.getAttribute("href")));
    whereNum.textContent = pad(g.i + 1);
    rollWhere(g.label, dir);
    whereBtn.setAttribute("aria-label", `You are in ${g.label}. Jump to a section`);
    requestTick();
  }

  const spyVisible = new Set();
  function pickActive() {
    let best = null;
    spyVisible.forEach((el) => { const g = groupOf.get(el); if (!best || g.i > best.i) best = g; });
    if (best) setActiveGroup(best);
  }
  const spyIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) spyVisible.add(en.target); else spyVisible.delete(en.target); });
    if (performance.now() < spyLockUntil) return;
    pickActive();
  }, { rootMargin: "-42% 0px -57% 0px", threshold: 0 });
  groups.forEach((g) => g.els.forEach((el) => spyIO.observe(el)));
  setActiveGroup(groups[0]);
  addEventListener("scrollend", () => { if (spyLockUntil) { spyLockUntil = 0; pickActive(); } });

  // In-page links move the indicator straight to their destination
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-toast")) return;
    const target = document.getElementById(a.getAttribute("href").slice(1));
    if (!target) return;
    if (body.classList.contains("menu-open")) closeNav(false);
    const g = groupOf.get(target) || groupFor(target);
    if (g) { setActiveGroup(g); spyLockUntil = performance.now() + 1600; }
  });

  /* ---------------------------------------------------------------
     Menu overlay (☰) — full navigation, your space, appearance
     --------------------------------------------------------------- */
  const menuBtn = $("#menu-btn");
  const overlay = $("#menu-overlay");
  let navReturnFocus = null;

  function openNav() {
    const r = menuBtn.getBoundingClientRect();
    overlay.style.setProperty("--ox", `${r.left + r.width / 2}px`);
    overlay.style.setProperty("--oy", `${r.top + r.height / 2}px`);
    navReturnFocus = document.activeElement;
    body.classList.add("menu-open");
    overlay.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Close menu");
    body.style.overflow = "hidden";
    closeMenus();
    hideTip();
    setTimeout(() => ($(".mo__link.is-current", overlay) || $(".mo__link", overlay)).focus({ preventScroll: true }), 120);
  }
  function closeNav(restoreFocus = true) {
    if (!body.classList.contains("menu-open")) return;
    body.classList.remove("menu-open");
    overlay.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
    if (!drawer.classList.contains("is-open")) body.style.overflow = "";
    if (restoreFocus && navReturnFocus) navReturnFocus.focus({ preventScroll: true });
  }
  menuBtn.addEventListener("click", () => (body.classList.contains("menu-open") ? closeNav() : openNav()));
  // Keep keyboard focus inside the overlay (plus the close button) while it is open
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !body.classList.contains("menu-open") || drawer.classList.contains("is-open")) return;
    const items = [menuBtn, ...$$("a, button", overlay)];
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });

  /* ---------------------------------------------------------------
     Tooltips for the icon-only capsule controls
     --------------------------------------------------------------- */
  const tooltip = $("#tooltip");
  const searchOpenBtn = $("#search-open");
  searchOpenBtn.dataset.tip = isMac ? "Search  ⌘K" : "Search  Ctrl K";
  if (isMac) $$(".search__kbd").forEach((k) => { k.textContent = "⌘ K"; });
  function showTip(el) {
    if (!canHover || !el.dataset.tip || body.classList.contains("menu-open") || el.closest(".menu.is-open")) return;
    const r = el.getBoundingClientRect();
    tooltip.textContent = el.dataset.tip;
    tooltip.style.left = `${r.left + r.width / 2}px`;
    tooltip.style.top = `${r.bottom + 10}px`;
    tooltip.classList.add("is-visible");
  }
  function hideTip() { tooltip.classList.remove("is-visible"); }
  $$("[data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", () => showTip(el));
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", () => { if (el.matches(":focus-visible")) showTip(el); });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", hideTip);
  });

  /* ---------------------------------------------------------------
     Dropdown menus (notifications, profile)
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
    trigger.addEventListener("click", () => {
      const open = !menu.classList.contains("is-open");
      closeMenus(menu);
      hideTip();
      menu.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    });
  });
  // Items inside a panel keep bubbling, so their data-drawer / data-toast actions still run
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-menu]") || e.target.closest(".menu__item")) closeMenus();
  });

  $("#mark-read").addEventListener("click", () => {
    $$(".notif.is-unread").forEach((n) => n.classList.remove("is-unread"));
    $("#bell-badge").classList.add("is-cleared");
    $("#bell").setAttribute("aria-label", "Notifications, none unread");
    toast("All notifications marked as read");
  });

  /* ---------------------------------------------------------------
     Search — command palette
     --------------------------------------------------------------- */
  const searchIndex = [
    { group: "Apps", label: "Salesforce", meta: "15 pending", mark: "sf", filter: "salesforce" },
    { group: "Apps", label: "UiPath", meta: "10 pending", mark: "ui", filter: "uipath" },
    { group: "Apps", label: "Darwinbox", meta: "5 pending", mark: "db", filter: "darwinbox" },
    { group: "Apps", label: "SAP", meta: "2 pending", mark: "sap", filter: "sap" },
    { group: "Policies", label: "Data Security", meta: "Security", policy: "Data Security" },
    { group: "Policies", label: "Management Process", meta: "Operations", policy: "Management Process" },
    { group: "Policies", label: "Brand Guidelines", meta: "Brand", policy: "Brand Guidelines" },
    { group: "Policies", label: "Code of Conduct", meta: "Conduct", policy: "Code of Conduct" },
    { group: "Policies", label: "Travel & Expenses", meta: "Operations", policy: "Travel & Expenses" },
    { group: "People", label: "Abdulazeez Aladwan", meta: "Projects Affairs Manager", person: 0 },
    { group: "People", label: "Sara Al Mansoori", meta: "Product Designer", person: 1 },
    { group: "People", label: "Ahmed Obaid", meta: "Birthday today", href: "#announcements" },
    { group: "Communities", label: "Cricket", meta: "42 members", sport: "Cricket" },
    { group: "Communities", label: "Padel", meta: "28 members", sport: "Padel" },
    { group: "Communities", label: "Football", meta: "58 members", sport: "Football" },
    { group: "Perks", label: "Medical insurance", meta: "Workplace perk", href: "#perks" },
    { group: "Perks", label: "Marriott Hotel Downtown", meta: "30% off", href: "#discounts" },
    { group: "Help", label: "Help & support", meta: "FAQs and contacts", drawer: "help" }
  ];
  const search = $("#search");
  const sInput = $("#search-input");
  const sPanel = $("#search-results");
  let sResults = [];
  let sActive = 0;

  const highlight = (text, q) => {
    const safe = escapeHtml(text);
    if (!q) return safe;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return safe;
    return escapeHtml(text.slice(0, i)) + "<mark>" + escapeHtml(text.slice(i, i + q.length)) + "</mark>" + escapeHtml(text.slice(i + q.length));
  };

  function renderSearch() {
    const q = sInput.value.trim();
    sResults = q
      ? searchIndex.filter((it) => (it.label + " " + it.meta + " " + it.group).toLowerCase().includes(q.toLowerCase()))
      : searchIndex.filter((it) => it.group === "Apps" || it.label === "Data Security" || it.label === "Help & support");
    sActive = 0;
    if (!sResults.length) {
      sPanel.innerHTML = `<p class="search__empty">No results for “${escapeHtml(q)}”. Try a person’s name, a policy or an app.</p>`;
      return;
    }
    let html = "";
    let group = "";
    sResults.forEach((it, i) => {
      if (it.group !== group) { group = it.group; html += `<p class="search__group">${q ? group : group === "Apps" ? "Jump to an app" : "Suggested"}</p>`; }
      const lead = it.mark
        ? `<span class="app-mark app-mark--${it.mark}">${it.mark === "sap" ? "SAP" : it.label.slice(0, 2)}</span>`
        : `<span class="app-mark app-mark--policy">${icon(it.group === "People" ? "i-user" : it.group === "Policies" ? "i-book" : it.group === "Communities" ? "i-ball" : it.group === "Perks" ? "i-gift" : "i-help", "ico ico--sm")}</span>`;
      html += `<button type="button" class="search__item${i === 0 ? " is-active" : ""}" role="option" data-i="${i}">${lead}<span>${highlight(it.label, q)}</span><small>${escapeHtml(it.meta)}</small></button>`;
    });
    sPanel.innerHTML = html;
  }
  function openSearch() {
    if (!search.classList.contains("is-open")) { search.classList.add("is-open"); closeMenus(); hideTip(); }
    sInput.setAttribute("aria-expanded", "true");
    renderSearch();
  }
  function closeSearch() { search.classList.remove("is-open"); sInput.setAttribute("aria-expanded", "false"); }
  function focusSearch() { openSearch(); sInput.focus(); }
  function choose(it) {
    closeSearch();
    sInput.value = "";
    sInput.blur();
    if (it.filter) { filterAttention(it.filter, true); return; }
    if (it.drawer) { openDrawer(it.drawer); return; }
    if (typeof it.person === "number") { showPerson(it.person); document.getElementById("people").scrollIntoView({ behavior: smooth() }); return; }
    if (it.policy) { revealPolicy(it.policy); return; }
    if (it.sport) { revealSport(it.sport); return; }
    if (it.href) document.querySelector(it.href).scrollIntoView({ behavior: smooth() });
  }

  searchOpenBtn.addEventListener("click", focusSearch);
  sInput.addEventListener("focus", openSearch);
  sInput.addEventListener("input", renderSearch);
  sInput.addEventListener("keydown", (e) => {
    const items = $$(".search__item", sPanel);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      sActive = (sActive + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((b, i) => b.classList.toggle("is-active", i === sActive));
      items[sActive].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && sResults[sActive]) {
      e.preventDefault();
      choose(sResults[sActive]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeSearch();
      sInput.blur();
      searchOpenBtn.focus({ preventScroll: true });
    }
  });
  $(".search__box").addEventListener("mousedown", (e) => { if (e.target !== sInput) e.preventDefault(); }); // keep focus while clicking
  sPanel.addEventListener("click", (e) => {
    const b = e.target.closest(".search__item");
    if (b) choose(sResults[Number(b.dataset.i)]);
  });
  sInput.addEventListener("blur", () => setTimeout(closeSearch, 120));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); }
  });

  /* ---------------------------------------------------------------
     Attention required — live control center
     skeleton → rows, app filters, hover surfacing, approve / reject
     --------------------------------------------------------------- */
  const taskList = $("#task-list");
  const tabsEl = $("#attention-tabs");
  const moreBtn = $("#more-tasks");
  const counts = { salesforce: 15, uipath: 10, darwinbox: 5, sap: 2 };
  const START_TOTAL = 32;
  const totalPending = () => Object.values(counts).reduce((a, b) => a + b, 0);
  const sourceNames = { salesforce: "Salesforce", uipath: "UiPath", darwinbox: "Darwinbox", sap: "SAP" };
  const sourceMarks = { salesforce: "sf", uipath: "ui", darwinbox: "db", sap: "sap" };
  const taskRows = () => $$(".task:not(.task--skeleton)", taskList);
  let currentTab = "all";
  let inboxOpen = false;

  // Direction-aware sliding indicator, shared by every tab list
  function moveIndicator(list) {
    const ind = $(".tabs__indicator", list);
    const sel = $(".tab.is-selected", list);
    if (!ind || !sel || !list.offsetParent) return;
    if (getComputedStyle(list).flexDirection === "column") {
      ind.style.width = "";
      ind.style.height = `${sel.offsetHeight}px`;
      ind.style.transform = `translateY(${sel.offsetTop}px)`;
    } else {
      ind.style.height = "";
      ind.style.width = `${sel.offsetWidth}px`;
      ind.style.transform = `translateX(${sel.offsetLeft}px)`;
    }
  }
  const moveTabIndicator = () => moveIndicator(tabsEl);

  // Simulated fetch — the skeleton plays when the console first comes into view
  let tasksLoaded = false;
  function loadTasks() {
    if (tasksLoaded) return;
    tasksLoaded = true;
    setTimeout(() => {
      taskList.classList.remove("is-loading");
      taskList.setAttribute("aria-busy", "false");
      filterAttention(currentTab);
    }, reduceMotion ? 0 : 900);
  }
  new IntersectionObserver((entries, io) => {
    if (entries.some((en) => en.isIntersecting)) { loadTasks(); io.disconnect(); }
  }, { rootMargin: "0px 0px -15% 0px" }).observe(taskList);

  function animateRows() {
    if (reduceMotion) return;
    let n = 0;
    taskRows().forEach((row) => {
      if (row.classList.contains("is-hidden")) return;
      row.classList.remove("is-in");
      void row.offsetWidth; // restart the animation
      row.style.animationDelay = `${n++ * 55}ms`;
      row.classList.add("is-in");
    });
  }

  function filterAttention(source, scroll = false) {
    currentTab = source;
    $$(".tab", tabsEl).forEach((t) => {
      const on = t.dataset.tab === source;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollTo({ left: t.offsetLeft - 16, behavior: smooth() });
    });
    moveTabIndicator();
    const showAll = taskList.classList.contains("show-all");
    let visible = 0;
    taskRows().forEach((row) => {
      const match = source === "all" || row.dataset.source === source;
      const extraHidden = source === "all" && row.classList.contains("is-extra") && !showAll;
      const show = match && !extraHidden;
      row.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });
    $("#task-empty").hidden = visible > 0;
    moreBtn.hidden = source !== "all";
    if (!taskList.classList.contains("is-loading")) animateRows();
    if (scroll && !inboxOpen) document.getElementById("attention").scrollIntoView({ behavior: smooth() });
  }

  tabsEl.addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) filterAttention(t.dataset.tab);
  });
  tabsEl.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const tabs = $$(".tab", tabsEl);
    const i = tabs.findIndex((t) => t.classList.contains("is-selected"));
    const next = tabs[(i + step + tabs.length) % tabs.length];
    next.focus();
    filterAttention(next.dataset.tab);
  });
  $$("[data-filter]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    filterAttention(el.dataset.filter, true);
  }));

  // Hovering an app surfaces its tasks; hovering a task lights up its app
  function spotlight(src) {
    const on = !!src && src !== "all";
    taskList.classList.toggle("has-spot", on);
    taskRows().forEach((r) => r.classList.toggle("is-lit", on && r.dataset.source === src));
  }
  if (canHover) {
    tabsEl.addEventListener("pointerover", (e) => { const t = e.target.closest(".tab"); spotlight(t ? t.dataset.tab : null); });
    tabsEl.addEventListener("pointerleave", () => spotlight(null));
    taskList.addEventListener("pointerover", (e) => {
      const r = e.target.closest(".task");
      $$(".tab", tabsEl).forEach((t) => t.classList.toggle("is-hot", !!r && t.dataset.tab === r.dataset.source));
    });
    taskList.addEventListener("pointerleave", () => $$(".tab.is-hot", tabsEl).forEach((t) => t.classList.remove("is-hot")));
  }

  moreBtn.addEventListener("click", () => {
    const open = !taskList.classList.contains("show-all");
    taskList.classList.toggle("show-all", open);
    moreBtn.setAttribute("aria-expanded", String(open));
    moreBtn.firstChild.textContent = open ? "Show fewer tasks " : "Show more tasks ";
    filterAttention("all");
  });

  function decrementCount(source) {
    if (!counts[source]) return;
    counts[source]--;
    const total = totalPending();
    $("#pending-count").textContent = total;
    $("#orbit-total").textContent = total;
    $$("[data-total]").forEach((el) => { el.textContent = total; });
    const allTab = $('.tab[data-tab="all"]', tabsEl);
    $(".tab__count", allTab).textContent = total;
    allTab.style.setProperty("--share", (total / START_TOTAL).toFixed(3));
    const tab = $(`.tab[data-tab="${source}"]`, tabsEl);
    $(".tab__count", tab).textContent = pad(counts[source]);
    tab.style.setProperty("--share", (counts[source] / START_TOTAL).toFixed(3));
    const node = $(`.orbit__node[data-filter="${source}"]`);
    $(".orbit__count", node).textContent = pad(counts[source]);
    node.setAttribute("aria-label", `${sourceNames[source]}, ${counts[source]} pending`);
    const entry = searchIndex.find((it) => it.filter === source);
    if (entry) entry.meta = `${counts[source]} pending`;
  }

  function quickResolve(row, action) {
    if (!row || row.classList.contains("is-done")) return;
    row.classList.add("is-done");
    $$(".task__actions button", row).forEach((b) => { b.disabled = true; });
    const verb = action === "approve" ? "Approved" : "Rejected";
    decrementCount(row.dataset.source);
    toast(`${verb} and synced to ${sourceNames[row.dataset.source]}`, action === "approve" ? "i-check" : "i-x");
  }

  /* ---------------------------------------------------------------
     Drawer (task review, inbox, profile, help)
     --------------------------------------------------------------- */
  const drawer = $("#drawer");
  const drawerTitle = $("#drawer-title");
  const drawerBody = $("#drawer-body");
  const attentionBody = $("#attention-body");
  const attentionHome = { parent: attentionBody.parentNode, next: attentionBody.nextSibling };
  let lastFocus = null;

  const drawerViews = {
    inbox: () => ({
      title: "Inbox",
      html: `<p class="d-note">Your tasks from every connected app, in one place.</p>`
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
      const title = $(".task__title", row).textContent;
      const detail = $(".task__meta span", row).textContent;
      const due = $(".due", row).textContent.trim();
      return {
        title: "Review task",
        html: `<div class="d-task__row"><span class="app-mark app-mark--lg app-mark--${sourceMarks[src]}">${src === "sap" ? "SAP" : sourceNames[src].slice(0, 2)}</span><span class="tag">${sourceNames[src]}</span></div>
          <p class="d-task__title">${escapeHtml(title)}</p>
          <dl class="d-facts"><div><dt>Context</dt><dd>${escapeHtml(detail)}</dd></div><div><dt>Due</dt><dd>${escapeHtml(due)}</dd></div></dl>
          <p class="d-note">Approving here updates the task in ${sourceNames[src]}. You can also open it there for the full record.</p>
          <div class="d-actions">
            <button class="btn btn--primary" type="button" id="approve-task"><span class="btn__label">Approve</span><span class="spinner" aria-hidden="true"></span></button>
            <button class="btn btn--quiet" type="button" data-toast="Opening ${sourceNames[src]} in a new tab…">Open in ${sourceNames[src]} ${icon("i-external", "ico ico--sm")}</button>
            <button class="btn btn--quiet" type="button" disabled title="Only the task owner can reassign">Reassign</button>
          </div>`
      };
    }
  };

  function restoreAttention() {
    if (!inboxOpen) return;
    attentionHome.parent.insertBefore(attentionBody, attentionHome.next);
    inboxOpen = false;
    requestAnimationFrame(moveTabIndicator);
  }

  function openDrawer(type, ctx) {
    const wasOpen = drawer.classList.contains("is-open");
    restoreAttention(); // switching views while the inbox is open
    const view = drawerViews[type](ctx);
    if (!wasOpen) lastFocus = document.activeElement;
    drawerTitle.textContent = view.title;
    drawerBody.innerHTML = view.html;
    drawer.classList.add("is-open");
    drawer.classList.toggle("is-fullpage", type === "inbox");
    drawer.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
    closeMenus();
    closeNav(false);
    closeSearch();
    hideTip();
    setTimeout(() => $(".drawer__head .icon-btn").focus(), 60);

    if (type === "inbox") {
      $$(".js-inbox-badge").forEach((b) => { b.style.transform = "scale(0)"; setTimeout(() => b.remove(), 250); });
      $$('[data-drawer="inbox"][aria-label]').forEach((b) => b.setAttribute("aria-label", "Inbox"));
      drawerBody.appendChild(attentionBody);
      inboxOpen = true;
      $(".console__side", attentionBody).classList.add("is-visible");
      loadTasks();
      requestAnimationFrame(moveTabIndicator);
    }
    if (type === "task") {
      $("#approve-task").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        btn.classList.add("is-loading");
        $(".btn__label", btn).textContent = "Approving";
        setTimeout(() => {
          closeDrawer();
          quickResolve(ctx, "approve");
        }, 900);
      });
    }
  }
  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;
    restoreAttention();
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (!body.classList.contains("menu-open")) body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
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
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (drawer.classList.contains("is-open")) { closeDrawer(); return; }
    if (menus.some((m) => m.classList.contains("is-open"))) { closeMenus(); return; }
    closeNav();
  });

  /* ---------------------------------------------------------------
     Announcements — birthday feed carousel + wish modal
     --------------------------------------------------------------- */
  const birthdays = [
    { name: "Ahmed Obaid", role: "Contact Center Agent", img: "img-rashid", initials: "AO" },
    { name: "Mariam Al Hashimi", role: "Finance Analyst", img: "img-av-mh", initials: "MH" },
    { name: "Yousef Karim", role: "Site Engineer", img: "img-av-yousef", initials: "YK" }
  ];
  const ann = $("#announcements");
  const bTrack = $("#bday-track");
  const bDots = $("#bday-dots");
  const confetti = $("#confetti");
  let bIndex = 0;
  let bTimer = null;
  let annVisible = false;
  const letters = (s) => [...s].map((ch, i) => `<span class="l" style="--i:${i}">${escapeHtml(ch)}</span>`).join("");

  bTrack.innerHTML = birthdays.map((p, i) => {
    const first = p.name.split(" ")[0];
    return `<article class="bday${i ? "" : " is-current"}" aria-roledescription="slide" aria-label="${i + 1} of ${birthdays.length}" ${i ? 'aria-hidden="true"' : ""}>
      <div class="bday__avatar"><span class="avatar ${p.img}">${p.initials}</span>${icon("i-gift")}</div>
      <div class="bday__text">
        <p class="bday__kicker">Birthday today</p>
        <h3 class="bday__title"><span class="bday__hb">Happy birthday,</span> <span class="bday__name"><span class="sr-only">${first}</span><span aria-hidden="true">${letters(first)}</span></span></h3>
        <p class="bday__role">${p.name}, ${p.role}</p>
        <p class="bday__msg">Let’s make the day memorable with your warm wishes.</p>
        <button class="btn btn--light btn--lg" type="button" data-wish="${i}" ${i ? 'tabindex="-1"' : ""}>${icon("i-gift", "ico ico--sm")}<span>Send birthday wish</span></button>
      </div>
    </article>`;
  }).join("");
  bDots.innerHTML = birthdays.map((p, i) => `<button class="dot feed__item" type="button" role="tab" aria-label="Show ${p.name}" aria-selected="${i === 0}"><span class="avatar ${p.img}"></span><span class="feed__txt"><strong>${p.name}</strong><small>Birthday · ${p.role}</small></span><span class="feed__timer" aria-hidden="true"></span></button>`).join("");

  function restartTimer() {
    const timers = $$(".feed__timer", bDots);
    timers.forEach((t) => t.classList.remove("is-running"));
    if (reduceMotion || !annVisible) return;
    void timers[bIndex].offsetWidth;
    timers[bIndex].classList.add("is-running");
  }
  function celebrate() {
    if (reduceMotion || !annVisible) return;
    const av = $(".bday.is-current .bday__avatar", bTrack);
    if (!av) return;
    const s = confetti.getBoundingClientRect();
    const r = av.getBoundingClientRect();
    burst(confetti, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 16, 170);
  }
  function goBday(i) {
    bIndex = (i + birthdays.length) % birthdays.length;
    bTrack.style.transform = `translateX(calc(${bIndex * -100}% - ${bIndex * 96}px))`;
    $$(".bday", bTrack).forEach((s, n) => {
      const on = n === bIndex;
      s.setAttribute("aria-hidden", String(!on));
      $("button", s).tabIndex = on ? 0 : -1;
      s.classList.remove("is-current");
      if (on) { void s.offsetWidth; s.classList.add("is-current"); }
    });
    $$(".dot", bDots).forEach((d, n) => d.setAttribute("aria-selected", String(n === bIndex)));
    restartTimer();
    setTimeout(celebrate, 380);
  }
  const stopBday = () => { clearInterval(bTimer); ann.classList.add("is-paused"); };
  const startBday = () => {
    clearInterval(bTimer);
    ann.classList.remove("is-paused");
    restartTimer();
    if (!reduceMotion && annVisible) bTimer = setInterval(() => goBday(bIndex + 1), 6000);
  };
  $$("[data-bday]").forEach((b) => b.addEventListener("click", () => { goBday(bIndex + (b.dataset.bday === "next" ? 1 : -1)); startBday(); }));
  $$(".dot", bDots).forEach((d, i) => d.addEventListener("click", () => { goBday(i); startBday(); }));
  ann.addEventListener("mouseenter", stopBday);
  ann.addEventListener("mouseleave", startBday);
  ann.addEventListener("focusin", stopBday);
  ann.addEventListener("focusout", startBday);
  new IntersectionObserver(([en]) => {
    const was = annVisible;
    annVisible = en.isIntersecting;
    if (annVisible && !was) { startBday(); setTimeout(celebrate, 500); }
    if (!annVisible) stopBday();
  }, { threshold: 0.35 }).observe(ann);

  const modal = $("#wish-modal");
  const wishText = $("#wish-text");
  const wishCount = $("#wish-count");
  const wishSend = $("#wish-send");
  let wishFor = 0;

  const updateCount = () => { wishCount.textContent = wishText.value.length; wishSend.disabled = !wishText.value.trim(); };
  wishText.addEventListener("input", updateCount);
  $$("#wish-presets .chip").forEach((c) => c.addEventListener("click", () => { wishText.value = c.textContent; updateCount(); wishText.focus(); }));

  bTrack.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wish]");
    if (!b || b.classList.contains("is-sent")) return;
    wishFor = Number(b.dataset.wish);
    const p = birthdays[wishFor];
    $("#wish-title").textContent = `Wish ${p.name.split(" ")[0]} a happy birthday`;
    $("#wish-role").textContent = `${p.name}, ${p.role}`;
    const av = $("#wish-avatar");
    av.className = `avatar avatar--xl ${p.img}`;
    av.textContent = p.initials;
    updateCount();
    stopBday();
    modal.showModal();
  });
  wishSend.addEventListener("click", () => {
    wishSend.classList.add("is-loading");
    $(".btn__label", wishSend).textContent = "Sending";
    setTimeout(() => {
      wishSend.classList.remove("is-loading");
      $(".btn__label", wishSend).textContent = "Send wish";
      modal.close();
      const btn = $(`[data-wish="${wishFor}"]`, bTrack);
      btn.classList.add("is-sent");
      btn.innerHTML = `${icon("i-check", "ico ico--sm")}<span>Wish sent</span>`;
      toast(`Your wish is on its way to ${birthdays[wishFor].name.split(" ")[0]}`, "i-gift");
      burstFrom(btn, 26, 240);
      startBday();
    }, 900);
  });
  modal.addEventListener("close", startBday);

  /* ---------------------------------------------------------------
     Welcome to the Bloom family — editorial people carousel
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
  const stage = $("#people-stage");
  const reel = $("#people-reel");
  const helloBtn = $("#say-hello");
  const peopleImg = $("#people-img");
  const wipe = $(".people__wipe");
  const greeted = new Set();
  let pIndex = 0;

  reel.innerHTML = people.map((p, i) => `<button class="reel-item" type="button" role="tab" aria-label="${p.name}" aria-selected="${i === 0}"><span class="reel-item__img ${p.img}"></span><span class="reel-item__name" aria-hidden="true">${p.name.split(" ")[0]}</span></button>`).join("");

  function paintPerson() {
    const p = people[pIndex];
    peopleImg.className = `people__img ${p.img}`;
    let n = 0;
    $("#people-name").innerHTML = p.name.split(" ").map((w) => `<span class="w"><span style="--i:${n++}">${escapeHtml(w)}</span></span>`).join(" ");
    $("#people-quote").textContent = p.quote;
    $("#people-role").textContent = p.role;
    $("#people-manager").textContent = p.manager;
    $("#people-doj").textContent = p.doj;
    $("#people-team").textContent = p.team;
    $("#people-week").textContent = p.week;
    $("#people-counter").textContent = `${pIndex + 1} / ${people.length}`;
    $$(".reel-item", reel).forEach((r, i) => r.setAttribute("aria-selected", String(i === pIndex)));
    const sent = greeted.has(pIndex);
    helloBtn.classList.toggle("is-sent", sent);
    $("span", helloBtn).textContent = sent ? "Hello sent" : `Say hello to ${p.name.split(" ")[0]}`;
  }
  // Crop transition: a colour panel wipes up over the portrait, the person
  // changes underneath, then the panel lifts away to reveal them.
  function showPerson(i) {
    pIndex = (i + people.length) % people.length;
    if (reduceMotion || !wipe.animate) { paintPerson(); return; }
    wipe.getAnimations().forEach((a) => a.cancel());
    stage.classList.add("is-swapping");
    wipe.style.transformOrigin = "50% 100%";
    const cover = wipe.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 420, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" });
    cover.onfinish = () => {
      paintPerson();
      stage.classList.remove("is-swapping");
      wipe.style.transformOrigin = "50% 0%";
      wipe.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 700, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    };
  }
  $$("[data-people]").forEach((b) => b.addEventListener("click", () => showPerson(pIndex + (b.dataset.people === "next" ? 1 : -1))));
  $$(".reel-item", reel).forEach((r, i) => r.addEventListener("click", () => { if (i !== pIndex) showPerson(i); }));
  helloBtn.addEventListener("click", () => {
    if (greeted.has(pIndex)) return;
    greeted.add(pIndex);
    paintPerson();
    burstFrom(helloBtn, 16, 150);
    toast(`You said hello to ${people[pIndex].name.split(" ")[0]}`, "i-wave");
  });
  paintPerson();

  /* ---------------------------------------------------------------
     Horizontal rails — policies strip and partner marketplace
     drag to scroll (mouse), arrow buttons, progress + counter
     --------------------------------------------------------------- */
  const chipsEl = $("#policy-chips");
  const strip = $("#policy-strip");
  const policies = $$(".policy", strip);
  const rails = [
    { el: strip, bar: $("#policy-progress"), count: $("#policy-count"), items: () => policies.filter((p) => !p.classList.contains("is-filtered")), near: true },
    { el: $("#partner-rail"), bar: $("#partner-progress"), count: $("#partner-count"), items: () => $$(".partner") }
  ];
  const railPad = (el) => parseFloat(getComputedStyle(el).paddingLeft) || 0;

  function updateRail(r) {
    const el = r.el;
    const total = el.scrollWidth;
    const view = el.clientWidth;
    const max = total - view;
    const p = max > 0 ? el.scrollLeft / max : 1;
    const win = total ? view / total : 1;
    r.bar.style.setProperty("--rp", clamp(win + p * (1 - win)).toFixed(3));
    const items = r.items();
    const edge = el.scrollLeft + railPad(el) - 12;
    let first = items.findIndex((it) => it.offsetLeft + it.offsetWidth * 0.5 > edge);
    if (first < 0) first = items.length - 1;
    if (max > 0 && el.scrollLeft >= max - 4) first = Math.max(first, items.length - 1);
    r.count.textContent = `${pad(first + 1)} — ${pad(items.length)}`;
    if (r.near) {
      const all = $(".chip.is-selected", chipsEl)?.dataset.cat === "all";
      const cat = items[Math.min(first, items.length - 1)]?.dataset.cat;
      $$(".chip", chipsEl).forEach((c) => c.classList.toggle("is-near", all && c.dataset.cat === cat));
    }
  }
  rails.forEach((r) => {
    let raf = 0;
    r.el.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateRail(r); }); }, { passive: true });
    updateRail(r);
  });
  $$("[data-rail-prev], [data-rail-next]").forEach((b) => b.addEventListener("click", () => {
    const el = document.getElementById(b.dataset.railPrev || b.dataset.railNext);
    const dir = b.hasAttribute("data-rail-next") ? 1 : -1;
    el.scrollBy({ left: dir * el.clientWidth * 0.66, behavior: smooth() });
  }));

  // Mouse drag-to-scroll; a real drag swallows the click that follows it
  $$("[data-drag]").forEach((el) => {
    let startX = 0;
    let startLeft = 0;
    let down = false;
    let moved = false;
    let swallow = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = el.scrollLeft;
    });
    addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; el.classList.add("is-dragging"); }
      if (moved) el.scrollLeft = startLeft - dx;
    });
    addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (moved) { swallow = true; el.classList.remove("is-dragging"); setTimeout(() => { swallow = false; }, 0); }
    });
    el.addEventListener("click", (e) => { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
    el.addEventListener("dragstart", (e) => e.preventDefault());
  });

  /* Policies — category exploration: filter, feature, follow ------- */
  let featureTimer = null;
  function setFeatured(card) {
    if (!card || card.classList.contains("is-featured")) return;
    policies.forEach((p) => p.classList.toggle("is-featured", p === card));
  }
  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $$(".chip", chipsEl).forEach((c) => { const on = c === chip; c.classList.toggle("is-selected", on); c.setAttribute("aria-pressed", String(on)); });
    const cat = chip.dataset.cat;
    let first = null;
    let n = 0;
    policies.forEach((p) => {
      const show = cat === "all" || p.dataset.cat === cat;
      p.classList.toggle("is-filtered", !show);
      if (!show) return;
      if (!first) first = p;
      if (!reduceMotion) p.animate([{ opacity: 0, transform: "translateX(48px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: n++ * 70, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
    });
    setFeatured(first);
    strip.scrollTo({ left: 0, behavior: smooth() });
    requestAnimationFrame(() => updateRail(rails[0]));
  });
  policies.forEach((p) => {
    if (canHover) {
      p.addEventListener("pointerenter", () => {
        clearTimeout(featureTimer);
        featureTimer = setTimeout(() => { if (!strip.classList.contains("is-dragging")) setFeatured(p); }, 110);
      });
      p.addEventListener("pointerleave", () => clearTimeout(featureTimer));
    }
    p.addEventListener("focusin", () => setFeatured(p));
  });
  function revealPolicy(name) {
    const card = policies.find((p) => p.dataset.name === name);
    if (!card) return;
    if (card.classList.contains("is-filtered")) $('.chip[data-cat="all"]', chipsEl).click();
    setFeatured(card);
    document.getElementById("policies").scrollIntoView({ behavior: smooth() });
    setTimeout(() => strip.scrollTo({ left: card.offsetLeft - railPad(strip), behavior: smooth() }), reduceMotion ? 0 : 450);
  }

  /* Discounts — reveal then copy code; tilt on pointer -------------- */
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
  if (canHover && !reduceMotion) {
    $$(".partner").forEach((c) => {
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width) - 0.5) * 10}deg`);
        c.style.setProperty("--rx", `${(((e.clientY - r.top) / r.height) - 0.5) * -8}deg`);
      });
      c.addEventListener("pointerleave", () => { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); });
    });
  }

  /* ---------------------------------------------------------------
     Sports & communities — expanding cards inside a pinned reel
     --------------------------------------------------------------- */
  const sportsList = $("#sports-list");
  const sportsEls = $$(".sport", sportsList);
  const sportMedia = sportsEls.map((s) => $(".sport__media", s));
  const hs = {
    el: $("[data-hscroll]"), on: false, top: 0, height: 0, dist: 0,
    bar: $("#sports-progress"), count: $("#sports-count"), lastIndex: -1
  };
  hs.pin = $(".hscroll__pin", hs.el);
  hs.track = $(".hscroll__track", hs.el);
  const hsMQ = matchMedia("(min-width: 1024px) and (min-height: 560px)");
  let lastScrollAt = 0;

  function openSport(s) {
    sportsEls.forEach((x) => {
      const on = x === s;
      x.classList.toggle("is-open", on);
      $(".sport__hit", x).setAttribute("aria-expanded", String(on));
    });
  }
  // Scroll the page so a card lands centred inside the pinned reel
  function bringSportIntoView(s) {
    const prevOpen = sportsEls.find((x) => x.classList.contains("is-open")) || s;
    const closedEl = sportsEls.find((x) => x !== prevOpen && x !== s) || s;
    const closedW = closedEl.offsetWidth;
    const openW = prevOpen.offsetWidth;
    const gap = parseFloat(getComputedStyle(sportsList).columnGap) || 12;
    openSport(s);
    if (!hs.on) return false;
    const center = sportsList.offsetLeft + sportsEls.indexOf(s) * (closedW + gap) + openW / 2;
    const tx = clamp(center - hs.pin.clientWidth / 2, 0, hs.dist);
    scrollTo({ top: hs.top + tx, behavior: smooth() });
    return true;
  }
  sportsEls.forEach((s) => {
    const hit = $(".sport__hit", s);
    if (canHover) {
      // pointermove (not mouseenter) so cards gliding under a still cursor don't fire
      s.addEventListener("pointermove", (e) => {
        if (!s.classList.contains("is-open") && performance.now() - lastScrollAt > 180) openSport(s);
        const r = s.getBoundingClientRect();
        s.style.setProperty("--px", `${e.clientX - r.left}px`);
        s.style.setProperty("--py", `${e.clientY - r.top}px`);
      });
    }
    hit.addEventListener("click", () => openSport(s));
    hit.addEventListener("focus", () => bringSportIntoView(s));
  });
  function revealSport(name) {
    const s = sportsEls.find((x) => $(".sport__name", x).textContent === name);
    if (!s) return;
    if (bringSportIntoView(s)) return;
    document.getElementById("sports").scrollIntoView({ behavior: smooth() });
    setTimeout(() => sportsList.scrollTo({ left: s.offsetLeft - 16, behavior: smooth() }), reduceMotion ? 0 : 450);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-join]");
    if (!b) return;
    const joined = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(joined));
    b.textContent = joined ? "Joined" : "Join group";
    const name = $(".sport__name", b.closest(".sport")).textContent;
    if (joined) burstFrom(b, 14, 130);
    toast(joined ? `You joined ${name}. The schedule is on its way to your inbox.` : `You left ${name}.`, joined ? "i-check" : "i-x");
  });

  function setupHScroll() {
    hs.on = hsMQ.matches && !reduceMotion;
    hs.el.classList.toggle("is-pinned", hs.on);
    if (!hs.on) { hs.el.style.height = ""; hs.track.style.transform = ""; sportsEls.forEach((s) => { s.style.scale = ""; }); sportMedia.forEach((m) => { m.style.translate = ""; }); return; }
    hs.dist = Math.max(0, hs.track.offsetWidth - hs.pin.clientWidth);
    hs.el.style.height = `${innerHeight + hs.dist}px`;
  }

  /* ---------------------------------------------------------------
     Workplace perks — scroll picks the perk, the visual follows
     --------------------------------------------------------------- */
  const perkEls = $$(".perk");
  const shots = $$(".perks__shot");
  const perkCaption = $(".perks__caption");
  let perkIndex = 0;
  function setPerk(i) {
    if (i === perkIndex) return;
    const prev = perkIndex;
    perkIndex = i;
    perkEls.forEach((p, n) => p.classList.toggle("is-active", n === i));
    shots.forEach((s, n) => { s.classList.toggle("was-active", n === prev); s.classList.toggle("is-active", n === i); });
    $("#perk-num").textContent = pad(i + 1);
    $("#perk-caption").textContent = $(".perk__title", perkEls[i]).textContent;
    perkCaption.classList.remove("is-changing");
    void perkCaption.offsetWidth;
    perkCaption.classList.add("is-changing");
  }
  const perkIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setPerk(perkEls.indexOf(en.target)); });
  }, { rootMargin: "-46% 0px -46% 0px" });
  perkEls.forEach((p, i) => {
    perkIO.observe(p);
    if (canHover) p.addEventListener("pointerenter", () => setPerk(i));
    p.addEventListener("focusin", () => setPerk(i));
  });

  /* ---------------------------------------------------------------
     FAQ — category tabs + animated accordion
     --------------------------------------------------------------- */
  const faqTabs = $("#faq-tabs");
  function selectFaq(tab, focus = false) {
    $$(".tab", faqTabs).forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = $("#" + t.getAttribute("aria-controls"));
      panel.hidden = !on;
      if (on && !reduceMotion) panel.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
    });
    if (focus) tab.focus();
    moveIndicator(faqTabs);
  }
  faqTabs.addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) selectFaq(t); });
  faqTabs.addEventListener("keydown", (e) => {
    const tabs = $$(".tab", faqTabs);
    const i = tabs.indexOf(document.activeElement);
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined || i < 0) return;
    e.preventDefault();
    selectFaq(tabs[(next + tabs.length) % tabs.length], true);
  });
  $$(".faqs__item").forEach((d) => {
    const summary = $("summary", d);
    const answer = $(".faqs__a", d);
    let anim = null;
    let closing = false;
    summary.addEventListener("click", (e) => {
      if (reduceMotion || !answer.animate) return;
      e.preventDefault();
      if (closing) { anim.cancel(); closing = false; return; } // changed their mind — stay open
      if (anim) anim.cancel();
      if (d.open) {
        closing = true;
        anim = answer.animate([{ height: `${answer.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 360, easing: "cubic-bezier(.4,0,.2,1)" });
        anim.onfinish = () => { d.open = false; closing = false; anim = null; };
      } else {
        d.open = true;
        anim = answer.animate([{ height: "0px", opacity: 0 }, { height: `${answer.offsetHeight}px`, opacity: 1 }], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" });
        anim.onfinish = () => { anim = null; };
      }
    });
  });

  /* ---------------------------------------------------------------
     Microinteractions — magnetic CTAs, app dock magnification,
     hero parallax on the pointer
     --------------------------------------------------------------- */
  const hero = $("#top");
  const heroStage = $(".hero__stage");
  if (canHover && !reduceMotion) {
    $$(".btn--magnetic").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--tx", `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
        b.style.setProperty("--ty", `${((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1)}px`);
      });
      b.addEventListener("pointerleave", () => { b.style.removeProperty("--tx"); b.style.removeProperty("--ty"); });
    });

    const dockList = $(".dock__list");
    const dockItems = $$(".dock__item", dockList);
    dockList.addEventListener("pointermove", (e) => {
      dockItems.forEach((it) => {
        const r = it.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        it.style.setProperty("--mag", (1 + 0.38 * Math.pow(Math.max(0, 1 - d / 150), 1.5)).toFixed(3));
      });
    });
    dockList.addEventListener("pointerleave", () => dockItems.forEach((it) => it.style.removeProperty("--mag")));

    let mx = 0, my = 0, tx = 0, ty = 0, praf = 0;
    const settle = () => {
      mx += (tx - mx) * 0.08;
      my += (ty - my) * 0.08;
      heroStage.style.setProperty("--mx", mx.toFixed(3));
      heroStage.style.setProperty("--my", my.toFixed(3));
      praf = Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002 ? requestAnimationFrame(settle) : 0;
    };
    hero.addEventListener("pointermove", (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
      if (!praf) praf = requestAnimationFrame(settle);
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!praf) praf = requestAnimationFrame(settle); });
  }

  /* ---------------------------------------------------------------
     Scroll choreography — one rAF loop, geometry cached on resize
     --------------------------------------------------------------- */
  const navbarEl = $("#navbar");
  const darkZones = ["#attention", "#announcements", "#sports", "#footer"].map((sel) => ({ el: $(sel), top: 0, bottom: 0 }));
  let navOnDark = null;
  const scenes = [];
  const addScene = (el, fn) => { if (el) scenes.push({ el, fn, top: 0, h: 0 }); };
  const docTop = (el) => { let t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };
  let vh = innerHeight;
  let compact = null;

  // Hero — copy lifts and shrinks, constellation rises faster, light drifts
  const heroCopy = $(".hero__copy");
  const heroFoot = $(".hero__foot");
  const orbitLines = $(".orbit__lines");
  const blobs = $$(".blob");
  addScene(hero, (p, y, s) => {
    const q = clamp(y / s.h);
    heroCopy.style.translate = `0 ${(q * -110).toFixed(1)}px`;
    heroCopy.style.scale = (1 - q * 0.08).toFixed(4);
    heroCopy.style.opacity = (1 - clamp((q - 0.2) / 0.55)).toFixed(3);
    heroStage.style.translate = `0 ${(q * -190).toFixed(1)}px`;
    orbitLines.style.rotate = `${(q * 28).toFixed(2)}deg`;
    heroFoot.style.translate = `0 ${(q * 70).toFixed(1)}px`;
    heroFoot.style.opacity = (1 - clamp(q * 2.4)).toFixed(3);
    blobs[0].style.translate = `0 ${(q * 180).toFixed(1)}px`;
    blobs[1].style.translate = `${(q * 60).toFixed(1)}px ${(q * -90).toFixed(1)}px`;
    blobs[2].style.translate = `${(q * -80).toFixed(1)}px ${(q * 120).toFixed(1)}px`;
  });

  // Attention — the console settles into full size as it arrives
  const attentionSec = $("#attention");
  addScene(attentionSec, (p) => {
    const e = clamp(p / 0.3);
    attentionSec.style.scale = e >= 1 ? "" : (0.93 + 0.07 * easeOut(e)).toFixed(4);
  });

  // People — marquee slides, the portrait drifts inside its frame,
  // facts move at their own pace
  const peopleSec = $("#people");
  const peopleMarquee = $(".people__marquee");
  const peopleFacts = $$("[data-speed]", peopleSec);
  addScene(peopleSec, (p) => {
    peopleMarquee.style.translate = `${(8 - p * 70).toFixed(2)}vw 0`;
    peopleImg.style.translate = `0 ${((p - 0.5) * -80).toFixed(1)}px`;
    peopleFacts.forEach((f) => { f.style.translate = `0 ${((p - 0.5) * Number(f.dataset.speed)).toFixed(1)}px`; });
  });

  // Interlude — outlined words slide in opposite directions, stickers float
  const interlude = $("#life");
  const interRows = $$(".interlude__row", interlude);
  const stickers = $$(".sticker", interlude);
  const interTitle = $(".interlude__title", interlude);
  addScene(interlude, (p) => {
    interRows.forEach((r) => { r.style.translate = `${((p - 0.5) * 36 * Number(r.dataset.dir)).toFixed(2)}vw 0`; });
    stickers.forEach((st) => { st.style.translate = `0 ${((p - 0.5) * Number(st.dataset.speed) * 2).toFixed(1)}px`; });
    interTitle.style.scale = (0.9 + 0.1 * easeOut(clamp(p * 2.2))).toFixed(4);
  });

  // Footer — the statement lights up word by word
  const footer = $("#footer");
  const footWords = $$(".fw", footer);
  let litCount = -1;
  addScene(footer, (p) => {
    const lit = Math.round(clamp((p - 0.1) / 0.32) * footWords.length);
    if (lit === litCount) return;
    litCount = lit;
    footWords.forEach((w, i) => w.classList.toggle("is-lit", i < lit));
  });

  function measure() {
    vh = innerHeight;
    setupHScroll();
    scenes.forEach((s) => { s.top = docTop(s.el); s.h = s.el.offsetHeight; });
    groups.forEach((g) => {
      g.top = Math.min(...g.els.map(docTop));
      g.bottom = Math.max(...g.els.map((el) => docTop(el) + el.offsetHeight));
    });
    hs.top = docTop(hs.el);
    hs.height = hs.el.offsetHeight;
    darkZones.forEach((z) => { z.top = docTop(z.el); z.bottom = z.top + z.el.offsetHeight; });
    requestTick();
  }

  function frame() {
    ticking = false;
    const y = scrollY;

    const isCompact = y > 40;
    if (isCompact !== compact) { compact = isCompact; body.classList.toggle("nav-compact", compact); }
    const probe = y + 38; // the capsule's vertical centre
    const onDark = darkZones.some((z) => probe >= z.top && probe < z.bottom);
    if (onDark !== navOnDark) { navOnDark = onDark; navbarEl.classList.toggle("is-on-dark", onDark); }
    if (activeGroup) {
      const g = activeGroup;
      const sp = clamp((y + vh * 0.42 - g.top) / Math.max(1, g.bottom - g.top));
      whereFill.setAttribute("stroke-dashoffset", (100 - sp * 100).toFixed(2));
    }

    if (!reduceMotion) {
      scenes.forEach((s) => {
        const start = s.top - vh;
        const end = s.top + s.h;
        if (y < start - 60 || y > end + 60) return; // off screen — leave it be
        s.fn(clamp((y - start) / (end - start)), y, s);
      });
    }

    if (hs.on) {
      const p = hs.dist ? clamp((y - hs.top) / hs.dist) : 0;
      const tx = p * hs.dist;
      hs.track.style.transform = `translate3d(${(-tx).toFixed(1)}px, 0, 0)`;
      hs.bar.style.transform = `scaleX(${p.toFixed(4)})`;
      if (y + vh > hs.top && y < hs.top + hs.height) {
        const vw = hs.pin.clientWidth;
        const listLeft = sportsList.offsetLeft;
        let best = 0;
        let bestD = Infinity;
        sportsEls.forEach((s, i) => {
          const c = listLeft + s.offsetLeft + s.offsetWidth / 2 - tx;
          const d = (c - vw / 2) / vw;
          if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
          sportMedia[i].style.translate = `${(d * -70).toFixed(1)}px 0`;
          s.style.scale = (1 - Math.min(Math.abs(d), 1) * 0.07).toFixed(4);
        });
        if (best !== hs.lastIndex) { hs.lastIndex = best; hs.count.textContent = `${pad(best + 1)} / ${pad(sportsEls.length)}`; }
      }
    }
  }
  addEventListener("scroll", () => { lastScrollAt = performance.now(); requestTick(); }, { passive: true });

  let measureRaf = 0;
  const scheduleMeasure = () => { if (!measureRaf) measureRaf = requestAnimationFrame(() => { measureRaf = 0; measure(); }); };
  new ResizeObserver(scheduleMeasure).observe(body);
  addEventListener("resize", () => {
    scheduleMeasure();
    sizeWhere();
    moveTabIndicator();
    moveIndicator(faqTabs);
    hideTip();
    rails.forEach(updateRail);
  });
  hsMQ.addEventListener("change", scheduleMeasure);
  mqReduce.addEventListener("change", (e) => { reduceMotion = e.matches; scheduleMeasure(); });

  /* ---------------------------------------------------------------
     Reveal on scroll, split headings, count-ups
     --------------------------------------------------------------- */
  $$(".split").forEach((el) => {
    let n = 0;
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span style="--i:${n++}">${escapeHtml(w)}</span></span>`).join(" ");
  });

  function countUp(el) {
    if (reduceMotion || el.dataset.counted) return;
    el.dataset.counted = "1";
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / 1400);
      el.textContent = Math.round(totalPending() * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const reveals = $$(".reveal, .partner-rail");
  const onReveal = (el) => {
    if (el.classList.contains("partner-rail")) setTimeout(() => el.classList.add("is-settled"), 1600);
    const c = $("[data-count]", el);
    if (c) countUp(c);
  };
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        io.unobserve(en.target);
        onReveal(en.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    reveals.forEach((r) => io.observe(r));
  } else {
    reveals.forEach((r) => r.classList.add("is-visible", "is-settled"));
  }

  /* ---------------------------------------------------------------
     First paint — let fonts settle, then run the hero entrance
     --------------------------------------------------------------- */
  const markLoaded = () => {
    if (root.classList.contains("is-loaded")) return;
    root.classList.add("is-loaded");
    countUp($("#orbit-total"));
    sizeWhere();
    moveTabIndicator();
    moveIndicator(faqTabs);
    measure();
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))])
    .then(() => requestAnimationFrame(markLoaded));
  addEventListener("load", () => { measure(); sizeWhere(); rails.forEach(updateRail); });
  measure();
})();
