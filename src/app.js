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
  // Any element with data-toast leads to a page outside the prototype. They all
  // say the same thing; the attribute keeps a note of where each one will go.
  const SOON = "Designing soon";
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toast]");
    if (!t) return;
    if (t.tagName === "A") e.preventDefault();
    toast(SOON, "i-sparkle");
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
    // the path still holds a chip that was re-rendered while handling the click
    if (!e.composedPath().some((n) => n.matches && n.matches("[data-menu]")) || e.target.closest('.menu__item:not([aria-disabled="true"])')) closeMenus();
  });

  $("#mark-read").addEventListener("click", () => {
    $$(".notif.is-unread").forEach((n) => n.classList.remove("is-unread"));
    $("#bell-badge").classList.add("is-cleared");
    $("#bell").setAttribute("aria-label", "Notifications, none unread");
    toast("All notifications marked as read");
  });

  /* ---------------------------------------------------------------
     Quick links — the apps Bloom works in. One list feeds the hero
     dock (the four with a `dock` place) and the "View All" panel.
     `brand` only tints the panel's cards; it never colours text.
     --------------------------------------------------------------- */
  const QUICK_LINKS = [
    { name: "SAP", mark: "sap", brand: "#0a6ed1", href: "https://www.sap.com", dock: 3, hint: "Procurement", desc: "Create ADCB Batch Approval Process Workflow requests directly from Bloom." },
    { name: "Salesforce", mark: "sf", brand: "#00a1e0", href: "https://www.salesforce.com", dock: 1, hint: "Sales & CRM", desc: "Create Broker Commission Approval, Resale Approval and other requests." },
    { name: "Darwinbox", mark: "db", brand: "#1a73e8", href: "https://www.darwinbox.com", dock: 2, hint: "People records", desc: "Create Leave, Out of Duty and other requests directly from Bloom." },
    { name: "UiPath", mark: "ui", brand: "#fa4616", href: "https://www.uipath.com", dock: 4, hint: "Automations", desc: "Start and track the automations that take on routine work." },
    { name: "Egnyte", mark: "eg", brand: "#00968f", href: "https://www.egnyte.com", desc: "All company policies are stored in Egnyte, Bloom’s document hub." },
    { name: "Docusign", mark: "ds", brand: "#4c00ff", href: "https://www.docusign.com", desc: "Sign, send and track the documents that need a signature." },
    { name: "ServiceDesk", mark: "sd", brand: "#2b7bf3", desc: "Raise an IT ticket and follow it through to a fix." },
    { name: "Contentful", mark: "cf", brand: "#ef4a52", href: "https://www.contentful.com", desc: "Edit and publish the content on Bloom’s websites." },
    { name: "Power BI", mark: "pbi", brand: "#f2c811", href: "https://app.powerbi.com", desc: "Reports and dashboards for every team." }
  ];
  // ServiceDesk lives on Bloom's network, so the prototype has no address for it
  const qlLink = (l) => l.href ? `href="${l.href}" target="_blank" rel="noopener"` : `href="#" data-toast="${l.name}"`;
  const qlMark = (l, cls = "") => `<span class="app-mark app-mark--${l.mark}${cls}" aria-hidden="true">${l.mark === "sap" ? "SAP" : l.name.slice(0, 2)}</span>`;
  $("#dock-list").innerHTML = QUICK_LINKS.filter((l) => l.dock).sort((a, b) => a.dock - b.dock).map((l) =>
    `<li><a class="dock__item" ${qlLink(l)}>${qlMark(l, " app-mark--lg")}<span class="dock__label"><span class="dock__name">${l.name}</span><span class="dock__hint">${escapeHtml(l.hint)}</span></span>${icon("i-external", "ico ico--sm dock__ext")}</a></li>`).join("");

  /* ---------------------------------------------------------------
     Search — command palette
     --------------------------------------------------------------- */
  const searchIndex = [
    { group: "Apps", label: "Salesforce", meta: "15 pending", mark: "sf", filter: "salesforce" },
    { group: "Apps", label: "UiPath", meta: "10 pending", mark: "ui", filter: "uipath" },
    { group: "Apps", label: "Darwinbox", meta: "5 pending", mark: "db", filter: "darwinbox" },
    { group: "Apps", label: "SAP", meta: "2 pending", mark: "sap", filter: "sap" },
    { group: "Apps", label: "Quick links", meta: `All ${QUICK_LINKS.length} apps`, drawer: "links" },
    { group: "Policies", label: "Data Security", meta: "Security", policy: "Data Security" },
    { group: "Policies", label: "Management Process", meta: "Operations", policy: "Management Process" },
    { group: "Policies", label: "Brand Guidelines", meta: "Brand", policy: "Brand Guidelines" },
    { group: "Policies", label: "Code of Conduct", meta: "Conduct", policy: "Code of Conduct" },
    { group: "Policies", label: "Travel & Expenses", meta: "Operations", policy: "Travel & Expenses" },
    { group: "People", label: "Abdulazeez Aladwan", meta: "Projects Affairs Manager", person: 0 },
    { group: "People", label: "Sara Al Mansoori", meta: "Product Designer", person: 1 },
    { group: "People", label: "Ahmed Obaid", meta: "Birthday today", ann: 0 },
    { group: "People", label: "Khalid Al Mazrouei", meta: "10-year work anniversary", ann: 3 },
    { group: "Announcements", label: "Fire safety drill", meta: "26 Sep · 10:30 AM", ann: 4 },
    { group: "Announcements", label: "Eid Al Adha", meta: "Holiday · 25 – 29 May", ann: 5 },
    { group: "Communities", label: "Cricket", meta: "42 members", sport: "Cricket" },
    { group: "Communities", label: "Padel", meta: "28 members", sport: "Padel" },
    { group: "Communities", label: "Football", meta: "58 members", sport: "Football" },
    { group: "Perks", label: "Marriott Hotel Downtown", meta: "30% off", href: "#discounts" },
    { group: "Requests", label: "Inbox", meta: "Waiting on you", inbox: "inbox" },
    { group: "Requests", label: "New request", meta: "TCDF, Internal Memo, RFP", inbox: "new" },
    { group: "Requests", label: "Drafts", meta: "Requests you haven’t sent", inbox: "draft" },
    { group: "Requests", label: "My requests", meta: "Waiting on approvers", inbox: "mine" },
    { group: "Help", label: "Contact IT Support", meta: "Raise an IT request", drawer: "itsupport" },
    { group: "Help", label: "Help & support", meta: "Talk to our support team", drawer: "support" },
    { group: "Bloom GPT", label: "Ask Bloom GPT", meta: "Your AI assistant", gpt: true }
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
      : searchIndex.filter((it) => it.group === "Apps" || it.label === "Data Security" || it.label === "Help & support" || it.gpt === true);
    if (q) sResults.push({ group: "Bloom GPT", label: `Ask Bloom GPT “${q}”`, meta: "Get an answer", gpt: q });
    sActive = 0;
    if (!sResults.length) {
      sPanel.innerHTML = `<p class="search__empty">No results for “${escapeHtml(q)}”. Try a person’s name, a policy or an app.</p>`;
      return;
    }
    let html = "";
    let group = "";
    sResults.forEach((it, i) => {
      if (it.group !== group) { group = it.group; html += `<p class="search__group">${q ? group : group === "Apps" ? "Jump to an app" : "Suggested"}</p>`; }
      const lead = it.gpt
        ? `<span class="app-mark app-mark--gpt"><span class="orb orb--xs"></span></span>`
        : it.mark
        ? `<span class="app-mark app-mark--${it.mark}">${it.mark === "sap" ? "SAP" : it.label.slice(0, 2)}</span>`
        : `<span class="app-mark app-mark--policy">${icon(it.group === "People" ? "i-user" : it.group === "Policies" ? "i-book" : it.group === "Communities" ? "i-ball" : it.group === "Perks" ? "i-gift" : it.group === "Announcements" ? "i-megaphone" : it.group === "Requests" ? "i-doc" : it.group === "Apps" ? "i-grid" : "i-help", "ico ico--sm")}</span>`;
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
    if (it.gpt) { openGpt(null, it.gpt === true ? "" : it.gpt); return; }
    if (it.filter) { filterAttention(it.filter, true); return; }
    if (it.drawer) { openDrawer(it.drawer); return; }
    if (it.inbox) { openInbox(null, it.inbox === "new" ? ib.tab : it.inbox); if (it.inbox === "new") openRequestForm(); return; }
    if (typeof it.person === "number") { showPerson(it.person); document.getElementById("people").scrollIntoView({ behavior: smooth() }); return; }
    if (it.policy) { revealPolicy(it.policy); return; }
    if (it.sport) { revealSport(it.sport); return; }
    if (it.perk) { revealPerk(it.perk); return; }
    if (typeof it.ann === "number") { showAnnouncement(it.ann); return; }
    if (it.href) document.querySelector(it.href).scrollIntoView({ behavior: smooth() });
  }

  searchOpenBtn.addEventListener("click", focusSearch);
  // The ☰ menu carries Search on the narrowest phones, where the capsule drops it
  $$("[data-open-search]").forEach((b) => b.addEventListener("click", () => { closeNav(false); focusSearch(); }));
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !isLocked()) { e.preventDefault(); focusSearch(); }
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
    if (scroll && !ib.open) document.getElementById("attention").scrollIntoView({ behavior: smooth() });
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

  // action: approve | reject | forward. A dialog normally asks first and passes silent
  function quickResolve(row, action, opts = {}) {
    if (!row || row.classList.contains("is-done")) return;
    row.classList.add("is-done");
    row.classList.remove("is-rfi");
    row.dataset.outcome = action;
    if (opts.reason) row.dataset.reason = opts.reason;
    $$(".task__actions button", row).forEach((b) => { b.disabled = true; });
    decrementCount(row.dataset.source);
    if (!opts.silent) toast(`${{ approve: "Approved", reject: "Rejected", forward: "Forwarded" }[action]} and synced to ${sourceNames[row.dataset.source]}`, action === "approve" ? "i-check" : "i-x");
    if (ib.open) renderIb();
  }

  /* ---------------------------------------------------------------
     Drawer (quick links, task review, request details, profile, help)
     --------------------------------------------------------------- */
  const drawer = $("#drawer");
  const drawerTitle = $("#drawer-title");
  const drawerBody = $("#drawer-body");
  let lastFocus = null;

  const SUPPORT_EMAIL = "it@bloomholding.com";
  const supportView = (it) => ({
      title: it ? "Contact IT Support" : "Help & support",
      back: true,
      html: `<div class="sp">
        <h3 class="sp__title">Talk to our <em>support team</em></h3>
        <p class="sp__lead">Feel free to reach out for help with your account or any questions you may have about Bloom Multiverse.</p>
        <a class="sp__mail" href="mailto:${SUPPORT_EMAIL}">${icon("i-mail", "ico ico--sm")}${SUPPORT_EMAIL}</a>
        <form class="sp__form" id="sp-form" novalidate>
          ${it ? `<div class="field">
            <label class="field__label" for="sp-email">Email <span class="sp__req" aria-hidden="true">*</span></label>
            <input class="field__input" id="sp-email" type="email" inputmode="email" autocomplete="off" placeholder="Enter email" required>
            <p class="field__error" id="sp-email-error" role="alert" hidden>Enter a valid email address.</p>
          </div>` : ""}
          <div class="field">
            <label class="field__label" for="sp-text">Tell us how we can help? <span class="sp__req" aria-hidden="true">*</span></label>
            <textarea id="sp-text" rows="6" placeholder="Type here" required></textarea>
          </div>
          <div class="sp__attach">
            <label class="sp__drop" for="sp-file">
              <span class="sp__drop-ico">${icon("i-upload")}</span>
              <span><strong>Add attachment</strong><small>PDF, JPG, PNG or DOC, up to 15 MB each. Max 5 files.</small></span>
            </label>
            <input id="sp-file" class="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
            <p class="field__error" id="sp-error" role="alert" hidden></p>
            <ul class="sp__files" id="sp-files" role="list"></ul>
          </div>
          <div class="d-actions">
            <button class="btn btn--primary" type="submit" id="sp-submit" disabled><span class="btn__label">Submit</span><span class="spinner" aria-hidden="true"></span></button>
            ${it ? "" : `<button class="btn btn--quiet" type="button" data-drawer="help">Browse FAQs</button>`}
          </div>
        </form>
      </div>`
    });


  const SP_MAX = 5, SP_BYTES = 15 * 1024 * 1024, SP_TYPES = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
  // Files stay in this tab's memory until Submit; nothing is stored or sent
  function initSupport() {
    const text = $("#sp-text"), submit = $("#sp-submit"), list = $("#sp-files"), err = $("#sp-error"), input = $("#sp-file");
    let files = [];
    const ext = (f) => f.name.split(".").pop().toLowerCase();
    const email = $("#sp-email"), emailErr = $("#sp-email-error");
    const emailOk = () => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    const sync = () => { submit.disabled = !text.value.trim() || (email && !email.value.trim()); };
    const paint = () => {
      list.innerHTML = files.map((f, i) => `<li class="sp-file"><span class="sp-file__ico sp-file__ico--${ext(f) === "jpeg" ? "jpg" : ext(f) === "docx" ? "doc" : ext(f)}">${icon("i-doc")}<b>${ext(f).replace("jpeg", "jpg").replace("docx", "doc").toUpperCase()}</b></span><span class="sp-file__name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><button class="sp-file__x" type="button" data-i="${i}" aria-label="Remove ${escapeHtml(f.name)}">${icon("i-x", "ico ico--sm")}</button></li>`).join("");
    };
    text.addEventListener("input", sync);
    if (email) {
      email.addEventListener("input", () => { sync(); if (email.getAttribute("aria-invalid")) { const ok = emailOk(); email.toggleAttribute("aria-invalid", !ok); emailErr.hidden = ok; } });
      email.addEventListener("blur", () => { if (!email.value.trim()) return; const ok = emailOk(); ok ? email.removeAttribute("aria-invalid") : email.setAttribute("aria-invalid", "true"); emailErr.hidden = ok; });
    }
    input.addEventListener("change", () => {
      const problems = [];
      [...input.files].forEach((f) => {
        if (!SP_TYPES.includes(ext(f))) problems.push(`${f.name} isn’t a PDF, JPG, PNG or DOC file.`);
        else if (f.size > SP_BYTES) problems.push(`${f.name} is over 15 MB.`);
        else if (files.length >= SP_MAX) { if (!problems.some((p) => p.includes("5 files"))) problems.push("You can add up to 5 files."); }
        else files.push(f);
      });
      input.value = "";
      err.hidden = !problems.length; err.textContent = problems.join(" ");
      paint();
    });
    list.addEventListener("click", (e) => {
      const x = e.target.closest(".sp-file__x");
      if (!x) return;
      files.splice(+x.dataset.i, 1); err.hidden = true; paint();
      $(".sp__drop").focus?.();
    });
    $("#sp-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!text.value.trim() || submit.classList.contains("is-loading")) return;
      if (!emailOk()) { email.setAttribute("aria-invalid", "true"); emailErr.hidden = false; email.focus(); return; }
      submit.classList.add("is-loading"); submit.disabled = true;
      $(".btn__label", submit).textContent = "Submitting";
      setTimeout(() => {
        // Nothing is sent. Offline stands in for a failed request, and the form keeps what was typed
        if (!navigator.onLine) {
          submit.classList.remove("is-loading"); submit.disabled = false; $(".btn__label", submit).textContent = "Submit";
          err.hidden = false; err.textContent = "Something went wrong. Check your connection and try again.";
          toast("Something went wrong", "i-x");
          return;
        }
        closeDrawer(); toast("Your request has been submitted successfully", "i-check");
      }, 900);
    });
    setTimeout(() => (email || text).focus(), 80);
  }

  // ---- request detail view: card, information, history, attachments, Take action ----
  const TASK_INFO = {
    "Discount approval": { name: "Discount Approval", by: "Layla Hassan", role: "Account Executive, Sales", main: [["Account", "Al Noor Trading"], ["Opportunity", "Renewal FY27"], ["List price", "AED 480,000"], ["Discount", "12%"], ["Net amount", "AED 422,400"]], more: [["Contract term", "24 months"], ["Payment terms", "Net 45"], ["Approval limit", "10%, needs a second approver"]] },
    "Exception review": { name: "Exception Review", by: "Finance automation", role: "UiPath, Invoice Matcher", main: [["Process", "Invoice Matcher"], ["Paused exceptions", "3"], ["Queue", "Finance-AP"], ["Paused since", "04:10 today"]], more: [["Robot", "BOT-FIN-07"], ["Failure reason", "Vendor not found"], ["Batch", "INV-2026-0914"]] },
    "Purchase requisition": { name: "Purchase Requisition", by: "Omar Haddad", role: "Procurement Lead", main: [["Requisition", "PR-40821"], ["Plant", "Mussafah"], ["Material", "Site equipment"], ["Value", "AED 86,400"]], more: [["Cost centre", "CC-2210"], ["Delivery date", "30 Oct 2026"], ["Vendor", "Mussafah Steel Trading"]] },
    "Onboarding checklist": { name: "Onboarding Checklist", by: "Projects Affairs team", role: "People & Culture", main: [["Employee", "Abdulazeez Aladwan"], ["Joining date", "1 Oct 2026"], ["Department", "Projects Affairs"], ["Checklist", "7 of 9 done"]], more: [["Manager", "Mathew Raymond"], ["Location", "Abu Dhabi"], ["Open items", "Laptop, building access"]] },
    "Forecast review": { name: "Forecast Review", by: "Sales Operations", role: "Shared the forecast", main: [["Quarter", "Q3"], ["Pipeline", "AED 12.4M"], ["Commit", "AED 4.1M"], ["Review call", "Thursday"]], more: [["Best case", "AED 6.8M"], ["Deals at risk", "5"], ["Coverage", "3.0x"]] },
    "Document validation": { name: "Document Validation", by: "Document Understanding", role: "UiPath", main: [["Contracts", "12"], ["Fields extracted", "148"], ["Low confidence", "9"], ["Queue", "Contracts-DU"]], more: [["Oldest item", "2 days"], ["Reviewer group", "Legal Ops"]] },
    "Travel request": { name: "Travel Request", by: "Mathew Raymond", role: "Director, Projects", main: [["Traveller", "Mathew Raymond"], ["Route", "Abu Dhabi to London"], ["Dates", "12 to 16 Oct 2026"], ["Estimated cost", "AED 6,200"]], more: [["Purpose", "Supplier site visit"], ["Class", "Economy"], ["Hotel", "3 nights"]] },
    "Goods receipt": { name: "Goods Receipt", by: "Warehouse team", role: "SAP", main: [["Goods receipt", "GR-11093"], ["Purchase order", "PO-4500112"], ["Warehouse", "Mussafah"], ["Items", "14"]], more: [["Received on", "22 Sep 2026"], ["Vendor", "Gulf Civil Works LLC"], ["Variance", "None"]] },
    "Opportunity update": { name: "Opportunity Update", by: "Salesforce", role: "Sales Operations", main: [["Opportunities", "4 stalled"], ["Oldest close date", "14 Aug 2026"], ["Owner team", "Sales"], ["Stage", "Negotiation"]], more: [["Value at stake", "AED 1.9M"], ["Last activity", "31 days ago"]] }
  };
  const DV_PILLS = { progress: ["ib-status--review", "i-clock", "In-Progress"], rfi: ["ib-status--rfi", "i-info", "RFI"], returned: ["ib-status--returned", "i-return", "Returned"], approved: ["ib-status--approved", "i-check", "Approved"], rejected: ["ib-status--rejected", "i-x", "Rejected"], withdrawn: ["ib-status--withdrawn", "i-return", "Withdrawn"], forwarded: ["ib-status--forwarded", "i-forward", "Forwarded"], draft: ["ib-status--forwarded", "i-edit", "Draft"] };
  const dvPill = (k) => { const p = DV_PILLS[k] || DV_PILLS.progress; return `<span class="ib-status ${p[0]}">${icon(p[1], "ico ico--xs")}${p[2]}</span>`; };
  const HIST = { approved: ["i-check", "Approved"], current: ["i-clock", "In-Progress"], rfi: ["i-info", "RFI"], returned: ["i-return", "Returned"], rejected: ["i-x", "Rejected"], awaiting: ["i-user", "Awaiting"] };
  const dvInitials = (n) => n.replace(/\(.*\)/, "").trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  function dvHTML(o) {
    const kv = (rows) => rows.map(([k, v]) => `<div class="dv__kv"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const rich = o.textHtml ? cleanHtml(o.textHtml) : o.text ? `<p>${escapeHtml(o.text)}</p>` : "";
    return `<div class="dv">
      <div class="dv__col">
        <section class="dv__card dv__card--head" aria-label="Request"><div class="dv__top"><span class="dv__ref">${escapeHtml(o.ref)}</span><span class="dv__ago">${escapeHtml(o.ago)}</span></div>
          <h3 class="dv__h">${escapeHtml(o.heading)}</h3>
          <div class="dv__who">${o.who ? `<span class="who__av" aria-hidden="true">${escapeHtml(dvInitials(o.who))}</span><span class="who__txt"><b>${escapeHtml(o.who)}</b><small>${escapeHtml(o.role || "")}</small></span>` : "<span></span>"}<span class="dv__lead">${o.lead || ""}</span></div></section>
        ${o.rfi ? `<p class="d-note">${icon("i-info", "ico ico--sm")}<b>${escapeHtml(o.rfi.from)}</b> asked for more information: ${escapeHtml(o.rfi.subject)}.</p>` : ""}
        ${o.note ? `<p class="d-note">${escapeHtml(o.note)}</p>` : ""}
        ${o.parallel ? `<p class="d-note">${icon("i-info", "ico ico--sm")}All approvers were notified at the same time.</p>` : ""}
        <section class="dv__card" aria-label="Request information"><h3 class="dv__sec">${icon("i-doc", "ico ico--sm")}Request information</h3>
          <dl class="dv__list">${kv(o.main)}</dl>
          ${o.more && o.more.length ? `<dl class="dv__list dv__more" hidden>${kv(o.more)}</dl><button class="dv__toggle" type="button" data-dv-more aria-expanded="false">${icon("i-chevron-down", "ico ico--sm")}<span>Show more detail</span></button>` : ""}</section>
        ${rich ? `<section class="dv__card" aria-label="Business justification"><h3 class="dv__sec">${icon("i-edit", "ico ico--sm")}Business justification</h3><div class="dv__rich">${rich}</div></section>` : ""}
      </div>
      <aside class="dv__col"><section class="dv__card" aria-label="Approval history"><h3 class="dv__sec">${icon("i-check", "ico ico--sm")}Approval history</h3>
        ${o.history && o.history.length ? `<ol class="hist">${o.history.map((h) => { const s = HIST[h.state] || HIST.awaiting; return `<li class="hist__it hist__it--${h.state}"><span class="hist__dot" aria-hidden="true">${icon(s[0], "ico ico--xs")}</span><div><p class="hist__n"><b>${escapeHtml(h.name)}</b>${h.comment ? `<span class="hist__c" title="${escapeHtml(h.comment)}" aria-label="Comment: ${escapeHtml(h.comment)}">${icon("i-info", "ico ico--xs")}</span>` : ""}</p><p class="hist__s">${escapeHtml(h.note || s[1])}</p>${h.tags ? `<p class="hist__t">${escapeHtml(h.tags)}</p>` : ""}${h.when ? `<p class="hist__w">${escapeHtml(h.when)}</p>` : ""}</div></li>`; }).join("")}</ol>` : `<p class="dv__empty">Approvers are added when the request is submitted.</p>`}</section></aside>
      <section class="dv__card dv__wide" aria-label="Attachments"><h3 class="dv__sec">${icon("i-upload", "ico ico--sm")}Attachment</h3>
        ${o.files && o.files.length ? `<div class="dvf__head" aria-hidden="true"><span>File name</span><span>Uploaded by</span><span>Date &amp; time</span><span>Action</span></div><ul class="dvf__list">${o.files.map((f, i) => `<li class="dvf__row"><span class="dvf__name" data-label="File name">${escapeHtml(f.name)}</span><span data-label="Uploaded by">${escapeHtml(f.by)}</span><span data-label="Date &amp; time">${escapeHtml(f.when)}</span><span class="dvf__act"><button class="att__btn att__btn--view" type="button" data-dv-view="${i}" aria-label="View ${escapeHtml(f.name)}">${icon("i-eye", "ico ico--sm")}</button></span></li>`).join("")}</ul>` : `<p class="dv__empty">No attachments.</p>`}</section>
    </div>`;
  }
  const taHTML = (acts) => `<div class="ta"><div class="ta__menu" id="ta-menu" role="menu" hidden>${acts.map(([k, l, i]) => `<button class="ta__opt ta__opt--${k}" type="button" role="menuitem" data-task-act="${k}">${icon(i, "ico ico--sm")}${l}</button>`).join("")}</div><button class="btn btn--primary ta__btn" id="ta-btn" type="button" aria-haspopup="menu" aria-expanded="false">${icon("i-bolt", "ico ico--sm")}Take action</button></div>`;
  // what a request shows under "Request information", from what was typed in the form
  function reqFacts(x) {
    const d = x.data || {}, main = [], more = [];
    const add = (a, k, v) => { if (v) a.push([k, escapeHtml(String(v))]); };
    if (x.type === "tcdf") {
      add(main, "Category", d.category); add(main, "Sub category", d.sub); add(main, "Reference value", d.ref); add(main, "Project", d.project); add(main, "Vendor name", d.vendor);
      add(more, "WBS code", d.wbs); add(more, "Amount", fmtMoney(d.cur, d.amount)); add(more, "In approved budget", d.budget); add(more, "Budget/MCR line reference no.", d.budgetRef);
    } else if (x.type === "rfp") {
      add(main, "Project name", d.project); add(main, "Department", d.dept); add(main, "Received date", fmtDay(d.received)); add(main, "Due date", fmtDay(d.due)); add(main, "PO number", d.po);
      add(more, "Vendor invoice number", d.invoice); add(more, "Payment project", d.payProject); add(more, "Stakeholder name", d.stakeholder); add(more, "Stakeholder type", d.stype); add(more, "Amount", fmtMoney(d.cur, d.amount));
      if (d.lines && d.lines.some((l) => l.item)) more.push(["Line items", d.lines.filter((l) => l.item).map((l) => `${escapeHtml(l.item)} · ${escapeHtml(fmtMoney(l.cur, l.amount))}`).join("<br>")]);
    } else { add(main, "Company", x.company); add(main, "Department", x.dept); }
    if (!main.length) { add(main, "Company", x.company); add(main, "Department", x.dept); }
    if (x.approvers && x.approvers.length) add(more, "Approval", x.parallel ? "All approvers at once" : "One after another");
    return { main, more };
  }

  const drawerPanel = $(".drawer__panel");
  const drawerMeta = $("#drawer-meta");
  const drawerFoot = $("#drawer-foot");
  const drawerBack = $(".drawer__back");
  const drawerClose = $(".drawer__close");

  const drawerViews = {
    links: () => ({
      title: "Quick links",
      back: true,
      html: `<ul class="ql-list" role="list">${QUICK_LINKS.map((l) =>
        `<li><a class="ql-card" ${qlLink(l)} style="--brand: ${l.brand}">${qlMark(l)}<span class="ql-card__text"><strong class="ql-card__name">${l.name}</strong><span class="ql-card__desc">${escapeHtml(l.desc)}</span></span>${icon("i-external", "ico ql-card__ext")}</a></li>`).join("")}</ul>`
    }),
    support: () => supportView(false),
    itsupport: () => supportView(true),
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
        <div class="d-actions"><button class="btn btn--primary" type="button" data-drawer="support">Contact support</button><button class="btn btn--quiet" type="button" data-toast="Opening the help centre…">Visit help centre</button></div>`
    }),
    task: (row) => {
      const src = row.dataset.source, idx = taskRows().indexOf(row);
      const info = TASK_INFO[row.dataset.rtype] || { name: "Approval", by: "", role: "", main: [], more: [] };
      const rfiFrom = row.dataset.rfiFrom;
      const state = row.classList.contains("is-rfi") ? "rfi" : "current";
      const history = [
        { name: "Fatima Al Zaabi", state: "approved", when: "12 Jun 2026" },
        { name: "Omar Khalil", state: "approved", when: "16 Jun 2026", comment: "Checked against the approved limit." },
        { name: "Rashid Khan (you)", state, when: "19 Jun 2026", note: state === "rfi" ? (rfiFrom ? "RFI to (You)" : "RFI sent") : "In-Progress" },
        { name: "Sarah Mitchell", state: "awaiting" }
      ];
      const acts = [["approve", "Approve", "i-check"], ["reject", "Reject", "i-x"], ...(rfiFrom ? [] : [["rfi", "RFI", "i-info"]]), ["forward", "Forward", "i-forward"]];
      return {
        title: info.name, wide: true,
        meta: `${dvPill(state === "rfi" ? "rfi" : "progress")}<span class="dv__created">Created 12 Jan 2024</span>`,
        html: dvHTML({
          ref: `REQ-${1041 + idx}`, ago: `${(idx + 1) * 15} mins ago`, heading: $(".task__title", row).textContent, who: info.by, role: info.role,
          lead: `<span class="app-mark app-mark--lg app-mark--${sourceMarks[src]}" aria-hidden="true">${src === "sap" ? "SAP" : sourceNames[src].slice(0, 2)}</span>`,
          main: info.main, more: info.more, history,
          files: [{ name: "Internal Information Notice.doc", by: info.by || "Requester", when: "30 Jun 2026 | 12:30 PM" }],
          rfi: rfiFrom ? { from: rfiFrom, subject: row.dataset.rfiSubject } : null
        }),
        foot: rfiFrom
          ? `<button class="btn btn--primary" type="button" data-task-act="respond">${icon("i-info", "ico ico--sm")}Respond to RFI</button>${taHTML(acts)}`
          : taHTML(acts)
      };
    },
    assigned: (x) => ({
      title: "Request details",
      html: `<div class="d-task__row"><span class="app-mark app-mark--lg app-mark--${sourceMarks[x.app]}">${x.app === "sap" ? "SAP" : sourceNames[x.app].slice(0, 2)}</span><span class="tag">${sourceNames[x.app]}</span>${ibStatusPill(x)}</div>
        <p class="d-task__title">${escapeHtml(x.title)}</p>
        <dl class="d-facts"><div><dt>Request type</dt><dd>${escapeHtml(x.rtype || "Approval")}</dd></div><div><dt>Closed</dt><dd>${escapeHtml(x.closed)}</dd></div></dl>
        ${x.reason ? `<h3 class="d-faq__label">Reason for rejection</h3><p class="d-note">${escapeHtml(x.reason)}</p>` : ""}
        <div class="d-actions"><button class="btn btn--quiet" type="button" data-close-drawer-inline>Close</button></div>`
    }),
    request: (x) => {
      const t = IB_TYPES[x.type];
      const steps = x.steps || [];
      const facts = reqFacts(x);
      const label = (REQUEST_TYPES.find((d) => d.key === x.type) || {}).short || t.label;
      const hist = steps.map((who, i) => {
        const tags = ((x.checks || {})[who] || []).join(", ");
        if (x.state === "history") return { tags, name: who, state: x.outcome === "approved" || i < steps.length - 1 && x.outcome === "rejected" ? "approved" : x.outcome === "rejected" ? "rejected" : "awaiting", when: i === 0 || x.outcome === "approved" ? x.closed : "" };
        const done = i + 1 < x.step, cur = i + 1 === x.step;
        return { tags, name: who, state: done ? "approved" : cur ? (x.status === "returned" ? "returned" : x.status === "rfi" ? "rfi" : x.parallel ? "current" : "current") : x.parallel ? "current" : "awaiting", when: done ? "" : cur || x.parallel ? "" : "Awaiting", note: cur && x.status === "rfi" ? "RFI to (You)" : "" };
      });
      const status = x.state === "history" ? x.outcome : x.state === "draft" ? "draft" : x.status === "returned" ? "returned" : x.status === "rfi" ? "rfi" : "progress";
      const mine = x.state === "mine";
      return {
        title: label, wide: true,
        meta: `${dvPill(status)}<span class="dv__created">${x.state === "draft" ? "Last edited" : x.state === "history" ? "Closed" : "Created"} ${x.state === "history" ? x.closed : ibAgo(x.ago)}</span>`,
        html: dvHTML({
          ref: x.ref, ago: x.state === "history" ? `Closed ${x.closed}` : ibAgo(x.ago), heading: x.title, who: "Rashid Khan", role: "Sr. Engineer, Digital Platforms",
          lead: `<span class="ib-row__icon" style="--c: var(--viz-${t.slot})">${icon("i-doc")}</span>`,
          main: facts.main, more: facts.more, text: x.details, textHtml: x.detailsHtml, history: hist, note: x.note,
          parallel: x.parallel, files: (x.files || []).map((f) => ({ name: `${f.name}.${f.ext || ""}`.replace(/\.$/, ""), by: "You", when: f.when })),
          rfi: x.status === "rfi" && x.rfi ? { from: x.rfi.from, subject: x.rfi.subject } : null
        }),
        foot: mine && x.status === "rfi" ? `<button class="btn btn--primary" type="button" data-ib-drawer="respond" data-id="${x.id}">${icon("i-info", "ico ico--sm")}Respond to ${escapeHtml(x.rfi.from.split(" ")[0])}</button>`
          : mine && x.status === "review" ? `<button class="btn btn--primary" type="button" data-ib-drawer="remind" data-id="${x.id}">${icon("i-bellring", "ico ico--sm")}Remind ${x.parallel ? "approvers" : escapeHtml(steps[x.step - 1] || "approver")}</button>` : ""
      };
    }
  };

  let drawerCtx = null;
  function openDrawer(type, ctx) {
    const wasOpen = drawer.classList.contains("is-open");
    drawerCtx = ctx;
    const view = drawerViews[type](ctx);
    if (!wasOpen) lastFocus = document.activeElement;
    drawerTitle.textContent = view.title;
    drawerBody.innerHTML = view.html;
    drawerBody.scrollTop = 0;
    drawerPanel.classList.toggle("is-wide", !!view.wide);
    drawerMeta.innerHTML = view.meta || "";
    drawerFoot.hidden = !view.foot;
    drawerFoot.innerHTML = view.foot || "";
    // A list you step into (Quick links) goes back with a chevron; the rest close with ×
    drawerBack.hidden = !view.back;
    drawerClose.hidden = !!view.back;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    body.style.overflow = "hidden";
    closeMenus();
    closeNav(false);
    closeSearch();
    hideTip();
    setTimeout(() => { if (type !== "support" && type !== "itsupport") (view.back ? drawerBack : drawerClose).focus(); }, 60);

    if (type === "support" || type === "itsupport") initSupport();
  }
  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (!body.classList.contains("menu-open") && !ib.open && !gpt.open) body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-drawer]");
    if (opener) { e.preventDefault(); openDrawer(opener.dataset.drawer); }
    const review = e.target.closest("[data-task]");
    if (review && !review.disabled) openDrawer("task", review.closest(".task"));
    const approveBtn = e.target.closest("[data-approve]");
    if (approveBtn && !approveBtn.disabled) confirmApprove([approveBtn.closest(".task")]);
    const rejectBtn = e.target.closest("[data-reject]");
    if (rejectBtn && !rejectBtn.disabled) confirmReject(rejectBtn.closest(".task"));
    const rfiBtn = e.target.closest("[data-rfi-update]");
    if (rfiBtn) openRfi(rfiBtn.closest(".task"));
  });
  $$("[data-close-drawer]").forEach((el) => el.addEventListener("click", closeDrawer));
  drawerPanel.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-drawer-inline]")) { closeDrawer(); return; }
    const b = e.target.closest('[data-ib-drawer="remind"]');
    if (b) { const x = ibFind(b.dataset.id); closeDrawer(); if (x) ibRemind(x); }
    const r = e.target.closest('[data-ib-drawer="respond"]');
    if (r) { const x = ibFind(r.dataset.id); closeDrawer(); if (x) openRespond(x); }
    const more = e.target.closest("[data-dv-more]");
    if (more) {
      const list = more.previousElementSibling, open = list.hidden;
      list.hidden = !open; more.setAttribute("aria-expanded", String(open)); $("span", more).textContent = open ? "Show less detail" : "Show more detail";
    }
    const v = e.target.closest("[data-dv-view]");
    if (v) toast("File previews aren’t part of the prototype", "i-info");
    const ta = e.target.closest("#ta-btn");
    if (ta) { const m = $("#ta-menu"), open = m.hidden; m.hidden = !open; ta.setAttribute("aria-expanded", String(open)); if (open) $("button", m).focus(); return; }
    const t = e.target.closest("[data-task-act]");
    if (t && drawerCtx) {
      const row = drawerCtx, act = t.dataset.taskAct;
      closeDrawer();
      ({ approve: (r2) => confirmApprove([r2]), reject: confirmReject, rfi: openRfi, forward: openForward, respond: openRfi })[act](row);
    }
  });
  document.addEventListener("click", (e) => { const m = $("#ta-menu"); if (m && !m.hidden && !e.target.closest(".ta")) { m.hidden = true; $("#ta-btn").setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.target.closest?.("dialog")) return; // dialogs close themselves
    const ta = $("#ta-menu");
    if (ta && !ta.hidden) { ta.hidden = true; $("#ta-btn").setAttribute("aria-expanded", "false"); $("#ta-btn").focus(); return; }
    if (isLocked()) return; // the login has no way around it
    if (drawer.classList.contains("is-open")) { closeDrawer(); return; }
    if (ibPopClose()) return;
    if (menus.some((m) => m.classList.contains("is-open"))) { closeMenus(); return; }
    if (gpt.open) { closeGpt(); return; }
    if (ib.open) { closeInbox(); return; }
    closeNav();
  });

  /* ---------------------------------------------------------------
     Inbox — the requests workspace (Bloom@Go)
     Inbox:        what is waiting on you from the connected apps. These
                   are the Attention rows, so both views stay in sync.
     Draft / My requests / History: your own requests.
     Search, filter and sort apply to the tab in view. The summary card
     and the chart describe that tab; picking a slice filters the list.
     --------------------------------------------------------------- */
  const IB_TYPES = {
    tcdf: { label: "TCDF", slot: 1 },
    memo: { label: "Internal Memo", slot: 2 },
    rfp: { label: "RFP", slot: 3 }
  };
  const IB_TABS = {
    inbox: { name: "Inbox", icon: "i-inbox", stat: "Waiting on you", chart: "Waiting by app", unit: "waiting" },
    draft: { name: "Draft", icon: "i-edit", stat: "Drafts", chart: "Drafts by type", unit: "drafts" },
    mine: { name: "My requests", icon: "i-send", stat: "In progress", chart: "In progress by type", unit: "in progress" },
    history: { name: "History", icon: "i-archive", stat: "Closed", chart: "Closed by type", unit: "closed" }
  };
  const IB_SORTS = { inbox: [["urgent", "Most urgent"], ["az", "A–Z"]], other: [["new", "Newest"], ["old", "Oldest"], ["az", "A–Z"]] };
  const IB_STATUS = {
    mine: [["review", "In progress"], ["rfi", "RFI"], ["returned", "Returned"]],
    history: [["approved", "Approved"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"], ["forwarded", "Forwarded"]]
  };
  // Everything that can be created from Bloom. The first three are Bloom's own
  // workflows (drafts, approval route, tracking); the rest are created here but
  // handled in their connected app, so they are tracked there.
  const REQUEST_TYPES = [
    { key: "tcdf", label: "TCDF (Tender Committee Decision Form)", short: "TCDF", own: true },
    { key: "memo", label: "Internal Memo", short: "Internal Memo", own: true },
    { key: "rfp", label: "Request for Payment (RFP)", short: "RFP", own: true },
    ...[["Leave", "darwinbox"], ["Out of Duty", "darwinbox"], ["Attendance Adjustment", "darwinbox"], ["Work From Home", "darwinbox"],
      ["Broker Commission Approval Workflow", "salesforce"], ["Resale Approval Process", "salesforce"], ["Sale Order Cancellation", "salesforce"], ["Payment Deferral", "salesforce"],
      ["Leasing Tenant Document Review", "salesforce"], ["Leasing Offer Approval", "salesforce"],
      ["ADCB Batch Approval Process Workflow", "sap"], ["Requisition Request (PR) Workflow", "sap"], ["Purchase Order (PO) Workflow", "sap"], ["Service Entry Sheet (SES) Workflow", "sap"],
      ["ADCB Approval Matrix Workflow", "sap"], ["Material Reservation Workflow", "sap"], ["MuleSoft Credential Store Workflow", "uipath"]
    ].map(([label, app]) => ({ key: label.toLowerCase().replace(/[^a-z]+/g, "-"), label, short: label, app }))
  ];
  const COMPANIES = ["Bloom Holding", "Bloom Hospitality", "Bloom Properties"];
  const DEPARTMENTS = ["Engineering", "Product", "UI/UX Design", "QA", "DevOps", "Human Resources", "Finance"];
  const PEOPLE = [
    { name: "Taruna Sharma", role: "Senior Manager Digital Products - IT" },
    { name: "Ankur Kushwaha", role: "Project manager - IT" },
    { name: "Ritika Dalmia", role: "BA Lead - IT" },
    { name: "Vishwesh Bhardwaj", role: "Technical Architect - IT" }
  ].map((p) => ({ ...p, email: `${p.name.toLowerCase().replace(/ /g, ".")}@bloomholding.com`, initials: p.name.split(" ").map((w) => w[0]).join("") }));
  const APP_ORDER = ["salesforce", "uipath", "darwinbox", "sap"];
  const ROUTE = { tcdf: ["Mathew Raymond", "Omar Haddad", "Finance"], memo: ["Mathew Raymond", "Mariam Al Hashimi"], rfp: ["Mathew Raymond", "Omar Haddad", "Finance"] };
  let ibSeq = 0;
  let ibRef = 2640;
  const rq = (o) => ({ id: `rq${++ibSeq}`, ref: `BG-${++ibRef}`, details: "", ...o });
  const ib = {
    open: false, tab: "inbox", q: "", type: "all", sort: "urgent", returnFocus: null, fresh: null, focusKey: null,
    rtypes: new Set(), status: "all", scope: "raised", sel: new Set(),
    items: [
      // drafts — "ago" is minutes since the last edit
      rq({ state: "draft", type: "tcdf", title: "Annual Service Agreement – Project Alpha", ago: 7200 }),
      rq({ state: "draft", type: "memo", title: "Request for Budget Approval – Marketing Campaign", ago: 10080 }),
      rq({ state: "draft", type: "rfp", title: "Payment Request – Annual Software License", ago: 15 }),
      rq({ state: "draft", type: "tcdf", title: "Vendor Onboarding – Site Equipment Supplier", ago: 2880 }),
      rq({ state: "draft", type: "tcdf", title: "Consultancy Agreement – Digital Platforms Audit", ago: 4320 }),
      rq({ state: "draft", type: "memo", title: "Office Relocation Notice – Mussafah Warehouse", ago: 20160 }),
      rq({ state: "draft", type: "tcdf", title: "Framework Agreement – Facilities Maintenance", ago: 30240 }),
      rq({ state: "draft", type: "tcdf", title: "Licence Renewal – Design Tools", ago: 43200 }),
      // in progress
      rq({ state: "mine", type: "tcdf", title: "Master Services Agreement – Abu Dhabi Edition Events", ago: 2880, status: "review", step: 2, steps: ROUTE.tcdf }),
      rq({ state: "mine", type: "rfp", title: "Cloud Hosting Services – Tender", ago: 4320, status: "review", step: 3, steps: ROUTE.rfp }),
      rq({ state: "mine", type: "memo", title: "Budget Reallocation – Q4 Digital Initiatives", ago: 5760, status: "review", step: 1, steps: ROUTE.memo }),
      rq({ state: "mine", type: "tcdf", title: "Supply Agreement – Petromal Fleet Fuel", ago: 10080, status: "returned", step: 2, steps: ["Mathew Raymond", "Legal", "Finance"], note: "Legal sent this back: attach the signed quote, then resubmit." }),
      rq({ state: "mine", type: "tcdf", title: "Consultancy Agreement – Marine Survey Partner", ago: 1440, status: "rfi", step: 2, steps: ROUTE.tcdf, rfi: { from: "Ankur Kushwaha", subject: "Need the SOW document" } }),
      // closed
      rq({ state: "history", type: "tcdf", title: "Service Agreement – Marriott Hotel Downtown Offsite", ago: 16000, closed: "12 Sep 2026", outcome: "approved", steps: ROUTE.tcdf }),
      rq({ state: "history", type: "memo", title: "Updated Travel Policy Rollout", ago: 20000, closed: "9 Sep 2026", outcome: "approved", steps: ROUTE.memo }),
      rq({ state: "history", type: "tcdf", title: "Equipment Lease – Survey Drones", ago: 30000, closed: "2 Sep 2026", outcome: "rejected", steps: ROUTE.tcdf }),
      rq({ state: "history", type: "tcdf", title: "Training Services – Brand Guidelines Workshop", ago: 37000, closed: "28 Aug 2026", outcome: "approved", steps: ROUTE.tcdf }),
      rq({ state: "history", type: "rfp", title: "Catering Services – Annual Town Hall", ago: 47000, closed: "21 Aug 2026", outcome: "withdrawn", steps: ROUTE.rfp }),
      rq({ state: "history", type: "tcdf", title: "Consultancy Agreement – Data Security Review", ago: 57000, closed: "14 Aug 2026", outcome: "approved", steps: ROUTE.tcdf }),
      // closed requests that were assigned to you — approving or rejecting an Inbox row adds to these
      rq({ state: "history", scope: "assigned", app: "darwinbox", rtype: "Leave", title: "Annual Leave Request – 3 Aug to 7 Aug", ago: 9000, closed: "5 Oct 2026", outcome: "approved" }),
      rq({ state: "history", scope: "assigned", app: "sap", rtype: "Purchase order", title: "Purchase Order Request for Vendor Payment – BluePeak Systems", ago: 14000, closed: "1 Oct 2026", outcome: "rejected", reason: "The vendor’s quote has expired. Please attach a current one." }),
      rq({ state: "history", scope: "assigned", app: "salesforce", rtype: "Sale order cancellation", title: "Sale Order Cancellation – Al Noor Trading", ago: 21000, closed: "24 Sep 2026", outcome: "approved" }),
      rq({ state: "history", scope: "assigned", app: "uipath", rtype: "Exception review", title: "Invoice exceptions – vendor contracts batch", ago: 33000, closed: "15 Sep 2026", outcome: "approved" })
    ]
  };
  const inboxEl = $("#inbox-page");
  const ibTabs = $("#ib-tabs");
  const ibList = $("#ib-list");
  const ibPlot = $("#ib-plot");
  const ibLegend = $("#ib-legend");
  const ibSearch = $("#ib-search");
  const ibTypeChips = $("#ib-type-chips");
  const ibSortChips = $("#ib-sort-chips");
  const ibStatNum = $("#ib-stat-num");
  const ibFind = (id) => ib.items.find((x) => x.id === id);

  function ibAgo(m) {
    if (m < 1) return "just now";
    if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
    if (m < 1440) { const h = Math.round(m / 60); return `${h} hour${h === 1 ? "" : "s"} ago`; }
    if (m < 10080) { const d = Math.round(m / 1440); return `${d} day${d === 1 ? "" : "s"} ago`; }
    if (m < 43200) { const w = Math.round(m / 10080); return `${w} week${w === 1 ? "" : "s"} ago`; }
    const mo = Math.round(m / 43200); return `${mo} month${mo === 1 ? "" : "s"} ago`;
  }
  const IB_OUT = { approved: ["i-check", "Approved"], rejected: ["i-x", "Rejected"], withdrawn: ["i-return", "Withdrawn"], forwarded: ["i-forward", "Forwarded"] };
  function ibStatusPill(x, asButton = false) {
    if (x.state === "mine") {
      if (x.status === "returned") return `<span class="ib-status ib-status--returned">${icon("i-return", "ico ico--xs")}Returned</span>`;
      if (x.status === "rfi") return asButton
        ? `<button class="ib-status ib-status--rfi" type="button" data-ib="respond" title="${escapeHtml(x.rfi.from)} asked for more information">${icon("i-info", "ico ico--xs")}RFI</button>`
        : `<span class="ib-status ib-status--rfi">${icon("i-info", "ico ico--xs")}RFI</span>`;
      return `<span class="ib-status ib-status--review">${icon("i-clock", "ico ico--xs")}In progress</span>`;
    }
    if (x.state === "history") { const o = IB_OUT[x.outcome]; return `<span class="ib-status ib-status--${x.outcome}">${icon(o[0], "ico ico--xs")}${o[1]}</span>`; }
    return "";
  }

  // Inbox rows come straight from the Attention list
  function ibTasks() {
    return taskRows().map((row, i) => ({
      id: `task-${i}`, kind: "task", row, key: row.dataset.source, order: i, rtype: row.dataset.rtype || "",
      title: $(".task__title", row).textContent, detail: $(".task__meta span", row).textContent,
      done: row.classList.contains("is-done"), outcome: row.dataset.outcome, rfi: row.classList.contains("is-rfi")
    }));
  }
  const OUTCOME_KEY = { approve: "approved", reject: "rejected", forward: "forwarded" };
  // What you have acted on: the seeded history plus every Inbox row you approve, reject or forward
  function ibAssigned() {
    const done = ibTasks().filter((x) => x.done).map((x) => ({
      id: x.id, kind: "req", state: "history", scope: "assigned", app: x.key, key: x.key, rtype: x.rtype, title: x.title, ago: 0, closed: "Just now",
      outcome: OUTCOME_KEY[x.outcome] || "approved", reason: x.row.dataset.reason || ""
    }));
    const seeded = ib.items.filter((x) => x.state === "history" && x.scope === "assigned").map((x) => ({ ...x, kind: "req", key: x.app }));
    return [...done, ...seeded];
  }
  const ibRaised = () => ib.items.filter((x) => x.state === "history" && x.scope !== "assigned");
  function ibOf(tab) {
    if (tab === "inbox") return ibTasks();
    if (tab === "history") return ib.scope === "assigned" ? ibAssigned() : ibRaised().map((x) => ({ ...x, kind: "req", key: x.type }));
    return ib.items.filter((x) => x.state === tab).map((x) => ({ ...x, kind: "req", key: x.type }));
  }
  const ibCount = (tab) => tab === "inbox" ? totalPending() : tab === "history" ? ibRaised().length + ibAssigned().length : ib.items.filter((x) => x.state === tab).length;
  const ibKeyLabel = (k) => IB_TYPES[k]?.label || sourceNames[k] || k;
  const ibStatusOf = (x) => x.state === "mine" ? x.status : x.outcome;
  const ibStatusLabel = (k) => ([...IB_STATUS.mine, ...IB_STATUS.history].find(([v]) => v === k) || [])[1] || k;
  const ibSelectable = (x) => x.kind === "task" && !x.done && !x.rfi;

  function ibVisible() {
    let list = ibOf(ib.tab);
    const all = list.length;
    if (ib.type !== "all") list = list.filter((x) => x.key === ib.type);
    if (ib.rtypes.size) list = list.filter((x) => ib.rtypes.has(x.rtype));
    if (ib.status !== "all") list = list.filter((x) => ibStatusOf(x) === ib.status);
    const q = ib.q.trim().toLowerCase();
    if (q) list = list.filter((x) => `${x.title} ${x.detail || ""} ${x.note || ""} ${x.rtype || ""} ${ibKeyLabel(x.key)} ${x.ref || ""}`.toLowerCase().includes(q));
    const by = { urgent: (a, b) => a.order - b.order, new: (a, b) => a.ago - b.ago, old: (a, b) => b.ago - a.ago, az: (a, b) => a.title.localeCompare(b.title) }[ib.sort];
    return { list: list.sort(by), all };
  }

  const ibCheck = (x) => ibSelectable(x)
    ? `<label class="ib-check"><input type="checkbox" data-ib-sel${ib.sel.has(x.id) ? " checked" : ""}><span class="ib-check__box" aria-hidden="true"><svg class="ico ico--xs"><use href="#i-check"/></svg></span><span class="sr-only">Select ${escapeHtml(x.title)}</span></label>`
    : `<span class="ib-check ib-check--off" aria-hidden="true"></span>`;
  function ibRowHTML(x, i, animate) {
    const cls = `ib-row${x.done ? " is-done" : ""}${animate ? " is-in" : ""}${ib.fresh === x.id ? " is-new" : ""}${x.kind === "task" ? " ib-row--sel" : ""}${ib.sel.has(x.id) ? " is-selected" : ""}`;
    const style = animate ? ` style="animation-delay:${Math.min(i, 10) * 45}ms"` : "";
    if (x.kind === "task") {
      const due = $(".due", x.row).outerHTML;
      const o = x.outcome === "reject" ? ["rejected", "i-x", "Rejected"] : x.outcome === "forward" ? ["forwarded", "i-forward", "Forwarded"] : ["approved", "i-check", "Approved"];
      const view = `<button class="ib-act" type="button" data-ib="view">${icon("i-eye", "ico ico--xs")}View</button>`;
      const more = `<button class="task__more" type="button" data-ib="more" aria-haspopup="menu" aria-label="More actions for ${escapeHtml(x.title)}">&#8942;</button>`;
      const side = x.done
        ? `<span class="ib-status ib-status--${o[0]}">${icon(o[1], "ico ico--xs")}${o[2]}</span>${view}`
        : x.rfi
        ? `${due}<div class="task__actions">${view}<button class="ib-act ib-act--rfi" type="button" data-ib="rfi">${icon("i-info", "ico ico--xs")}Update RFI</button>${more}</div>`
        : `${due}<div class="task__actions">${view}<button class="task__approve" type="button" data-ib="approve">${icon("i-check", "ico ico--xs")}Approve</button><button class="task__reject" type="button" data-ib="reject">${icon("i-x", "ico ico--xs")}Reject</button>${more}</div>`;
      return `<li class="${cls}"${style} data-id="${x.id}">${ibCheck(x)}<span class="app-mark app-mark--${sourceMarks[x.key]}">${x.key === "sap" ? "SAP" : sourceNames[x.key].slice(0, 2)}</span>
        <div class="ib-row__body"><p class="ib-row__title">${escapeHtml(x.title)}</p><p class="ib-row__meta"><span>${sourceNames[x.key]}</span>${x.rtype ? `<span>${escapeHtml(x.rtype)}</span>` : ""}<span>${escapeHtml(x.detail)}</span></p></div>
        <div class="ib-row__side">${side}</div></li>`;
    }
    if (x.scope === "assigned") {
      return `<li class="${cls}"${style} data-id="${x.id}"><span class="app-mark app-mark--${sourceMarks[x.app]}">${x.app === "sap" ? "SAP" : sourceNames[x.app].slice(0, 2)}</span>
        <div class="ib-row__body"><p class="ib-row__title">${escapeHtml(x.title)}</p><p class="ib-row__meta"><span>${sourceNames[x.app]}</span><span>${escapeHtml(x.rtype)}</span><span>Closed ${x.closed}</span></p></div>
        <div class="ib-row__side">${ibStatusPill(x)}<button class="ib-act" type="button" data-ib="view">${icon("i-eye", "ico ico--xs")}View</button></div></li>`;
    }
    const t = IB_TYPES[x.type];
    let meta = "";
    let side = "";
    if (x.state === "draft") {
      meta = `<span>${ibAgo(x.ago)}</span>`;
      side = `<button class="ib-act ib-act--edit" type="button" data-ib="edit">${icon("i-edit", "ico ico--xs")}Edit</button><button class="ib-act ib-act--delete" type="button" data-ib="delete" aria-label="Delete draft ${escapeHtml(x.title)}">${icon("i-trash", "ico ico--xs")}Delete</button>`;
    } else if (x.state === "mine") {
      const bars = x.steps.map((_, s) => `<i class="${s + 1 < x.step ? "is-done" : x.parallel || s + 1 === x.step ? (x.status === "returned" ? "is-returned" : x.status === "rfi" ? "is-rfi" : "is-current") : ""}"></i>`).join("");
      const where = x.status === "returned" ? "Back with you" : x.status === "rfi" ? `${escapeHtml(x.rfi.from)} needs more information` : x.parallel ? "With all approvers" : `With ${escapeHtml(x.steps[x.step - 1])}`;
      meta = `<span>Submitted ${ibAgo(x.ago)}</span><span><span class="ib-steps" aria-hidden="true">${bars}</span>Step ${x.step} of ${x.steps.length} · ${where}</span>`;
      side = `${ibStatusPill(x, true)}<button class="ib-act" type="button" data-ib="view">${icon("i-eye", "ico ico--xs")}View</button>` + (x.status === "returned"
        ? `<button class="ib-act ib-act--edit" type="button" data-ib="revise">${icon("i-edit", "ico ico--xs")}Revise</button>`
        : x.status === "rfi" ? "" : `<button class="ib-act" type="button" data-ib="remind"${x.reminded ? " disabled" : ""}>${icon("i-bellring", "ico ico--xs")}${x.reminded ? "Reminded" : "Remind"}</button>`);
    } else {
      meta = `<span>Closed ${x.closed}</span>`;
      side = `${ibStatusPill(x)}<button class="ib-act" type="button" data-ib="view">${icon("i-eye", "ico ico--xs")}View</button><button class="ib-act" type="button" data-ib="duplicate">${icon("i-copy", "ico ico--xs")}Duplicate</button>`;
    }
    return `<li class="${cls}"${style} data-id="${x.id}"><span class="ib-row__icon" style="--c: var(--viz-${t.slot})">${icon("i-doc")}</span>
      <div class="ib-row__body"><p class="ib-row__title">${escapeHtml(x.title)}</p><p class="ib-row__meta"><span class="ib-type" style="--c: var(--viz-${t.slot})">${t.label}</span>${meta}</p></div>
      <div class="ib-row__side">${side}</div></li>`;
  }

  // numbers count to their new value
  function ibNum(el, to) {
    const from = Number(el.textContent) || 0;
    if (reduceMotion || from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => { const k = clamp((t - t0) / 600); el.textContent = Math.round(from + (to - from) * easeOut(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function ibStat() {
    const T = IB_TABS[ib.tab];
    $("#ib-stat-icon use").setAttribute("href", `#${T.icon}`);
    $("#ib-avg").hidden = ib.tab !== "inbox";
    $("#ib-stat-label").textContent = ib.tab === "history" && ib.scope === "assigned" ? "Acted on" : T.stat;
    ibNum(ibStatNum, ib.tab === "history" ? ibOf("history").length : ibCount(ib.tab));
    let sub = "";
    if (ib.tab === "inbox") {
      const open = ibTasks().filter((x) => !x.done);
      const overdue = open.filter((x) => $(".due--overdue", x.row)).length;
      const today = open.filter((x) => $(".due--today", x.row)).length;
      sub = `${overdue} overdue · ${today} due today`;
    } else if (ib.tab === "draft") {
      const d = ib.items.filter((x) => x.state === "draft");
      sub = d.length ? `Last edited ${ibAgo(Math.min(...d.map((x) => x.ago)))}` : "No drafts — start one with New request";
    } else if (ib.tab === "mine") {
      const m = ib.items.filter((x) => x.state === "mine");
      const n = (st) => m.filter((x) => x.status === st).length;
      sub = `${n("review")} in progress · ${n("rfi")} need${n("rfi") === 1 ? "s" : ""} information · ${n("returned")} returned`;
    } else {
      const h = ibOf("history");
      const n = (o) => h.filter((x) => x.outcome === o).length;
      sub = ib.scope === "assigned" ? `${n("approved")} approved · ${n("rejected")} rejected · ${n("forwarded")} forwarded` : `${n("approved")} approved · ${n("rejected")} rejected · ${n("withdrawn")} withdrawn`;
    }
    $("#ib-stat-sub").textContent = sub;
  }

  // Chart: a donut on every tab — by app on Inbox, by request type elsewhere.
  // Each app and each type keeps its own colour slot (validated as a set).
  const DONUT_R = 52, DONUT_C = 2 * Math.PI * DONUT_R, DONUT_GAP = 2.5;
  const IB_APP_SLOTS = { salesforce: 1, darwinbox: 2, uipath: 3, sap: 4 };
  const ibByApp = () => ib.tab === "inbox" || (ib.tab === "history" && ib.scope === "assigned");
  function ibSlices() {
    if (ib.tab === "inbox") return { total: totalPending(), slices: APP_ORDER.map((a) => ({ key: a, label: sourceNames[a], slot: IB_APP_SLOTS[a], v: counts[a], mark: sourceMarks[a] })) };
    const items = ibOf(ib.tab);
    if (ibByApp()) return { total: items.length, slices: APP_ORDER.map((a) => ({ key: a, label: sourceNames[a], slot: IB_APP_SLOTS[a], v: items.filter((x) => x.key === a).length, mark: sourceMarks[a] })) };
    return { total: items.length, slices: Object.entries(IB_TYPES).map(([k, t]) => ({ key: k, label: t.label, slot: t.slot, v: items.filter((x) => x.key === k).length })) };
  }
  function ibChart() {
    $("#ib-chart-title").textContent = ib.tab === "history" && ib.scope === "assigned" ? "Acted on by app" : IB_TABS[ib.tab].chart;
    const { total, slices } = ibSlices();
    const set = ibByApp() ? "apps" : "types";
    if (!ibPlot.querySelector(".ib-donut") || ibPlot.dataset.set !== set) {
      ibPlot.dataset.set = set;
      ibPlot.innerHTML = `<div class="ib-donut"><svg viewBox="0 0 132 132" aria-hidden="true"><circle class="ib-donut__track" cx="66" cy="66" r="${DONUT_R}"/>${slices.map((x) => `<circle class="ib-donut__seg" data-key="${x.key}" cx="66" cy="66" r="${DONUT_R}" style="--c: var(--viz-${x.slot}); stroke-dasharray: 0 ${DONUT_C}"/>`).join("")}</svg><div class="ib-donut__center"><p class="ib-donut__num"></p><p class="ib-donut__lbl"></p></div></div>`;
      void ibPlot.offsetWidth; // start segments from zero so they sweep in
    }
    let acc = 0;
    $$(".ib-donut__seg", ibPlot).forEach((seg) => {
      const v = slices.find((x) => x.key === seg.dataset.key).v;
      const len = total ? (v / total) * DONUT_C : 0;
      seg.style.strokeDasharray = `${Math.max(0, len - (v && v !== total ? DONUT_GAP : 0)).toFixed(2)} ${DONUT_C.toFixed(2)}`;
      seg.style.strokeDashoffset = (-acc).toFixed(2);
      acc += len;
    });
    const unit = IB_TABS[ib.tab].unit;
    ibLegend.innerHTML = slices.map((x) => `<li><button class="ib-legend__item" type="button" data-key="${x.key}" aria-pressed="${ib.type === x.key}" style="--c: var(--viz-${x.slot})" aria-label="${x.label}: ${x.v} ${unit} of ${total}. Show only ${x.label}"><span class="ib-legend__dot"></span><span class="ib-legend__name">${x.mark ? `<span class="app-mark app-mark--${x.mark}" aria-hidden="true">${x.key === "sap" ? "SAP" : x.label.slice(0, 2)}</span>` : ""}${x.label}</span><span class="ib-legend__val">${x.v}</span><span class="ib-legend__pct">${total ? Math.round((x.v / total) * 100) : 0}%</span></button></li>`).join("");
    ibDonutFocus(ib.focusKey || (ib.type !== "all" ? ib.type : null));
  }
  function ibDonutFocus(key) {
    const donut = $(".ib-donut", ibPlot);
    if (!donut) return;
    const { total, slices } = ibSlices();
    const hit = key && slices.find((x) => x.key === key);
    donut.classList.toggle("has-focus", !!hit);
    $$(".ib-donut__seg", donut).forEach((s) => s.classList.toggle("is-focus", !!hit && s.dataset.key === key));
    $$(".ib-legend__item", ibLegend).forEach((b) => b.classList.toggle("is-focus", !!hit && b.dataset.key === key));
    $(".ib-donut__num", donut).textContent = hit ? hit.v : total;
    $(".ib-donut__lbl", donut).textContent = hit ? hit.label : IB_TABS[ib.tab].unit;
  }

  const ibChips = (el, rows, isOn, attr) => { el.innerHTML = rows.map(([k, l]) => `<button class="chip${isOn(k) ? " is-selected" : ""}" type="button" aria-pressed="${isOn(k)}" ${attr}="${escapeHtml(k)}">${escapeHtml(l)}</button>`).join(""); };
  function ibControls() {
    const keys = ibByApp() ? APP_ORDER : Object.keys(IB_TYPES);
    ibChips(ibTypeChips, [["all", "All"], ...keys.map((k) => [k, ibKeyLabel(k)])], (k) => ib.type === k, "data-type");
    $("#ib-type-label").textContent = ibByApp() ? "App" : "Request type";
    // inbox rows and assigned history carry a request type (Leave, Purchase order…)
    const rtypes = ibByApp() ? [...new Set(ibOf(ib.tab).map((x) => x.rtype).filter(Boolean))].sort() : [];
    $("#ib-rtype-group").hidden = !rtypes.length;
    ibChips($("#ib-rtype-chips"), rtypes.map((r) => [r, r]), (k) => ib.rtypes.has(k), "data-rtype");
    const sts = IB_STATUS[ib.tab];
    $("#ib-status-group").hidden = !sts;
    if (sts) ibChips($("#ib-status-chips"), [["all", "All"], ...sts.filter(([v]) => ib.scope !== "assigned" || v !== "withdrawn").filter(([v]) => ib.scope === "assigned" || v !== "forwarded")], (k) => ib.status === k, "data-status");
    const sorts = ib.tab === "inbox" ? IB_SORTS.inbox : IB_SORTS.other;
    ibChips(ibSortChips, sorts, (k) => ib.sort === k, "data-sort");
    const n = (ib.type !== "all" ? 1 : 0) + (ib.sort !== sorts[0][0] ? 1 : 0) + ib.rtypes.size + (ib.status !== "all" ? 1 : 0);
    const badge = $("#ib-filter-count");
    badge.hidden = !n;
    badge.textContent = n;
    $("#ib-filter-btn").setAttribute("aria-label", n ? `Filter, ${n} active` : "Filter");
  }

  const IB_EMPTY = {
    inbox: ["i-check", "All caught up!", "You have no pending requests. New approval requests will appear here when they require your action."],
    draft: ["i-edit", "No draft requests", "Requests you’ve started but haven’t submitted yet will appear here after you save them as drafts."],
    mine: ["i-send", "Ready to get started?", "Get started by creating your first request. Once submitted, you can track its progress here."],
    history: ["i-archive", "No request history", "Completed requests and requests you’ve reviewed or acted on will appear here."]
  };
  // the bulk bar replaces the column header while rows are ticked
  function ibBulk() {
    const sel = [...ib.sel].filter((id) => ibTasks().some((x) => x.id === id && ibSelectable(x)));
    ib.sel = new Set(sel);
    const rows = ib.tab === "inbox" ? ibVisible().list.filter(ibSelectable) : [];
    $("#ib-bulk").hidden = !sel.length || ib.tab !== "inbox";
    $("#ib-head").hidden = !$("#ib-bulk").hidden;
    $("#ib-all-wrap").hidden = ib.tab !== "inbox" || !rows.length;
    $("#ib-head").classList.toggle("has-all", ib.tab === "inbox" && !!rows.length);
    $("#ib-bulk-n").textContent = sel.length;
    const all = $("#ib-all");
    all.checked = !!rows.length && rows.every((x) => ib.sel.has(x.id));
    all.indeterminate = !all.checked && rows.some((x) => ib.sel.has(x.id));
    $$(".ib-row", ibList).forEach((li) => {
      const on = ib.sel.has(li.dataset.id);
      li.classList.toggle("is-selected", on);
      const cb = $("[data-ib-sel]", li);
      if (cb) cb.checked = on;
    });
  }

  function renderIb({ animate = false } = {}) {
    Object.keys(IB_TABS).forEach((t) => { $(`[data-ib-count="${t}"]`, ibTabs).textContent = ibCount(t); });
    ibStat();
    ibChart();
    ibControls();
    const { list, all } = ibVisible();
    ibList.innerHTML = list.map((x, i) => ibRowHTML(x, i, animate)).join("");
    ibList.setAttribute("aria-labelledby", `ib-tab-${ib.tab}`);
    const empty = $("#ib-empty");
    empty.hidden = list.length > 0;
    $("#ib-scope").hidden = ib.tab !== "history";
    if (ib.tab === "history") $$("#ib-scope .chip").forEach((c) => { const on = c.dataset.scope === ib.scope; c.classList.toggle("is-selected", on); c.setAttribute("aria-pressed", String(on)); });
    if (!list.length) {
      const filtered = ib.q.trim() || ib.type !== "all" || ib.rtypes.size || ib.status !== "all";
      const E = IB_EMPTY[ib.tab];
      $("#ib-empty-icon use").setAttribute("href", filtered ? "#i-search" : `#${E[0]}`);
      $("#ib-empty-title").textContent = filtered ? "Nothing matches" : E[1];
      $("#ib-empty-text").textContent = filtered ? "Try another word, pick a different type, or clear the filters." : E[2];
      $("#ib-empty-cta").hidden = filtered || (ib.tab !== "mine" && ib.tab !== "draft");
    }
    ibBulk();
    const more = ib.tab === "inbox" ? ` · the ${totalPending()} total includes items you open in each app` : "";
    $("#ib-showing").textContent = `Showing ${list.length} of ${all}${more}`;
    ib.fresh = null;
    requestAnimationFrame(() => moveIndicator(ibTabs));
  }

  function setIbTab(tab, { focus = false } = {}) {
    if (!IB_TABS[tab]) return;
    const changed = tab !== ib.tab;
    ib.tab = tab;
    if (changed) { ib.type = "all"; ib.rtypes.clear(); ib.status = "all"; ib.sel.clear(); ib.sort = tab === "inbox" ? "urgent" : "new"; ib.focusKey = null; ibPlot.innerHTML = ""; ibPopClose(); }
    $$(".tab", ibTabs).forEach((t) => {
      const on = t.dataset.ibTab === tab;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    renderIb({ animate: changed || focus });
  }

  function openInbox(trigger, tab) {
    if (!ib.open) {
      ib.returnFocus = document.activeElement;
      const r = trigger?.getBoundingClientRect?.();
      inboxEl.style.setProperty("--ox", r ? `${r.left + r.width / 2}px` : "50%");
      inboxEl.style.setProperty("--oy", r ? `${r.top + r.height / 2}px` : "40px");
      closeNav(false); closeMenus(); closeSearch(); hideTip();
      ib.open = true;
      inboxEl.classList.add("is-open");
      inboxEl.setAttribute("aria-hidden", "false");
      inboxEl.scrollTop = 0;
      body.style.overflow = "hidden";
      loadTasks();
      $$(".js-inbox-badge").forEach((b) => { b.style.transform = "scale(0)"; setTimeout(() => b.remove(), 250); });
      $$("[data-open-inbox][aria-label]").forEach((b) => b.setAttribute("aria-label", "Inbox"));
    }
    setIbTab(tab || ib.tab);
    renderIb({ animate: true });
    setTimeout(() => $(".tab.is-selected", ibTabs)?.focus({ preventScroll: true }), 320);
  }
  function closeInbox() {
    if (!ib.open) return;
    ib.open = false;
    ibPopClose();
    inboxEl.classList.remove("is-open");
    inboxEl.setAttribute("aria-hidden", "true");
    closeMenus();
    if (!body.classList.contains("menu-open") && !drawer.classList.contains("is-open") && !gpt.open) body.style.overflow = "";
    if (ib.returnFocus && document.contains(ib.returnFocus)) ib.returnFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-inbox]");
    if (opener) { e.preventDefault(); openInbox(opener); }
    if (e.target.closest("[data-close-inbox]")) closeInbox();
  });
  // keep keyboard focus inside the inbox while it is the top layer
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !ib.open || drawer.classList.contains("is-open") || $("dialog[open]")) return;
    const items = $$("button:not([disabled]), input, a[href]", inboxEl).filter((el) => el.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });

  ibTabs.addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) setIbTab(t.dataset.ibTab); });
  ibTabs.addEventListener("keydown", (e) => {
    const tabs = $$(".tab", ibTabs);
    const i = tabs.indexOf(document.activeElement);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined || i < 0) return;
    e.preventDefault();
    setIbTab(tabs[(next + tabs.length) % tabs.length].dataset.ibTab, { focus: true });
  });
  ibSearch.addEventListener("input", () => { ib.q = ibSearch.value; renderIb(); });
  ibSearch.addEventListener("keydown", (e) => { if (e.key === "Escape" && ibSearch.value) { e.stopPropagation(); ibSearch.value = ""; ib.q = ""; renderIb(); } });
  const ibPickType = (k) => { ib.type = ib.type === k ? "all" : k; ib.focusKey = null; renderIb({ animate: true }); };
  ibTypeChips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { ib.type = c.dataset.type; renderIb({ animate: true }); } });
  ibSortChips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { ib.sort = c.dataset.sort; renderIb({ animate: true }); } });
  $("#ib-rtype-chips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; const k = c.dataset.rtype; ib.rtypes.has(k) ? ib.rtypes.delete(k) : ib.rtypes.add(k); renderIb({ animate: true }); });
  $("#ib-status-chips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { ib.status = c.dataset.status; renderIb({ animate: true }); } });
  $("#ib-clear").addEventListener("click", () => { ib.type = "all"; ib.rtypes.clear(); ib.status = "all"; ib.sort = ib.tab === "inbox" ? "urgent" : "new"; ib.q = ""; ibSearch.value = ""; renderIb({ animate: true }); });
  $("#ib-show").addEventListener("click", () => { closeMenus(); $("#ib-filter-btn").focus(); });
  $("#ib-scope").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c || c.dataset.scope === ib.scope) return; ib.scope = c.dataset.scope; ib.type = "all"; ib.rtypes.clear(); ib.status = "all"; ib.focusKey = null; ibPlot.innerHTML = ""; renderIb({ animate: true }); });
  // the chart is also a filter: pick a slice or a legend row
  ibPlot.addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) ibPickType(b.dataset.key); });
  ibLegend.addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) ibPickType(b.dataset.key); });
  const ibHover = (e) => { const b = e.target.closest?.("[data-key]"); const k = b ? b.dataset.key : null; if (k !== ib.focusKey) { ib.focusKey = k; ibDonutFocus(k || (ib.type !== "all" ? ib.type : null)); } };
  [ibPlot, ibLegend].forEach((el) => {
    el.addEventListener("pointerover", ibHover);
    el.addEventListener("pointerleave", () => { ib.focusKey = null; ibDonutFocus(ib.type !== "all" ? ib.type : null); });
    el.addEventListener("focusin", ibHover);
    el.addEventListener("focusout", () => { ib.focusKey = null; ibDonutFocus(ib.type !== "all" ? ib.type : null); });
  });

  function ibRemind(x) {
    x.reminded = true;
    toast(`Reminder sent to ${x.parallel ? "all approvers" : x.steps[x.step - 1]}`, "i-bellring");
    if (ib.open) renderIb();
  }

  /* ---------------------------------------------------------------
     Requests flow — approve / reject / request more info / forward /
     delete / respond all share one dialog. Nothing is sent anywhere.
     --------------------------------------------------------------- */
  const flowModal = $("#flow-modal");
  const flowForm = $("#flow-form");
  function flow(o) {
    flowForm.innerHTML = `<span class="flow__art${o.tone ? ` flow__art--${o.tone}` : ""}" aria-hidden="true">${icon(o.ico || "i-info")}</span>
      <h2 class="h3 flow__title" id="flow-title">${o.title}</h2>
      ${o.text ? `<p class="flow__text">${o.text}</p>` : ""}
      ${o.body ? `<div class="flow__body">${o.body}</div>` : ""}
      <div class="modal__foot"><button class="btn btn--ghost" type="button" data-flow-cancel>${o.cancel || "Cancel"}</button><button class="btn ${o.danger ? "btn--danger" : "btn--primary"}" type="submit" id="flow-ok">${o.confirm}</button></div>`;
    flowForm.onsubmit = (e) => { e.preventDefault(); if (o.validate && o.validate() === false) return; flowModal.close(); o.done && o.done(); };
    $("[data-flow-cancel]", flowForm).onclick = () => { flowModal.close(); if (o.onCancel) o.onCancel(); };
    flowForm.oninput = (e) => { const el = e.target, err = el.id && $(`#${el.id}-err`, flowForm); if (err && el.value.trim()) { err.hidden = true; el.setAttribute("aria-invalid", "false"); } };
    if (o.setup) o.setup();
    flowModal.showModal();
    $(o.focus || "#flow-ok", flowForm).focus();
  }
  const flowField = (id, label, extra = "") => `<div class="field"><label class="field__label" for="${id}">${label} <span class="sp__req" aria-hidden="true">*</span></label>${extra}<p class="field__error" id="${id}-err" role="alert" hidden></p></div>`;
  const flowCheck = (id, msg) => { const el = $("#" + id); const bad = !el.value.trim(); $(`#${id}-err`).hidden = !bad; $(`#${id}-err`).textContent = msg; el.setAttribute("aria-invalid", String(bad)); if (bad) el.focus(); return !bad; };

  // Pick a person by name or email
  const peopleHTML = () => `<div class="field"><label class="ib-search flow__search"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-search"/></svg><input id="fl-who" type="search" placeholder="Search by name &amp; email" autocomplete="off" aria-label="Search people"></label><div class="who" id="fl-people" role="listbox" aria-label="People"></div><p class="field__error" id="fl-who-err" role="alert" hidden>Choose a person.</p></div>`;
  function peopleBind(pick) {
    const input = $("#fl-who"), list = $("#fl-people");
    const paint = () => {
      const q = input.value.trim().toLowerCase();
      const rows = PEOPLE.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q));
      list.innerHTML = rows.length ? rows.map((p) => `<button class="who__row" type="button" role="option" aria-selected="${pick.name === p.name}" data-name="${escapeHtml(p.name)}"><span class="who__av" aria-hidden="true">${p.initials}</span><span class="who__txt"><b>${p.name}</b><small>${p.role}</small></span>${icon("i-check", "ico ico--sm who__tick")}</button>`).join("") : `<p class="who__none">No one found for “${escapeHtml(input.value)}”.</p>`;
    };
    input.addEventListener("input", paint);
    list.addEventListener("click", (e) => { const b = e.target.closest("[data-name]"); if (!b) return; pick.name = b.dataset.name; $("#fl-who-err").hidden = true; paint(); });
    paint();
  }

  // File picker used by the respond dialog (same limits as Help & support)
  const attachHTML = () => `<div class="sp__attach"><input id="fl-file" class="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"><label class="sp__drop" for="fl-file"><span class="sp__drop-ico">${icon("i-upload")}</span><span><strong>Add attachment</strong><small>PDF, JPG, PNG or DOC, up to 15 MB each. Max 5 files.</small></span></label><p class="field__error" id="fl-file-err" role="alert" hidden></p><ul class="sp__files" id="fl-files" role="list"></ul></div>`;
  function attachBind(input, list, err) {
    const files = [];
    const ext = (f) => f.name.split(".").pop().toLowerCase().replace("jpeg", "jpg").replace("docx", "doc");
    const paint = () => { list.innerHTML = files.map((f, i) => `<li class="sp-file"><span class="sp-file__ico sp-file__ico--${ext(f)}">${icon("i-doc")}<b>${ext(f).toUpperCase()}</b></span><span class="sp-file__name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><button class="sp-file__x" type="button" data-i="${i}" aria-label="Remove ${escapeHtml(f.name)}">${icon("i-x", "ico ico--sm")}</button></li>`).join(""); };
    input.addEventListener("change", () => {
      const problems = [];
      [...input.files].forEach((f) => {
        if (!SP_TYPES.includes(f.name.split(".").pop().toLowerCase())) problems.push(`${f.name} isn’t a PDF, JPG, PNG or DOC file.`);
        else if (f.size > SP_BYTES) problems.push(`${f.name} is over 15 MB.`);
        else if (files.length >= SP_MAX) { if (!problems.some((p) => p.includes("5 files"))) problems.push("You can add up to 5 files."); }
        else files.push(f);
      });
      input.value = "";
      err.hidden = !problems.length; err.textContent = problems.join(" ");
      paint();
    });
    list.addEventListener("click", (e) => { const x = e.target.closest(".sp-file__x"); if (x) { files.splice(+x.dataset.i, 1); err.hidden = true; paint(); } });
  }

  function confirmApprove(rows) {
    rows = rows.filter((r) => r && !r.classList.contains("is-done"));
    if (!rows.length) return;
    const n = rows.length;
    flow({
      ico: "i-check", tone: "ok", title: n > 1 ? "Approve selected requests?" : "Approve request",
      text: n > 1 ? `You are about to approve ${n} selected requests.` : "Are you sure you want to approve this request?",
      body: n === 1 ? `<p class="flow__ref">${escapeHtml($(".task__title", rows[0]).textContent)}</p>` : "",
      confirm: n > 1 ? "Approve all" : "Approve",
      done: () => {
        rows.forEach((r) => quickResolve(r, "approve", { silent: true }));
        ib.sel.clear(); if (ib.open) renderIb();
        toast(n > 1 ? `${n} requests have been successfully approved.` : "The request has been successfully approved.", "i-check");
      }
    });
  }
  function confirmReject(row) {
    if (!row || row.classList.contains("is-done")) return;
    flow({
      ico: "i-x", tone: "bad", title: "Reject request", text: "Are you sure you want to reject the request? Please share the reason for rejection.",
      body: `<p class="flow__ref">${escapeHtml($(".task__title", row).textContent)}</p>${flowField("fl-reason", "Reason for rejection", `<textarea id="fl-reason" rows="3" placeholder="Enter rejection reason"></textarea>`)}`,
      confirm: "Reject", danger: true, focus: "#fl-reason",
      validate: () => flowCheck("fl-reason", "Add a reason so the requester knows what to change."),
      done: () => { quickResolve(row, "reject", { silent: true, reason: $("#fl-reason").value.trim() }); toast("The request has been successfully rejected.", "i-x"); }
    });
  }
  function markRfi(row) {
    row.classList.add("is-rfi");
    const acts = $(".task__actions", row);
    if (acts && !$(".task__rfi", acts)) acts.insertAdjacentHTML("afterbegin", `<button class="task__rfi" type="button" data-rfi-update>${icon("i-info", "ico ico--xs")}Update RFI</button>`);
  }
  function openRfi(row) {
    if (!row || row.classList.contains("is-done")) return;
    if (row.dataset.rfiFrom) { // someone asked you: this is your reply
      openRespond({ rfi: { from: row.dataset.rfiFrom, subject: row.dataset.rfiSubject } }, () => { delete row.dataset.rfiFrom; row.classList.remove("is-rfi"); $(".task__rfi", row)?.remove(); });
      return;
    }
    const pick = { name: row.dataset.rfiTo || "" };
    const editing = !!pick.name;
    flow({
      ico: "i-info", title: editing ? "Update RFI" : "Request more information", text: "Please specify the additional information required to proceed with this request.",
      body: `<p class="flow__ref">${escapeHtml($(".task__title", row).textContent)}</p>${peopleHTML()}${flowField("fl-msg", "Your message", `<textarea id="fl-msg" rows="4" placeholder="Type your message"></textarea>`)}`,
      confirm: editing ? "Update" : "Submit", focus: "#fl-who",
      setup: () => { peopleBind(pick); $("#fl-msg").value = row.dataset.rfiMsg || ""; },
      validate: () => { $("#fl-who-err").hidden = !!pick.name; if (!pick.name) { $("#fl-who").focus(); return false; } return flowCheck("fl-msg", "Tell them what you need."); },
      done: () => {
        row.dataset.rfiTo = pick.name; row.dataset.rfiMsg = $("#fl-msg").value.trim();
        markRfi(row); ib.sel.delete(`task-${taskRows().indexOf(row)}`);
        toast(editing ? "Your request for additional information has been updated." : "Your request for additional information has been sent successfully.", "i-info");
        if (ib.open) renderIb();
      }
    });
  }
  function openForward(row) {
    if (!row || row.classList.contains("is-done")) return;
    const pick = { name: "" };
    flow({
      ico: "i-forward", title: "Forward request", text: "Select another approver to review and approve this request.",
      body: `<p class="flow__ref">${escapeHtml($(".task__title", row).textContent)}</p>${peopleHTML()}`,
      confirm: "Forward", focus: "#fl-who", setup: () => peopleBind(pick),
      validate: () => { $("#fl-who-err").hidden = !!pick.name; if (!pick.name) { $("#fl-who").focus(); return false; } },
      done: () => { row.dataset.forwardTo = pick.name; quickResolve(row, "forward", { silent: true }); ib.sel.clear(); if (ib.open) renderIb(); toast("The request has been forwarded to the next approver.", "i-forward"); }
    });
  }
  function confirmDelete(x) {
    flow({
      ico: "i-trash", tone: "bad", title: "Delete request", text: "Are you sure you want to delete the request?",
      body: `<p class="flow__ref">${escapeHtml(x.title)}</p>`, confirm: "Delete", danger: true,
      done: () => { ib.items = ib.items.filter((y) => y !== x); renderIb(); toast("Draft deleted", "i-trash"); }
    });
  }
  // A request of yours is waiting on information somebody asked for
  function openRespond(x, onDone) {
    if (!x || !x.rfi) return;
    flow({
      ico: "i-info", title: "Request more information", text: `RFI requestor: <b>${escapeHtml(x.rfi.from)}</b>`,
      body: `<p class="flow__ref"><span>RFI</span>${escapeHtml(x.rfi.subject)}</p>${flowField("fl-msg", "Type your message", `<textarea id="fl-msg" rows="4"></textarea>`)}${attachHTML()}`,
      confirm: "Submit", focus: "#fl-msg", setup: () => attachBind($("#fl-file"), $("#fl-files"), $("#fl-file-err")),
      validate: () => flowCheck("fl-msg", "Write a short reply."),
      done: () => {
        if (onDone) onDone(); else { x.status = "review"; x.rfi = null; }
        toast("Your response has been sent successfully.", "i-check"); renderIb();
      }
    });
  }

  // The ⋮ menu on an Inbox row
  const ibPop = document.createElement("div");
  ibPop.className = "ib-pop"; ibPop.setAttribute("role", "menu"); ibPop.hidden = true;
  function ibPopClose() {
    if (ibPop.hidden) return false;
    ibPop.hidden = true; ibPop.closest(".ib-row")?.classList.remove("has-pop"); ibPop.remove();
    if (ibPop.owner && ibPop.owner.isConnected) ibPop.owner.setAttribute("aria-expanded", "false");
    return true;
  }
  function ibPopOpen(btn) {
    ibPopClose();
    ibPop.owner = btn; btn.setAttribute("aria-expanded", "true");
    ibPop.innerHTML = `<button type="button" role="menuitem" data-pop="rfi">${icon("i-info", "ico ico--sm")}Request more info</button><button type="button" role="menuitem" data-pop="forward">${icon("i-forward", "ico ico--sm")}Forward</button>`;
    btn.closest(".ib-row").appendChild(ibPop);
    btn.closest(".ib-row").classList.add("has-pop");
    ibPop.hidden = false;
    $("button", ibPop).focus();
  }
  document.addEventListener("click", (e) => { if (!ibPop.hidden && !e.target.closest(".ib-pop, [data-ib='more']")) ibPopClose(); });
  ibPop.addEventListener("keydown", (e) => {
    const items = $$("button", ibPop), i = items.indexOf(document.activeElement);
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); items[(i + d + items.length) % items.length].focus(); }
    if (e.key === "Tab") ibPopClose();
  });

  ibList.addEventListener("click", (e) => {
    const pop = e.target.closest("[data-pop]");
    const btn = pop || e.target.closest("[data-ib]");
    if (!btn) return;
    const li = btn.closest(".ib-row");
    const act = pop ? pop.dataset.pop : btn.dataset.ib;
    if (li.classList.contains("ib-row--sel")) {
      const row = taskRows()[Number(li.dataset.id.slice(5))];
      if (act === "more") { if (ibPop.owner === btn && !ibPop.hidden) ibPopClose(); else ibPopOpen(btn); return; }
      const owner = ibPop.owner;
      ibPopClose();
      if (act === "view") openDrawer(row.classList.contains("is-done") ? "assigned" : "task", row.classList.contains("is-done") ? ibAssigned().find((y) => y.id === li.dataset.id) : row);
      else if (act === "approve") confirmApprove([row]);
      else if (act === "reject") confirmReject(row);
      else if (act === "rfi") openRfi(row);
      else if (act === "forward") openForward(row);
      return;
    }
    const x = ibFind(li.dataset.id) || ibAssigned().find((y) => y.id === li.dataset.id);
    if (!x) return;
    if (act === "edit") openRequestForm(x, x.state === "draft" ? "edit" : "revise");
    else if (act === "revise") openRequestForm(x, "revise");
    else if (act === "view") openDrawer(x.scope === "assigned" ? "assigned" : "request", x);
    else if (act === "respond") openRespond(x);
    else if (act === "remind") ibRemind(x);
    else if (act === "duplicate") {
      const copy = rq({ state: "draft", type: x.type, title: `${x.title} (copy)`, details: x.details, ago: 0 });
      ib.items.unshift(copy);
      toast("Copied to Drafts", "i-copy");
      renderIb();
      const draftTab = $('[data-ib-tab="draft"] .tab__count', ibTabs);
      if (!reduceMotion) draftTab.animate([{ transform: "scale(1.6)" }, { transform: "none" }], { duration: 500, easing: "cubic-bezier(.34,1.56,.64,1)" });
    } else if (act === "delete") confirmDelete(x);
  });
  // Select rows and approve them together
  ibList.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-ib-sel]");
    if (!cb) return;
    const id = cb.closest(".ib-row").dataset.id;
    cb.checked ? ib.sel.add(id) : ib.sel.delete(id);
    ibBulk();
  });
  $("#ib-all").addEventListener("change", (e) => {
    const rows = ibVisible().list.filter(ibSelectable);
    rows.forEach((x) => (e.target.checked ? ib.sel.add(x.id) : ib.sel.delete(x.id)));
    ibBulk();
  });
  $("#ib-bulk-clear").addEventListener("click", () => { ib.sel.clear(); ibBulk(); $("#ib-all").focus(); });
  $("#ib-bulk-approve").addEventListener("click", () => confirmApprove([...ib.sel].map((id) => taskRows()[Number(id.slice(5))])));
  $("#ib-empty-cta").addEventListener("click", () => openRequestForm());

  // one Inbox request already has an RFI waiting for you ("RFI to (You)")
  { const seeded = taskRows().pop(); if (seeded) { seeded.dataset.rfiFrom = "Ankur Kushwaha"; seeded.dataset.rfiSubject = "Need SOW Document"; markRfi(seeded); } }

  /* New request — pick a type, fill in the details, review, send */
  const rqp = $("#rq-pick");
  const rqpList = $("#rqp-list");
  const rqpSearch = $("#rqp-search");
  const rqpGo = $("#rqp-go");
  let rqpPick = null;
  function rqpRender() {
    const q = rqpSearch.value.trim().toLowerCase();
    const rows = REQUEST_TYPES.filter((d) => `${d.label} ${d.app ? sourceNames[d.app] : "Bloom"}`.toLowerCase().includes(q));
    let html = "", grp = "";
    rows.forEach((d) => {
      const g = d.own ? "Bloom workflows" : `Created in ${sourceNames[d.app]}`;
      if (g !== grp) { grp = g; html += `<p class="rqp__group" role="presentation">${g}</p>`; }
      const lead = d.own ? `<span class="rqp__dot" style="--c: var(--viz-${IB_TYPES[d.key].slot})"></span>` : `<span class="app-mark app-mark--${sourceMarks[d.app]}" aria-hidden="true">${d.app === "sap" ? "SAP" : sourceNames[d.app].slice(0, 2)}</span>`;
      html += `<button class="rqp__opt" type="button" role="option" aria-selected="${rqpPick === d.key}" data-key="${d.key}">${lead}<span>${escapeHtml(d.label)}</span>${icon("i-check", "ico ico--sm rqp__tick")}</button>`;
    });
    rqpList.innerHTML = html;
    rqpList.hidden = !rows.length;
    $("#rqp-none").hidden = rows.length > 0;
    rqpGo.disabled = !rqpPick;
  }
  function openRqPick() {
    rqpPick = null; rqpSearch.value = ""; rqpRender();
    rqp.showModal();
    rqpSearch.focus();
  }
  const rqpProceed = () => { if (!rqpPick) return; const d = REQUEST_TYPES.find((x) => x.key === rqpPick); rqp.close(); rqStart(d); };
  rqpSearch.addEventListener("input", rqpRender);
  rqpList.addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) { rqpPick = b.dataset.key; rqpRender(); rqpList.querySelector(`[data-key="${rqpPick}"]`).focus(); } });
  rqpList.addEventListener("dblclick", (e) => { if (e.target.closest("[data-key]")) rqpProceed(); });
  $("#rqp-form").addEventListener("submit", (e) => { e.preventDefault(); rqpProceed(); });
  $("#rqp-cancel").addEventListener("click", () => rqp.close());

  const rqModal = $("#request-modal");
  const rqForm = $("#request-form");
  const rqBody = $("#rq-body");
  const rqDraftBtn = $("#rq-draft");
  const rqBackBtn = $("#rq-back");
  const rf = { item: null, mode: "new", def: null, step: 1, vals: {} };
  const defOf = (key) => REQUEST_TYPES.find((d) => d.key === key);
  function rfSpec(def) {
    const company = { k: "company", label: "Company", options: COMPANIES, req: true, half: true };
    const dept = { k: "dept", label: "Department", options: DEPARTMENTS, ph: "Select department", req: true, half: true };
    const subject = (l = "Subject") => ({ k: "title", label: l, ph: `Enter ${l.toLowerCase()}`, req: true });
    const why = { k: "details", label: "Business justification", area: true, req: true, ph: "Why is this needed, and what happens if it isn’t approved?" };
    if (!def.own) return [subject(), { k: "details", label: "Details", area: true, req: true, ph: "What do you need?" }];
    if (def.key === "tcdf") return [company, dept, subject("Title"), { k: "payee", label: "Vendor or counterparty", ph: "Enter name", half: true }, { k: "amount", label: "Estimated value (AED)", ph: "0", half: true }, why];
    if (def.key === "rfp") return [company, dept, subject(), { k: "payee", label: "Payee", ph: "Enter payee", req: true, half: true }, { k: "amount", label: "Amount (AED)", ph: "0", req: true, half: true }, why];
    return [company, dept, subject(), why];
  }
  function rfFieldHTML(sp, vals = rf.vals) {
    const id = `rf-${sp.k}`, v = vals[sp.k] || "";
    const label = `<label class="field__label" for="${id}">${sp.label}${sp.req ? ` <span class="sp__req" aria-hidden="true">*</span>` : ` <span class="field__opt">optional</span>`}</label>`;
    const ctl = sp.options
      ? `<select class="field__input" id="${id}" data-k="${sp.k}"><option value="" disabled${v ? "" : " selected"}>${sp.ph || "Select"}</option>${sp.options.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select>`
      : sp.area ? `<textarea id="${id}" data-k="${sp.k}" rows="6" placeholder="${escapeHtml(sp.ph || "")}">${escapeHtml(v)}</textarea>`
      : `<input class="field__input" id="${id}" data-k="${sp.k}" type="text"${sp.k === "amount" ? ' inputmode="decimal"' : ""} maxlength="90" autocomplete="off" placeholder="${escapeHtml(sp.ph || "")}" value="${escapeHtml(v)}">`;
    return `<div class="field${sp.half ? " field--half" : ""}">${label}${ctl}<p class="field__error" id="${id}-err" role="alert" hidden>${sp.k === "title" ? "Give the request a title so approvers know what it is." : "This is required."}</p></div>`;
  }
  function rfRender() {
    const d = rf.def, own = d.own;
    $("#rq-title").textContent = rf.mode === "revise" ? "Revise and resubmit" : rf.mode === "edit" ? "Edit draft" : `Create ${d.short}`;
    $("#rq-sub").textContent = rf.mode === "revise" ? (rf.item.note || "Update the request, then send it back to the approvers.") : own ? `Bloom@Go · ${rf.item ? rf.item.ref : "a reference is added when you save"}` : `Created here, approved in ${sourceNames[d.app]}`;
    $("#rq-steps").hidden = !own;
    $("#rq-steps").innerHTML = `<li class="${rf.step === 1 ? "is-current" : "is-done"}"><b>${rf.step === 1 ? "01" : icon("i-check", "ico ico--xs")}</b>${escapeHtml(d.short)} details</li><li class="${rf.step === 2 ? "is-current" : ""}"><b>02</b>Review &amp; send</li>`;
    const spec = rfSpec(d);
    if (rf.step === 1) {
      rqBody.innerHTML = `${own ? "" : `<p class="d-note">${icon("i-info", "ico ico--sm")}This request is created in ${sourceNames[d.app]} and approved there. You’ll follow it in ${sourceNames[d.app]}.</p>`}<div class="rq-grid">${spec.map(rfFieldHTML).join("")}</div>`;
    } else {
      const route = ROUTE[d.key];
      rqBody.innerHTML = `<dl class="d-facts rq-review">${spec.filter((sp) => (rf.vals[sp.k] || "").trim()).map((sp) => `<div${sp.area || sp.k === "title" ? ' class="d-facts__wide"' : ""}><dt>${sp.label}</dt><dd>${escapeHtml(rf.vals[sp.k])}</dd></div>`).join("")}</dl>
        <h3 class="d-faq__label">Approval route</h3><ol class="d-steps">${route.map((who, i) => `<li class="d-step d-step--${i === 0 ? "current" : "todo"}"><span class="d-step__dot">${icon(i === 0 ? "i-clock" : "i-user")}</span><p><strong>${escapeHtml(who)}</strong><span>${i === 0 ? "Reviews first" : "Next"}</span></p></li>`).join("")}</ol>`;
    }
    rqBackBtn.hidden = rf.step === 1;
    rqDraftBtn.hidden = !own || rf.mode === "revise";
    $("#rq-submit-label").textContent = own && rf.step === 1 ? "Save & next" : !own ? "Submit request" : rf.mode === "revise" ? "Resubmit" : "Submit for approval";
    $("#rq-submit use").setAttribute("href", own && rf.step === 1 ? "#i-arrow" : "#i-send");
  }
  function rfValid(all) {
    let first = null;
    rfSpec(rf.def).forEach((sp) => {
      const bad = (all ? sp.req : sp.k === "title") && !(rf.vals[sp.k] || "").trim();
      const el = $(`#rf-${sp.k}`), err = $(`#rf-${sp.k}-err`);
      if (!el) return;
      err.hidden = !bad; el.setAttribute("aria-invalid", String(bad));
      if (bad && !first) first = el;
    });
    if (first) first.focus();
    return !first;
  }
  rqBody.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    rf.vals[k] = e.target.value;
    if (e.target.value.trim()) { e.target.setAttribute("aria-invalid", "false"); $(`#rf-${k}-err`).hidden = true; }
  });
  function rfOpen(item, mode, def) {
    rf.item = item; rf.mode = mode; rf.def = def; rf.step = 1;
    rf.vals = item
      ? { company: item.company || COMPANIES[0], dept: item.dept || "", title: item.title, details: item.details || "", amount: item.amount || "", payee: item.payee || "" }
      : { company: COMPANIES[0], dept: "", title: "", details: "", amount: "", payee: "" };
    rfRender();
    rqModal.showModal();
    setTimeout(() => { const f = $("#rq-body [data-k='title'], #rq-body select, #rq-body input"); if (f) f.focus(); }, 40);
  }
  const rqStart = (def) => (def.own ? wzOpen(null, "new", def) : rfOpen(null, "new", def));
  function openRequestForm(item = null, mode = "new") {
    if (!item) { openRqPick(); return; }
    wzOpen(item, mode, defOf(item.type));
  }
  function rfSave(submit) {
    const v = rf.vals, d = rf.def;
    if (!d.own) {
      rqModal.close();
      toast(`${d.label} created in ${sourceNames[d.app]}`, "i-send");
      return;
    }
    let x = rf.item;
    if (!x) { x = rq({ state: "draft", type: d.key, title: v.title.trim(), ago: 0 }); ib.items.unshift(x); }
    Object.assign(x, { title: v.title.trim(), type: d.key, company: v.company, dept: v.dept, amount: (v.amount || "").trim(), payee: (v.payee || "").trim(), details: (v.details || "").trim(), ago: 0 });
    if (submit) Object.assign(x, { state: "mine", status: "review", step: 1, steps: ROUTE[d.key], note: "", reminded: false, rfi: null });
    rqModal.close();
    ib.fresh = x.id;
    if (ib.open) setIbTab(x.state); else openInbox(null, x.state);
    ib.fresh = x.id;
    renderIb();
    toast(submit ? `Sent to ${ROUTE[d.key][0]} for approval` : "Draft saved", submit ? "i-send" : "i-edit");
  }
  rqForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (rf.step === 1 && !rfValid(true)) return;
    if (rf.def.own && rf.step === 1) { rf.step = 2; rfRender(); $("#rq-title").focus?.(); return; }
    rfSave(true);
  });
  rqDraftBtn.addEventListener("click", () => { if (rf.step === 1 && !rfValid(false)) return; rfSave(false); });
  rqBackBtn.addEventListener("click", () => { rf.step = 1; rfRender(); });
  $("#rq-cancel").addEventListener("click", () => rqModal.close());
  rqModal.addEventListener("close", () => { rqBody.innerHTML = ""; });
  $("#ib-new").addEventListener("click", () => openRequestForm());
  /* ---------------------------------------------------------------
     Create Internal Memo / TCDF / RFP. The memo has three steps
     (details, approvers, attachments); TCDF and RFP have four
     (submission details, request details, approvers, attachments).
     Files are only listed in the tab; nothing is stored or sent.
     --------------------------------------------------------------- */
  const wzModal = $("#wizard-modal");
  const wzPanel = $("#wz-panel");
  const wzNext = $("#wz-next");
  const wzDraft = $("#wz-draft");
  const wz = { item: null, mode: "new", def: null, step: 1, vals: {}, lines: [], locked: false, approvers: [], checks: {}, signing: true, files: [], snap: "" };
  const WZ_FLOWS = {
    memo: { crumb: "Create Memo", noun: "memo", steps: [
      ["details", "Memo details", "Identify the primary entities and the core objective of this internal memo."],
      ["approvers", "Approvers", "Select the required stakeholders for review."],
      ["files", "Attachments", "Upload relevant files to provide additional context or reference for this memo."]] },
    tcdf: { crumb: "TCDF", noun: "TCDF", steps: [
      ["submission", "Submission Details", "Identify the submission type and core request categorization."],
      ["request", "Request Details", "Say what is being requested and why."],
      ["approvers", "Approvers", "Select the required stakeholders for review."],
      ["files", "Attachments", "Upload relevant files to provide additional context or reference for this TCDF."]] },
    rfp: { crumb: "RFP", noun: "payment request", steps: [
      ["submission", "Submission Details", "Identify the submission type and core request categorization."],
      ["request", "Request Details", "Say what is being requested and why."],
      ["approvers", "Approvers", "Select the required stakeholders for review."],
      ["files", "Attachments", "Upload relevant files to provide additional context or reference for this payment request."]] }
  };
  const wzKey = () => WZ_FLOWS[wz.def.key].steps[wz.step - 1][0];
  const FILE_KINDS = { doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", ppt: "PPT", pptx: "PPT" };
  const WZ_BYTES = 10 * 1024 * 1024, WZ_MAX = 10;
  let reqSeq = 0;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Sample lists for the prototype's dropdowns
  const TCDF_CATEGORIES = ["Bidder List", "Construction Contract", "Purchase order", "Service Agreement", "Others"];
  const TCDF_SUBS = {
    "Bidder List": ["Shortlist approval", "Bidder addition", "Evaluation outcome"],
    "Construction Contract": ["Awards", "Amendment to agreement no.", "Close out", "Variation Order"],
    "Purchase order": ["New purchase order", "Amendment to purchase order", "Cancellation"],
    "Service Agreement": ["Awards", "Amendment to agreement no.", "Close out", "Renewal"],
    Others: ["Others"]
  };
  const PROJECTS = ["ADB Boat Parking", "Al - Dhay AMC - BG", "Al Abbar Rectification work of villa", "Al Ain Bloomscape Nursery", "Al Ain Mock up villa", "Saadiyat Marina Phase 2", "Yas Bay Retail Podium"];
  const VENDORS = ["2U Getsmarter (US) LLC", "360 degree Cloud Technologies LLC", "3C Payment Luxembourg S.A", "3db Entertainment & Parties Events", "3FIVEB Technologies DMCC", "Gulf Civil Works LLC", "Mussafah Steel Trading"];
  const WBS_CODES = ["36322", "36410", "36588", "40117", "40233", "41009"];
  const CURRENCIES = [["AED", "Dirham"], ["INR", "Rupee"], ["JPY", "Japanese Yen"], ["USD", "Dollar"]];
  const RFP_DEPARTMENTS = ["Project Development", "Finance", "Commercial", "Delivery", "Design", "Hospitality", "Procurement", "Legal"];
  const STAKEHOLDER_TYPES = ["Supplier", "Contractor", "Consultant", "Landlord", "Other"];
  const LINE_ITEMS = ["Advance payment", "1st Payment", "2nd Payment", "3rd Payment", "Final payment", "Retention release"];
  const CHECKLIST = ["Delivery", "Design", "Hospitality", "Commercial", "Finance", "Head of Department"];
  // Typing this PO number fills the payment details in, as in the flow
  const PO_LOOKUP = { "123456789": { payProject: "Al Metlaa", stakeholder: "Taruna", stype: "Supplier", cur: "AED", amount: "1500" } };
  const PO_FILLED = ["payProject", "stakeholder", "stype", "cur", "amount"];
  const USED_INVOICES = ["1244sap", "inv-2026-0001"];
  const DUP_MSG = "Invoice number already exists. Please enter a unique invoice number.";

  // The justification is rich text typed on this page. Keep a small allow-list so
  // nothing but formatting survives (paste is plain text too).
  const RTE_TAGS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "UL", "OL", "LI", "H1", "H2", "H3", "FONT"]);
  function cleanHtml(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const walk = (node) => [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1 || !RTE_TAGS.has(ch.tagName)) { ch.remove(); return; }
      [...ch.attributes].forEach((a) => {
        if (a.name !== "style") { ch.removeAttribute(a.name); return; }
        const keep = a.value.split(";").map((d) => d.trim()).filter((d) => /^(text-align|background-color|font-weight|font-style|text-decoration(-line)?)\s*:\s*[a-z0-9#(),.\s%-]+$/i.test(d));
        keep.length ? ch.setAttribute("style", keep.join("; ")) : ch.removeAttribute("style");
      });
      walk(ch);
    });
    walk(doc.body);
    return doc.body.innerHTML;
  }
  const wzSnapshot = () => JSON.stringify({ v: wz.vals, l: wz.lines, a: wz.approvers, c: wz.checks, s: wz.signing, f: wz.files.map((f) => f.name) });
  const fmtSize = (b) => `${Math.max(0.1, b / 1048576).toFixed(1)} mb`;
  const fmtWhen = (d) => { const h = d.getHours(); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} | ${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const fmtDay = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ""; };
  const fmtMoney = (cur, n) => (n ? `${cur || "AED"} ${Number(String(n).replace(/,/g, "")).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "");

  // ---- the field specs for each step ------------------------------------
  const sp = {
    text: (k, label, o = {}) => ({ t: "text", k, label, ph: `Enter ${label.toLowerCase()}`, ...o }),
    combo: (k, label, o = {}) => ({ t: "combo", k, label, ph: `Select ${label.toLowerCase()}`, ...o })
  };
  function wzSpec() {
    const key = wzKey(), d = wz.def.key;
    if (d === "memo" && key === "details") return [
      sp.combo("company", "Company", { opts: COMPANIES, req: 1, half: 1, plain: 1 }), sp.combo("dept", "Department", { opts: DEPARTMENTS, req: 1, half: 1, plain: 1 }),
      sp.text("title", "Subject", { req: 1 }), { t: "rich", k: "details", req: 1 }];
    if (key === "request") return [sp.text("title", "Subject", { req: 1 }), { t: "rich", k: "details", req: 1 }];
    if (d === "tcdf" && key === "submission") return [
      sp.combo("category", "Category", { opts: TCDF_CATEGORIES, req: 1, half: 1, plain: 1 }),
      sp.combo("sub", "Sub category", { optsFn: (v) => TCDF_SUBS[v.category] || [], req: 1, half: 1, plain: 1, offIf: (v) => !v.category }),
      sp.text("ref", "Reference value", { ph: "Enter value", req: 1 }),
      sp.combo("project", "Project", { opts: PROJECTS, search: "Find item", req: 1, half: 1 }),
      sp.combo("vendor", "Vendor name", { opts: VENDORS, search: "Find item", req: 1, half: 1 }),
      sp.combo("wbs", "WBS code", { opts: WBS_CODES, search: "Find item", req: 1, half: 1, ph: "Select WBS code" }),
      { t: "money", k: "amount", cur: "cur", label: "Amount", req: 1, half: 1 },
      { t: "radio", k: "budget", label: "Is it included in the approved budget?", opts: ["Yes", "No"], req: 1, half: 1 },
      sp.text("budgetRef", "Budget/MCR line reference no.", { ph: "Enter budget number", req: 1, half: 1, showIf: (v) => v.budget === "Yes" })];
    if (d === "rfp" && key === "submission") return [
      sp.text("project", "Project name", { req: 1, half: 1 }), sp.combo("dept", "Department", { opts: RFP_DEPARTMENTS, req: 1, half: 1, plain: 1 }),
      { t: "date", k: "received", label: "Received date", req: 1, half: 1 }, { t: "date", k: "due", label: "Due date", req: 1, half: 1 },
      { t: "section", label: "Payment details" },
      sp.text("po", "PO number", { ph: "Enter number", half: 1, hint: () => (wz.locked ? "Matched purchase order. The details below are filled in." : "") }),
      sp.text("invoice", "Vendor invoice number", { ph: "Enter number", req: 1, half: 1 }),
      sp.text("payProject", "Project name", { ph: "Enter name", req: 1, half: 1, lock: 1 }),
      { t: "money", k: "amount", cur: "cur", label: "Currency", req: 1, half: 1, lock: 1 },
      sp.text("stakeholder", "Stakeholder name", { ph: "Enter name", req: 1, half: 1, lock: 1 }),
      sp.combo("stype", "Stakeholder type", { opts: STAKEHOLDER_TYPES, ph: "Enter type", req: 1, half: 1, plain: 1, lock: 1 }),
      { t: "lines" }];
    return [];
  }
  const specShown = (s) => !s.showIf || s.showIf(wz.vals);
  const invoiceDup = () => USED_INVOICES.includes((wz.vals.invoice || "").trim().toLowerCase());
  const lineOk = (l) => l.item && String(l.amount || "").trim();
  function wzValid() {
    const key = wzKey();
    if (key === "approvers") return wz.approvers.length > 0;
    if (key === "files") return true;
    const specs = wzSpec();
    const ok = specs.every((s) => {
      if (!s.req || !specShown(s)) return true;
      if (s.t === "rich") return (wz.vals.detailsText || "").trim();
      if (s.t === "money") return String(wz.vals[s.k] || "").trim() && wz.vals[s.cur];
      return String(wz.vals[s.k] || "").trim();
    });
    if (!ok) return false;
    if (specs.some((s) => s.t === "lines") && !wz.lines.every(lineOk)) return false;
    if (wz.def.key === "rfp" && key === "submission") {
      if (wz.vals.received && wz.vals.due && wz.vals.due < wz.vals.received) return false;
      if (invoiceDup()) return false;
    }
    return true;
  }
  function wzRefresh() {
    wzNext.disabled = !wzValid();
    wzDraft.disabled = wzSnapshot() === wz.snap;
  }

  // ---- fields: text, dates, radios, money, lines and the dropdown ----------
  const reqMark = (s) => (s.req ? ` <span class="sp__req" aria-hidden="true">*</span>` : ` <span class="field__opt">optional</span>`);
  const fieldWrap = (s, inner, id) => `<div class="field${s.half ? " field--half" : ""}${s.lock && wz.locked ? " is-locked" : ""}"${s.showIf ? ` data-show="${s.k}"` : ""}>${inner}<p class="field__error" id="${id}-err" role="alert" hidden></p></div>`;
  // one dropdown for every select: optional search, keyboard friendly, values live in wz.vals / wz.lines
  const comboId = (k) => `cb-${k.replace(/[^a-z0-9]/gi, "-")}`;
  function comboHTML(id, value, o) {
    const dis = o.disabled ? " disabled" : "";
    return `<div class="combo" data-combo="${id}"><button class="combo__btn field__input${value ? "" : " is-ph"}" type="button" id="rf-${id.replace(/[^a-z0-9]/gi, "-")}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${comboId(id)}"${dis}${o.label ? ` aria-label="${escapeHtml(o.label)}"` : ""}><span>${escapeHtml(value || o.ph || "Select")}</span>${icon("i-chevron-down", "ico ico--sm combo__chev")}</button>
      <div class="combo__pop" id="${comboId(id)}" hidden>${o.search ? `<label class="combo__search">${icon("i-search", "ico ico--sm")}<input type="search" placeholder="${escapeHtml(o.search)}" autocomplete="off" aria-label="${escapeHtml(o.search)}"></label>` : ""}<div class="combo__list" role="listbox" tabindex="-1"></div></div></div>`;
  }
  const comboOpts = (id) => {
    if (id === "cur") return CURRENCIES.map(([c, n]) => ({ v: c, label: `<b>${c}</b> ${n}` }));
    if (id.startsWith("line:")) {
      const [, , f] = id.split(":");
      return (f === "cur" ? CURRENCIES.map(([c, n]) => ({ v: c, label: `<b>${c}</b> ${n}` })) : LINE_ITEMS.map((v) => ({ v, label: v })));
    }
    const s = wzSpec().find((x) => x.k === id);
    return (s.optsFn ? s.optsFn(wz.vals) : s.opts).map((v) => ({ v, label: escapeHtml(v) }));
  };
  const comboGet = (id) => (id.startsWith("line:") ? wz.lines[Number(id.split(":")[1])][id.split(":")[2]] : wz.vals[id]);
  const comboSet = (id, v) => { if (id.startsWith("line:")) wz.lines[Number(id.split(":")[1])][id.split(":")[2]] = v; else wz.vals[id] = v; };
  function moneyHTML(s) {
    const id = `rf-${s.k}`, locked = s.lock && wz.locked;
    return fieldWrap(s, `<label class="field__label" for="${id}">${s.label}${reqMark(s)}</label><div class="money${locked ? " is-locked" : ""}">${comboHTML(s.cur, wz.vals[s.cur] || "AED", { label: "Currency", disabled: locked, search: "Find currency" })}<input class="field__input money__in" id="${id}" data-k="${s.k}" type="text" inputmode="decimal" autocomplete="off" placeholder="Enter amount" value="${escapeHtml(wz.vals[s.k] || "")}"${locked ? " disabled" : ""}></div>`, id);
  }
  function fieldHTML(s) {
    if (s.t === "section") return `<h3 class="wz__sec">${s.label}</h3>`;
    if (s.t === "rich") return rteHTML();
    if (s.t === "lines") return linesHTML();
    if (!specShown(s)) return "";
    const id = `rf-${s.k}`, v = wz.vals[s.k] || "";
    const lab = `<label class="field__label" for="${id}">${s.label}${reqMark(s)}</label>`;
    const locked = s.lock && wz.locked;
    if (s.t === "money") return moneyHTML(s);
    if (s.t === "combo") {
      const off = (s.offIf && s.offIf(wz.vals)) || locked;
      return fieldWrap(s, `${lab.replace(`for="${id}"`, `for="${id}"`)}${comboHTML(s.k, v, { ph: s.ph, search: s.search, disabled: off, label: s.label })}`, id);
    }
    if (s.t === "radio") return `<fieldset class="field field--half rq-radio"><legend class="field__label">${s.label}${reqMark(s)}</legend><div class="rq-radio__row" role="radiogroup">${s.opts.map((o) => `<label class="rq-radio__opt"><input type="radio" name="rf-${s.k}" data-k="${s.k}" value="${o}"${v === o ? " checked" : ""}><span class="rq-radio__dot" aria-hidden="true"></span>${o}</label>`).join("")}</div></fieldset>`;
    if (s.t === "date") return fieldWrap(s, `${lab}<input class="field__input" id="${id}" data-k="${s.k}" type="date" value="${escapeHtml(v)}"${s.k === "due" && wz.vals.received ? ` min="${escapeHtml(wz.vals.received)}"` : ""}>`, id);
    const hint = s.hint ? s.hint() : "";
    return fieldWrap(s, `${lab}<input class="field__input" id="${id}" data-k="${s.k}" type="text" maxlength="90" autocomplete="off" placeholder="${escapeHtml(s.ph || "")}" value="${escapeHtml(v)}"${locked ? " disabled" : ""}>${hint ? `<p class="field__ok">${icon("i-check", "ico ico--xs")}${hint}</p>` : ""}`, id);
  }
  function linesHTML() {
    return `<div class="lines">${wz.lines.map((l, i) => `<div class="lines__row" data-i="${i}">
      ${fieldWrap({ half: 1 }, `<div class="lines__lab"><label class="field__label" for="rf-line-${i}-item">Line item${reqMark({ req: 1 })}</label>${i ? `<button class="lines__rm" type="button" data-line-rm="${i}" aria-label="Remove line item ${i + 1}">${icon("i-trash", "ico ico--sm")}</button>` : ""}</div>${comboHTML(`line:${i}:item`, l.item, { ph: "Enter item", label: `Line item ${i + 1}` })}`, `rf-line-${i}`)}
      ${fieldWrap({ half: 1 }, `<span class="field__label lines__lab2" aria-hidden="true">&nbsp;</span><div class="money">${comboHTML(`line:${i}:cur`, l.cur || "AED", { label: `Currency, line item ${i + 1}`, search: "Find currency" })}<input class="field__input money__in" data-line="${i}" type="text" inputmode="decimal" autocomplete="off" placeholder="Enter amount" aria-label="Amount, line item ${i + 1}" value="${escapeHtml(l.amount || "")}"></div>`, `rf-line-${i}-amt`)}</div>`).join("")}
      <button class="lines__add" type="button" data-line-add${wz.lines.length >= 10 ? " disabled" : ""}>${icon("i-plus", "ico ico--sm")}Add more</button></div>`;
  }

  // ---- step 1: details, with the rich-text justification ---------------
  const rteBtn = (cmd, label, inner, val = "") => `<button class="rte__btn" type="button" data-cmd="${cmd}"${val ? ` data-val="${val}"` : ""} aria-label="${label}" title="${label}">${inner}</button>`;
  const rteHTML = () => `<div class="field rte-field">
    <span class="field__label" id="wz-just-label">Business justification <span class="sp__req" aria-hidden="true">*</span></span>
    <div class="rte" id="wz-rte">
      <div class="rte__bar" role="toolbar" aria-label="Formatting" aria-controls="wz-edit">
        <span class="rte__grp">${rteBtn("undo", "Undo", icon("i-undo", "ico ico--sm"))}${rteBtn("redo", "Redo", icon("i-redo", "ico ico--sm"))}</span>
        <span class="rte__grp"><button class="rte__btn" type="button" data-zoom="-1" aria-label="Zoom out" title="Zoom out">${icon("i-minus", "ico ico--sm")}</button><span class="rte__zoom" id="wz-zoom" aria-live="polite">100%</span><button class="rte__btn" type="button" data-zoom="1" aria-label="Zoom in" title="Zoom in">${icon("i-plus", "ico ico--sm")}</button></span>
        <span class="rte__grp"><select class="rte__select" id="wz-block" aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>${rteBtn("insertUnorderedList", "Bulleted list", icon("i-list", "ico ico--sm"))}</span>
        <span class="rte__grp">${rteBtn("bold", "Bold", "<b>B</b>")}${rteBtn("italic", "Italic", "<i>I</i>")}${rteBtn("strikeThrough", "Strikethrough", "<s>S</s>")}${rteBtn("underline", "Underline", "<u>U</u>")}${rteBtn("hiliteColor", "Highlight", '<span class="rte__hl">A</span>', "#FFE58F")}</span>
        <span class="rte__grp">${rteBtn("justifyLeft", "Align left", icon("i-align-left", "ico ico--sm"))}${rteBtn("justifyCenter", "Align centre", icon("i-align-center", "ico ico--sm"))}${rteBtn("justifyRight", "Align right", icon("i-align-right", "ico ico--sm"))}${rteBtn("justifyFull", "Justify", icon("i-align-justify", "ico ico--sm"))}</span>
        <button class="rte__btn rte__expand" type="button" data-expand aria-label="Expand editor" aria-pressed="false" title="Expand editor">${icon("i-expand", "ico ico--sm")}</button>
      </div>
      <div class="rte__area"><div class="rte__edit" id="wz-edit" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="wz-just-label" data-placeholder="Why is this needed, and what happens if it isn’t approved?"></div></div>
      <div class="rte__ai">
        ${icon("i-sparkle", "ico ico--sm")}<input id="wz-ai" type="text" placeholder="Tell AI what else needs to be changed…" autocomplete="off" aria-label="Tell AI what else needs to be changed">
        <button class="rte__send" type="button" id="wz-ai-go" aria-label="Send to Bloom GPT" disabled>${icon("i-arrow-up", "ico ico--sm")}</button>
      </div>
    </div>
  </div>`;
  function rteBind() {
    const edit = $("#wz-edit"), rte = $("#wz-rte"), ai = $("#wz-ai"), go = $("#wz-ai-go");
    const LEVELS = [[12, 75], [14, 88], [16, 100], [18, 113], [20, 125], [24, 150]]; // font size in px, label in %
    let lvl = 2;
    edit.innerHTML = cleanHtml(wz.vals.details || "");
    try { document.execCommand("styleWithCSS", false, true); } catch (e) { /* older engines use font tags, which the clean-up allows */ }
    const sync = () => {
      wz.vals.details = cleanHtml(edit.innerHTML);
      wz.vals.detailsText = edit.textContent.trim();
      edit.dataset.empty = String(!wz.vals.detailsText && !edit.querySelector("li"));
      go.disabled = !wz.vals.detailsText;
      wzRefresh();
    };
    const state = () => $$("[data-cmd]", rte).forEach((b) => {
      if (!["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].includes(b.dataset.cmd)) return;
      let on = false;
      try { on = document.activeElement === edit && document.queryCommandState(b.dataset.cmd); } catch (e) { on = false; }
      b.setAttribute("aria-pressed", String(on));
    });
    edit.addEventListener("input", sync);
    edit.addEventListener("keyup", state); edit.addEventListener("mouseup", state);
    edit.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); });
    $(".rte__bar", rte).addEventListener("mousedown", (e) => { if (!e.target.closest("select")) e.preventDefault(); }); // keep the selection
    $(".rte__bar", rte).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.zoom) { lvl = clamp(lvl + Number(b.dataset.zoom), 0, LEVELS.length - 1); edit.style.fontSize = `${LEVELS[lvl][0]}px`; $("#wz-zoom").textContent = `${LEVELS[lvl][1]}%`; return; }
      if (b.dataset.expand !== undefined) {
        const on = rte.classList.toggle("is-expanded");
        b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Collapse editor" : "Expand editor");
        $("use", b).setAttribute("href", on ? "#i-collapse" : "#i-expand");
        return;
      }
      if (!b.dataset.cmd) return;
      edit.focus();
      let val = b.dataset.val || null;
      if (b.dataset.cmd === "hiliteColor" && document.queryCommandValue("hiliteColor").replace(/\s/g, "") === "rgb(255,229,143)") val = "transparent";
      document.execCommand(b.dataset.cmd, false, val);
      sync(); state();
    });
    $("#wz-block").addEventListener("change", (e) => { edit.focus(); document.execCommand("formatBlock", false, e.target.value); sync(); });
    // "Tell AI" — a stand-in: it tidies spacing and capitals, nothing leaves the page
    const runAi = () => {
      if (go.disabled) return;
      const w = document.createTreeWalker(edit, NodeFilter.SHOW_TEXT);
      const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach((n) => { n.textContent = n.textContent.replace(/\s+/g, " ").replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, c) => a + c.toUpperCase()); });
      const last = nodes[nodes.length - 1];
      if (last && !/[.!?:]\s*$/.test(last.textContent)) last.textContent = last.textContent.replace(/\s+$/, "") + ".";
      ai.value = "";
      sync();
      toast("Bloom GPT tidied your text", "i-sparkle");
    };
    go.addEventListener("click", runAi);
    ai.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); runAi(); } });
    sync();
  }

  // ---- approvers: an order, optionally switchable (memo) and, for RFP, a checklist each ------
  const personOf = (name) => PEOPLE.find((p) => p.name === name) || { name, role: "", initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2) };
  const isMemo = () => wz.def.key === "memo";
  const isRfp = () => wz.def.key === "rfp";
  const chkLabel = (name) => { const c = wz.checks[name] || []; return c.length ? (c.length > 2 ? `${c.length} selected` : c.join(", ")) : "Select checklist"; };
  const apvRow = (p, i) => `<li class="apv__row" data-name="${escapeHtml(p.name)}">
    ${wz.signing ? `<button class="apv__grip" type="button" aria-label="Move ${escapeHtml(p.name)}, position ${i + 1} of ${wz.approvers.length}. Drag, or use the arrow keys.">${icon("i-grip", "ico ico--sm")}</button><span class="apv__n" aria-hidden="true">${i + 1}</span>` : ""}
    <span class="who__av" aria-hidden="true">${p.initials}</span><span class="who__txt"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.role)}</small></span>
    ${isRfp() ? `<div class="combo combo--check apv__chk" data-check="${escapeHtml(p.name)}"><button class="combo__btn field__input${(wz.checks[p.name] || []).length ? "" : " is-ph"}" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Approval checklist for ${escapeHtml(p.name)}"><span>${escapeHtml(chkLabel(p.name))}</span>${icon("i-chevron-down", "ico ico--sm combo__chev")}</button><div class="combo__pop" hidden><p class="combo__head">Select checklist</p><div class="combo__list" role="listbox" aria-multiselectable="true">${CHECKLIST.map((c) => `<label class="combo__opt combo__opt--check" role="option"><input type="checkbox" value="${c}"${(wz.checks[p.name] || []).includes(c) ? " checked" : ""}><span class="combo__box" aria-hidden="true">${icon("i-check", "ico ico--xs")}</span>${c}</label>`).join("")}</div></div></div>` : ""}
    <button class="apv__rm" type="button" data-remove aria-label="Remove ${escapeHtml(p.name)}">${icon("i-trash", "ico ico--sm")}</button></li>`;
  function apvHTML() {
    return `<div class="apv">
      ${isMemo() ? `<div class="apv__top"><button class="apv__switch" type="button" role="switch" aria-checked="${wz.signing}" id="wz-sign"><span class="switch" aria-hidden="true"><span class="switch__thumb"></span></span>Set signing order</button>
        <p class="apv__note">${wz.signing ? "Approvers review one after another, in the order below." : "All approvers are notified at the same time."}</p></div>` : ""}
      <p class="apv__warn" id="apv-warn" role="status" hidden>${icon("i-info", "ico ico--sm")}Sequence should be selected appropriately. Assigning an HOD as the first approver may disrupt the intended approval flow.</p>
      <section class="apv__card" id="apv-picked" aria-label="Selected approvers" hidden><h3 class="apv__h">${wz.signing ? "Approval sequence" : "Approvers"}</h3>${wz.signing ? `<p class="apv__hint">Arrange approvers in the desired approval sequence by dragging and dropping them.</p>` : ""}<ol class="apv__list" id="apv-list"></ol></section>
      <section class="apv__card" aria-label="Add approver"><h3 class="apv__h">Add approver details</h3>
        <label class="ib-search"><svg class="ico ico--sm" aria-hidden="true"><use href="#i-search"/></svg><input id="apv-q" type="search" placeholder="Search by name &amp; email" autocomplete="off" aria-label="Search by name and email"></label>
        <div class="apv__results" id="apv-results"></div></section>
      <p class="sr-only" id="apv-live" aria-live="polite"></p></div>`;
  }
  const hodFirst = () => isRfp() && wz.approvers.length && (wz.checks[wz.approvers[0]] || []).includes("Head of Department");
  function apvPaint(focusName) {
    const list = $("#apv-list"), picked = $("#apv-picked"), res = $("#apv-results");
    picked.hidden = !wz.approvers.length;
    list.innerHTML = wz.approvers.map((n, i) => apvRow(personOf(n), i)).join("");
    $("#apv-warn").hidden = !hodFirst();
    const q = $("#apv-q").value.trim().toLowerCase();
    const rows = PEOPLE.filter((p) => !wz.approvers.includes(p.name) && `${p.name} ${p.email}`.toLowerCase().includes(q));
    res.innerHTML = rows.length
      ? rows.map((p) => `<div class="apv__res"><span class="who__av" aria-hidden="true">${p.initials}</span><span class="who__txt"><b>${p.name}</b><small>${p.role}</small></span><button class="btn btn--ghost btn--sm" type="button" data-add="${escapeHtml(p.name)}" aria-label="Add ${escapeHtml(p.name)}">${icon("i-plus", "ico ico--xs")}Add</button></div>`).join("")
      : `<div class="apv__empty">${icon("i-search", "ico")}<p>${q ? "No employee found with the name &amp; email ID" : "Everyone available has been added."}</p></div>`;
    if (focusName) $(`[data-name="${CSS.escape(focusName)}"] .apv__grip`, list)?.focus();
    wzRefresh();
  }
  function apvBind() {
    const list = $("#apv-list");
    apvPaint();
    $("#apv-q").addEventListener("input", () => apvPaint());
    $("#apv-results").addEventListener("click", (e) => {
      const b = e.target.closest("[data-add]");
      if (!b) return;
      wz.approvers.push(b.dataset.add); apvPaint();
      $("#apv-live").textContent = `${b.dataset.add} added as approver ${wz.approvers.length}`;
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-remove]");
      if (!b) return;
      const name = b.closest(".apv__row").dataset.name;
      flow({
        ico: "i-trash", tone: "bad", title: "Remove approver", text: "Are you sure you want to remove approver?", body: `<p class="flow__ref">${escapeHtml(name)}</p>`, confirm: "Remove", danger: true,
        done: () => { wz.approvers = wz.approvers.filter((n) => n !== name); delete wz.checks[name]; apvPaint(); $("#apv-q").focus(); }
      });
    });
    // checklist per approver (RFP)
    list.addEventListener("click", (e) => {
      const btn = e.target.closest(".apv__chk > .combo__btn");
      if (!btn) return;
      const box = btn.parentElement, open = btn.getAttribute("aria-expanded") !== "true";
      closeCombos();
      if (open) { btn.setAttribute("aria-expanded", "true"); $(".combo__pop", box).hidden = false; box.closest(".apv__row").classList.add("has-open"); }
    });
    list.addEventListener("change", (e) => {
      const cb = e.target.closest(".combo__opt--check input");
      if (!cb) return;
      const box = cb.closest("[data-check]"), name = box.dataset.check;
      const set = new Set(wz.checks[name] || []);
      cb.checked ? set.add(cb.value) : set.delete(cb.value);
      wz.checks[name] = CHECKLIST.filter((c) => set.has(c));
      const btn = $(".combo__btn", box);
      $("span", btn).textContent = chkLabel(name);
      btn.classList.toggle("is-ph", !wz.checks[name].length);
      $("#apv-warn").hidden = !hodFirst();
      wzRefresh();
    });
    // reorder: drag the handle (mouse, pen and touch) or use the arrow keys on it
    let drag = null;
    list.addEventListener("pointerdown", (e) => {
      const g = e.target.closest(".apv__grip");
      if (!g) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      drag = g.closest(".apv__row"); drag.classList.add("is-drag");
    });
    list.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const others = [...list.children].filter((r) => r !== drag);
      const next = others.find((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
      if (next) { if (drag.nextElementSibling !== next) list.insertBefore(drag, next); } else if (list.lastElementChild !== drag) list.appendChild(drag);
    });
    const drop = () => {
      if (!drag) return;
      const name = drag.dataset.name;
      drag = null;
      wz.approvers = [...list.children].map((r) => r.dataset.name);
      apvPaint(name);
    };
    list.addEventListener("pointerup", drop); list.addEventListener("pointercancel", drop);
    list.addEventListener("keydown", (e) => {
      const g = e.target.closest(".apv__grip");
      const d = { ArrowUp: -1, ArrowDown: 1 }[e.key];
      if (!g || !d) return;
      e.preventDefault();
      const name = g.closest(".apv__row").dataset.name, i = wz.approvers.indexOf(name), j = i + d;
      if (j < 0 || j >= wz.approvers.length) return;
      [wz.approvers[i], wz.approvers[j]] = [wz.approvers[j], wz.approvers[i]];
      apvPaint(name);
      $("#apv-live").textContent = `${name} moved to position ${j + 1} of ${wz.approvers.length}`;
    });
    const sign = $("#wz-sign");
    if (sign) sign.addEventListener("click", () => {
      const turn = () => { wz.signing = !wz.signing; wzRender(); $("#wz-sign").focus(); };
      if (wz.signing && wz.approvers.length > 1) {
        flow({
          ico: "i-info", title: "Disable signing order?", text: "If you turn off Set signing order, all approvers will be notified at the same time instead of following a defined approval sequence. Do you want to proceed?",
          confirm: "Confirm change", done: turn
        });
      } else turn();
    });
  }

  // ---- attachments ----------------------------------------------------------
  const attRowHTML = (f, i) => `<li class="att__row"><span class="att__c att__c--n" data-label="S.no">${i + 1}.</span><span class="att__c att__c--name" data-label="File name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><span class="att__c" data-label="File type">${f.kind}</span><span class="att__c" data-label="Size">${f.size}</span><span class="att__c" data-label="Date &amp; time">${f.when}</span><span class="att__c att__c--act"><button class="att__btn att__btn--del" type="button" data-del="${i}" aria-label="Remove ${escapeHtml(f.name)}">${icon("i-trash", "ico ico--sm")}</button><button class="att__btn att__btn--view" type="button" data-view="${i}" aria-label="View ${escapeHtml(f.name)}">${icon("i-eye", "ico ico--sm")}</button></span></li>`;
  function attHTML() {
    return `<div class="att">
      <section class="apv__card" aria-label="Upload files"><h3 class="apv__h">Upload files</h3>
        <div class="att__drop" id="att-drop"><span class="att__ico" aria-hidden="true">${icon("i-upload", "ico")}</span><p class="att__t">Drag &amp; drop the files here.</p><p class="att__s">Upload file in Excel, Word, PPT format, up to Max 10MB in size, Max ${WZ_MAX} files.</p>
          <input id="att-file" class="sr-only" type="file" multiple accept=".xls,.xlsx,.doc,.docx,.ppt,.pptx"><label class="btn btn--ghost btn--sm" for="att-file">Choose file from your computer</label></div>
        <p class="field__error" id="att-err" role="alert" hidden></p></section>
      <section class="apv__card" id="att-card" aria-label="Uploaded documents" hidden><h3 class="apv__h">Uploaded documents <span class="att__count" id="att-count"></span></h3>
        <div class="att__head" aria-hidden="true"><span>S.no</span><span>File name</span><span>File type</span><span>Size</span><span>Date &amp; time</span><span>Action</span></div>
        <ol class="att__list" id="att-list"></ol></section></div>`;
  }
  function attBind() {
    const input = $("#att-file"), err = $("#att-err"), drop = $("#att-drop");
    const paint = () => {
      $("#att-card").hidden = !wz.files.length;
      $("#att-count").textContent = `(${wz.files.length} of ${WZ_MAX})`;
      $("#att-list").innerHTML = wz.files.map(attRowHTML).join("");
    };
    const take = (list) => {
      const problems = [];
      [...list].forEach((f) => {
        const ext = f.name.split(".").pop().toLowerCase();
        if (!FILE_KINDS[ext]) problems.push(`${f.name} isn’t an Excel, Word or PPT file.`);
        else if (f.size > WZ_BYTES) problems.push(`${f.name} is over 10 MB.`);
        else if (wz.files.length >= WZ_MAX) { if (!problems.some((p) => p.includes("files"))) problems.push(`You can add up to ${WZ_MAX} files.`); }
        else wz.files.push({ name: f.name.replace(/\.[^.]+$/, ""), ext, kind: FILE_KINDS[ext], size: fmtSize(f.size), when: fmtWhen(new Date()), blob: URL.createObjectURL(f) });
      });
      err.hidden = !problems.length; err.textContent = problems.join(" ");
      paint(); wzRefresh();
    };
    input.addEventListener("change", () => { take(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
    drop.addEventListener("drop", (e) => take(e.dataTransfer.files));
    $("#att-list").addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]"), view = e.target.closest("[data-view]");
      if (del) { wz.files.splice(+del.dataset.del, 1); err.hidden = true; paint(); wzRefresh(); }
      if (view) { const f = wz.files[+view.dataset.view]; if (f.blob) window.open(f.blob, "_blank", "noopener"); else toast("No preview for this file in the prototype", "i-info"); }
    });
    paint();
  }

  // ---- the dropdown behaviour -------------------------------------------------
  function closeCombos(except) {
    $$(".combo", wzModal).forEach((c) => {
      if (c === except) return;
      const b = $(".combo__btn", c);
      if (b && b.getAttribute("aria-expanded") === "true") {
        b.setAttribute("aria-expanded", "false"); $(".combo__pop", c).hidden = true;
        const row = c.closest(".apv__row"); if (row) row.classList.remove("has-open");
      }
    });
  }
  const anyComboOpen = () => $$(".combo__btn[aria-expanded='true']", wzModal).length > 0;
  function comboPaint(box) {
    const id = box.dataset.combo, q = ($(".combo__search input", box)?.value || "").trim().toLowerCase(), cur = comboGet(id);
    const rows = comboOpts(id).filter((o) => o.v.toLowerCase().includes(q));
    $(".combo__list", box).innerHTML = rows.length
      ? rows.map((o) => `<button class="combo__opt" type="button" role="option" aria-selected="${o.v === cur}" data-v="${escapeHtml(o.v)}"><span>${o.label}</span>${icon("i-check", "ico ico--sm combo__tick")}</button>`).join("")
      : `<p class="combo__none">No match for “${escapeHtml(q)}”.</p>`;
  }
  function comboOpen(box) {
    closeCombos(box);
    const btn = $(".combo__btn", box), pop = $(".combo__pop", box);
    btn.setAttribute("aria-expanded", "true"); pop.hidden = false;
    comboPaint(box);
    pop.scrollIntoView({ block: "nearest" });
    ($(".combo__search input", box) || $(".combo__opt[aria-selected='true']", box) || $(".combo__opt", box))?.focus({ preventScroll: true });
  }
  function wzRepaint(focusId) {
    const m = $("#wz-main"), top = m.scrollTop, a = document.activeElement;
    const id = focusId || (a && wzPanel.contains(a) ? a.id : ""), pos = a && a.selectionStart;
    const specs = wzSpec();
    wzPanel.innerHTML = `<div class="rq-grid">${specs.map(fieldHTML).join("")}</div>`;
    if (specs.some((x) => x.t === "rich")) rteBind();
    m.scrollTop = top;
    const el = id && document.getElementById(id);
    if (el && !el.disabled) { el.focus({ preventScroll: true }); if (typeof pos === "number" && el.setSelectionRange && el.type === "text") try { el.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } }
    wzRefresh();
  }
  const cleanMoney = (v) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const fieldMsg = (id, msg) => { const err = $(`#${id}-err`), el = $(`#${id}`); if (!err) return; err.hidden = !msg; err.textContent = msg || ""; if (el) el.setAttribute("aria-invalid", String(!!msg)); };
  function poLookup() {
    const hit = PO_LOOKUP[(wz.vals.po || "").trim()];
    if (hit) { Object.assign(wz.vals, hit); wz.locked = true; wzRepaint(); }
    else if (wz.locked) { PO_FILLED.forEach((k) => { wz.vals[k] = k === "cur" ? "AED" : ""; }); wz.locked = false; wzRepaint(); }
  }
  function invoiceCheck(announce) {
    const dup = invoiceDup();
    fieldMsg("rf-invoice", dup ? DUP_MSG : "");
    if (dup && announce) toast(DUP_MSG, "i-x");
    wzRefresh();
  }
  function dateCheck() {
    const bad = wz.vals.received && wz.vals.due && wz.vals.due < wz.vals.received;
    fieldMsg("rf-due", bad ? "The due date can’t be before the received date." : "");
    wzRefresh();
  }

  // ---- the page itself -----------------------------------------------------------
  function wzRender() {
    const flowDef = WZ_FLOWS[wz.def.key], steps = flowDef.steps, last = wz.step === steps.length;
    $("#wz-crumb").textContent = wz.mode === "revise" ? "Revise & resubmit" : wz.mode === "edit" ? "Edit draft" : flowDef.crumb;
    $("#wz-steps").innerHTML = steps.map(([, l], i) => {
      const done = i + 1 < wz.step, cur = i + 1 === wz.step;
      return `<li class="${cur ? "is-current" : done ? "is-done" : ""}"><button type="button" class="wz__step" data-step="${i + 1}"${cur ? ' aria-current="step"' : ""}${i + 1 > wz.step ? " disabled" : ""}><b>${done ? icon("i-check", "ico ico--xs") : `0${i + 1}`}</b><span>${l}</span></button></li>`;
    }).join("");
    const [key, label, desc] = steps[wz.step - 1];
    $("#wz-num").textContent = `0${wz.step}`;
    $("#wz-back").hidden = wz.step === 1;
    $("#wz-back").setAttribute("aria-label", `Back to ${steps[Math.max(0, wz.step - 2)][1]}`);
    $("#wz-title").textContent = label;
    $("#wz-desc").textContent = desc;
    closeCombos();
    if (key === "approvers") { wzPanel.innerHTML = apvHTML(); apvBind(); }
    else if (key === "files") { wzPanel.innerHTML = attHTML(); attBind(); }
    else {
      const specs = wzSpec();
      wzPanel.innerHTML = `<div class="rq-grid">${specs.map(fieldHTML).join("")}</div>`;
      if (specs.some((s) => s.t === "rich")) rteBind();
    }
    wzDraft.hidden = wz.mode === "revise";
    $("#wz-next-label").textContent = !last ? "Save & next" : wz.mode === "revise" ? "Resubmit" : "Submit";
    $("#wz-main").scrollTop = 0;
    wzRefresh();
  }
  function wzOpen(item, mode, def) {
    Object.assign(wz, { item, mode, def, step: 1, signing: item ? item.signing !== false : true });
    const d = item && item.data ? item.data : {};
    wz.vals = { company: COMPANIES[0], dept: "", title: "", details: "", detailsText: "", cur: "AED", ...d, ...(item ? { title: item.title, details: item.detailsHtml || d.details || "", detailsText: item.details || d.detailsText || "", company: item.company || d.company || COMPANIES[0], dept: item.dept || d.dept || "" } : {}) };
    wz.lines = d.lines && d.lines.length ? d.lines.map((l) => ({ ...l })) : [{ item: "", cur: "AED", amount: "" }];
    wz.locked = !!d.locked;
    wz.checks = item && item.checks ? Object.fromEntries(Object.entries(item.checks).map(([k, v]) => [k, [...v]])) : {};
    wz.approvers = item && item.approvers ? [...item.approvers] : [];
    wz.files = item && item.files ? item.files.map((f) => ({ ...f })) : [];
    wzRender();
    wzModal.showModal();
    wz.snap = wzSnapshot();
    wzRefresh();
    setTimeout(() => $("#wz-panel .combo__btn:not(:disabled), #wz-panel input:not([type=radio])")?.focus({ preventScroll: true }), 40);
  }
  // typing and choosing in step fields
  wzPanel.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches(".combo__search input")) { comboPaint(t.closest(".combo")); return; }
    if (t.dataset.line !== undefined) { const v = cleanMoney(t.value); t.value = v; wz.lines[+t.dataset.line].amount = v; wzRefresh(); return; }
    const k = t.dataset.k;
    if (!k || t.type === "radio") return;
    let v = t.value;
    if (k === "amount") { v = cleanMoney(v); t.value = v; }
    wz.vals[k] = v;
    if (t.getAttribute("aria-invalid") === "true" && k !== "invoice" && k !== "due") fieldMsg(t.id, "");
    if (k === "po") { poLookup(); return; }
    if (k === "invoice") { fieldMsg("rf-invoice", ""); wzRefresh(); return; }
    if (k === "received" || k === "due") { if (k === "received" && t.value) { const due = $("#rf-due"); if (due) due.min = t.value; } dateCheck(); return; }
    wzRefresh();
  });
  wzPanel.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("input[type=radio]")) { wz.vals[t.dataset.k] = t.value; if (t.value === "No") wz.vals.budgetRef = ""; wzRepaint(); }
  });
  wzPanel.addEventListener("focusout", (e) => { if (e.target.id === "rf-invoice" && (wz.vals.invoice || "").trim()) invoiceCheck(true); });
  wzPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".combo > .combo__btn");
    if (btn && !btn.closest(".apv__chk")) { const box = btn.parentElement; btn.getAttribute("aria-expanded") === "true" ? closeCombos() : comboOpen(box); return; }
    const opt = e.target.closest(".combo__opt:not(.combo__opt--check)");
    if (opt) {
      const box = opt.closest(".combo"), id = box.dataset.combo;
      comboSet(id, opt.dataset.v);
      if (id === "category") wz.vals.sub = "";
      wzRepaint(`rf-${id.replace(/[^a-z0-9]/gi, "-")}`);
      return;
    }
    if (e.target.closest("[data-line-add]")) { if (wz.lines.length < 10) { wz.lines.push({ item: "", cur: "AED", amount: "" }); wzRepaint(); $$(".lines__row .combo__btn", wzPanel).pop()?.focus(); } return; }
    const rm = e.target.closest("[data-line-rm]");
    if (rm) { wz.lines.splice(+rm.dataset.lineRm, 1); wzRepaint(); }
  });
  wzPanel.addEventListener("keydown", (e) => {
    const box = e.target.closest(".combo:not(.combo--check)");
    if (!box) return;
    const btn = $(".combo__btn", box), open = btn.getAttribute("aria-expanded") === "true";
    if (e.target === btn && !open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); comboOpen(box); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCombos(); btn.focus(); return; }
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const items = [...$$(".combo__search input, .combo__opt", box)], i = items.indexOf(document.activeElement);
    items[clamp(i + d, 0, items.length - 1)]?.focus();
  });
  wzModal.addEventListener("click", (e) => { if (!e.target.closest(".combo")) closeCombos(); });
  $("#wz-back").addEventListener("click", () => { if (wz.step > 1) { wz.step -= 1; wzRender(); } });
  $("#wz-steps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (b && !b.disabled && Number(b.dataset.step) < wz.step) { wz.step = Number(b.dataset.step); wzRender(); }
  });
  function wzAttemptClose() {
    if (wzSnapshot() === wz.snap) { wzModal.close(); return; }
    flow({
      ico: "i-x", tone: "bad", title: "Discard changes?", text: "You have unsaved changes. If you cancel now, all the changes you’ve made will be discarded and cannot be recovered.",
      cancel: "No", confirm: "Yes", danger: true, done: () => wzModal.close()
    });
  }
  wzModal.addEventListener("cancel", (e) => { e.preventDefault(); if (anyComboOpen()) { closeCombos(); return; } wzAttemptClose(); });
  wzModal.addEventListener("close", () => { wzPanel.innerHTML = ""; }); // keep ids unique while it is closed
  $("#wz-cancel").addEventListener("click", wzAttemptClose);
  function wzSave(submit) {
    const v = wz.vals, d = wz.def;
    const title = (v.title || "").trim() || `Untitled ${d.short}`;
    let x = wz.item;
    if (!x) { x = rq({ state: "draft", type: d.key, title, ago: 0 }); ib.items.unshift(x); }
    Object.assign(x, {
      title, type: d.key, company: v.company, dept: v.dept, amount: fmtMoney(v.cur, v.amount), payee: (v.stakeholder || "").trim(),
      details: v.detailsText || "", detailsHtml: v.details || "", approvers: [...wz.approvers], checks: Object.fromEntries(Object.entries(wz.checks).map(([k, c]) => [k, [...c]])), signing: wz.signing,
      files: wz.files.map((f) => ({ ...f })), data: { ...v, lines: wz.lines.map((l) => ({ ...l })), locked: wz.locked }, ago: 0
    });
    if (submit) {
      x.ref = `REQ-2026-${String(++reqSeq).padStart(4, "0")}`;
      Object.assign(x, { state: "mine", status: "review", step: 1, steps: [...wz.approvers], parallel: !wz.signing, note: "", reminded: false, rfi: null });
    }
    wzModal.close();
    ib.fresh = x.id;
    if (ib.open) setIbTab(x.state); else openInbox(null, x.state);
    ib.fresh = x.id;
    renderIb();
    if (!submit) { toast("Draft saved", "i-edit"); return; }
    flow({
      ico: "i-sparkle", tone: "ok", title: "Request created successfully", body: `<p class="flow__ref flow__ref--ref">#${x.ref}</p>`,
      cancel: "Track request", confirm: "Go to home", done: () => closeInbox(),
      onCancel: () => { const li = ibList.querySelector(`[data-id="${x.id}"]`); if (li) li.scrollIntoView({ behavior: smooth(), block: "center" }); }
    });
  }
  $("#wz-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!wzValid()) return;
    if (wz.step < WZ_FLOWS[wz.def.key].steps.length) { wz.step += 1; wzRender(); return; }
    wzSave(true);
  });
  wzDraft.addEventListener("click", () => { if (!wzDraft.disabled) wzSave(false); });


  /* ---------------------------------------------------------------
     Announcements — birthdays, a work anniversary, a fire drill and
     Eid. One slide each (birthdays get one per person); the feed has
     one tile per kind, and the chapter takes that kind's mood.
     --------------------------------------------------------------- */
  const birthdays = [
    { name: "Ahmed Obaid", role: "Contact Center Agent", img: "img-rashid", initials: "AO" },
    { name: "Mariam Al Hashimi", role: "Finance Analyst", img: "img-av-mh", initials: "MH" },
    { name: "Yousef Karim", role: "Site Engineer", img: "img-av-yousef", initials: "YK" }
  ];
  const anniversary = { name: "Khalid Al Mazrouei", role: "Facilities Supervisor", img: "img-av-elder", initials: "KM", years: 10, since: "24 Sep 2016" };
  const firstName = (p) => p.name.split(" ")[0];
  const slides = [...birthdays.map((p, i) => ({ group: "bday", i })), { group: "anniv" }, { group: "drill" }, { group: "eid" }];
  const ANN_TILES = [
    { group: "bday", label: "Birthdays", title: `${birthdays.length} birthdays today`, sub: `${birthdays.slice(0, -1).map(firstName).join(", ")} & ${firstName(birthdays[birthdays.length - 1])}`,
      lead: `<span class="feed__stack">${birthdays.map((p) => `<span class="avatar ${p.img}">${p.initials}</span>`).join("")}</span>` },
    { group: "anniv", label: "Work anniversary", title: "Work anniversary", sub: `${anniversary.name} · ${anniversary.years} years`,
      lead: `<span class="avatar ${anniversary.img}">${anniversary.initials}</span><span class="feed__badge">${anniversary.years}</span>` },
    { group: "drill", label: "Fire drill", title: "Fire safety drill", sub: "26 Sep · 10:30 – 11:00 AM", lead: `<span class="feed__icon feed__icon--drill">${icon("i-flame")}</span>` },
    { group: "eid", label: "Holiday", title: "Eid Al Adha", sub: "Holiday · 25 – 29 May", lead: `<span class="feed__icon feed__icon--eid">${icon("i-moon")}</span>` }
  ];
  const ann = $("#announcements");
  const bTrack = $("#bday-track");
  const bDots = $("#bday-dots");
  const confetti = $("#confetti");
  let bIndex = 0;
  let bTimer = null;
  let annVisible = false;
  const letters = (s) => [...s].map((ch, i) => `<span class="l" style="--i:${i}">${escapeHtml(ch)}</span>`).join("");
  const bigName = (s) => `<span class="bday__name"><span class="sr-only">${escapeHtml(s)}</span><span aria-hidden="true">${letters(s)}</span></span>`;
  const EID_ART = `<svg class="eid__svg" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="eid-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9B5"/><stop offset=".5" stop-color="#F3B547"/><stop offset="1" stop-color="#C98320"/></linearGradient>
        <mask id="eid-cut"><rect x="-40" y="-40" width="320" height="320" fill="#fff"/><circle cx="160" cy="92" r="92" fill="#000"/></mask>
      </defs>
      <circle cx="108" cy="134" r="110" fill="url(#eid-gold)" mask="url(#eid-cut)"/>
      <path class="eid__string" d="M122 0v40" stroke-dasharray="1.5 4"/><path class="eid__star" d="M122 40l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4Z"/>
      <g class="eid__lantern" style="transform-origin: 158px 0">
        <path class="eid__string" d="M158 0v52"/><path class="eid__metal" d="M151 52h14l-2 5h-10Z"/>
        <path class="eid__glass" d="M149 58h18l6 11v28l-6 11h-18l-6-11V69Z"/><path class="eid__line" d="M158 58v50M143 83h30M149 58l-6 25 6 25M167 58l6 25-6 25"/>
        <circle class="eid__flame" cx="158" cy="84" r="5"/><path class="eid__metal" d="M153 108h10l-5 7Z"/>
      </g>
      <g class="eid__lantern eid__lantern--2" style="transform-origin: 204px 0">
        <path class="eid__string" d="M204 0v96"/><path class="eid__metal" d="M199 96h10l-1.5 4h-7Z"/>
        <path class="eid__glass" d="M198 101h12l4 8v19l-4 8h-12l-4-8v-19Z"/><path class="eid__line" d="M204 101v35M194 118h20"/>
        <circle class="eid__flame" cx="204" cy="118" r="3.5"/><path class="eid__metal" d="M200 136h8l-4 5Z"/>
      </g>
    </svg>`;

  const slideOpen = (n, kind) => `<article class="slide slide--${kind}${n ? "" : " is-current"}" data-group="${kind}" aria-roledescription="slide" aria-label="${n + 1} of ${slides.length}"${n ? ' aria-hidden="true"' : ""}>`;
  function slideHTML(sl, n) {
    if (sl.group === "bday") {
      const p = birthdays[sl.i];
      const also = birthdays.map((q, j) => (j === sl.i ? "" : `<button class="also__btn" type="button" data-go="${j}" aria-label="Show ${q.name}’s birthday"><span class="avatar ${q.img}">${q.initials}</span></button>`)).join("");
      return `${slideOpen(n, "bday")}
        <div class="bday__avatar slide__art"><span class="avatar ${p.img}">${p.initials}</span>${icon("i-gift")}</div>
        <div class="slide__text">
          <p class="bday__kicker">Birthday today</p>
          <h3 class="bday__title"><span class="bday__hb">Happy birthday,</span> ${bigName(firstName(p))}</h3>
          <p class="bday__role">${p.name}, ${p.role}</p>
          <p class="bday__msg">Let’s make the day memorable with your warm wishes.</p>
          <div class="slide__actions"><button class="btn btn--light btn--lg" type="button" data-wish="b${sl.i}">${icon("i-gift", "ico ico--sm")}<span>Send birthday wish</span></button><p class="slide__also"><span>Also today</span>${also}</p></div>
        </div></article>`;
    }
    if (sl.group === "anniv") {
      const p = anniversary;
      const dots = Array.from({ length: p.years }, (_, k) => `<i style="--k:${k}"></i>`).join("");
      return `${slideOpen(n, "anniv")}
        <div class="bday__avatar slide__art anniv__art"><span class="anniv__orbit" style="--n:${p.years}" aria-hidden="true">${dots}</span><span class="avatar ${p.img}">${p.initials}</span><span class="anniv__badge"><strong>${p.years}</strong><small>years</small></span></div>
        <div class="slide__text">
          <p class="bday__kicker">Work anniversary</p>
          <h3 class="bday__title"><span class="bday__hb">${p.years} years at Bloom,</span> ${bigName(firstName(p))}</h3>
          <p class="bday__role">${p.name}, ${p.role} · since ${p.since}</p>
          <p class="bday__msg">A decade of keeping our sites running smoothly. Say thank you.</p>
          <div class="slide__actions"><button class="btn btn--light btn--lg" type="button" data-wish="a">${icon("i-sparkle", "ico ico--sm")}<span>Say congratulations</span></button></div>
        </div></article>`;
    }
    if (sl.group === "drill") {
      return `${slideOpen(n, "drill")}
        <div class="slide__art drill__art" aria-hidden="true"><span class="drill__ring"></span><span class="drill__ring"></span><span class="drill__disc">${icon("i-flame")}</span></div>
        <div class="slide__text">
          <p class="bday__kicker">Safety · Fire drill</p>
          <h3 class="slide__title">Workplace fire safety drill</h3>
          <p class="bday__msg">We run regular drills so everyone knows the way out. When the alarm sounds, leave your things and follow your floor warden to the assembly point.</p>
          <div class="drill__when"><span class="drill__cal"><small>Sep</small><strong>26</strong></span><span class="drill__time"><strong>10:30 – 11:00 AM</strong><small>All floors · Assembly point A</small></span></div>
          <div class="slide__actions"><button class="btn btn--light btn--lg" type="button" data-remind>${icon("i-bellring", "ico ico--sm")}<span>Remind me</span></button><a class="btn btn--glass btn--lg" href="#" data-toast="Opening the evacuation plan…">Evacuation plan</a></div>
        </div></article>`;
    }
    return `${slideOpen(n, "eid")}
        <div class="slide__art eid__art" aria-hidden="true">${EID_ART}</div>
        <div class="slide__text">
          <p class="bday__kicker">Holiday</p>
          <h3 class="bday__title eid__title"><span class="eid__name">Eid Al Adha</span> <span class="bday__hb eid__mubarak">Mubarak</span></h3>
          <p class="eid__leave"><small>Eid holidays</small><strong>25 May – 29 May</strong></p>
          <p class="bday__msg">Wishing you and your family a blessed Eid.</p>
          <div class="slide__actions"><a class="btn btn--light btn--lg" href="#" data-toast="Opening Eid rewards…">${icon("i-gift", "ico ico--sm")}<span>View rewards</span></a></div>
        </div></article>`;
  }
  bTrack.innerHTML = slides.map(slideHTML).join("");
  bDots.innerHTML = ANN_TILES.map((t, i) => `<button class="dot feed__item" type="button" role="tab" data-group="${t.group}" aria-selected="${i === 0}" aria-label="${t.label}: ${t.title}, ${t.sub}"><span class="feed__lead">${t.lead}</span><span class="feed__txt"><strong>${t.title}</strong><small>${t.sub}</small></span>${t.group === "bday" ? `<span class="feed__meta" aria-hidden="true">01 / ${pad(birthdays.length)}</span>` : ""}<span class="feed__timer" aria-hidden="true"></span></button>`).join("");
  const slideEls = $$(".slide", bTrack);
  const tileEls = $$(".dot", bDots);
  const groupStart = (g) => slides.findIndex((sl) => sl.group === g);

  function restartTimer() {
    const timers = $$(".feed__timer", bDots);
    timers.forEach((t) => t.classList.remove("is-running"));
    if (reduceMotion || !annVisible) return;
    const t = timers[ANN_TILES.findIndex((x) => x.group === slides[bIndex].group)];
    void t.offsetWidth;
    t.classList.add("is-running");
  }
  function celebrate() {
    if (reduceMotion || !annVisible) return;
    const av = $(".slide.is-current .bday__avatar", bTrack);
    if (!av) return;
    const s = confetti.getBoundingClientRect();
    const r = av.getBoundingClientRect();
    burst(confetti, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 16, 170);
  }
  function goBday(i) {
    bIndex = (i + slides.length) % slides.length;
    const sl = slides[bIndex];
    bTrack.style.transform = `translateX(calc(${bIndex * -100}% - ${bIndex * 96}px))`;
    slideEls.forEach((s, n) => {
      const on = n === bIndex;
      s.setAttribute("aria-hidden", String(!on));
      $$("button, a", s).forEach((b) => { b.tabIndex = on ? 0 : -1; });
      s.classList.remove("is-current");
      if (on) { void s.offsetWidth; s.classList.add("is-current"); }
    });
    ann.dataset.mood = sl.group;
    tileEls.forEach((d) => d.setAttribute("aria-selected", String(d.dataset.group === sl.group)));
    if (sl.group === "bday") $(".feed__meta", bDots).textContent = `${pad(sl.i + 1)} / ${pad(birthdays.length)}`;
    restartTimer();
    setTimeout(celebrate, 380);
  }
  // Search can open any announcement
  function showAnnouncement(n) {
    goBday(n);
    ann.scrollIntoView({ behavior: smooth() });
  }
  const stopBday = () => { clearInterval(bTimer); ann.classList.add("is-paused"); };
  const startBday = () => {
    clearInterval(bTimer);
    ann.classList.remove("is-paused");
    restartTimer();
    if (!reduceMotion && annVisible) bTimer = setInterval(() => goBday(bIndex + 1), 6000);
  };
  $$("[data-bday]").forEach((b) => b.addEventListener("click", () => { goBday(bIndex + (b.dataset.bday === "next" ? 1 : -1)); startBday(); }));
  // A tile opens its kind; tapping Birthdays again moves to the next person
  tileEls.forEach((d) => d.addEventListener("click", () => {
    const g = d.dataset.group;
    const cur = slides[bIndex];
    goBday(g === "bday" && cur.group === "bday" ? (cur.i + 1) % birthdays.length : groupStart(g));
    startBday();
    // Stacked layouts put the stage above the feed: bring it into view
    const stage = $(".announce__stage");
    if (matchMedia("(max-width: 1199px)").matches && stage.getBoundingClientRect().top < 70) stage.scrollIntoView({ behavior: smooth(), block: "center" });
  }));
  bTrack.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { goBday(Number(go.dataset.go)); return; }
    const remind = e.target.closest("[data-remind]");
    if (remind && !remind.classList.contains("is-sent")) {
      remind.classList.add("is-sent");
      remind.innerHTML = `${icon("i-check", "ico ico--sm")}<span>Reminder set</span>`;
      toast("We’ll remind you at 10:15 AM on 26 Sep", "i-bellring");
    }
  });
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

  // Wish dialog — birthday wishes and anniversary congratulations
  const modal = $("#wish-modal");
  const wishText = $("#wish-text");
  const wishCount = $("#wish-count");
  const wishSend = $("#wish-send");
  const wishPresets = $("#wish-presets");
  const WISH = {
    b: { title: (f) => `Wish ${f} a happy birthday`, text: "Happy birthday! Wishing you a wonderful year ahead.", presets: ["Have a great day! 🎉", "Many happy returns", "Cake is on you today"], send: "Send wish", sent: "Wish sent", toast: (f) => `Your wish is on its way to ${f}` },
    a: { title: (f) => `Congratulate ${f} on ${anniversary.years} years`, text: `Happy work anniversary! Thank you for ${anniversary.years} great years.`, presets: [`Congrats on ${anniversary.years} years! 🎉`, "Here’s to many more", "Thanks for all you do"], send: "Send congrats", sent: "Congrats sent", toast: (f) => `Your congratulations are on their way to ${f}` }
  };
  let wishFor = "b0";
  const wishPerson = (key) => (key[0] === "a" ? anniversary : birthdays[Number(key.slice(1))]);

  const updateCount = () => { wishCount.textContent = wishText.value.length; wishSend.disabled = !wishText.value.trim(); };
  wishText.addEventListener("input", updateCount);
  wishPresets.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { wishText.value = c.textContent; updateCount(); wishText.focus(); } });

  bTrack.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wish]");
    if (!b || b.classList.contains("is-sent")) return;
    wishFor = b.dataset.wish;
    const p = wishPerson(wishFor);
    const w = WISH[wishFor[0]];
    $("#wish-title").textContent = w.title(firstName(p));
    $("#wish-role").textContent = `${p.name}, ${p.role}`;
    const av = $("#wish-avatar");
    av.className = `avatar avatar--xl ${p.img}`;
    av.textContent = p.initials;
    wishText.value = w.text;
    wishPresets.innerHTML = w.presets.map((t) => `<button class="chip" type="button">${escapeHtml(t)}</button>`).join("");
    $(".btn__label", wishSend).textContent = w.send;
    updateCount();
    stopBday();
    modal.showModal();
  });
  wishSend.addEventListener("click", () => {
    const w = WISH[wishFor[0]];
    wishSend.classList.add("is-loading");
    $(".btn__label", wishSend).textContent = "Sending";
    setTimeout(() => {
      wishSend.classList.remove("is-loading");
      $(".btn__label", wishSend).textContent = w.send;
      modal.close();
      const btn = $(`[data-wish="${wishFor}"]`, bTrack);
      btn.classList.add("is-sent");
      btn.innerHTML = `${icon("i-check", "ico ico--sm")}<span>${w.sent}</span>`;
      toast(w.toast(firstName(wishPerson(wishFor))), "i-gift");
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
    $("#people-counter").textContent = `${pad(pIndex + 1)} / ${pad(people.length)}`;
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
    r.count.textContent = `${pad(first + 1)} / ${pad(items.length)}`;
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
     Workplace perks — one list drives the chips, the index, the
     spotlight and search, so the chapter holds 4 perks or 40.
     The index shows PERK_LIMIT rows, then "Show all". The spotlight
     autoplays through the visible rows (the active row's rule is the
     timer) until you pick a perk yourself.
     --------------------------------------------------------------- */
  const PERK_CATS = { health: "Health", travel: "Travel", savings: "Savings", wellbeing: "Wellbeing", growth: "Growth" };
  const PERK_TAGS = { covered: "i-shield", ready: "i-check", new: "i-sparkle" };
  const perks = [
    { id: "medical", cat: "health", icon: "i-shield", img: "img-perk-medical", tag: ["covered", "Covered"], title: "Medical insurance", text: "You and your family are covered. Download the myNAS app to find clinics and submit claims.", cta: "Download myNAS app", toast: "Opening the myNAS download page…" },
    { id: "air", cat: "travel", icon: "i-plane", img: "img-perk-air", tag: ["ready", "Ready to book"], title: "Air tickets", text: "Your annual ticket home is ready to book.", cta: "See details", toast: "Opening air ticket details…" },
    { id: "mimojo", cat: "savings", icon: "i-wallet", img: "img-perk-mimojo", title: "Mimojo", text: "Cashback at cafés and stores near you.", cta: "Open Mimojo", toast: "Opening Mimojo…" },
    { id: "mazaya", cat: "savings", icon: "i-tag", img: "img-perk-mazaya", title: "Mazaya", text: "Member prices on travel, dining and leisure.", cta: "Open Mazaya", toast: "Opening Mazaya…" },
    // Sample perks that show the layout at scale. A perk without a photo gets generated art.
    { id: "checkup", cat: "health", icon: "i-pulse", tag: ["new", "New"], title: "Annual health check", text: "A free yearly check-up at partner clinics, booked around your calendar.", cta: "Book a check-up", toast: "Opening health check booking…" },
    { id: "travel-cover", cat: "travel", icon: "i-globe", tag: ["covered", "Covered"], title: "Travel insurance", text: "Covered worldwide whenever you travel for work.", cta: "View your cover", toast: "Opening your travel cover…" },
    { id: "mobile", cat: "savings", icon: "i-phone", title: "Family mobile plan", text: "Discounted lines for you and your family on a partner network.", cta: "See plans", toast: "Opening mobile plans…" },
    { id: "gym", cat: "wellbeing", icon: "i-heart", title: "Gym & wellness", text: "Corporate rates at partner gyms, pools and studios.", cta: "Find a gym", toast: "Opening partner gyms…" },
    { id: "counselling", cat: "wellbeing", icon: "i-leaf", title: "Counselling", text: "Free, confidential sessions with a wellbeing counsellor.", cta: "Book a session", toast: "Opening counselling bookings…" },
    { id: "birthday-leave", cat: "wellbeing", icon: "i-cake", tag: ["new", "New"], title: "Birthday leave", text: "Take your birthday off, on us.", cta: "Plan your day", toast: "Opening leave planner…" },
    { id: "learning", cat: "growth", icon: "i-cap", title: "Learning budget", text: "A yearly budget for courses, books and certifications.", cta: "Browse courses", toast: "Opening the course catalogue…" },
    { id: "referral", cat: "growth", icon: "i-users", title: "Referral bonus", text: "Recommend someone great. You’re rewarded when they join.", cta: "Refer a friend", toast: "Opening referrals…" }
  ];
  const PERK_LIMIT = 6;
  const perksSec = $("#perks");
  const perkChips = $("#perk-chips");
  const perkList = $("#perk-list");
  const perkMore = $("#perks-more");
  const perkSpotEl = $("#perk-spot");
  const perkShots = $("#perk-shots");
  const perkBody = $("#perk-body");
  const perkStage = $(".perks__stage");
  const pk = { cat: "all", open: false, id: perks[0].id, auto: !reduceMotion, hover: false, focus: false, inView: false };
  const perkById = (id) => perks.find((x) => x.id === id);
  const perkPool = () => (pk.cat === "all" ? perks : perks.filter((x) => x.cat === pk.cat));
  const perkShown = () => (pk.open ? perkPool() : perkPool().slice(0, PERK_LIMIT));

  function renderPerkChips() {
    const n = (c) => perks.filter((x) => x.cat === c).length;
    perkChips.innerHTML = [["all", "All", perks.length], ...Object.keys(PERK_CATS).filter(n).map((c) => [c, PERK_CATS[c], n(c)])]
      .map(([c, label, count]) => `<button class="chip${pk.cat === c ? " is-selected" : ""}" type="button" aria-pressed="${pk.cat === c}" data-cat="${c}"${c === "all" ? "" : ` data-pc="${c}"`}>${c === "all" ? "" : '<span class="chip__dot" aria-hidden="true"></span>'}${label}<span class="chip__count">${count}</span></button>`).join("");
  }
  function renderPerkList(animateFrom = -1) {
    const pool = perkPool();
    perkList.innerHTML = perkShown().map((x, i) => {
      const on = x.id === pk.id;
      const rise = animateFrom >= 0 && i >= animateFrom ? ` class="is-in" style="--i:${i - animateFrom}"` : "";
      return `<li role="presentation"${rise}><button class="perk-row${on ? " is-active" : ""}" type="button" role="tab" id="perk-tab-${x.id}" aria-selected="${on}" aria-controls="perk-spot" tabindex="${on ? 0 : -1}" data-perk="${x.id}" data-pc="${x.cat}">
        <span class="perk-row__num">${pad(i + 1)}</span><span class="perk-row__tile">${icon(x.icon)}</span>
        <span class="perk-row__text"><span class="perk-row__title">${escapeHtml(x.title)}</span><span class="perk-row__meta">${PERK_CATS[x.cat]}${x.tag ? ` · ${x.tag[1]}` : ""}</span></span>
        ${icon("i-arrow", "ico perk-row__go")}</button></li>`;
    }).join("");
    perkMore.hidden = pool.length <= PERK_LIMIT;
    perkMore.setAttribute("aria-expanded", String(pk.open));
    $("span", perkMore).textContent = pk.open ? "Show fewer" : `Show all ${pool.length} perks`;
  }
  function renderPerkSpot(animate) {
    const x = perkById(pk.id);
    const shot = document.createElement("div");
    shot.className = `perk-shot ${x.img || "perk-shot--art"}${animate ? "" : " is-active"}`;
    shot.dataset.pc = x.cat;
    if (!x.img) shot.innerHTML = `${icon(x.icon, "ico perk-shot__icon")}${icon("i-sparkle", "ico perk-shot__spark")}`;
    if (animate) {
      $$(".perk-shot", perkShots).forEach((s) => { s.classList.remove("is-active"); s.classList.add("was-active"); });
      perkShots.append(shot);
      void shot.offsetWidth; // start the wipe from below
      shot.classList.add("is-active");
      $$(".perk-shot", perkShots).slice(0, -2).forEach((s) => s.remove());
    } else {
      perkShots.replaceChildren(shot);
    }
    perkBody.innerHTML = `<p class="perk-spot__top"><span class="perk-spot__cat" data-pc="${x.cat}"><span class="chip__dot" aria-hidden="true"></span>${PERK_CATS[x.cat]}</span>${x.tag ? `<span class="tag perk-spot__tag">${icon(PERK_TAGS[x.tag[0]], "ico ico--xs")}${x.tag[1]}</span>` : ""}</p>
      <h3 class="perk-spot__title">${escapeHtml(x.title)}</h3>
      <p class="perk-spot__text">${escapeHtml(x.text)}</p>
      <a class="btn btn--light btn--sm perk-spot__cta" href="#" data-toast="${escapeHtml(x.toast)}">${escapeHtml(x.cta)} ${icon("i-arrow", "ico ico--sm btn__arrow")}</a>`;
    if (animate) { perkBody.classList.remove("is-changing"); void perkBody.offsetWidth; perkBody.classList.add("is-changing"); }
    perkSpotEl.setAttribute("aria-labelledby", `perk-tab-${x.id}`);
    const pool = perkPool();
    const i = pool.findIndex((p) => p.id === x.id);
    $("#perk-count").textContent = `${pad(i + 1)} / ${pad(pool.length)}`;
    $("#perk-progress").style.setProperty("--rp", ((i + 1) / pool.length).toFixed(3));
    $("#perk-prev").disabled = $("#perk-next").disabled = pool.length < 2;
  }
  function stopPerkAuto() { pk.auto = false; perkList.classList.remove("is-auto"); }
  function syncPerkPause() { perkList.classList.toggle("is-paused", !pk.inView || pk.hover || pk.focus || document.hidden); }
  function setPerk(id, { user = false, reveal = false } = {}) {
    if (user) stopPerkAuto();
    const pool = perkPool();
    const at = pool.findIndex((x) => x.id === id);
    if (at < 0) return;
    const changed = id !== pk.id || !perkShots.firstChild;
    pk.id = id;
    if (!pk.open && at >= PERK_LIMIT) { pk.open = true; renderPerkList(PERK_LIMIT); }
    $$(".perk-row", perkList).forEach((r) => {
      const on = r.dataset.perk === id;
      r.classList.toggle("is-active", on);
      r.setAttribute("aria-selected", String(on));
      r.tabIndex = on ? 0 : -1;
    });
    if (changed) renderPerkSpot(!!perkShots.firstChild);
    // Phones stack the spotlight above the index: bring it into view
    if (reveal && matchMedia("(max-width: 1023px)").matches) {
      const r = perkStage.getBoundingClientRect();
      if (r.top < 80 || r.bottom > innerHeight) perkStage.scrollIntoView({ behavior: smooth(), block: "center" });
    }
  }
  function stepPerk(d) {
    const pool = perkPool();
    const i = pool.findIndex((x) => x.id === pk.id);
    setPerk(pool[(i + d + pool.length) % pool.length].id, { user: true });
  }
  function pickPerkCat(cat) {
    stopPerkAuto();
    pk.cat = cat;
    pk.open = false;
    pk.id = perkPool()[0].id;
    renderPerkChips();
    renderPerkList(0);
    renderPerkSpot(true);
  }
  // Search finds any perk; picking one selects it here
  function revealPerk(id) {
    const x = perkById(id);
    if (!x) return;
    if (pk.cat !== "all" && pk.cat !== x.cat) { pk.cat = "all"; pk.open = false; renderPerkChips(); renderPerkList(); }
    setPerk(id, { user: true });
    perksSec.scrollIntoView({ behavior: smooth() });
  }
  searchIndex.splice(searchIndex.findIndex((it) => it.group === "Perks"), 0, ...perks.map((x) => ({ group: "Perks", label: x.title, meta: `${PERK_CATS[x.cat]} perk`, perk: x.id })));

  renderPerkChips();
  renderPerkList();
  renderPerkSpot(false);
  perkList.classList.toggle("is-auto", pk.auto);

  perkChips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c && c.dataset.cat !== pk.cat) pickPerkCat(c.dataset.cat); });
  perkList.addEventListener("click", (e) => { const r = e.target.closest(".perk-row"); if (r) setPerk(r.dataset.perk, { user: true, reveal: true }); });
  perkList.addEventListener("keydown", (e) => {
    const rows = $$(".perk-row", perkList);
    const i = rows.indexOf(document.activeElement);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: rows.length - 1 }[e.key];
    if (next === undefined || i < 0) return;
    e.preventDefault();
    const row = rows[(next + rows.length) % rows.length];
    setPerk(row.dataset.perk, { user: true });
    row.focus();
  });
  // Autoplay: when the active row's timer rule finishes, move to the next visible row
  perkList.addEventListener("animationend", (e) => {
    if (!pk.auto || e.animationName !== "timer" || !e.target.classList.contains("is-active")) return;
    const rows = perkShown();
    const i = rows.findIndex((x) => x.id === pk.id);
    setPerk(rows[(i + 1) % rows.length].id);
  });
  perkMore.addEventListener("click", () => {
    stopPerkAuto();
    pk.open = !pk.open;
    if (!pk.open && perkPool().findIndex((x) => x.id === pk.id) >= PERK_LIMIT) { pk.id = perkPool()[0].id; renderPerkSpot(true); }
    renderPerkList(pk.open ? PERK_LIMIT : -1);
    if (!pk.open && perkList.getBoundingClientRect().top < 0) perkList.scrollIntoView({ behavior: smooth(), block: "start" });
  });
  $("#perk-prev").addEventListener("click", () => stepPerk(-1));
  $("#perk-next").addEventListener("click", () => stepPerk(1));
  // Swipe the spotlight on touch screens
  let perkSwipe = null;
  perkSpotEl.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") perkSwipe = [e.clientX, e.clientY]; });
  perkSpotEl.addEventListener("pointercancel", () => { perkSwipe = null; });
  perkSpotEl.addEventListener("pointerup", (e) => {
    if (!perkSwipe) return;
    const dx = e.clientX - perkSwipe[0], dy = e.clientY - perkSwipe[1];
    perkSwipe = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) stepPerk(dx < 0 ? 1 : -1);
  });
  // Pause the timer while you read, point at, or tab through the chapter
  [$(".perks__index"), perkStage].forEach((el) => {
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { pk.hover = true; syncPerkPause(); } });
    el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { pk.hover = false; syncPerkPause(); } });
  });
  perksSec.addEventListener("focusin", () => { pk.focus = true; syncPerkPause(); });
  perksSec.addEventListener("focusout", (e) => { if (!perksSec.contains(e.relatedTarget)) { pk.focus = false; syncPerkPause(); } });
  document.addEventListener("visibilitychange", syncPerkPause);
  new IntersectionObserver(([en]) => { pk.inView = en.isIntersecting; syncPerkPause(); }, { threshold: 0.35 }).observe(perkStage);
  syncPerkPause();

  /* ---------------------------------------------------------------
     Bloom GPT — the platform's assistant
     A scripted agent: it reads the same data the page shows (tasks,
     people, announcements, policies, perks, discounts, communities,
     drafts, FAQs), answers with cards, and acts on them: approve a
     task, open a person or policy, set a reminder, copy a code.
     --------------------------------------------------------------- */
  const gptEl = $("#gpt-page");
  const gptThread = $("#gpt-thread");
  const gptInput = $("#gpt-input");
  const gptNew = $("#gpt-new");
  const gpt = { open: false, busy: false, returnFocus: null, typing: null };
  const GPT_ASK = [
    ["What needs my attention?", "i-bolt"], ["Show my tasks", "i-check"], ["Find a policy", "i-doc"], ["Leave policies", "i-calendar"],
    ["What’s new?", "i-megaphone"], ["Find a colleague", "i-users"], ["My drafts", "i-edit"], ["Show my benefits", "i-shield"],
    ["Travel discounts", "i-tag"], ["Find communities", "i-ball"], ["Take me to my profile", "i-user"], ["Help", "i-help"]
  ];
  const GPT_ICON = Object.fromEntries(GPT_ASK);
  const GPT_HINTS = ["Who joined the team this week?", "What needs my attention?", "When is the fire drill?", "Show my benefits", "What changed in Data Security?"];
  const PC_HUE = { health: "var(--pc-health)", travel: "var(--pc-travel)", savings: "var(--pc-savings)", wellbeing: "var(--pc-wellbeing)", growth: "var(--pc-growth)" };
  const gptChip = (q, cls = "") => `<button class="chip gpt-chip${cls}" type="button" data-gpt-ask="${escapeHtml(q)}">${icon(GPT_ICON[q] || "i-sparkle", "ico ico--sm")}${escapeHtml(q)}</button>`;
  $("#gpt-chips").innerHTML = GPT_ASK.map(([q]) => gptChip(q)).join("");

  // answer building blocks
  const B = (t) => `<strong>${escapeHtml(t)}</strong>`;
  const act = (label, a, v = "", cls = "btn--quiet") => `<button class="btn btn--sm ${cls}" type="button" data-gpt-act="${a}" data-v="${escapeHtml(String(v))}">${escapeHtml(label)}</button>`;
  const gRow = ({ lead, title, meta = "", actions = "" }) => `<li class="gpt-row"><span class="gpt-row__lead">${lead}</span><span class="gpt-row__txt"><strong>${escapeHtml(title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span><span class="gpt-row__act">${actions}</span></li>`;
  const gCard = (rows) => `<ul class="gpt-card">${rows.join("")}</ul>`;
  const gTile = (ic, hue = "var(--accent)") => `<span class="gpt-tile" style="--hue:${hue}">${icon(ic)}</span>`;
  const initialsOf = (name) => name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const gAv = (p) => `<span class="avatar ${p.img}">${initialsOf(p.name)}</span>`;
  const gMark = (src) => `<span class="app-mark app-mark--${sourceMarks[src]}">${sourceNames[src].slice(0, 2)}</span>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const openTasks = () => taskRows().filter((r) => !r.classList.contains("is-done"));
  const policyInfo = (card) => ({ name: card.dataset.name, cat: $(".tag", card)?.textContent.trim() || "Policy", desc: $(".policy__desc", card).textContent.trim(), meta: $(".policy__foot .meta", card)?.textContent.trim() || "" });
  const POLICY_KEYS = { "Data Security": /security|data/, "Management Process": /management|process/, "Brand Guidelines": /brand|guideline/, "Code of Conduct": /conduct/, "Travel & Expenses": /expense|travel/ };
  const partnersData = () => $$(".partner").map((p) => ({ name: $(".partner__name", p).textContent, cat: $(".partner__cat", p).textContent, off: $(".offer strong", p).textContent, code: $(".partner__code", p).dataset.code, logo: [...$(".partner__logo", p).classList].find((c) => c.startsWith("img-")) }));
  const sportsData = () => sportsEls.map((x) => ({ name: $(".sport__name", x).textContent, members: parseInt($(".sport__foot > span:last-child", x)?.textContent, 10) || 0 }));
  const everyone = () => [...people.map((p, i) => ({ ...p, kind: "joiner", i })), ...birthdays.map((p, i) => ({ ...p, kind: "birthday", i })), { ...anniversary, kind: "anniv" }];

  const GPT_SKILLS = {
    attention() {
      const open = openTasks();
      const overdue = open.filter((r) => $(".due--overdue", r));
      const today = open.filter((r) => $(".due--today", r));
      const pick = [...overdue, ...today].slice(0, 4);
      const all = taskRows();
      return {
        text: `You have ${B(`${totalPending()} actions`)} across ${plural(APP_ORDER.filter((a) => counts[a]).length, "app", "apps")}. ${overdue.length ? `${B(`${overdue.length} ${overdue.length === 1 ? "is" : "are"} overdue`)} and ` : ""}${today.length} ${today.length === 1 ? "is" : "are"} due today. Start with these:`,
        body: pick.length ? gCard(pick.map((r) => { const i = all.indexOf(r); return gRow({ lead: gMark(r.dataset.source), title: $(".task__title", r).textContent, meta: `${sourceNames[r.dataset.source]} · ${$(".due", r).textContent.trim()}`, actions: act("Review", "task", i) + act("Approve", "approve", i, "btn--primary") }); })) : "",
        follow: ["Show my tasks", "My drafts"]
      };
    },
    tasks: () => ({
      text: `${B(`${totalPending()} actions`)} are waiting on you. Here they are by app:`,
      body: gCard(APP_ORDER.map((a) => gRow({ lead: gMark(a), title: sourceNames[a], meta: `${counts[a]} waiting`, actions: act("Show", "filter", a) }))),
      actions: act("Open inbox", "inbox", "inbox", "btn--primary"),
      follow: ["What needs my attention?", "My drafts"]
    }),
    policy(t) {
      const named = Object.keys(POLICY_KEYS).find((n) => POLICY_KEYS[n].test(t) && !/^find a polic/.test(t));
      if (named) {
        const p = policyInfo(policies.find((c) => c.dataset.name === named));
        return { text: `${B(p.name)} · ${escapeHtml(p.cat)}. ${escapeHtml(p.desc)}${/updated/i.test(p.meta) ? ` <span class="msg__meta">${escapeHtml(p.meta)}</span>` : ""}`, actions: act("Open policy", "policy", p.name, "btn--primary"), follow: ["Find a policy", "What’s new?"] };
      }
      return {
        text: `Here’s the policy library. ${B("Data Security")} was updated most recently.`,
        body: gCard(policies.map((c) => { const p = policyInfo(c); return gRow({ lead: gTile("i-book"), title: p.name, meta: p.cat, actions: act("Open", "policy", p.name) }); })),
        follow: ["Leave policies", "What changed in Data Security?"]
      };
    },
    leave: () => ({
      text: `There isn’t a leave policy in the library yet. Leave requests and balances are handled in ${B("Darwinbox")}. Coming up: ${B("Eid Al Adha holidays, 25 – 29 May")}.`,
      body: gCard([
        gRow({ lead: gTile("i-moon", "#13806A"), title: "Eid Al Adha holidays", meta: "25 May – 29 May", actions: act("View", "ann", groupStart("eid")) }),
        gRow({ lead: gMark("darwinbox"), title: "Request leave in Darwinbox", meta: "Balances and approvals", actions: `<button class="btn btn--sm btn--quiet" type="button" data-toast="Darwinbox leave">Open</button>` }),
        gRow({ lead: gTile("i-book"), title: "Travel & Expenses", meta: "Operations policy", actions: act("Open", "policy", "Travel & Expenses") })
      ]),
      follow: ["Find a policy", "What’s new?"]
    }),
    news: () => ({
      text: "Here’s what’s new at Bloom today:",
      body: gCard([
        gRow({ lead: gAv(birthdays[0]), title: `${birthdays.length} birthdays today`, meta: birthdays.map(firstName).join(", "), actions: act("Wish", "wish", 0) }),
        gRow({ lead: gAv(anniversary), title: `${anniversary.name}, ${anniversary.years} years`, meta: "Work anniversary", actions: act("View", "ann", groupStart("anniv")) }),
        gRow({ lead: gTile("i-flame", "#E0472B"), title: "Fire safety drill", meta: "26 Sep · 10:30 – 11:00 AM", actions: act("View", "ann", groupStart("drill")) }),
        gRow({ lead: gAv(people[0]), title: `${people[0].name} joined`, meta: people[0].role, actions: act("Meet", "person", 0) }),
        gRow({ lead: gTile("i-shield"), title: "Data Security was updated", meta: "Security policy", actions: act("Read", "policy", "Data Security") })
      ]),
      follow: ["Who joined the team this week?", "When is the fire drill?"]
    }),
    birthday: () => ({
      text: `It’s ${B(birthdays[0].name)}’s birthday today, and ${birthdays.slice(1).map((p) => `${escapeHtml(firstName(p))}’s`).join(" and ")} too.`,
      body: gCard(birthdays.map((p, i) => gRow({ lead: gAv(p), title: p.name, meta: p.role, actions: act("Send wish", "wish", i, "btn--primary") }))),
      follow: ["What’s new?", "Find a colleague"]
    }),
    anniv: () => ({
      text: `${B(anniversary.name)}, ${escapeHtml(anniversary.role)}, celebrates ${B(`${anniversary.years} years`)} at Bloom today. He joined on ${escapeHtml(anniversary.since)}.`,
      actions: act("Say congratulations", "congrats", "", "btn--primary"),
      follow: ["What’s new?"]
    }),
    drill: () => ({
      text: `The ${B("fire safety drill")} is on ${B("26 Sep, 10:30 – 11:00 AM")}, on all floors. When the alarm sounds, leave your things and follow your floor warden to Assembly point A.`,
      actions: act("Remind me", "remind", "", "btn--primary") + act("View announcement", "ann", groupStart("drill")),
      follow: ["What’s new?"]
    }),
    colleague(t) {
      const who = everyone().find((p) => t.includes(firstName(p).toLowerCase()));
      if (who) {
        const extra = who.kind === "joiner" ? `${who.team} · ${who.week.toLowerCase()}` : who.kind === "birthday" ? "Birthday today" : `${anniversary.years}-year work anniversary`;
        const action = who.kind === "joiner" ? act("Meet", "person", who.i, "btn--primary") : who.kind === "birthday" ? act("Send wish", "wish", who.i, "btn--primary") : act("Say congratulations", "congrats", "", "btn--primary");
        return { text: `Here’s ${B(who.name)}:`, body: gCard([gRow({ lead: gAv(who), title: who.name, meta: `${who.role} · ${extra}`, actions: action })]), follow: ["Find a colleague", "What’s new?"] };
      }
      return {
        text: `${B(`${people.length} people`)} joined Bloom this month. This week: ${B(people[0].name)}, ${escapeHtml(people[0].role)}.`,
        body: gCard(people.map((p, i) => gRow({ lead: gAv(p), title: p.name, meta: `${p.role} · ${p.team}`, actions: act("Meet", "person", i) }))),
        follow: ["Whose birthday is it today?", "What’s new?"]
      };
    },
    drafts() {
      const d = ib.items.filter((x) => x.state === "draft").sort((a, b) => a.ago - b.ago);
      return {
        text: d.length ? `You have ${B(plural(d.length, "draft", "drafts"))}. The most recent:` : "You have no drafts. Start one with New request in the inbox.",
        body: d.length ? gCard(d.slice(0, 3).map((x) => gRow({ lead: `<span class="ib-row__icon" style="--c: var(--viz-${IB_TYPES[x.type].slot})">${icon("i-doc")}</span>`, title: x.title, meta: `${IB_TYPES[x.type].label} · edited ${ibAgo(x.ago)}`, actions: act("Edit", "draft", x.id) }))) : "",
        actions: act("Open drafts", "inbox", "draft", "btn--primary"),
        follow: ["Show my tasks", "What needs my attention?"]
      };
    },
    benefits: () => ({
      text: `You have ${B(`${perks.length} perks`)}. Your core benefits:`,
      body: gCard(perks.slice(0, 4).map((p) => gRow({ lead: gTile(p.icon, PC_HUE[p.cat]), title: p.title, meta: `${PERK_CATS[p.cat]}${p.tag ? ` · ${p.tag[1]}` : ""}`, actions: act("Open", "perk", p.id) }))),
      actions: act("See all perks", "goto", "#perks"),
      follow: ["Travel discounts", "Find communities"]
    }),
    discounts(t) {
      const all = partnersData();
      const travel = /travel|hotel|stay|trip/.test(t);
      const list = travel ? all.filter((p) => /stay|hotel|spa/i.test(p.cat)) : all.slice().sort((a, b) => parseInt(b.off, 10) - parseInt(a.off, 10)).slice(0, 4);
      const rows = list.map((p) => gRow({ lead: `<span class="gpt-logo"><span class="partner__logo ${p.logo}"></span></span>`, title: p.name, meta: `${p.cat} · ${p.off} off`, actions: act("Get code", "code", p.code, "btn--primary") }));
      if (travel) { const air = perks.find((p) => p.id === "air"); rows.push(gRow({ lead: gTile(air.icon, PC_HUE.travel), title: air.title, meta: "Perk · Ready to book", actions: act("Open", "perk", "air") })); }
      return { text: travel ? "For travel and stays, these apply to you:" : `Your best partner offers, from ${B(`${all.length} partners`)}:`, body: gCard(rows), actions: act("All discounts", "goto", "#discounts"), follow: ["Show my benefits", "Find communities"] };
    },
    communities(t) {
      const all = sportsData();
      const one = all.find((s) => t.includes(s.name.toLowerCase()));
      const list = one ? [one] : all;
      const top = all.slice().sort((a, b) => b.members - a.members)[0];
      return {
        text: one ? `The ${B(one.name)} community has ${B(`${one.members} members`)}.` : `There are ${B(`${all.length} communities`)} to join. ${escapeHtml(top.name)} is the biggest, with ${top.members} members.`,
        body: gCard(list.map((s) => gRow({ lead: gTile("i-ball", "#2E5BFF"), title: s.name, meta: `${s.members} members`, actions: act("View", "sport", s.name) }))),
        follow: ["Show my benefits", "What’s new?"]
      };
    },
    profile: () => ({
      text: "Opening your profile…",
      body: gCard([gRow({ lead: `<span class="avatar img-rashid">RK</span>`, title: "Rashid Khan", meta: "Sr. Engineer · rashid.khan@bloom.ae", actions: act("Open profile", "drawer", "profile", "btn--primary") })]),
      then: () => setTimeout(() => { if (gpt.open) GPT_ACTS.drawer("profile"); }, reduceMotion ? 300 : 1200)
    }),
    help: () => ({
      text: "Here are quick answers to common questions:",
      body: `<div class="gpt-faqs">${$$("#faq .faqs__item").slice(0, 3).map((d) => `<details class="gpt-faq"><summary>${escapeHtml($("summary", d).textContent.trim())}</summary><p>${escapeHtml($(".faqs__a", d).textContent.trim())}</p></details>`).join("")}</div>`,
      actions: act("See all FAQs", "goto", "#faq"),
      follow: ["Find a policy", "Take me to my profile"]
    }),
    hello: () => ({ text: "Hi Rashid! I can find people, policies, tasks and benefits, and take you straight to them. Try one of these:", follow: ["What needs my attention?", "What’s new?", "Show my benefits"] }),
    thanks: () => ({ text: "Anytime. Anything else I can help with?", follow: ["What needs my attention?", "Find a colleague"] }),
    fallback: () => ({ text: "I can’t answer that yet. I know about your tasks, people, announcements, policies, benefits, discounts and communities. Try one of these:", follow: ["What needs my attention?", "Find a colleague", "Find a policy", "Show my benefits"] })
  };
  // the first rule that matches decides; order matters
  const GPT_ROUTES = [
    [/\bprofile\b|my account|my details/, "profile"], [/\bdrafts?\b/, "drafts"], [/birthday/, "birthday"], [/anniversar/, "anniv"],
    [/\bfire\b|drill|evacuat/, "drill"], [/\bleave\b|holiday|vacation|time off|\beid\b/, "leave"],
    [/attention|urgent|overdue|priorit|important/, "attention"], [/\btasks?\b|approv|pending|to-?do|waiting|inbox/, "tasks"],
    [/polic|guideline|conduct|security|expense|handbook/, "policy"], [/discount|offer|deal|coupon|\bcode\b|hotel|dining|restaurant/, "discounts"],
    [/benefit|perk|insurance|medical|mimojo|mazaya|ticket|allowance/, "benefits"],
    [/communit|sport|club|cricket|padel|yoga|football|basketball|badminton/, "communities"],
    [/colleague|\bwho\b|joined|joiner|new (people|hire|starter|member)|people|person|\bteam\b|\bmeet\b|abdul|sara|mohammed|hana|daniel|ahmed|mariam|yousef|khalid/, "colleague"],
    [/what.?s new|news|announce|happening|update|today/, "news"], [/\bhelp\b|faq|support|how do|how can/, "help"],
    [/^(hi|hey|hello|salam|marhaba|good (morning|afternoon|evening))\b/, "hello"], [/thank|cheers/, "thanks"]
  ];
  const gptReply = (q) => { const t = q.toLowerCase().replace(/[’‘]/g, "'"); const r = GPT_ROUTES.find(([re]) => re.test(t)); return GPT_SKILLS[r ? r[1] : "fallback"](t); };

  // actions the answers can take; anything that leaves the page closes Bloom GPT first
  const gptLeave = (fn) => { closeGpt(); setTimeout(fn, reduceMotion ? 0 : 380); };
  const gptDone = (btn, label) => { btn.outerHTML = `<span class="gpt-done">${icon("i-check", "ico ico--sm")}${escapeHtml(label)}</span>`; };
  const GPT_ACTS = {
    task: (v) => gptLeave(() => openDrawer("task", taskRows()[Number(v)])),
    approve: (v, btn) => { const r = taskRows()[Number(v)]; if (r && !r.classList.contains("is-done")) quickResolve(r, "approve"); $('[data-gpt-act="task"]', btn.parentElement)?.remove(); gptDone(btn, "Approved"); },
    filter: (v) => gptLeave(() => filterAttention(v, true)),
    inbox: (v) => gptLeave(() => openInbox(null, v)),
    draft: (v) => gptLeave(() => { openInbox(null, "draft"); const x = ibFind(v); if (x) setTimeout(() => openRequestForm(x, "edit"), 500); }),
    policy: (v) => gptLeave(() => revealPolicy(v)),
    person: (v) => gptLeave(() => { showPerson(Number(v)); document.getElementById("people").scrollIntoView({ behavior: smooth() }); }),
    ann: (v) => gptLeave(() => showAnnouncement(Number(v))),
    wish: (v) => gptLeave(() => { showAnnouncement(Number(v)); setTimeout(() => $(".slide.is-current [data-wish]", bTrack)?.click(), reduceMotion ? 50 : 900); }),
    congrats: () => gptLeave(() => { showAnnouncement(groupStart("anniv")); setTimeout(() => $(".slide.is-current [data-wish]", bTrack)?.click(), reduceMotion ? 50 : 900); }),
    perk: (v) => gptLeave(() => revealPerk(v)),
    sport: (v) => gptLeave(() => revealSport(v)),
    drawer: (v) => gptLeave(() => openDrawer(v)),
    goto: (v) => gptLeave(() => $(v).scrollIntoView({ behavior: smooth() })),
    async code(v, btn) { try { await navigator.clipboard.writeText(v); toast(`Code ${v} copied`, "i-copy"); } catch { toast(`Your code is ${v}`, "i-copy"); } btn.outerHTML = `<span class="gpt-code">${escapeHtml(v)}</span>`; },
    remind(v, btn) { const rb = $("[data-remind]", bTrack); if (rb && !rb.classList.contains("is-sent")) rb.click(); else toast("Your reminder is already set", "i-bellring"); gptDone(btn, "Reminder set"); }
  };

  function gptScroll() { gptEl.scrollTo({ top: gptEl.scrollHeight, behavior: smooth() }); }
  function gptAsk(q) {
    q = q.trim();
    if (!q || gpt.busy) return;
    gpt.busy = true;
    stopHints();
    gptInput.value = "";
    gptInput.placeholder = "Ask a follow-up…";
    gptEl.classList.add("is-chatting");
    gptNew.hidden = false;
    gptThread.insertAdjacentHTML("beforeend", `<li class="msg msg--me"><p>${escapeHtml(q)}</p></li>`);
    const bot = document.createElement("li");
    bot.className = "msg msg--bot is-thinking";
    bot.innerHTML = `<span class="orb" aria-hidden="true"></span><div class="msg__body"><span class="gpt-dots" role="status" aria-label="Bloom GPT is thinking"><i></i><i></i><i></i></span></div>`;
    gptThread.append(bot);
    gptScroll();
    setTimeout(() => {
      const r = gptReply(q);
      bot.classList.remove("is-thinking");
      $(".msg__body", bot).innerHTML = `<p class="msg__text">${r.text}</p>${r.body || ""}${r.actions ? `<div class="msg__actions">${r.actions}</div>` : ""}${r.follow ? `<div class="msg__follow">${r.follow.map((f) => gptChip(f, " chip--follow")).join("")}</div>` : ""}`;
      gpt.busy = false;
      gptScroll();
      r.then?.();
    }, reduceMotion ? 200 : 650 + Math.random() * 450);
  }
  function gptReset() {
    gptThread.innerHTML = "";
    gptEl.classList.remove("is-chatting");
    gptNew.hidden = true;
    gptInput.value = "";
    startHints();
    gptInput.focus({ preventScroll: true });
  }
  // the placeholder types example questions
  function startHints() {
    stopHints();
    if (reduceMotion) { gptInput.placeholder = GPT_HINTS[0]; return; }
    let i = 0, j = 0, dir = 1;
    const tick = () => {
      const s = GPT_HINTS[i];
      j += dir;
      gptInput.placeholder = s.slice(0, j);
      if (dir > 0 && j >= s.length) { dir = -1; gpt.typing = setTimeout(tick, 1900); return; }
      if (dir < 0 && j <= 0) { dir = 1; i = (i + 1) % GPT_HINTS.length; gpt.typing = setTimeout(tick, 320); return; }
      gpt.typing = setTimeout(tick, dir > 0 ? 48 : 22);
    };
    gpt.typing = setTimeout(tick, 500);
  }
  function stopHints() { clearTimeout(gpt.typing); }
  function gptNoticed() {
    const overdue = openTasks().filter((r) => $(".due--overdue", r)).length;
    const items = [];
    if (overdue) items.push(`<button type="button" data-gpt-ask="Show my overdue approvals"><span class="pulse-dot" aria-hidden="true"></span>${overdue} approval${overdue === 1 ? " is" : "s are"} overdue</button>`);
    items.push(`<button type="button" data-gpt-ask="Whose birthday is it today?">${icon("i-gift", "ico ico--sm")}It’s ${escapeHtml(firstName(birthdays[0]))}’s birthday today</button>`);
    items.push(`<button type="button" data-gpt-ask="What changed in Data Security?">${icon("i-shield", "ico ico--sm")}Data Security was updated</button>`);
    $("#gpt-noticed").innerHTML = `<span class="gpt__noticed-label">${icon("i-sparkle", "ico ico--sm")}Bloom GPT noticed</span>${items.join('<i aria-hidden="true"></i>')}`;
  }
  function openGpt(trigger, q) {
    if (!gpt.open) {
      gpt.returnFocus = document.activeElement;
      const r = trigger?.getBoundingClientRect?.();
      gptEl.style.setProperty("--ox", r ? `${r.left + r.width / 2}px` : "50%");
      gptEl.style.setProperty("--oy", r ? `${r.top + r.height / 2}px` : "40px");
      closeNav(false); closeMenus(); closeSearch(); hideTip();
      if (ib.open) closeInbox();
      const hr = new Date().getHours();
      $("#gpt-greet").textContent = `${hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"}, Rashid`;
      $("#gpt-date").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      gptNoticed();
      gpt.open = true;
      gptEl.classList.add("is-open");
      gptEl.setAttribute("aria-hidden", "false");
      body.style.overflow = "hidden";
      if (!gptEl.classList.contains("is-chatting")) { gptEl.scrollTop = 0; startHints(); }
      setTimeout(() => gptInput.focus({ preventScroll: true }), 350);
    }
    if (q) gptAsk(q);
  }
  function closeGpt() {
    if (!gpt.open) return;
    gpt.open = false;
    stopHints();
    gptEl.classList.remove("is-open");
    gptEl.setAttribute("aria-hidden", "true");
    if (!body.classList.contains("menu-open") && !drawer.classList.contains("is-open") && !ib.open) body.style.overflow = "";
    if (gpt.returnFocus && document.contains(gpt.returnFocus)) gpt.returnFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-gpt]");
    if (opener) { e.preventDefault(); openGpt(opener); }
    if (e.target.closest("[data-close-gpt]")) closeGpt();
  });
  gptEl.addEventListener("click", (e) => {
    const a = e.target.closest("[data-gpt-act]");
    if (a) { GPT_ACTS[a.dataset.gptAct]?.(a.dataset.v, a); return; }
    const q = e.target.closest("[data-gpt-ask]");
    if (q) gptAsk(q.dataset.gptAsk);
  });
  $("#gpt-form").addEventListener("submit", (e) => { e.preventDefault(); gptAsk(gptInput.value); });
  gptNew.addEventListener("click", gptReset);
  // keep keyboard focus inside Bloom GPT while it is the top layer
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !gpt.open || drawer.classList.contains("is-open") || $("dialog[open]")) return;
    const items = $$("button:not([disabled]), input, a[href], summary", gptEl).filter((el) => el.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
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
     Flag cursor — the logo's ribbon flag (red over blue, a white gap
     between) flies from the pointer. At rest it waves beside the
     pointer; in motion it streams along the path; over anything you
     can click it furls into a two-colour ring; a click makes it
     flutter and sends out a ripple.
     --------------------------------------------------------------- */
  const fcCanvas = $("#flag-cursor");
  const fcRing = $("#flag-ring");
  const fcLabel = $(".fc-label", fcRing);
  const fcSwitch = $("#cursor-switch");
  const FC_KEY = "bloo-x-cursor";
  const FC_N = 16;                 // points along the flag
  const FC_SEG = 2.1;              // resting spacing → a ~32px flag
  const FC_MAX = 12;               // longest stretch between points
  const FC_DIR = { x: .8, y: .6 };  // at rest the flag flies down-right, like a pointer's tail
  const FC_BLUE = ["#7DD3FF", "#2F6BFF", "#0B2DBF"];
  const FC_RED = ["#FF8E7A", "#E3263B", "#A10D24"];
  const FC_HOVER = 'a, button:not([aria-disabled="true"]), summary, label, [role="tab"], [role="switch"], .chip, .sport, .orbit__node, .reel-item, .frag, .ib-donut__seg, [data-drawer], [data-toast]';
  const FC_TEXT = 'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
  const fcSupported = canHover && !!(fcCanvas && fcCanvas.getContext);
  const fc = {
    on: false, ctx: fcSupported ? fcCanvas.getContext("2d") : null, dpr: 1, w: 0, h: 0,
    x: 0, y: 0, px: 0, py: 0, inside: false, placed: false, mode: "flag", label: "",
    alpha: 0, rest: 1, ring: 0, press: 0, kick: 0, speed: 0, flip: 1, raf: 0, last: 0,
    needsHit: false, ripples: [], nodes: Array.from({ length: FC_N }, () => ({ x: 0, y: 0 }))
  };
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  function fcResize() {
    if (!fc.on) return;
    fc.dpr = Math.min(window.devicePixelRatio || 1, 2);
    fc.w = innerWidth; fc.h = innerHeight;
    fcCanvas.width = Math.round(fc.w * fc.dpr);
    fcCanvas.height = Math.round(fc.h * fc.dpr);
  }
  function fcStart() { if (fc.on && !fc.raf) { fc.last = 0; fc.raf = requestAnimationFrame(fcFrame); } }
  function fcPlace() {
    // unfurl from the pointer instead of streaking in from the corner
    fc.nodes.forEach((n, i) => { n.x = fc.x + FC_DIR.x * FC_SEG * i; n.y = fc.y + FC_DIR.y * FC_SEG * i; });
    fc.px = fc.x; fc.py = fc.y; fc.placed = true;
  }
  function fcTarget(el) {
    if (!el || !el.closest) return;
    if (el.closest("dialog[open]") || el.closest(FC_TEXT)) { fc.mode = "native"; return; }
    const hit = el.closest(FC_HOVER);
    const drag = el.closest("[data-drag]");
    const label = !hit && drag ? "Drag" : "";
    fc.mode = hit || drag ? "hover" : "flag";
    if (label !== fc.label) { fc.label = label; fcLabel.textContent = label; fcRing.classList.toggle("has-label", !!label); }
  }

  // Smooth edge through the band's points (midpoint quadratic curves)
  function fcEdge(ctx, pts, move) {
    if (move) ctx.moveTo(pts[0].x, pts[0].y); else ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    const e = pts[pts.length - 1];
    ctx.lineTo(e.x, e.y);
  }

  function fcFrame(now) {
    fc.raf = 0;
    const dt = fc.last ? Math.min(3, (now - fc.last) / 16.667) : 1;
    fc.last = now;
    const ctx = fc.ctx;
    const ease = (r) => 1 - Math.pow(1 - r, dt);

    if (fc.needsHit && fc.inside) { fc.needsHit = false; fcTarget(document.elementFromPoint(fc.x, fc.y)); }

    // state springs
    const show = fc.inside && fc.mode !== "native" ? 1 : 0;
    fc.alpha += (show - fc.alpha) * ease(.22);
    fc.rest += ((fc.mode === "hover" ? .16 : 1) - fc.rest) * ease(.16);
    const ringTarget = fc.mode === "hover" ? (fc.label ? 1.3 : 1) : 0;
    fc.ring += (ringTarget * (1 - fc.press * .18) - fc.ring) * ease(.2);
    fc.kick *= Math.pow(.9, dt);
    const sp = Math.hypot(fc.x - fc.px, fc.y - fc.py) / dt;
    fc.speed += (sp - fc.speed) * ease(.2);
    fc.px = fc.x; fc.py = fc.y;

    // the flag: each point chases the one ahead of it, offset downwind
    const n = fc.nodes;
    n[0].x = fc.x; n[0].y = fc.y;
    const k = ease(.5);
    for (let i = 1; i < FC_N; i++) {
      const p = n[i - 1], q = n[i];
      q.x += (p.x + FC_DIR.x * FC_SEG * fc.rest - q.x) * k;
      q.y += (p.y + FC_DIR.y * FC_SEG * fc.rest - q.y) * k;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d > FC_MAX) { q.x = p.x + dx / d * FC_MAX; q.y = p.y + dy / d * FC_MAX; }
    }

    ctx.setTransform(fc.dpr, 0, 0, fc.dpr, 0, 0);
    ctx.clearRect(0, 0, fc.w, fc.h);

    if (fc.alpha > .01) {
      const time = now / 1000;
      // flutter: a wave travelling to the tail, livelier with speed and on click
      const amp = (1.8 + Math.min(fc.speed, 40) * .08 + fc.kick * 7) * fc.rest;
      const mid = [];
      for (let i = 0; i < FC_N; i++) {
        const t = i / (FC_N - 1);
        const a = n[Math.max(0, i - 1)], b = n[Math.min(FC_N - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const w = amp * t * Math.sin(t * 5.2 - time * 8.5);
        mid.push({ x: n[i].x + ty * w, y: n[i].y - tx * w, t });
      }
      // keep the red stripe on top, as on the logo (with a little hysteresis)
      const vx = mid[FC_N - 1].x - mid[0].x;
      if (vx > 4) fc.flip = 1; else if (vx < -4) fc.flip = -1;
      let len = 0;
      for (let i = 1; i < FC_N; i++) len += Math.hypot(mid[i].x - mid[i - 1].x, mid[i].y - mid[i - 1].y);
      // a resting flag is chunky like the logo; a long streak thins into a ribbon
      const stretch = clamp((len - 34) / 160);
      const topO = [], topI = [], botO = [], botI = [];
      const bandScale = (.55 + .45 * fc.rest) * (1 - .38 * stretch);
      for (let i = 0; i < FC_N; i++) {
        const m = mid[i];
        const a = mid[Math.max(0, i - 1)], b = mid[Math.min(FC_N - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        if (tl < .5) { tx = FC_DIR.x; ty = FC_DIR.y; }
        const nx = ty * fc.flip, ny = -tx * fc.flip;
        const twist = .8 + .2 * Math.cos(m.t * 4 - time * 5);        // a hint of ribbon twist
        const T = 5.6 * (1 - .22 * m.t) * bandScale * twist;
        const G = 1.9 * (1 - .22 * m.t) * bandScale * twist;
        topI.push({ x: m.x + nx * G / 2, y: m.y + ny * G / 2 });
        topO.push({ x: m.x + nx * (G / 2 + T), y: m.y + ny * (G / 2 + T) });
        botI.push({ x: m.x - nx * G / 2, y: m.y - ny * G / 2 });
        botO.push({ x: m.x - nx * (G / 2 + T), y: m.y - ny * (G / 2 + T) });
      }
      // a long streak fades toward its tail; the resting flag stays solid
      const tail = clamp(1 - (len - 70) / 170, .12, 1);
      const h = mid[0], e = mid[FC_N - 1];
      const gx = Math.abs(e.x - h.x) + Math.abs(e.y - h.y) < 1 ? h.x + 10 : e.x;
      const gy = Math.abs(e.x - h.x) + Math.abs(e.y - h.y) < 1 ? h.y + 8 : e.y;
      const band = (outer, inner, cols) => {
        const g = ctx.createLinearGradient(h.x, h.y, gx, gy);
        g.addColorStop(0, cols[0]); g.addColorStop(.45, cols[1]); g.addColorStop(1, hexA(cols[2], tail));
        ctx.fillStyle = g;
        ctx.beginPath();
        fcEdge(ctx, outer, true);
        fcEdge(ctx, inner.slice().reverse(), false);
        ctx.closePath();
        ctx.fill();
        // rounded hoist, as on the logo
        ctx.beginPath();
        ctx.arc((outer[0].x + inner[0].x) / 2, (outer[0].y + inner[0].y) / 2, Math.hypot(outer[0].x - inner[0].x, outer[0].y - inner[0].y) / 2, 0, Math.PI * 2);
        ctx.fillStyle = cols[0];
        ctx.fill();
      };
      ctx.globalAlpha = fc.alpha;
      ctx.shadowColor = "rgba(11, 22, 64, .22)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      // top band red, bottom band blue, as on the logo
      band(botO, botI, FC_BLUE);
      band(topO, topI, FC_RED);
      ctx.shadowColor = "transparent";

      // the pole-top: a precise dot at the hotspot
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 3.3 - fc.press * .9, 0, Math.PI * 2);
      ctx.fillStyle = "#0B1640";
      ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.stroke();
    }

    // click ripples in the flag's colours
    fc.ripples = fc.ripples.filter((r) => (r.age += dt / 60) < .55);
    fc.ripples.forEach((r) => {
      const q = r.age / .55, rad = 6 + easeOut(q) * 34;
      ctx.globalAlpha = (1 - q) * .9;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.strokeStyle = FC_RED[1]; ctx.stroke();
      ctx.beginPath(); ctx.arc(r.x, r.y, rad * .7, 0, Math.PI * 2); ctx.strokeStyle = FC_BLUE[1]; ctx.stroke();
    });
    ctx.globalAlpha = 1;

    fcRing.style.opacity = (fc.alpha * Math.min(1, fc.ring * 1.6)).toFixed(3);
    fcRing.style.transform = `translate3d(${fc.x}px, ${fc.y}px, 0) scale(${Math.max(.01, fc.ring).toFixed(3)})`;

    if (fc.on && !document.hidden && (fc.inside || fc.alpha > .01 || fc.ripples.length)) fc.raf = requestAnimationFrame(fcFrame);
  }

  function setFlagCursor(pref) {
    const on = pref && fcSupported && !reduceMotion;
    if (fcSwitch) {
      fcSwitch.hidden = !fcSupported || reduceMotion;
      fcSwitch.setAttribute("aria-checked", String(pref));
    }
    if (on === fc.on) return;
    fc.on = on;
    root.classList.toggle("has-fc", on);
    if (on) { fcResize(); fc.placed = false; }
    else if (fc.ctx) { cancelAnimationFrame(fc.raf); fc.raf = 0; fc.ctx.clearRect(0, 0, fcCanvas.width, fcCanvas.height); fcRing.style.opacity = "0"; }
  }
  if (fcSupported) {
    addEventListener("pointermove", (e) => {
      if (!fc.on || e.pointerType !== "mouse") return;
      fc.x = e.clientX; fc.y = e.clientY; fc.inside = true;
      if (!fc.placed) fcPlace();
      fcTarget(e.target);
      fcStart();
    }, { passive: true });
    addEventListener("pointerdown", (e) => {
      if (!fc.on || e.pointerType !== "mouse") return;
      fc.press = 1; fc.kick = 1;
      if (fc.mode !== "native") fc.ripples.push({ x: e.clientX, y: e.clientY, age: 0 });
      fcStart();
    }, { passive: true });
    addEventListener("pointerup", () => { fc.press = 0; }, { passive: true });
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) { fc.inside = false; fc.placed = false; } });
    addEventListener("blur", () => { fc.inside = false; fc.placed = false; });
    addEventListener("scroll", () => { fc.needsHit = true; }, { passive: true });
    addEventListener("resize", fcResize);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fcStart(); });
    fcSwitch?.addEventListener("click", () => {
      const next = fcSwitch.getAttribute("aria-checked") !== "true";
      store.set(FC_KEY, next ? "on" : "off");
      setFlagCursor(next);
      toast(next ? "Flag cursor on" : "Flag cursor off", "i-sparkle");
    });
  }
  setFlagCursor(store.get(FC_KEY) !== "off");

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
    // Stacked (phone) hero runs taller than the screen: lifting and fading
    // would hide the quick links before they are reached, so leave it still.
    const still = s.h > vh * 1.2;
    heroCopy.style.translate = still ? "" : `0 ${(q * -110).toFixed(1)}px`;
    heroCopy.style.scale = still ? "" : (1 - q * 0.08).toFixed(4);
    heroCopy.style.opacity = still ? "" : (1 - clamp((q - 0.2) / 0.55)).toFixed(3);
    heroStage.style.translate = still ? "" : `0 ${(q * -190).toFixed(1)}px`;
    orbitLines.style.rotate = `${(q * 28).toFixed(2)}deg`;
    heroFoot.style.translate = still ? "" : `0 ${(q * 70).toFixed(1)}px`;
    heroFoot.style.opacity = still ? "" : (1 - clamp(q * 2.4)).toFixed(3);
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
  const phoneMQ = matchMedia("(max-width: 767px)"); // stickers drift less where they sit close to the words
  addScene(interlude, (p) => {
    const drift = phoneMQ.matches ? 0.3 : 1;
    interRows.forEach((r) => { r.style.translate = `${((p - 0.5) * 36 * Number(r.dataset.dir)).toFixed(2)}vw 0`; });
    stickers.forEach((st) => { st.style.translate = `0 ${((p - 0.5) * Number(st.dataset.speed) * 2 * drift).toFixed(1)}px`; });
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
  mqReduce.addEventListener("change", (e) => { reduceMotion = e.matches; scheduleMeasure(); setFlagCursor(store.get(FC_KEY) !== "off"); });

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
     Sign in — the front door
     The head script locks the page (html.is-locked) unless this tab is
     signed in; #login always opens it. One action: Login using Bloom ID.
     A prototype: nothing is stored or sent, and the brand panel shows no
     personal data before sign-in.
     --------------------------------------------------------------- */
  const SESSION_KEY = "bloo-session";
  const ME = { name: "Rashid Khan", first: "Rashid" };
  const login = $("#login");
  const loginGo = $("#login-go");
  const loginStatus = $("#login-status");
  const lg = { busy: false };
  function isLocked() { return root.classList.contains("is-locked"); }
  const session = {
    set() { try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* no storage: signed in until reload */ } },
    clear() { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* nothing kept */ } }
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 300) : ms));

  // Everything behind the login stays out of reach: focus, clicks and screen readers
  function setPageInert(on) {
    $$("body > *").filter((el) => !el.matches("#login, .toasts, .sprite, script, .fc-canvas, .fc-ring, .confetti")).forEach((el) => { el.inert = on; });
    login.setAttribute("aria-hidden", String(!on));
  }
  function setBusy(btn, on) {
    const label = $(".btn__label", btn);
    btn.dataset.idle ??= label.textContent;
    label.textContent = on ? btn.dataset.loginBusy : btn.dataset.idle;
    btn.classList.toggle("is-loading", on);
    if (!on) btn.classList.remove("is-done");
  }
  function resetLogin() {
    lg.busy = false;
    login.removeAttribute("aria-busy");
    setBusy(loginGo, false);
  }
  // The dialog's heading takes focus, so nothing is pre-selected and Tab reaches the button next
  const focusLogin = () => $("#login-title").focus({ preventScroll: true });

  async function signIn() {
    if (lg.busy) return;
    lg.busy = true;
    login.setAttribute("aria-busy", "true");
    setBusy(loginGo, true);
    loginStatus.textContent = loginGo.dataset.loginBusy;
    await wait(1100);
    session.set();
    loginGo.classList.remove("is-loading");
    loginGo.classList.add("is-done");
    $(".btn__label", loginGo).textContent = `Welcome, ${ME.first}`;
    loginStatus.textContent = `Signed in as ${ME.name}`;
    await wait(520);
    openPortal(loginGo);
  }

  // The portal opens out of the button, and the hero plays its welcome
  function openPortal(from) {
    const r = from.getBoundingClientRect();
    login.style.setProperty("--hx", `${r.left + r.width / 2}px`);
    login.style.setProperty("--hy", `${r.top + r.height / 2}px`);
    login.classList.add("is-leaving");
    void login.offsetWidth;
    login.classList.add("is-through");
    setPageInert(false);
    if (location.hash === "#login") { try { history.replaceState(null, "", location.pathname + location.search); } catch { /* sandboxed page */ } }
    playEntrance();
    setTimeout(() => {
      login.classList.add("is-instant");
      root.classList.remove("is-locked");
      login.classList.remove("is-leaving", "is-through");
      void login.offsetWidth;
      login.classList.remove("is-instant");
      resetLogin();
      measure();
      requestTick();
      $("#main").focus({ preventScroll: true });
    }, reduceMotion ? 0 : 900);
  }

  // The login grows out of whatever opened it (Sign out), like the other pages
  function showLogin(from) {
    const r = from ? from.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    login.style.setProperty("--ox", `${r.left + r.width / 2}px`);
    login.style.setProperty("--oy", `${r.top + r.height / 2}px`);
    closeMenus();
    closeSearch();
    hideTip();
    if (gpt.open) closeGpt();
    if (ib.open) closeInbox();
    if (drawer.classList.contains("is-open")) closeDrawer();
    closeNav(false);
    resetLogin();
    root.classList.add("is-locked");
    setPageInert(true);
    setTimeout(() => {
      // back to the top, so signing in again replays the welcome
      root.classList.remove("is-loaded");
      scrollTo({ top: 0, behavior: "instant" });
      focusLogin();
    }, reduceMotion ? 0 : 760);
  }
  function signOut(from) {
    session.clear();
    showLogin(from);
    toast("You’re signed out. See you soon.", "i-logout");
  }
  // a #login link opens it from inside the page too
  addEventListener("hashchange", () => { if (location.hash === "#login" && !isLocked()) showLogin(null); });
  document.addEventListener("click", (e) => {
    const out = e.target.closest("[data-signout]");
    if (out) { e.preventDefault(); signOut(out); }
  });
  loginGo.addEventListener("click", signIn);

  if (isLocked()) {
    setPageInert(true);
    setTimeout(focusLogin, 500);
  }

  /* ---------------------------------------------------------------
     First paint — let fonts settle, then run the hero entrance
     (behind the login, the entrance waits until you sign in)
     --------------------------------------------------------------- */
  let settled = false;
  function playEntrance() {
    if (!settled || root.classList.contains("is-loaded")) return;
    if (isLocked() && !login.classList.contains("is-leaving")) return;
    root.classList.add("is-loaded");
    countUp($("#orbit-total"));
  }
  const markLoaded = () => {
    settled = true;
    sizeWhere();
    moveTabIndicator();
    moveIndicator(faqTabs);
    measure();
    playEntrance();
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))])
    .then(() => requestAnimationFrame(markLoaded));
  addEventListener("load", () => { measure(); sizeWhere(); rails.forEach(updateRail); });
  measure();
})();
