  /* ==================================================================
     BlooMultiverse on phones — mobile.js
     The same product, recomposed for one hand. Under 768px (and on
     phones held sideways) the page gives way to an app: a sticky
     header, five destinations in a frosted bar at the bottom, pages
     that push and pop inside each tab, bottom sheets and full-screen
     layers for search and notifications.

     Every screen reads the page's own data (the Attention rows, the
     requests, people, policies, communities, partners, perks, FAQs),
     and every action goes through the page's own functions, which call
     sync() — so both views always agree. The one thing the phone app
     leaves out on purpose is creating a new request.
     ================================================================== */
  const appEl = $("#app");
  const appViews = $("#app-views");
  const appNav = $("#app-nav");
  const appLayer = $("#app-layer");
  const sheetEl = $("#app-sheet");
  const sheetBody = $("#app-sheet-body");
  const appMQ = matchMedia(APP_QUERY);
  const EXPO = "cubic-bezier(.16,1,.3,1)";
  const TABS = ["home", "tasks", "help", "explore", "profile"];
  const esc = escapeHtml;
  const PAGES = {};
  const A = {
    on: false, tab: "home",
    stacks: Object.fromEntries(TABS.map((t) => [t, []])),
    modal: null,          // the full-screen layer (search, notifications)
    sheet: null,          // the bottom sheet
    loaded: false, loading: false, refreshing: false,
    synced: "2 minutes ago",
    fresh: null, justDone: null,
    tk: { seg: "all", q: "", app: "all", type: "all", status: "all", sort: "urgent" },
    pp: { q: "", kind: "all" },
    pol: { q: "", cat: "all" },
    off: { group: "all" },
    pk: { cat: "all", open: false },
    faq: "general",
    nf: "all",
    sr: { q: "", view: "live", group: "all" }
  };
  const motion = (el, frames, opts = {}) => (reduceMotion || !el?.animate)
    ? Promise.resolve()
    : el.animate(frames, { duration: 520, easing: EXPO, ...opts }).finished.catch(() => {});

  /* ---------------------------------------------------------------
     Data — views over the page's own sources, never copies
     --------------------------------------------------------------- */
  const imgOf = (el) => [...(el?.classList || [])].find((c) => c.startsWith("img-")) || "";
  const markOf = (src) => `<span class="app-mark app-mark--${sourceMarks[src]}" aria-hidden="true">${src === "sap" ? "SAP" : sourceNames[src].slice(0, 2)}</span>`;
  const tasksData = () => taskRows().map((row, i) => {
    const due = $(".due", row);
    const title = $(".task__title", row).textContent;
    return {
      i, row, src: row.dataset.source, title, detail: $(".task__meta span", row).textContent,
      kind: /^(approve|sign off|confirm)\b/i.test(title) ? "approval" : "task",
      due: due.textContent.trim(), dueHTML: due.outerHTML,
      overdue: due.classList.contains("due--overdue"), today: due.classList.contains("due--today"),
      done: row.classList.contains("is-done"), outcome: row.dataset.outcome
    };
  });
  const urgency = (t) => (t.overdue ? 0 : t.today ? 1 : 2);
  const byUrgency = (a, b) => urgency(a) - urgency(b) || a.i - b.i;
  const openTasksData = () => tasksData().filter((t) => !t.done).sort(byUrgency);
  const reqById = (id) => ib.items.find((x) => x.id === id);
  const reqsIn = (...states) => ib.items.filter((x) => states.includes(x.state));
  const STATUS = { review: "In review", returned: "Returned", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
  const statusOf = (x) => (x.state === "history" ? x.outcome : x.state === "mine" ? x.status : "draft");

  const policiesData = () => policies.map((card) => {
    const p = policyInfo(card);
    return { ...p, key: card.dataset.cat, img: imgOf($(".policy__media", card)), tag: $(".tag", card).outerHTML, updated: /^updated/i.test(p.meta) ? p.meta : "" };
  });
  const policyBy = (name) => policiesData().find((p) => p.name === name);
  const POLICY_CATS = () => $$("#policy-chips .chip").map((c) => ({ key: c.dataset.cat, label: c.lastChild.textContent.trim(), num: $(".chip__num", c).textContent }));

  const groupsData = () => sportsEls.map((el, i) => ({
    i, el, name: $(".sport__name", el).textContent, img: imgOf(el), tint: el.style.getPropertyValue("--tint").trim(),
    members: parseInt($(".sport__foot > span:last-of-type", el)?.textContent, 10) || 0,
    faces: $$(".stack i", el).map(imgOf), joined: $("[data-join]", el).getAttribute("aria-pressed") === "true"
  }));
  const groupBy = (name) => groupsData().find((g) => g.name === name);

  const OFFER_GROUPS = { stays: "Travel & stays", food: "Food & dining", home: "Home & industry", everyday: "Everyday" };
  const offersData = () => partnersData().map((p, i) => ({ ...p, i, pct: parseInt(p.off, 10), group: $$(".partner")[i].dataset.group, revealed: isRevealed(p.code) }));
  const offerBy = (code) => offersData().find((o) => o.code === code);

  const peopleData = () => everyone().map((p) => ({
    ...p, key: p.kind === "anniv" ? "anniv:0" : `${p.kind}:${p.i}`,
    wishKey: p.kind === "birthday" ? `b${p.i}` : p.kind === "anniv" ? "a" : ""
  }));
  const personBy = (key) => peopleData().find((p) => p.key === key);
  const personNote = (p) => (p.kind === "joiner" ? p.week : p.kind === "birthday" ? "Birthday today" : `${p.years} years at Bloom`);

  const perkById2 = (id) => perks.find((x) => x.id === id);
  // A chapter's own words (kicker, title, subtitle), so both views say the same thing
  const copyOf = (sel) => {
    const sec = $(sel);
    const k = $(".kicker", sec);
    return { kicker: k ? k.lastChild.textContent.trim() : "", title: $(".display", sec)?.textContent.trim().replace(/\s+/g, " ") || "", sub: $(".section-sub", sec)?.textContent.trim() || "" };
  };
  const quickLinks = () => $$(".dock__item").map((a) => {
    const mark = [...$(".app-mark", a).classList].find((c) => /^app-mark--(sf|db|sap|ui)$/.test(c));
    return { href: a.getAttribute("href"), name: $(".dock__name", a).textContent, hint: $(".dock__hint", a).textContent, mark, src: APP_ORDER.find((k) => mark === `app-mark--${sourceMarks[k]}`) };
  });

  /* ---------------------------------------------------------------
     Building blocks
     --------------------------------------------------------------- */
  const kicker = (text) => `<p class="kicker"><span class="kicker__line"></span>${esc(text)}</p>`;
  const intro = ({ kick, title, sub, extra = "" }) =>
    `<header class="m-intro">${kick ? kicker(kick) : ""}<h1 class="m-intro__title" tabindex="-1">${esc(title)}</h1>${sub ? `<p class="m-intro__sub">${esc(sub)}</p>` : ""}${extra}</header>`;
  const secHead = (title, { link, count, tag = "h2" } = {}) =>
    `<div class="m-sec__head"><${tag} class="m-sec__title">${esc(title)}${count != null ? ` <span class="m-sec__count">${pad(count)}</span>` : ""}</${tag}>${link ? `<button class="soft-link soft-link--sm" type="button" data-go="${esc(link.go)}">${esc(link.label)}${icon("i-arrow", "ico ico--sm")}</button>` : ""}</div>`;
  const railHTML = (items, cls = "", label = "") =>
    `<div class="m-rail ${cls}" data-rail${label ? ` role="group" aria-label="${esc(label)}"` : ""}>${items.join("")}</div>` +
    `<div class="rail-foot m-rail-foot" aria-hidden="true"><div class="rail-progress"><span></span></div><p class="rail-count">01 / ${pad(items.length)}</p></div>`;
  const emptyHTML = ({ ic = "i-search", title, text = "", action = "" }) =>
    `<div class="m-empty" role="status"><span class="m-empty__icon" aria-hidden="true">${icon(ic)}</span><p class="m-empty__title">${title}</p>${text ? `<p class="m-empty__text">${text}</p>` : ""}${action}</div>`;
  const chevron = icon("i-chevron-right", "ico ico--sm m-row__chev");
  // A row inside a list panel. title and sub are HTML (callers escape)
  const rowHTML = ({ lead = "", title, sub = "", end = chevron, go, act, v, cls = "", attrs = "" }) =>
    `<li><button class="m-row ${cls}" type="button"${go ? ` data-go="${esc(go)}"` : ""}${act ? ` data-act="${act}" data-v="${esc(String(v ?? ""))}"` : ""}${attrs}>${lead ? `<span class="m-row__lead">${lead}</span>` : ""}<span class="m-row__txt"><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ""}</span>${end}</button></li>`;
  const infoRowHTML = ({ lead = "", title, sub = "" }) => `<li><div class="m-row m-row--static">${lead ? `<span class="m-row__lead">${lead}</span>` : ""}<span class="m-row__txt"><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ""}</span></div></li>`;
  // A switch in a list is a row like any other: tile, title and its value, then the switch
  const switchRowHTML = ({ lead, title, off, on, checked, label, attrs = "", sw, cls = "" }) =>
    `<li><button class="m-row m-row--switch ${cls}" type="button" role="switch" aria-checked="${checked}" aria-label="${label}"${attrs}><span class="m-row__lead">${lead}</span><span class="m-row__txt"><strong>${title}</strong><small><span class="pref__off">${off}</span><span class="pref__on">${on}</span></small></span>${sw}</button></li>`;
  const tile = (ic, hue) => `<span class="gpt-tile"${hue ? ` style="--hue:${hue}"` : ""} aria-hidden="true">${icon(ic)}</span>`;
  const chipHTML = ({ label, on, act, v, count, dot, num, pc, role = "" }) =>
    `<button class="chip${on ? " is-selected" : ""}" type="button"${role ? ` role="${role}" aria-selected="${on}"` : ` aria-pressed="${on}"`} data-act="${act}" data-v="${esc(String(v))}"${pc ? ` data-pc="${pc}"` : ""}>${num ? `<span class="chip__num">${num}</span>` : ""}${dot ? '<span class="chip__dot" aria-hidden="true"></span>' : ""}${esc(label)}${count != null ? `<span class="chip__count">${count}</span>` : ""}</button>`;
  const avatarHTML = (p, cls = "") => `<span class="avatar ${p.img || ""} ${cls}">${esc(p.initials || initialsOf(p.name))}</span>`;
  const reqIcon = (x) => `<span class="ib-row__icon" style="--c: var(--viz-${IB_TYPES[x.type].slot})" aria-hidden="true">${icon("i-doc")}</span>`;
  const skeletonHTML = (n = 3) => `<ul class="m-cards" aria-busy="true" aria-label="Loading">${Array.from({ length: n }, () => `<li class="m-card m-sk"><span class="sk sk--mark"></span><span class="sk-stack"><span class="sk sk--line"></span><span class="sk sk--short"></span></span><span class="sk sk--pill"></span></li>`).join("")}</ul>`;
  const searchField = (key, label, value = "") =>
    `<label class="ib-search m-field">${icon("i-search", "ico ico--sm")}<input type="search" data-input="${key}" value="${esc(value)}" placeholder="${esc(label)}" aria-label="${esc(label)}" autocomplete="off" enterkeyhint="search"></label>`;

  /* ---------------------------------------------------------------
     Shell — pages, tab stacks, layers, sheets, back
     --------------------------------------------------------------- */
  const stackOf = (tab) => $(`[data-stack="${tab}"]`, appViews);
  const topPage = (tab = A.tab) => A.stacks[tab].at(-1);

  function barHTML(def, ctx) {
    if (def.root) {
      const unread = $$("#notif-list .notif.is-unread").length;
      return `<header class="pg-bar pg-bar--brand">
        <button class="app-brand" type="button" data-act="top" aria-label="Bloom Multiverse, back to the top"><span class="brand__word has-logo" aria-hidden="true"></span></button>
        <div class="pg-bar__acts">
          <button class="app-ibtn" type="button" data-go="search" aria-label="Search">${icon("i-search")}</button>
          <button class="app-ibtn js-bell" type="button" data-go="notifications" aria-label="${unread ? `Notifications, ${unread} unread` : "Notifications"}">${icon("i-bell")}<span class="badge-dot js-bell-count${unread ? "" : " is-cleared"}" aria-hidden="true">${unread}</span></button>
        </div></header>`;
    }
    if (def.modal) return def.bar(ctx);
    return `<header class="pg-bar pg-bar--back${def.over ? " pg-bar--over" : ""}">
      <button class="pg-bar__btn" type="button" data-app-back aria-label="Back">${icon("i-chevron-left")}</button>
      <p class="pg-bar__title" aria-hidden="true">${esc(def.title(ctx))}</p>
      <div class="pg-bar__acts">${def.acts ? def.acts(ctx) : ""}</div></header>`;
  }

  function makePage(name, ctx = "") {
    const def = PAGES[name];
    const el = document.createElement("section");
    el.className = `pg pg--${name}${def.root ? " pg--root" : ""}${def.modal ? " pg--modal" : ""}`;
    el.setAttribute("aria-label", def.title(ctx));
    if (def.modal) { el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); }
    el._page = { name, ctx, def };
    el.innerHTML = `${barHTML(def, ctx)}<div class="pg-body">${def.render(ctx)}</div>`;
    def.mount?.(el, ctx);
    return el;
  }
  // Measure what needs layout once a page is on screen
  const attached = (el) => requestAnimationFrame(() => { $$("[data-rail]", el).forEach(updateAppRail); updateBar(el); });
  // Re-render a page for a new context (the next person, the next task)
  function repaint(el, ctx) {
    el._page.ctx = ctx;
    el.setAttribute("aria-label", el._page.def.title(ctx));
    const t = $(".pg-bar__title", el);
    if (t) t.textContent = el._page.def.title(ctx);
    $(".pg-body", el).innerHTML = el._page.def.render(ctx);
    el._page.def.mount?.(el, ctx);
    $$("[data-rail]", el).forEach(updateAppRail);
    el.scrollTop = 0;
    updateBar(el);
  }

  function focusPage(el) {
    const t = $("h1", el);
    if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
  }
  function ensureRoot(tab) {
    if (A.stacks[tab].length) return;
    const el = makePage(tab);
    A.stacks[tab].push(el);
    stackOf(tab).append(el);
    PAGES[tab].activate?.(el);
    attached(el);
  }

  function setTab(tab, { top = true } = {}) {
    if (!TABS.includes(tab)) return;
    closeModal(false);
    closeSheet(false);
    if (tab === A.tab) {
      if (A.stacks[tab].length > 1) popToRoot(tab);
      else if (top) topPage(tab)?.scrollTo({ top: 0, behavior: smooth() });
      return;
    }
    ensureRoot(tab);
    const from = stackOf(A.tab);
    const to = stackOf(tab);
    from.classList.remove("is-active"); from.inert = true;
    to.classList.add("is-active"); to.inert = false;
    A.tab = tab;
    const pg = topPage(tab);
    pg._page.def.activate?.(pg);
    motion(pg, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 360 });
    syncNav(true);
    syncBack();
  }

  function push(name, ctx = "") {
    if (!PAGES[name]) return;
    if (PAGES[name].root) { setTab(name); return; }
    closeModal(false);
    closeSheet(false);
    const stack = A.stacks[A.tab];
    const prev = stack.at(-1);
    const el = makePage(name, ctx);
    el._return = document.activeElement;
    stack.push(el);
    stackOf(A.tab).append(el);
    attached(el);
    prev.inert = true;
    motion(prev, [{ transform: "none", opacity: 1 }, { transform: "translateX(-24%)", opacity: 0.4 }]).then(() => { if (stack.at(-1) !== prev && stack.includes(prev)) prev.classList.add("is-under"); });
    if (reduceMotion) prev.classList.add("is-under");
    motion(el, [{ transform: "translateX(100%)" }, { transform: "none" }]);
    focusPage(el);
    syncBack();
  }

  function pop(tab = A.tab) {
    const stack = A.stacks[tab];
    if (stack.length < 2) return false;
    const el = stack.pop();
    const prev = stack.at(-1);
    el.inert = true;
    prev.classList.remove("is-under");
    prev.inert = false;
    motion(prev, [{ transform: "translateX(-24%)", opacity: 0.4 }, { transform: "none", opacity: 1 }]);
    motion(el, [{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 420, fill: "forwards" }).then(() => el.remove());
    if (reduceMotion) el.remove();
    const back = el._return;
    if (back && prev.contains(back)) back.focus({ preventScroll: true }); else focusPage(prev);
    prev._page.def.activate?.(prev);
    syncBack();
    return true;
  }
  function popToRoot(tab = A.tab, animate = true) {
    const stack = A.stacks[tab];
    if (stack.length < 2) return;
    const top = stack.at(-1);
    stack.splice(1).forEach((el) => { if (el !== top || !animate) el.remove(); });
    const base = stack[0];
    base.classList.remove("is-under");
    base.inert = false;
    if (animate) {
      top.inert = true;
      motion(top, [{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 420, fill: "forwards" }).then(() => top.remove());
      if (reduceMotion) top.remove();
    }
    base._page.def.activate?.(base);
    syncBack();
  }

  /* Full-screen layers: search and notifications, grown from their button */
  function openModal(name, trigger, arg = "") {
    closeSheet(false);
    if (A.modal) closeModal(false);
    PAGES[name].prepare?.(arg);
    const el = makePage(name, arg);
    const r = trigger?.getBoundingClientRect?.();
    el.style.setProperty("--ox", r ? `${r.left + r.width / 2}px` : "50%");
    el.style.setProperty("--oy", r ? `${r.top + r.height / 2}px` : "40px");
    appLayer.append(el);
    attached(el);
    A.modal = { name, el, ret: trigger || document.activeElement };
    appViews.inert = true;
    appNav.inert = true;
    void el.offsetWidth;
    el.classList.add("is-open");
    el._page.def.opened?.(el, arg);
    syncBack();
  }
  function closeModal(restore = true) {
    if (!A.modal) return;
    const { el, ret } = A.modal;
    A.modal = null;
    el.inert = true;
    el.classList.remove("is-open");
    el.classList.add("is-closing");
    motion(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" }).then(() => el.remove());
    if (reduceMotion) el.remove();
    appViews.inert = false;
    appNav.inert = false;
    if (restore && ret?.isConnected) ret.focus({ preventScroll: true });
    syncBack();
  }

  /* Bottom sheet — one at a time, over everything in the app */
  function openSheet({ title, render, onOk, cls = "" }) {
    const ret = document.activeElement;
    A.sheet = { render, onOk, ret };
    sheetEl.className = `app-sheet is-open ${cls}`;
    $("#app-sheet-title").textContent = title;
    sheetBody.innerHTML = render();
    sheetEl.setAttribute("aria-hidden", "false");
    [appViews, appNav, appLayer, $("#app-auth")].forEach((x) => { x.inert = true; });
    const panel = $(".app-sheet__panel", sheetEl);
    panel.style.transform = "";
    motion(panel, [{ transform: "translateY(100%)" }, { transform: "none" }]);
    motion($(".app-sheet__scrim", sheetEl), [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
    setTimeout(() => ($("button, a, input", sheetBody) || $(".app-sheet__x", sheetEl)).focus({ preventScroll: true }), 60);
    syncBack();
  }
  function closeSheet(restore = true) {
    if (!A.sheet) return;
    const { ret } = A.sheet;
    A.sheet = null;
    const panel = $(".app-sheet__panel", sheetEl);
    const scrim = $(".app-sheet__scrim", sheetEl);
    const done = () => {
      [panel, scrim].forEach((x) => x.getAnimations().forEach((a) => a.cancel()));
      if (!A.sheet) { sheetEl.className = "app-sheet"; sheetEl.setAttribute("aria-hidden", "true"); panel.style.transform = ""; }
    };
    const from = getComputedStyle(panel).transform;
    sheetEl.classList.add("is-closing");
    Promise.all([
      motion(panel, [{ transform: from === "none" ? "none" : from }, { transform: "translateY(100%)" }], { duration: 320, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }),
      motion(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: "forwards" })
    ]).then(done);
    if (reduceMotion) done();
    appViews.inert = !!A.modal;
    appNav.inert = !!A.modal;
    appLayer.inert = false;
    $("#app-auth").inert = false;
    if (restore && ret?.isConnected) ret.focus({ preventScroll: true });
    syncBack();
  }
  function confirmSheet({ title, text, ok, danger = false, ic = "i-help", onOk }) {
    openSheet({
      title, onOk,
      render: () => `<div class="m-confirm"><span class="m-confirm__icon${danger ? " is-danger" : ""}" aria-hidden="true">${icon(ic)}</span><p class="m-confirm__text">${text}</p>
        <div class="m-sheet-foot"><button class="btn btn--quiet" type="button" data-sheet-close>Cancel</button><button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" data-sheet-ok>${ok}</button></div></div>`
    });
  }

  /* Back: the header's button, Esc, Android's back and iOS's edge swipe.
     While anything is stacked, one history entry stands guard so the
     system back closes the top layer instead of leaving the app. */
  const hist = { armed: false, pending: 0, timer: 0 };
  const depth = () => (gpt.open ? 1 : 0) + ($("dialog[open]") ? 1 : 0) + (A.sheet ? 1 : 0) + (A.modal ? 1 : 0) + Math.max(0, A.stacks[A.tab].length - 1);
  function backOnce() {
    const dlg = $("dialog[open]");
    if (dlg) { dlg.close(); return true; }
    if (gpt.open) { closeGpt(); return true; }
    if (A.sheet) { closeSheet(); return true; }
    if (A.modal) { closeModal(); return true; }
    return pop();
  }
  function back() { backOnce(); syncBack(); }
  // One history step at a time: never push while our own back is still in
  // flight, or that back could land past the page and leave the app.
  function syncBack() {
    if (!A.on || hist.pending) return;
    const d = depth();
    try {
      if (d && !hist.armed) { history.pushState({ bloomApp: true }, ""); hist.armed = true; }
      else if (!d && hist.armed) {
        hist.armed = false;
        hist.pending++;
        clearTimeout(hist.timer);
        hist.timer = setTimeout(() => { hist.pending = 0; syncBack(); }, 1000); // if the back never lands
        history.back();
      }
    } catch { /* no session history here (a sandboxed frame): the buttons still work */ }
  }
  function unwindBack() {
    if (!hist.armed || hist.pending) return;
    hist.armed = false;
    hist.pending++;
    try { history.back(); } catch { hist.pending = 0; }
  }
  addEventListener("popstate", () => {
    if (hist.pending) { hist.pending--; clearTimeout(hist.timer); syncBack(); return; }
    if (!A.on || !hist.armed) return;
    hist.armed = false;
    backOnce();
    syncBack();
  });
  // Bloom GPT and the dialogs are layers too
  new MutationObserver(() => syncBack()).observe(gptEl, { attributes: true, attributeFilter: ["class"] });
  $$("dialog").forEach((d) => new MutationObserver(() => syncBack()).observe(d, { attributes: true, attributeFilter: ["open"] }));

  /* Header states: frosted once content slides under it; a pushed page's
     title appears in the bar once its big title has scrolled away */
  function updateBar(pg) {
    const bar = $(".pg-bar", pg);
    if (!bar) return;
    bar.classList.toggle("is-scrolled", pg.scrollTop > 4);
    const t = $(".pg-body h1", pg);
    if (t && !pg._page.def.root) bar.classList.toggle("show-title", t.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
    tellMockup(false);
  }
  function updateAppRail(r) {
    const foot = r.nextElementSibling?.classList.contains("m-rail-foot") ? r.nextElementSibling : null;
    const items = [...r.children].filter((c) => c.offsetParent !== null);
    const max = r.scrollWidth - r.clientWidth;
    const p = max > 0 ? r.scrollLeft / max : 1;
    const win = r.scrollWidth ? r.clientWidth / r.scrollWidth : 1;
    const edge = r.scrollLeft + (parseFloat(getComputedStyle(r).paddingLeft) || 0) - 8;
    let first = items.findIndex((it) => it.offsetLeft + it.offsetWidth * 0.5 > edge);
    if (first < 0) first = items.length - 1;
    if (max > 0 && r.scrollLeft >= max - 4) first = items.length - 1;
    if (foot) {
      $(".rail-progress span", foot).style.setProperty("--rp", clamp(win + p * (1 - win)).toFixed(3));
      $(".rail-count", foot).textContent = `${pad(first + 1)} / ${pad(items.length)}`;
      foot.hidden = items.length < 2 || max <= 4;
    }
    if (r._index !== first) { r._index = first; r._onIndex?.(first, items[first]); }
  }
  const scrollQueue = new Set();
  appEl.addEventListener("scroll", (e) => {
    const t = e.target;
    if (!(t instanceof Element) || !(t.classList.contains("pg") || t.hasAttribute("data-rail"))) return;
    if (!scrollQueue.size) requestAnimationFrame(() => { scrollQueue.forEach((el) => (el.classList.contains("pg") ? updateBar(el) : updateAppRail(el))); scrollQueue.clear(); });
    scrollQueue.add(t);
  }, { capture: true, passive: true });

  /* Keep what's on screen in step with the data */
  const focusKey = (el) => (el?.dataset ? (el.dataset.act ? `a:${el.dataset.act}|${el.dataset.v ?? ""}` : el.dataset.go ? `g:${el.dataset.go}` : el.dataset.input ? `i:${el.dataset.input}` : "") : "");
  function rerender(box, html) {
    const had = box.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const lefts = $$("[data-rail]", box).map((r) => r.scrollLeft);
    box.innerHTML = html;
    $$("[data-rail]", box).forEach((r, i) => { r.scrollLeft = lefts[i] || 0; updateAppRail(r); });
    if (had !== null) {
      const el = had && $$("[data-act], [data-go], [data-input]", box).find((x) => focusKey(x) === had);
      (el || $("button, a, input", box))?.focus({ preventScroll: true });
    }
  }
  function refreshPage(pg) {
    const { def, ctx } = pg._page;
    if (!def.live) return;
    $$("[data-live]", pg).forEach((box) => {
      const fn = def.live[box.dataset.live];
      if (fn) rerender(box, fn(ctx, box.dataset.arg));
    });
    def.refreshed?.(pg, ctx);
  }
  function refreshAll() {
    if (!A.on) return;
    $$(".pg", appEl).forEach(refreshPage);
    if (A.sheet?.render && !A.sheet.static) rerender(sheetBody, A.sheet.render());
    syncBadges();
  }
  syncers.add((e) => {
    if (!A.on) return;
    if (e.type === "task") A.justDone = `task-${taskRows().indexOf(e.row)}`;
    if (e.type === "request") onRequestSaved(e);
    refreshAll();
    A.justDone = null;
  });

  function syncBadges() {
    const n = totalPending();
    const tb = $("#app-task-badge");
    tb.textContent = n;
    tb.hidden = !n;
    $('[data-app-tab="tasks"]', appNav).setAttribute("aria-label", n ? `Inbox, ${n} waiting` : "Inbox");
    const unread = $$("#notif-list .notif.is-unread").length;
    $$(".js-bell-count", appEl).forEach((b) => { b.textContent = unread; b.classList.toggle("is-cleared", !unread); });
    $$(".js-bell", appEl).forEach((b) => b.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications"));
  }
  // The Profile tab wears your photo
  $('[data-app-tab="profile"]', appNav).insertAdjacentHTML("afterbegin", avatarHTML(me, "app-nav__ic app-nav__dp").replace("<span ", '<span aria-hidden="true" '));
  function syncNav(pop = false) {
    const items = $$(".app-nav__item", appNav);
    items.forEach((b) => { if (b.dataset.appTab === A.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    const cur = items.find((b) => b.dataset.appTab === A.tab);
    const ind = $(".app-nav__ind", appNav);
    if (!cur || !cur.offsetWidth) return;
    ind.style.width = `${cur.offsetWidth}px`;
    ind.style.transform = `translateX(${cur.offsetLeft}px)`;
    if (pop) motion($(".app-nav__ic", cur), [{ transform: "scale(.7) translateY(3px)" }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.34,1.56,.64,1)" });
  }

  /* One click handler for the whole app */
  function go(target, from) {
    if (!target) return;
    const [name, ...rest] = target.split("/");
    const arg = rest.join("/");
    if (name === "tab") { setTab(arg); return; }
    if (name === "tasks") { const [seg, app] = arg.split("/"); goTasks(seg || "all", app ? { app } : {}); return; }
    if (name === "search" || name === "notifications") { openModal(name, from, arg); return; }
    if (name === "gpt") { closeModal(false); closeSheet(false); openGpt(from, arg || undefined); return; }
    if (name === "ann") { showAnn(Number(arg)); return; }
    if (name === "faq") { showFaq(Number(arg)); return; }
    push(name, arg);
  }
  appEl.addEventListener("click", (e) => {
    const t = e.target;
    const g = t.closest("[data-go]");
    if (g && appEl.contains(g)) { e.preventDefault(); go(g.dataset.go, g); return; }
    if (t.closest("[data-app-back]")) { back(); return; }
    if (t.closest("[data-modal-close]")) { closeModal(); return; }
    const tab = t.closest("[data-app-tab]");
    if (tab) { setTab(tab.dataset.appTab); return; }
    const ok = t.closest("[data-sheet-ok]");
    if (ok) { const fn = A.sheet?.onOk; closeSheet(false); fn?.(ok); return; }
    if (t.closest("[data-sheet-close]")) { closeSheet(); return; }
    const a = t.closest("[data-act]");
    if (a && !a.disabled && a.getAttribute("aria-disabled") !== "true") { ACTS[a.dataset.act]?.(a.dataset.v, a, e); return; }
    // Announcement slides keep the page's own buttons
    const wish = t.closest("[data-wish]");
    if (wish && !wish.classList.contains("is-sent")) { openWish(wish.dataset.wish, wish); return; }
    if (t.closest("[data-remind]")) { setDrillReminder(); return; }
    const ask = t.closest("[data-gpt-ask]");
    if (ask) { openGpt(ask, ask.dataset.gptAsk); }
  });
  appEl.addEventListener("input", (e) => {
    const k = e.target.dataset?.input;
    if (k) INPUTS[k]?.(e.target.value, e.target);
  });
  appEl.addEventListener("keydown", (e) => {
    const k = e.target.dataset?.input;
    if (k && e.key === "Enter") { e.preventDefault(); INPUTS[`${k}:enter`]?.(e.target.value, e.target); e.target.blur(); }
    // arrow keys move between tabs in a tab list
    const tabEl = e.target.closest?.('[role="tab"]');
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (tabEl && step) {
      const list = tabEl.parentElement;
      const tabs = $$('[role="tab"]', list);
      tabs[(tabs.indexOf(tabEl) + step + tabs.length) % tabs.length].click();
      $('[role="tab"][aria-selected="true"]', list)?.focus();
      e.preventDefault();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!A.on) return;
    if (e.key === "Escape" && !e.target.closest?.("dialog") && !gpt.open && (A.sheet || A.modal || A.stacks[A.tab].length > 1)) { e.preventDefault(); back(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); if (!A.modal) go("search"); }
  }, true);

  /* ---------------------------------------------------------------
     Actions — what the app's buttons do
     --------------------------------------------------------------- */
  const ACTS = {
    top: () => topPage()?.scrollTo({ top: 0, behavior: smooth() }),
    retry: () => { if (navigator.onLine) { showOffline(false); refresh(); } else toast("Still offline. We’ll sync when you’re back.", "i-cloud-off"); },
    ask: (q, btn) => openGpt(btn, q),
    // tasks
    approve: (i) => { const r = taskRows()[Number(i)]; if (r && !r.classList.contains("is-done")) quickResolve(r, "approve"); },
    reject: (i) => askReject(Number(i)),
    seg: (seg) => setSeg(seg),
    "tk-filter": () => openSheet({ title: "Filter and sort", render: tkFilterHTML }),
    "tk-key": (k) => {
      if (APP_ORDER.includes(k)) setSeg("approvals", { app: A.tk.seg === "approvals" && A.tk.app === k ? "all" : k });
      else if (A.tk.seg !== "all" && A.tk.seg !== "approvals") { A.tk.type = A.tk.type === k ? "all" : k; refreshAll(); }
    },
    "f-app": (v) => { A.tk.app = v; refreshAll(); },
    "f-type": (v) => { A.tk.type = v; refreshAll(); },
    "f-status": (v) => { A.tk.status = v; refreshAll(); },
    "f-sort": (v) => { A.tk.sort = v; refreshAll(); },
    "f-clear": () => { Object.assign(A.tk, { app: "all", type: "all", status: "all", q: "", sort: A.tk.seg === "approvals" ? "urgent" : "new" }); $$('[data-input="tk"]', appEl).forEach((i) => { i.value = ""; }); refreshAll(); },
    edit: (id) => { const x = reqById(id); if (x) openRequestForm(x, "edit"); },
    revise: (id) => { const x = reqById(id); if (x) openRequestForm(x, "revise"); },
    remind: (id) => { const x = reqById(id); if (x && !x.reminded) ibRemind(x); },
    delete: (id) => askDelete(id),
    "approve-detail": (i, btn) => approveFromDetail(Number(i), btn),
    "next-task": (i) => nextTask(Number(i)),
    // announcements, people
    "ann-kind": (g) => annToKind(g),
    "ann-go": (n) => scrollAnnTo(Number(n)),
    wish: (key, btn) => openWish(key, btn),
    hello: (i, btn) => sayHello(Number(i), btn),
    "pp-kind": (v) => { A.pp.kind = v; refreshAll(); },
    "person-step": (d) => stepJoiner(Number(d)),
    // policies, groups, offers, perks
    "pol-cat": (v) => { A.pol.cat = v; refreshAll(); },
    join: (name, btn) => { const g = groupBy(name); if (g) setJoined(g.el, !g.joined, btn); },
    "off-group": (v) => { A.off.group = v; refreshAll(); },
    code: (code) => { if (isRevealed(code)) copyCode(code); else { revealCode(code); toast(`Your code is ${code}. Tap it to copy.`, "i-tag"); } },
    "pk-cat": (v) => { A.pk.cat = v; A.pk.open = false; refreshAll(); const r = $(".m-spot-rail", topPage()); if (r) r.scrollTo({ left: 0 }); },
    "pk-more": () => { A.pk.open = !A.pk.open; refreshAll(); },
    // help
    "faq-cat": (v) => { A.faq = v; refreshAll(); },
    // profile
    "sign-out": () => confirmSheet({ title: "Sign out?", text: "You’ll need to sign in again to see your tasks, requests and perks.", ok: "Sign out", danger: true, ic: "i-logout", onOk: signOut }),
    "auth-sso": (_, btn) => signInWithId(btn),
    "auth-bio": (kind) => showBio(kind === "face" ? "face" : "finger"),
    "auth-scan": (kind) => scanBio(kind === "face" ? "face" : "finger"),
    "auth-help": () => toast("IT support will be in touch shortly.", "i-help"),
    language: () => openSheet({ title: "Language", render: languageHTML }),
    "push-notify": (_, btn) => {
      const on = !pushOn();
      store.set(NOTIFY_KEY, JSON.stringify({ push: on }));
      btn.setAttribute("aria-checked", String(on));
      toast(on ? "Push notifications on" : "Push notifications off", "i-bell");
    },
    // notifications
    "notif-all": () => { if ($$("#notif-list .notif.is-unread").length) markAllRead(); else toast("You’re all caught up", "i-check"); },
    "notif-kind": (v) => { A.nf = v; refreshAll(); },
    "notif-open": (id) => openNotif(id),
    // search
    "sr-recent": (q) => runSearch(q, true),
    "sr-forget": (q) => { saveRecents(recents().filter((x) => x !== q)); renderAppSearch(); },
    "sr-clear": () => { saveRecents([]); renderAppSearch(); },
    "sr-group": (g) => { A.sr.group = g; A.sr.view = "results"; renderAppSearch(); },
    "sr-all": (g) => { A.sr.group = g || "all"; A.sr.view = "results"; renderAppSearch(); },
    "sr-open": (i) => openResult(Number(i))
  };
  const INPUTS = {
    tk: (v) => { A.tk.q = v; refreshAll(); },
    pp: (v) => { A.pp.q = v; refreshAll(); },
    pol: (v) => { A.pol.q = v; refreshAll(); },
    sr: (v) => { A.sr.q = v; A.sr.view = "live"; A.sr.group = "all"; renderAppSearch(); },
    "sr:enter": (v) => runSearch(v, true)
  };

  /* ---------------------------------------------------------------
     HOME — everything important happening today
     --------------------------------------------------------------- */
  PAGES.home = {
    root: true, title: () => "Home",
    render: () => `${helloHTML()}
      <section class="m-sec m-sec--attn" aria-label="Needs your attention" data-live="attn">${attnHTML()}</section>
      ${quickHTML()}
      <section class="m-sec m-sec--ann" aria-labelledby="m-ann-title">${annSectionHTML()}</section>
      <section class="m-sec" aria-labelledby="m-people-title">${homePeopleHTML()}</section>
      <section class="m-sec" aria-labelledby="m-pol-title">${homePolicyHTML()}</section>
      <section class="m-sec" aria-labelledby="m-ben-title" data-live="benefits">${homeBenefitsHTML()}</section>
      <p class="m-endcap" data-live="endcap">${endcapHTML()}</p>`,
    live: {
      attn: () => attnHTML(),
      benefits: () => homeBenefitsHTML(),
      endcap: () => endcapHTML(),
      annAct: (ctx, n) => slideActions(slides[Number(n)]),
      celebrate: () => celebrateStripHTML(),
      faces: () => railHTML(people.map((p, i) => faceHTML(p, i)), "m-face-rail", "New joiners")
    },
    mount(el) { bindAnn(el); bindPull(el); }
  };

  function helloHTML() {
    const now = new Date();
    const hr = now.getHours();
    const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    const target = (a) => (a.classList.contains("frag--joiner") ? "person/joiner:0" : a.classList.contains("frag--bday") ? "ann/0" : "policy/Data Security");
    const frags = $$(".frags .frag").map((a) => `<li><button class="frag frost m-frag" type="button" data-go="${target(a)}">${a.innerHTML}</button></li>`).join("");
    return `<section class="m-hello">
      <p class="hero__date"><i class="pulse-dot pulse-dot--live"></i><span>${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span></p>
      <h1 class="hero__title m-hello__title" tabindex="-1"><span class="hero__line"><span class="hero__line-in">${greet},</span></span> <span class="hero__line hero__line--name"><span class="hero__line-in">${esc(me.first)}<span class="hero__dot">.</span></span></span></h1>
      <p class="hero__tagline m-hello__tag">${$(".hero__tagline").innerHTML}</p>
      <ul class="m-frags" aria-label="Today at Bloom">${frags}</ul>
    </section>`;
  }

  const attnRow = ({ label, lead, title, meta, urgent, go }) =>
    `<li><button class="m-attn__row" type="button" data-go="${esc(go)}"><span class="m-attn__lead">${lead}</span><span class="m-attn__txt"><small${urgent ? ' class="is-urgent"' : ""}>${label}</small><strong>${esc(title)}</strong><span>${meta}</span></span>${icon("i-chevron-right", "ico ico--sm m-row__chev")}</button></li>`;
  function attnHTML() {
    if (!A.loaded) {
      loadOnce();
      return `<div class="m-attn tone-invert attention is-loading"><div class="m-attn__head"><p class="m-attn__kicker">${icon("i-bolt", "ico ico--sm")}Needs your attention</p></div>${skeletonHTML(3)}</div>`;
    }
    const open = openTasksData();
    const overdue = open.filter((t) => t.overdue).length;
    const today = open.filter((t) => t.today).length;
    const approval = open.find((t) => t.kind === "approval");
    const task = open.find((t) => t.kind === "task");
    const back = reqsIn("mine").find((x) => x.status === "returned");
    const rows = [
      approval && attnRow({ label: "Pending approval", lead: markOf(approval.src), title: approval.title, meta: `${sourceNames[approval.src]} · ${esc(approval.due)}`, urgent: approval.overdue, go: `task/${approval.i}` }),
      back && attnRow({ label: "Important action", lead: reqIcon(back), title: back.title, meta: `Returned by ${esc(back.steps[back.step - 1])} · revise and resubmit`, urgent: true, go: `request/${back.id}` }),
      task && attnRow({ label: "Pending task", lead: markOf(task.src), title: task.title, meta: `${sourceNames[task.src]} · ${esc(task.due)}`, urgent: task.overdue, go: `task/${task.i}` })
    ].filter(Boolean);
    const total = totalPending();
    const apps = APP_ORDER.filter((a) => counts[a]).length;
    return `<div class="m-attn tone-invert attention">
      <span class="attention__glow" aria-hidden="true"></span>
      <div class="m-attn__head"><p class="m-attn__kicker">${icon("i-bolt", "ico ico--sm")}Needs your attention</p><p class="live"><i class="pulse-dot pulse-dot--ok"></i>Live</p></div>
      <p class="m-attn__total"><strong>${total}</strong><span>actions pending<br>across ${apps} ${apps === 1 ? "app" : "apps"}</span></p>
      <ul class="m-attn__stats">${overdue ? `<li class="stat-pill stat-pill--alert"><i class="pulse-dot"></i>${overdue} overdue</li>` : ""}<li class="stat-pill">${today} due today</li></ul>
      <div class="m-attn__apps" role="group" aria-label="Pending by app">${APP_ORDER.map((a, i) => `<button class="m-attn__app" type="button" data-go="tasks/approvals/${a}" style="--i:${i};--share:${(counts[a] / START_TOTAL).toFixed(3)}" aria-label="${sourceNames[a]}, ${counts[a]} pending">${markOf(a)}<strong>${pad(counts[a])}</strong><span class="tab__bar" aria-hidden="true"></span></button>`).join("")}</div>
      ${rows.length ? `<ul class="m-attn__list">${rows.join("")}</ul>` : `<p class="m-attn__clear">${icon("i-check", "ico ico--sm")}You’re all caught up.</p>`}
      <button class="btn btn--light m-attn__all" type="button" data-go="tab/tasks">View all tasks${icon("i-arrow", "ico ico--sm btn__arrow")}</button>
    </div>`;
  }

  function quickHTML() {
    const apps = quickLinks().map((x) => `<li><a class="m-app" href="${esc(x.href)}" target="_blank" rel="noopener"><span class="app-mark app-mark--lg ${x.mark}" aria-hidden="true"></span><span class="m-app__name">${esc(x.name)}</span><span class="m-app__hint">${esc(x.hint)}</span></a></li>`).join("");
    return `<section class="m-sec" aria-labelledby="m-ql-title">${secHead($("#ql-title").textContent).replace('class="m-sec__title"', 'class="m-sec__title" id="m-ql-title"')}
      <div class="m-dock frost"><ul class="m-dock__list" data-rail>${apps}<li><button class="m-app" type="button" data-toast="Opening quick links…"><span class="app-mark app-mark--lg m-app__all" aria-hidden="true">${icon("i-grid")}</span><span class="m-app__name">View all</span><span class="m-app__hint">Every app</span></button></li></ul></div></section>`;
  }

  /* Announcements: the page's own slides, as swipeable cards */
  function annCardHTML(sl, n) {
    const tpl = document.createElement("template");
    tpl.innerHTML = slideHTML(sl, n).trim();
    const card = tpl.content.firstElementChild;
    card.classList.remove("is-current");
    card.classList.add("announce", "m-ann");
    card.removeAttribute("aria-hidden");
    card.dataset.n = n;
    card.dataset.mood = sl.group;
    card.prepend($("#announcements .announce__bg").cloneNode(true));
    const cta = $(".slide__cta", card);
    if (cta) { cta.dataset.live = "annAct"; cta.dataset.arg = n; }
    // "Also today" avatars jump to that card
    $$("[data-go]", card).forEach((b) => { b.dataset.act = "ann-go"; b.dataset.v = b.dataset.go; delete b.dataset.go; });
    // the Eid art's gradient and mask need ids of their own
    return card.outerHTML.replace(/eid-(gold|cut)/g, "m-eid-$1");
  }
  function annSectionHTML() {
    const c = { kick: $("#announcements .kicker").lastChild.textContent.trim(), title: $("#ann-title").textContent };
    const tiles = ANN_TILES.map((t, i) => `<button class="chip m-ann-chip${i ? "" : " is-selected"}" type="button" aria-pressed="${!i}" data-act="ann-kind" data-v="${t.group}">${esc(t.label)}${t.group === "bday" ? `<span class="chip__count">${birthdays.length}</span>` : ""}</button>`).join("");
    return `<div class="m-sec__head m-sec__head--kick">${kicker(c.kick)}<h2 class="m-sec__title" id="m-ann-title">${esc(c.title)}</h2></div>
      <div class="chips m-chips" role="group" aria-label="Jump to an announcement">${tiles}</div>
      ${railHTML(slides.map(annCardHTML), "m-ann-rail", "Announcements")}`;
  }
  function bindAnn(el) {
    const rail = $(".m-ann-rail", el);
    if (!rail) return;
    // the card in view comes alive (its own entrance plays) and its kind lights up
    rail._onIndex = (i, card) => {
      $$(".m-ann", rail).forEach((c) => c.classList.toggle("is-current", c === card));
      const g = card?.dataset.group;
      $$(".m-ann-chip", el).forEach((c) => { const on = c.dataset.v === g; c.classList.toggle("is-selected", on); c.setAttribute("aria-pressed", String(on)); });
    };
    requestAnimationFrame(() => updateAppRail(rail));
  }
  function scrollAnnTo(n) {
    const pg = A.stacks.home[0];
    const rail = pg && $(".m-ann-rail", pg);
    const card = rail?.children[n];
    if (card) rail.scrollTo({ left: card.offsetLeft - (parseFloat(getComputedStyle(rail).paddingLeft) || 0), behavior: smooth() });
  }
  function annToKind(g) {
    const pg = A.stacks.home[0];
    const cur = slides[$(".m-ann-rail", pg)?._index ?? 0];
    scrollAnnTo(g === "bday" && cur?.group === "bday" ? (cur.i + 1) % birthdays.length : groupStart(g));
  }
  function showAnn(n) {
    closeModal(false);
    closeSheet(false);
    if (A.tab !== "home") setTab("home");
    popToRoot("home", false);
    const pg = A.stacks.home[0];
    const sec = $(".m-sec--ann", pg);
    pg.scrollTo({ top: sec.offsetTop - 64, behavior: smooth() });
    setTimeout(() => scrollAnnTo(n), reduceMotion ? 0 : 300);
  }

  function faceHTML(p, i, big = false) {
    return `<button class="m-face${big ? " m-face--big" : ""}" type="button" data-go="person/joiner:${i}" aria-label="${esc(p.name)}, ${esc(p.role)}">
      <span class="m-face__img ${p.img}" aria-hidden="true"></span>
      ${i === 0 || big ? `<span class="m-face__badge">${icon("i-sparkle", "ico ico--xs")}${esc(p.week)}</span>` : ""}
      <span class="m-face__txt"><strong>${esc(p.name.split(" ")[0])}${big ? ` ${esc(p.name.split(" ").slice(1).join(" "))}` : ""}</strong><small>${esc(p.role)}</small>${greeted.has(i) ? `<span class="m-face__sent">${icon("i-wave", "ico ico--xs")}Hello sent</span>` : ""}</span>
      </button>`;
  }
  function celebrateStripHTML() {
    const folks = [...birthdays.map((p, i) => ({ ...p, key: `b${i}` })), { ...anniversary, key: "a" }];
    const left = folks.filter((p) => !wished.has(p.key)).length;
    return `<button class="m-card m-celebrate" type="button" data-go="people">
      <span class="feed__stack" aria-hidden="true">${folks.map((p) => avatarHTML(p)).join("")}</span>
      <span class="m-celebrate__txt"><strong>${birthdays.length} birthdays and a work anniversary</strong><small>${left ? `${left} still to wish today` : "You’ve wished everyone today"}</small></span>${chevron}</button>`;
  }
  function homePeopleHTML() {
    return `${secHead("New at Bloom", { link: { label: "See all", go: "people" } }).replace('class="m-sec__title"', 'class="m-sec__title" id="m-people-title"')}
      <div data-live="faces">${railHTML(people.map((p, i) => faceHTML(p, i)), "m-face-rail", "New joiners")}</div>
      <div data-live="celebrate">${celebrateStripHTML()}</div>`;
  }
  function policyFeatureHTML(p) {
    return `<button class="m-card m-feature" type="button" data-go="policy/${esc(p.name)}">
      <span class="m-feature__media m-media ${p.img}" aria-hidden="true"></span>
      <span class="m-feature__body">${p.tag}<strong class="m-feature__title">${esc(p.name)}</strong><span class="m-feature__desc">${esc(p.desc)}</span>
      <span class="m-feature__foot"><span class="meta">${esc(p.updated || p.cat)}</span><span class="policy__go"><span class="policy__go-label">Read policy</span>${icon("i-arrow")}</span></span></span></button>`;
  }
  function homePolicyHTML() {
    const list = policiesData();
    const p = list.find((x) => x.updated) || list[0];
    return `${secHead("Policy update", { link: { label: "All policies", go: "policies" } }).replace('class="m-sec__title"', 'class="m-sec__title" id="m-pol-title"')}${policyFeatureHTML(p)}`;
  }
  function offerTileHTML(o) {
    return `<li class="m-card m-offer">
      <button class="m-task__hit" type="button" data-go="discount/${esc(o.code)}" aria-label="${esc(o.name)}, ${esc(o.off)} off"></button>
      <span class="m-offer__plate" aria-hidden="true"><span class="partner__logo ${o.logo}"></span></span>
      <span class="partner__cat">${esc(o.cat)}</span><strong class="m-offer__name">${esc(o.name)}</strong>
      <span class="offer"><strong>${esc(o.off)}</strong> off</span>
      <button class="partner__code m-offer__code${o.revealed ? " is-revealed" : ""}" type="button" data-act="code" data-v="${esc(o.code)}"${o.revealed ? ` aria-label="Copy code ${esc(o.code)}"` : ""}>${o.revealed ? `${esc(o.code)} ${icon("i-copy", "ico ico--xs")}` : "Get code"}</button></li>`;
  }
  function spotCardHTML(x, { rail = false } = {}) {
    return `<button class="m-spot${rail ? " m-spot--rail" : ""}" type="button" data-go="perk/${x.id}" data-pc="${x.cat}" aria-label="${esc(x.title)}, ${PERK_CATS[x.cat]} perk">
      <span class="perk-shot is-active ${x.img || "perk-shot--art"}" data-pc="${x.cat}" aria-hidden="true">${x.img ? "" : `${icon(x.icon, "ico perk-shot__icon")}${icon("i-sparkle", "ico perk-shot__spark")}`}</span>
      <span class="m-spot__body"><span class="perk-spot__top"><span class="perk-spot__cat" data-pc="${x.cat}"><span class="chip__dot" aria-hidden="true"></span>${PERK_CATS[x.cat]}</span>${x.tag ? `<span class="tag perk-spot__tag">${icon(PERK_TAGS[x.tag[0]], "ico ico--xs")}${x.tag[1]}</span>` : ""}</span>
      <strong class="m-spot__title">${esc(x.title)}</strong><span class="m-spot__text">${esc(x.text)}</span></span></button>`;
  }
  function homeBenefitsHTML() {
    const top = offersData().sort((a, b) => b.pct - a.pct).slice(0, 2);
    return `${secHead("Perks & discounts", { link: { label: "Explore", go: "perks" } }).replace('class="m-sec__title"', 'class="m-sec__title" id="m-ben-title"')}
      ${spotCardHTML(perks[0])}
      <ul class="m-offer-grid">${top.map(offerTileHTML).join("")}</ul>
      <button class="soft-link soft-link--sm m-sec__more" type="button" data-go="discounts">All ${offersData().length} partner offers${icon("i-arrow", "ico ico--sm")}</button>`;
  }
  const endcapHTML = () => `${icon("i-check", "ico ico--sm")}<span>You’re up to date · synced <span class="js-synced">${A.synced}</span></span>`;

  /* Pull to refresh (Home and Tasks) */
  function bindPull(pg) {
    const ind = document.createElement("div");
    ind.className = "m-pull";
    ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = `<span class="m-pull__disc">${icon("i-refresh", "ico ico--sm")}</span>`;
    pg.append(ind);
    let y0 = null;
    let dy = 0;
    const reset = () => { ind.style.transform = ""; ind.style.opacity = ""; ind.classList.remove("is-ready"); };
    pg.addEventListener("touchstart", (e) => { y0 = pg.scrollTop <= 0 && !A.refreshing && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    pg.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0 || pg.scrollTop > 0) { reset(); return; }
      const p = Math.min(1, dy / 96);
      ind.style.transform = `translate(-50%, ${Math.min(dy * 0.55, 70).toFixed(1)}px) rotate(${(p * 270).toFixed(0)}deg) scale(${(0.5 + p * 0.5).toFixed(3)})`;
      ind.style.opacity = p.toFixed(3);
      ind.classList.toggle("is-ready", p >= 1);
    }, { passive: true });
    pg.addEventListener("touchend", () => {
      if (y0 === null) return;
      y0 = null;
      if (dy >= 96) refresh(ind); else reset();
    });
    pg.addEventListener("touchcancel", () => { y0 = null; reset(); });
  }
  function refresh(ind) {
    A.refreshing = true;
    if (ind) { ind.classList.add("is-busy"); ind.style.transform = "translate(-50%, 56px)"; ind.style.opacity = "1"; }
    setTimeout(() => {
      A.refreshing = false;
      if (ind) { ind.classList.remove("is-busy", "is-ready"); ind.style.transform = ""; ind.style.opacity = ""; }
      if (!navigator.onLine) { showOffline(true); toast("Couldn’t sync. You’re offline.", "i-cloud-off"); return; }
      A.synced = "just now";
      $$(".js-synced").forEach((s) => { s.textContent = A.synced; });
      refreshAll();
      toast("Synced just now", "i-refresh");
    }, reduceMotion ? 300 : 1100);
  }
  function loadOnce() {
    if (A.loaded || A.loading) return;
    A.loading = true;
    setTimeout(() => { A.loaded = true; A.loading = false; refreshAll(); }, reduceMotion ? 0 : 900);
  }

  /* ---------------------------------------------------------------
     TASKS — the action centre (no New request here, by design)
     --------------------------------------------------------------- */
  const SEGS = [["all", "All"], ["approvals", "Approvals"], ["pending", "Pending"], ["drafts", "Drafts"], ["mine", "My requests"]];
  const SEG_STATES = { drafts: ["draft"], pending: ["mine"], mine: ["mine", "history"] };
  const SORTS = { approvals: [["urgent", "Most urgent"], ["az", "A–Z"]], other: [["new", "Newest"], ["old", "Oldest"], ["az", "A–Z"]] };

  PAGES.tasks = {
    root: true, title: () => "Inbox",
    render: () => `${intro({ kick: "Bloom@Go", title: "Inbox", sub: $(".inbox__sub").textContent })}
      <div class="m-sec m-sec--sum" data-live="tkSum">${tkSumHTML()}</div>
      <div class="m-tk-tools">${searchField("tk", "Search tasks and requests", A.tk.q)}<span class="m-tk-filter" data-live="tkFilterBtn">${tkFilterBtnHTML()}</span></div>
      <div class="tabs m-tabs" role="tablist" aria-label="Tasks and requests">${tkTabsHTML()}</div>
      <div class="m-tk-list" role="tabpanel" aria-live="polite" data-live="tkList">${tkListHTML()}</div>
      <p class="m-tk-foot" data-live="tkFoot">${tkFootHTML()}</p>`,
    live: { tkSum: () => tkSumHTML(), tkFilterBtn: () => tkFilterBtnHTML(), tkList: () => tkListHTML(), tkFoot: () => tkFootHTML() },
    mount(el) { bindPull(el); },
    activate(el) { requestAnimationFrame(() => moveIndicator($(".m-tabs", el))); },
    refreshed(el) { syncTkTabs(el); }
  };
  const tkDots = () => ({ approvals: openTasksData().some((t) => t.overdue), pending: reqsIn("mine").some((x) => x.status === "returned") });
  function tkTabsHTML() {
    const dot = tkDots();
    return `<span class="tabs__indicator" aria-hidden="true"></span>${SEGS.map(([k, label]) => { const on = A.tk.seg === k; return `<button class="tab${on ? " is-selected" : ""}${dot[k] ? " has-dot" : ""}" role="tab" type="button" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-act="seg" data-v="${k}">${label}<i class="m-tabs__dot" aria-hidden="true"></i></button>`; }).join("")}`;
  }
  function syncTkTabs(pg) {
    const list = $(".m-tabs", pg);
    const dot = tkDots();
    $$(".tab", list).forEach((t) => {
      const on = t.dataset.v === A.tk.seg;
      t.classList.toggle("is-selected", on);
      t.classList.toggle("has-dot", !!dot[t.dataset.v]);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    moveIndicator(list);
  }
  function tkList(seg = A.tk.seg) {
    const f = A.tk;
    const q = f.q.trim().toLowerCase();
    const hit = (s) => !q || s.toLowerCase().includes(q);
    if (seg === "approvals") {
      const list = tasksData().filter((t) => (f.app === "all" || t.src === f.app) && hit(`${t.title} ${t.detail} ${sourceNames[t.src]}`));
      return list.sort(f.sort === "az" ? (a, b) => a.title.localeCompare(b.title) : byUrgency);
    }
    const states = SEG_STATES[seg] || [];
    const list = ib.items.filter((x) => states.includes(x.state) && (f.type === "all" || x.type === f.type) && (f.status === "all" || statusOf(x) === f.status) &&
      hit(`${x.title} ${x.details || ""} ${x.note || ""} ${IB_TYPES[x.type].label} ${x.ref}`));
    const by = { old: (a, b) => b.ago - a.ago, az: (a, b) => a.title.localeCompare(b.title) }[f.sort] || ((a, b) => a.ago - b.ago);
    return list.sort(by);
  }
  const activeFilters = () => (A.tk.app !== "all" ? 1 : 0) + (A.tk.type !== "all" ? 1 : 0) + (A.tk.status !== "all" ? 1 : 0) + (A.tk.sort !== (A.tk.seg === "approvals" || A.tk.seg === "all" ? "urgent" : "new") ? 1 : 0);
  function tkFilterBtnHTML() {
    const n = activeFilters();
    return `<button class="btn btn--ghost m-filter-btn" type="button" data-act="tk-filter" aria-label="Filter and sort${n ? `, ${n} active` : ""}"${A.tk.seg === "all" ? " hidden" : ""}>${icon("i-filter", "ico ico--sm")}<span class="m-filter-btn__label">Filter</span>${n ? `<span class="ib-filter__count">${n}</span>` : ""}</button>`;
  }
  function donutHTML(slices, total, unit, label) {
    let acc = 0;
    const segs = slices.map((x) => {
      const len = total ? (x.v / total) * DONUT_C : 0;
      const s = `<circle class="ib-donut__seg" cx="66" cy="66" r="${DONUT_R}" style="--c: var(--viz-${x.slot}); stroke-dasharray: ${Math.max(0, len - (x.v && x.v !== total ? DONUT_GAP : 0)).toFixed(2)} ${DONUT_C.toFixed(2)}; stroke-dashoffset: ${(-acc).toFixed(2)}"/>`;
      acc += len;
      return s;
    }).join("");
    return `<div class="ib-donut m-donut" role="img" aria-label="${esc(label)}: ${slices.map((x) => `${x.label} ${x.v}`).join(", ")}"><svg viewBox="0 0 132 132" aria-hidden="true"><circle class="ib-donut__track" cx="66" cy="66" r="${DONUT_R}"/>${segs}</svg><div class="ib-donut__center"><p class="ib-donut__num">${total}</p><p class="ib-donut__lbl">${unit}</p></div></div>`;
  }
  function tkSumHTML() {
    const seg = A.tk.seg;
    let label, num, sub, unit, ic, slices, chart, keyOn;
    if (seg === "all" || seg === "approvals") {
      const open = openTasksData();
      label = "Waiting on you"; ic = "i-inbox"; unit = "waiting"; chart = "Waiting by app";
      num = totalPending();
      sub = `${open.filter((t) => t.overdue).length} overdue · ${open.filter((t) => t.today).length} due today · across ${APP_ORDER.filter((a) => counts[a]).length} apps`;
      slices = APP_ORDER.map((a) => ({ key: a, label: sourceNames[a], slot: IB_APP_SLOTS[a], v: counts[a] }));
      keyOn = seg === "approvals" ? A.tk.app : "";
    } else {
      const items = reqsIn(...SEG_STATES[seg]);
      num = items.length;
      slices = Object.entries(IB_TYPES).map(([k, t]) => ({ key: k, label: t.label, slot: t.slot, v: items.filter((x) => x.type === k).length }));
      keyOn = A.tk.type;
      if (seg === "drafts") { label = "Drafts"; ic = "i-edit"; unit = "drafts"; chart = "Drafts by type"; sub = items.length ? `Last edited ${ibAgo(Math.min(...items.map((x) => x.ago)))}` : "No drafts right now"; }
      else if (seg === "pending") { const b = items.filter((x) => x.status === "returned").length; label = "In progress"; ic = "i-send"; unit = "in progress"; chart = "In progress by type"; sub = `${items.length - b} in review · ${b} returned to you`; }
      else { const closed = items.filter((x) => x.state === "history").length; label = "Submitted"; ic = "i-archive"; unit = "requests"; chart = "Requests by type"; sub = `${items.length - closed} in progress · ${closed} closed`; }
    }
    const total = slices.reduce((s, x) => s + x.v, 0);
    return `<div class="m-card m-sum">
      <div class="m-sum__stat"><span class="ib-stat__icon" aria-hidden="true">${icon(ic)}</span><p class="m-sum__label">${label}</p><p class="m-sum__num">${num}</p></div>
      ${donutHTML(slices, total, unit, chart)}
      <p class="m-sum__sub">${sub}</p>
      <div class="m-legend" role="group" aria-label="${esc(chart)}. Tap one to filter">${slices.map((x) => `<button class="m-legend__item" type="button" data-act="tk-key" data-v="${x.key}" aria-pressed="${keyOn === x.key}" style="--c: var(--viz-${x.slot})"><span class="ib-legend__dot" aria-hidden="true"></span>${x.label}<strong>${x.v}</strong></button>`).join("")}</div>
    </div>`;
  }

  function taskCardHTML(t) {
    const pill = t.done
      ? `<span class="ib-status ib-status--${t.outcome === "reject" ? "rejected" : "approved"}">${icon(t.outcome === "reject" ? "i-x" : "i-check", "ico ico--xs")}${t.outcome === "reject" ? "Rejected" : "Approved"}</span>`
      : t.dueHTML;
    return `<li class="m-card m-task${t.done ? " is-done" : ""}${A.justDone === `task-${t.i}` ? " is-just-done" : ""}">
      <button class="m-task__hit" type="button" data-go="task/${t.i}" aria-label="${t.done ? "View" : "Review"}: ${esc(t.title)}"></button>
      <div class="m-task__top">${markOf(t.src)}<p class="m-task__src"><strong>${sourceNames[t.src]}</strong><small>${t.kind === "approval" ? "Approval" : "Task"}</small></p>${pill}</div>
      <p class="m-task__title">${esc(t.title)}</p>
      <p class="m-task__meta">${esc(t.detail)}</p>
      ${t.done ? "" : `<div class="m-task__acts"><button class="task__approve" type="button" data-act="approve" data-v="${t.i}">${icon("i-check", "ico ico--xs")}Approve</button><button class="task__reject" type="button" data-act="reject" data-v="${t.i}">${icon("i-x", "ico ico--xs")}Reject</button><button class="task__more" type="button" data-go="task/${t.i}" aria-label="Details: ${esc(t.title)}">${icon("i-arrow", "ico ico--xs")}</button></div>`}
    </li>`;
  }
  function reqCardHTML(x) {
    const t = IB_TYPES[x.type];
    let meta = "";
    let acts = "";
    if (x.state === "draft") {
      meta = `Edited ${ibAgo(x.ago)}`;
      acts = `<button class="ib-act ib-act--edit" type="button" data-act="edit" data-v="${x.id}">${icon("i-edit", "ico ico--xs")}Edit</button><button class="ib-act ib-act--delete" type="button" data-act="delete" data-v="${x.id}" aria-label="Delete draft ${esc(x.title)}">${icon("i-trash", "ico ico--xs")}Delete</button>`;
    } else if (x.state === "mine") {
      const bars = x.steps.map((_, s) => `<i class="${s + 1 < x.step ? "is-done" : s + 1 === x.step ? (x.status === "returned" ? "is-returned" : "is-current") : ""}"></i>`).join("");
      meta = `<span class="ib-steps" aria-hidden="true">${bars}</span>Step ${x.step} of ${x.steps.length} · ${x.status === "returned" ? "Back with you" : `With ${esc(x.steps[x.step - 1])}`}`;
      acts = `<button class="ib-act" type="button" data-go="request/${x.id}">${icon("i-eye", "ico ico--xs")}View</button>` + (x.status === "returned"
        ? `<button class="ib-act ib-act--edit" type="button" data-act="revise" data-v="${x.id}">${icon("i-edit", "ico ico--xs")}Revise</button>`
        : `<button class="ib-act" type="button" data-act="remind" data-v="${x.id}"${x.reminded ? " disabled" : ""}>${icon("i-bellring", "ico ico--xs")}${x.reminded ? "Reminded" : "Remind"}</button>`);
    } else {
      meta = `Closed ${x.closed}`;
      acts = `<button class="ib-act" type="button" data-go="request/${x.id}">${icon("i-eye", "ico ico--xs")}View</button>`;
    }
    return `<li class="m-card m-task m-req${A.fresh === x.id ? " is-new" : ""}" data-id="${x.id}">
      <button class="m-task__hit" type="button" data-go="request/${x.id}" aria-label="Open ${esc(x.title)}"></button>
      <div class="m-task__top">${reqIcon(x)}<p class="m-task__src"><strong><span class="ib-type" style="--c: var(--viz-${t.slot})">${t.label}</span></strong><small>${x.ref}</small></p>${ibStatusPill(x)}</div>
      <p class="m-task__title">${esc(x.title)}</p>
      <p class="m-task__meta">${meta}</p>
      <div class="m-task__acts">${acts}</div></li>`;
  }
  const cardFor = (x) => (x.row ? taskCardHTML(x) : reqCardHTML(x));
  const groupHTML = (title, items, n, seg, max = items.length) =>
    `<div class="m-group"><div class="m-group__head"><h3 class="m-group__title">${title} <span>${n}</span></h3>${n > max ? `<button class="link-btn" type="button" data-act="seg" data-v="${seg}">See all ${n}</button>` : ""}</div><ul class="m-cards">${items.slice(0, max).map(cardFor).join("")}</ul></div>`;
  function tkListHTML() {
    if (!A.loaded) { loadOnce(); return skeletonHTML(3); }
    const seg = A.tk.seg;
    const filtered = !!A.tk.q.trim() || activeFilters() > 0;
    const clear = filtered ? `<button class="btn btn--quiet btn--sm" type="button" data-act="f-clear">Clear search and filters</button>` : "";
    if (seg === "all") {
      const open = tkList("approvals").filter((t) => !t.done);
      const inProgress = tkList("pending");
      const backWithYou = inProgress.filter((x) => x.status === "returned");
      const review = inProgress.filter((x) => x.status === "review");
      const drafts = tkList("drafts");
      const groups = [
        open.length && groupHTML("Waiting on you", open, open.length, "approvals", 3),
        backWithYou.length && groupHTML("Back with you", backWithYou, backWithYou.length, "pending"),
        review.length && groupHTML("In review", review, review.length, "pending", 2),
        drafts.length && groupHTML("Drafts", drafts, drafts.length, "drafts", 2)
      ].filter(Boolean);
      return groups.length ? groups.join("") : emptyHTML(filtered
        ? { title: "Nothing matches", text: "Try another word, or clear the search.", action: clear }
        : { ic: "i-check", title: "You’re all caught up", text: "Nothing is waiting on you right now." });
    }
    const list = tkList(seg);
    if (!list.length) {
      if (filtered) return emptyHTML({ title: "Nothing matches", text: "Try another word, pick a different filter, or clear them.", action: clear });
      return emptyHTML({
        approvals: { ic: "i-check", title: "Nothing waiting on you", text: "You’re all caught up." },
        pending: { ic: "i-send", title: "Nothing in progress", text: "Requests you’ve sent appear here while approvers review them." },
        drafts: { ic: "i-edit", title: "No drafts right now", text: "Requests you save without sending appear here." },
        mine: { ic: "i-archive", title: "No requests yet", text: "Requests you’ve sent, and how they ended, appear here." }
      }[seg]);
    }
    if (seg === "mine") {
      const prog = list.filter((x) => x.state === "mine");
      const closed = list.filter((x) => x.state === "history");
      return [prog.length && groupHTML("In progress", prog, prog.length, "pending"), closed.length && groupHTML("Closed", closed, closed.length, "mine")].filter(Boolean).join("");
    }
    return `<ul class="m-cards">${list.map(cardFor).join("")}</ul>`;
  }
  function tkFootHTML() {
    const seg = A.tk.seg;
    const more = seg === "approvals" ? `Showing ${tkList().length} of ${taskRows().length} · the ${totalPending()} total includes items you open in each app` : "";
    return `${more ? `<span>${more}</span>` : ""}<span>Synced <span class="js-synced">${A.synced}</span></span>`;
  }
  function tkFilterHTML() {
    const seg = A.tk.seg;
    const f = A.tk;
    const group = (label, act, opts, cur) => `<p class="ib-filter__label">${label}</p><div class="chips m-sheet-chips" role="group" aria-label="${label}">${opts.map(([k, l]) => chipHTML({ label: l, on: cur === k, act, v: k })).join("")}</div>`;
    let html = seg === "approvals"
      ? group("App", "f-app", [["all", "All apps"], ...APP_ORDER.map((a) => [a, sourceNames[a]])], f.app)
      : group("Request type", "f-type", [["all", "All types"], ...Object.entries(IB_TYPES).map(([k, t]) => [k, t.label])], f.type);
    if (seg === "pending") html += group("Status", "f-status", [["all", "Any"], ["review", STATUS.review], ["returned", STATUS.returned]], f.status);
    if (seg === "mine") html += group("Status", "f-status", [["all", "Any"], ...Object.entries(STATUS)], f.status);
    html += group("Sort by", "f-sort", seg === "approvals" ? SORTS.approvals : SORTS.other, f.sort);
    const n = tkList(seg).length;
    return `<div class="m-filter">${html}</div><div class="m-sheet-foot"><button class="btn btn--quiet" type="button" data-act="f-clear">Clear</button><button class="btn btn--primary" type="button" data-sheet-close>Show ${n} ${n === 1 ? "result" : "results"}</button></div>`;
  }
  function goTasks(seg = "all", opts = {}) {
    closeModal(false);
    closeSheet(false);
    if (A.tab !== "tasks") setTab("tasks");
    popToRoot("tasks", false);
    setSeg(seg, opts);
  }
  function setSeg(seg, { app = "all", type = "all", status = "all" } = {}) {
    Object.assign(A.tk, { seg, app, type, status, sort: seg === "all" || seg === "approvals" ? "urgent" : "new" });
    const pg = A.stacks.tasks[0];
    if (!pg) return;
    refreshPage(pg);
    if (!reduceMotion) $$(".m-tk-list .m-card", pg).forEach((c, i) => { c.style.animationDelay = `${Math.min(i, 8) * 45}ms`; c.classList.add("is-in"); });
  }
  function askReject(i) {
    const t = tasksData()[i];
    if (!t || t.done) return;
    confirmSheet({
      title: "Reject this task?", danger: true, ic: "i-x", ok: "Reject",
      text: `<strong>${esc(t.title)}</strong><br>It’s rejected in ${sourceNames[t.src]} and leaves your list.`,
      onOk: () => { const r = taskRows()[i]; if (r && !r.classList.contains("is-done")) quickResolve(r, "reject"); }
    });
  }
  function askDelete(id) {
    const x = reqById(id);
    if (!x) return;
    confirmSheet({
      title: "Delete this draft?", danger: true, ic: "i-trash", ok: "Delete draft",
      text: `<strong>${esc(x.title)}</strong><br>This can’t be undone.`,
      onOk: () => {
        const cards = $$(`.m-req[data-id="${id}"]`, appEl);
        const done = () => { ib.items = ib.items.filter((y) => y !== x); toast("Draft deleted", "i-trash"); if (A.stacks[A.tab].at(-1)?._page.ctx === id) pop(); sync(); };
        if (reduceMotion || !cards.length) { done(); return; }
        Promise.all(cards.map((c) => { c.style.overflow = "hidden"; return motion(c, [{ height: `${c.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", marginTop: "-12px" }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }); })).then(done);
      }
    });
  }
  function onRequestSaved({ item, submit }) {
    A.fresh = item.id;
    setTimeout(() => { A.fresh = null; }, 1800);
    // A resubmitted or sent draft now lives under Pending
    if (submit && A.tab === "tasks" && A.stacks.tasks.length === 1 && A.tk.seg === "drafts") setSeg("pending");
  }

  /* Task detail */
  PAGES.task = {
    title: () => "Review task",
    render(i) {
      const t = tasksData()[Number(i)];
      if (!t) return emptyHTML({ title: "This task isn’t here any more", text: "It may have been completed in its app." });
      return `<div class="m-detail">
        <div class="d-task__row"><span class="app-mark app-mark--lg app-mark--${sourceMarks[t.src]}" aria-hidden="true"></span><span class="tag">${sourceNames[t.src]}</span><span class="m-detail__state" data-live="taskState">${taskStateHTML(i)}</span></div>
        <h1 class="d-task__title m-detail__title" tabindex="-1">${esc(t.title)}</h1>
        <dl class="d-facts"><div><dt>Context</dt><dd>${esc(t.detail)}</dd></div><div><dt>Due</dt><dd>${esc(t.due)}</dd></div><div><dt>App</dt><dd>${sourceNames[t.src]}</dd></div><div><dt>Kind</dt><dd>${t.kind === "approval" ? "Approval" : "Task"}</dd></div></dl>
        <p class="d-note">Approving here updates the task in ${sourceNames[t.src]}. You can also open it there for the full record.</p>
        <ul class="m-list">
          ${rowHTML({ lead: tile("i-external"), title: `Open in ${sourceNames[t.src]}`, sub: "The full record, in a new tab", attrs: ` data-toast="Opening ${sourceNames[t.src]} in a new tab…"` })}
          ${rowHTML({ lead: tile("i-users"), title: "Reassign", sub: "Only the task owner can reassign", end: "", attrs: " disabled" })}
          ${rowHTML({ lead: `<span class="orb orb--sm"></span>`, title: "Ask Bloom GPT what’s next", sub: "Your most urgent work, in order", act: "ask", v: "What needs my attention?" })}
        </ul>
      </div>
      <div class="m-actionbar" data-live="taskBar">${taskBarHTML(i)}</div>`;
    },
    live: { taskState: (i) => taskStateHTML(i), taskBar: (i) => taskBarHTML(i) }
  };
  function taskStateHTML(i) {
    const t = tasksData()[Number(i)];
    if (!t) return "";
    return t.done ? `<span class="ib-status ib-status--${t.outcome === "reject" ? "rejected" : "approved"}">${icon(t.outcome === "reject" ? "i-x" : "i-check", "ico ico--xs")}${t.outcome === "reject" ? "Rejected" : "Approved"}</span>` : t.dueHTML;
  }
  function taskBarHTML(i) {
    const t = tasksData()[Number(i)];
    if (!t) return "";
    if (!t.done) return `<button class="btn task__reject m-actionbar__half" type="button" data-act="reject" data-v="${t.i}">${icon("i-x", "ico ico--sm")}Reject</button><button class="btn btn--primary m-actionbar__main" type="button" data-act="approve-detail" data-v="${t.i}"><span class="btn__label">Approve</span><span class="spinner" aria-hidden="true"></span></button>`;
    const next = openTasksData().find((x) => x.i !== t.i);
    return `<div class="m-done${A.justDone === `task-${t.i}` ? " is-just-done" : ""}" role="status"><span class="m-done__icon${t.outcome === "reject" ? " is-rejected" : ""}" aria-hidden="true">${icon(t.outcome === "reject" ? "i-x" : "i-check")}</span><p><strong>${t.outcome === "reject" ? "Rejected" : "Approved"}</strong><span>Synced to ${sourceNames[t.src]}</span></p>
      ${next ? `<button class="btn btn--primary btn--sm" type="button" data-act="next-task" data-v="${t.i}">Next task${icon("i-arrow", "ico ico--sm btn__arrow")}</button>` : `<button class="btn btn--quiet btn--sm" type="button" data-app-back>All done</button>`}</div>`;
  }
  function approveFromDetail(i, btn) {
    btn.classList.add("is-loading");
    $(".btn__label", btn).textContent = "Approving";
    setTimeout(() => { const r = taskRows()[i]; if (r && !r.classList.contains("is-done")) quickResolve(r, "approve"); }, reduceMotion ? 0 : 900);
  }
  function nextTask(i) {
    const next = openTasksData().find((x) => x.i !== i);
    const pg = topPage();
    if (!next || pg?._page.name !== "task") return;
    motion($(".pg-body", pg), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-24px)" }], { duration: 200, easing: "ease-in" }).then(() => {
      repaint(pg, String(next.i));
      motion($(".pg-body", pg), [{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: 360 });
      focusPage(pg);
    });
  }

  /* Request detail */
  PAGES.request = {
    title: (id) => (reqById(id)?.state === "draft" ? "Draft" : "Request details"),
    render(id) {
      return `<div class="m-detail" data-live="reqMain">${reqMainHTML(id)}</div>
      <div class="m-actionbar" data-live="reqBar">${reqBarHTML(id)}</div>`;
    },
    live: { reqMain: (id) => reqMainHTML(id), reqBar: (id) => reqBarHTML(id) },
    refreshed(pg, id) { const t = $(".pg-bar__title", pg); if (t) t.textContent = PAGES.request.title(id); }
  };
  function reqMainHTML(id) {
    const x = reqById(id);
    if (!x) return emptyHTML({ ic: "i-trash", title: "This request isn’t here any more", text: "It may have been deleted." });
    const t = IB_TYPES[x.type];
    const steps = x.steps || [];
    const stateOf = (i) => {
      if (x.state === "history") return x.outcome === "approved" ? "done" : x.outcome === "rejected" ? (i < steps.length - 1 ? "done" : "rejected") : (i === 0 ? "done" : "skipped");
      return i + 1 < x.step ? "done" : i + 1 === x.step ? (x.status === "returned" ? "returned" : "current") : "todo";
    };
    const stepIcon = { done: "i-check", current: "i-clock", returned: "i-return", rejected: "i-x", todo: "i-user", skipped: "i-user" };
    const stepText = { done: "Approved", current: "Reviewing now", returned: "Sent it back to you", rejected: "Rejected", todo: "Next", skipped: "Not needed" };
    return `<div class="d-task__row">${reqIcon(x)}<span class="tag">${t.label}</span>${ibStatusPill(x)}</div>
        <h1 class="d-task__title m-detail__title" tabindex="-1">${esc(x.title)}</h1>
        <dl class="d-facts"><div><dt>${x.state === "history" ? "Closed" : x.state === "draft" ? "Last edited" : "Submitted"}</dt><dd>${x.state === "history" ? x.closed : ibAgo(x.ago)}</dd></div><div><dt>Reference</dt><dd>${x.ref}</dd></div></dl>
        ${x.details ? `<p class="d-note">${esc(x.details)}</p>` : ""}
        ${x.note ? `<p class="d-note m-note--warn">${esc(x.note)}</p>` : ""}
        ${steps.length ? `<h2 class="d-faq__label">Approval route</h2><ol class="d-steps">${steps.map((who, i) => { const s = stateOf(i); return `<li class="d-step d-step--${s}"><span class="d-step__dot">${icon(stepIcon[s])}</span><p><strong>${esc(who)}</strong><span>${stepText[s]}</span></p></li>`; }).join("")}</ol>` : `<p class="m-detail__hint">${icon("i-edit", "ico ico--sm")}Not sent yet. Edit it, then submit it for approval.</p>`}`;
  }
  function reqBarHTML(id) {
    const x = reqById(id);
    if (!x) return "";
    if (x.state === "draft") return `<button class="btn ib-act--delete m-actionbar__half" type="button" data-act="delete" data-v="${x.id}">${icon("i-trash", "ico ico--sm")}Delete</button><button class="btn btn--primary m-actionbar__main" type="button" data-act="edit" data-v="${x.id}">${icon("i-edit", "ico ico--sm")}Edit draft</button>`;
    if (x.state === "mine" && x.status === "returned") return `<button class="btn btn--primary m-actionbar__main" type="button" data-act="revise" data-v="${x.id}">${icon("i-edit", "ico ico--sm")}Revise and resubmit</button>`;
    if (x.state === "mine") return `<button class="btn btn--primary m-actionbar__main" type="button" data-act="remind" data-v="${x.id}"${x.reminded ? " disabled" : ""}>${icon(x.reminded ? "i-check" : "i-bellring", "ico ico--sm")}${x.reminded ? `Reminded ${esc(x.steps[x.step - 1])}` : `Remind ${esc(x.steps[x.step - 1])}`}</button>`;
    return `<p class="m-actionbar__note">${ibStatusPill(x)}<span>Closed ${x.closed}</span></p>`;
  }

  /* ---------------------------------------------------------------
     EXPLORE — the gateway to discovery
     --------------------------------------------------------------- */
  PAGES.explore = {
    root: true, title: () => "Explore",
    render() {
      const pols = policiesData();
      const groups = groupsData();
      const offers = offersData();
      const top = Math.max(...offers.map((o) => o.pct));
      const updated = pols.find((p) => p.updated);
      return `<header class="m-intro m-intro--explore">
          <div class="m-outline" aria-hidden="true"><p>${$$(".interlude__row")[1].textContent}</p></div>
          ${kicker($("#life-title").textContent)}
          <h1 class="m-intro__title" tabindex="-1">Explore</h1>
          <p class="m-intro__sub">Policies, ${esc($("#life .interlude__text").textContent.charAt(0).toLowerCase() + $("#life .interlude__text").textContent.slice(1))}</p>
        </header>
        <button class="m-searchbar" type="button" data-go="search">${icon("i-search", "ico ico--sm")}<span>Search policies, groups, perks…</span></button>
        <div class="m-bento">
          <button class="m-tile m-tile--photo" type="button" data-go="policies">
            <span class="m-tile__img m-media ${(updated || pols[0]).img}" aria-hidden="true"></span>
            <span class="m-tile__txt"><strong>Policies</strong><small>${pols.length} guides${updated ? ` · ${esc(updated.name)} updated` : ""}</small></span>${icon("i-arrow", "ico m-tile__go")}</button>
          <button class="m-tile m-tile--photo" type="button" data-go="communities">
            <span class="m-tile__img m-media ${groups[groups.length - 1].img}" aria-hidden="true"></span>
            <span class="m-tile__txt"><strong>Communities</strong><small>${groups.length} groups · ${groups.reduce((s, g) => s + g.members, 0)} members</small></span>${icon("i-arrow", "ico m-tile__go")}</button>
          <button class="m-tile m-tile--offers" type="button" data-go="discounts">
            <span class="m-tile__logos" aria-hidden="true">${offers.slice(0, 4).map((o) => `<span class="m-tile__logo"><span class="partner__logo ${o.logo}"></span></span>`).join("")}</span>
            <span class="m-tile__txt"><strong>Discounts</strong><small>${offers.length} partners · up to ${top}% off</small></span>${icon("i-arrow", "ico m-tile__go")}</button>
          <button class="m-tile m-tile--photo" type="button" data-go="perks">
            <span class="m-tile__img m-media ${perks[1].img}" aria-hidden="true"></span>
            <span class="m-tile__txt"><strong>Perks</strong><small>${perks.length} perks · ${esc(perks[0].title)} ${perks[0].tag ? perks[0].tag[1].toLowerCase() : ""}</small></span>${icon("i-arrow", "ico m-tile__go")}</button>
        </div>`;
    }
  };

  /* PEOPLE ---------------------------------------------------------- */
  PAGES.people = {
    title: () => "People",
    render() {
      const c = copyOf("#people");
      return `<div class="m-marquee" aria-hidden="true"><span>${$(".people__marquee span").innerHTML}</span></div>
        ${intro({ kick: c.kicker, title: c.title, sub: c.sub })}
        <section class="m-sec" aria-label="New joiners">${secHead("New joiners", { count: people.length })}<div data-live="facesBig">${railHTML(people.map((p, i) => faceHTML(p, i, true)), "m-face-rail m-face-rail--big", "New joiners")}</div></section>
        <section class="m-sec" aria-label="Celebrating today">${secHead("Celebrating today")}<ul class="m-list" data-live="celebrations">${celebrationsHTML()}</ul></section>
        <section class="m-sec" aria-label="Colleagues">${secHead("Colleagues")}${searchField("pp", "Search by name, role or team", A.pp.q)}
          <div class="chips m-chips" role="group" aria-label="Show" data-live="ppChips">${ppChipsHTML()}</div>
          <div data-live="ppList">${ppListHTML()}</div></section>`;
    },
    live: { celebrations: () => celebrationsHTML(), ppChips: () => ppChipsHTML(), ppList: () => ppListHTML(), facesBig: () => railHTML(people.map((p, i) => faceHTML(p, i, true)), "m-face-rail m-face-rail--big", "New joiners") }
  };
  function celebrationsHTML() {
    return peopleData().filter((p) => p.wishKey).map((p) => {
      const sent = wished.has(p.wishKey);
      return `<li class="m-cele"><button class="m-cele__hit" type="button" data-go="person/${p.key}" aria-label="${esc(p.name)}, ${esc(personNote(p))}"></button>${avatarHTML(p)}<span class="m-row__txt"><strong>${esc(p.name)}</strong><small>${esc(personNote(p))} · ${esc(p.role)}</small></span>
        <button class="btn btn--sm ${sent ? "btn--quiet" : "btn--primary"} m-cele__btn" type="button" data-act="wish" data-v="${p.wishKey}"${sent ? ' aria-disabled="true"' : ""}>${icon(sent ? "i-check" : p.kind === "anniv" ? "i-sparkle" : "i-gift", "ico ico--sm")}${sent ? WISH[p.wishKey[0]].sent : p.kind === "anniv" ? "Congratulate" : "Wish"}</button></li>`;
    }).join("");
  }
  const PP_KINDS = [["all", "All"], ["joiner", "New joiners"], ["birthday", "Birthdays"], ["anniv", "Anniversaries"]];
  function ppChipsHTML() {
    const all = peopleData();
    return PP_KINDS.map(([k, l]) => chipHTML({ label: l, on: A.pp.kind === k, act: "pp-kind", v: k, count: k === "all" ? all.length : all.filter((p) => p.kind === k).length })).join("");
  }
  function ppListHTML() {
    const q = A.pp.q.trim().toLowerCase();
    const list = peopleData().filter((p) => (A.pp.kind === "all" || p.kind === A.pp.kind) && (!q || `${p.name} ${p.role} ${p.team || ""}`.toLowerCase().includes(q)));
    if (!list.length) return emptyHTML({ ic: "i-users", title: "No one matches", text: q ? `No colleague matches “${esc(A.pp.q.trim())}”.` : "Try another filter.", action: `<button class="btn btn--quiet btn--sm" type="button" data-act="ask" data-v="Find a colleague">Ask Bloom GPT</button>` });
    return `<ul class="m-list">${list.map((p) => rowHTML({ lead: avatarHTML(p), title: esc(p.name), sub: `${esc(p.role)}${p.team ? ` · ${esc(p.team)}` : ""} · ${esc(personNote(p))}`, go: `person/${p.key}` })).join("")}</ul>`;
  }

  /* Person detail */
  PAGES.person = {
    over: true,
    title: (key) => personBy(key)?.name || "Person",
    render(key) {
      const p = personBy(key);
      if (!p) return emptyHTML({ ic: "i-user", title: "We couldn’t find this person" });
      const joiner = p.kind === "joiner";
      let n = 0;
      const name = p.name.split(" ").map((w) => `<span class="w"><span style="--i:${n++}">${esc(w)}</span></span>`).join(" ");
      const facts = joiner
        ? [["Reporting manager", p.manager], ["Date of joining", p.doj], ["Team", p.team]]
        : p.kind === "birthday" ? [["Role", p.role], ["Today", "Birthday"]] : [["Role", p.role], ["With Bloom since", p.since], ["Years", String(p.years)]];
      const quote = joiner ? p.quote : p.kind === "birthday" ? "Let’s make the day memorable with your warm wishes." : "A decade of keeping our sites running smoothly. Say thank you.";
      return `<figure class="people__portrait m-portrait" data-swipe="${joiner ? "joiner" : ""}">
          <div class="people__img ${p.img}"></div><span class="people__wipe" aria-hidden="true"></span>
          <figcaption class="people__badge">${icon("i-sparkle", "ico ico--xs")}<span>${esc(personNote(p))}</span></figcaption>
          ${joiner ? `<span class="people__index" aria-hidden="true">${pad(p.i + 1)} / ${pad(people.length)}</span>` : ""}
        </figure>
        <div class="m-person">
          <p class="people__meet">Meet</p>
          <h1 class="people__name m-person__name" tabindex="-1" aria-label="${esc(p.name)}">${name}</h1>
          <p class="people__role">${esc(p.role)}</p>
          <blockquote class="people__quote m-person__quote">${esc(quote)}</blockquote>
          <dl class="people__facts m-person__facts">${facts.map(([t, d]) => `<div><dt>${t}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>
        </div>
        ${joiner ? `<section class="m-sec" aria-label="More new joiners">${secHead("More new joiners")}${railHTML(people.map((q, i) => (i === p.i ? "" : faceHTML(q, i))).filter(Boolean), "m-face-rail")}</section>` : ""}
        <div class="m-actionbar" data-live="personBar">${personBarHTML(key)}</div>`;
    },
    live: { personBar: (key) => personBarHTML(key) },
    mount(el) { bindPortraitSwipe(el); }
  };
  function personBarHTML(key) {
    const p = personBy(key);
    if (!p) return "";
    if (p.kind === "joiner") {
      const sent = greeted.has(p.i);
      return `<div class="carousel-ctrl"><button class="icon-btn icon-btn--bordered" type="button" data-act="person-step" data-v="-1" aria-label="Previous new joiner">${icon("i-chevron-left")}</button><button class="icon-btn icon-btn--bordered" type="button" data-act="person-step" data-v="1" aria-label="Next new joiner">${icon("i-chevron-right")}</button></div>
        <button class="btn m-actionbar__main ${sent ? "btn--quiet is-sent" : "btn--primary"}" type="button" data-act="hello" data-v="${p.i}"${sent ? ' aria-disabled="true"' : ""}>${icon(sent ? "i-check" : "i-wave", "ico ico--sm btn__wave")}<span>${sent ? "Hello sent" : `Say hello to ${esc(p.name.split(" ")[0])}`}</span></button>`;
    }
    const sent = wished.has(p.wishKey);
    const w = WISH[p.wishKey[0]];
    return `<button class="btn m-actionbar__main ${sent ? "btn--quiet is-sent" : "btn--primary"}" type="button" data-act="wish" data-v="${p.wishKey}"${sent ? ' aria-disabled="true"' : ""}>${icon(sent ? "i-check" : p.kind === "anniv" ? "i-sparkle" : "i-gift", "ico ico--sm")}<span>${sent ? w.sent : p.kind === "anniv" ? "Say congratulations" : "Send birthday wish"}</span></button>`;
  }
  // Next and previous joiner: the page's colour wipe covers the portrait,
  // the person changes underneath, then it lifts away
  function stepJoiner(d) {
    const pg = topPage();
    if (pg?._page.name !== "person") return;
    const p = personBy(pg._page.ctx);
    if (p?.kind !== "joiner") return;
    const key = `joiner:${(p.i + d + people.length) % people.length}`;
    const wipeEl = $(".people__wipe", pg);
    if (reduceMotion || !wipeEl?.animate) { repaint(pg, key); return; }
    wipeEl.style.transformOrigin = "50% 100%";
    wipeEl.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 380, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" }).onfinish = () => {
      repaint(pg, key);
      const w2 = $(".people__wipe", pg);
      w2.style.transformOrigin = "50% 0%";
      w2.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 640, easing: EXPO, fill: "forwards" });
    };
  }
  function bindPortraitSwipe(el) {
    const fig = $('[data-swipe="joiner"]', el);
    if (!fig) return;
    let s = null;
    const from = (x, y) => { s = [x, y]; };
    const to = (x, y) => {
      if (!s) return;
      const dx = x - s[0];
      const dy = y - s[1];
      s = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) stepJoiner(dx < 0 ? 1 : -1);
    };
    fig.addEventListener("touchstart", (e) => from(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    fig.addEventListener("touchend", (e) => to(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
    // a mouse swipes too (the app in the iPhone mockup)
    fig.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") from(e.clientX, e.clientY); });
    fig.addEventListener("pointerup", (e) => { if (e.pointerType === "mouse") to(e.clientX, e.clientY); });
  }

  /* POLICIES -------------------------------------------------------- */
  PAGES.policies = {
    title: () => "Policies",
    render() {
      const c = copyOf("#policies");
      const all = $("#policies .soft-link");
      return `${intro({ kick: c.kicker, title: "Policies", sub: c.sub })}
        ${searchField("pol", "Search policies", A.pol.q)}
        <div class="chips m-chips" role="group" aria-label="Filter policies" data-live="polChips">${polChipsHTML()}</div>
        <div data-live="polList">${polListHTML()}</div>
        <button class="soft-link soft-link--sm m-sec__more" type="button" data-toast="Opening the policy library…">${esc(all.textContent.trim())}${icon("i-arrow", "ico ico--sm")}</button>
        <section class="m-sec" aria-label="Questions about policies">${secHead("Questions about policies")}${faqListHTML("policies")}</section>`;
    },
    live: { polChips: () => polChipsHTML(), polList: () => polListHTML() }
  };
  function polChipsHTML() {
    const all = policiesData();
    return POLICY_CATS().map((c) => chipHTML({ label: c.label, num: c.num, on: A.pol.cat === c.key, act: "pol-cat", v: c.key, count: c.key === "all" ? all.length : all.filter((p) => p.key === c.key).length })).join("");
  }
  function polRowHTML(p) {
    return `<li><button class="m-card m-pol" type="button" data-go="policy/${esc(p.name)}"><span class="m-pol__img m-media ${p.img}" aria-hidden="true"></span>
      <span class="m-pol__txt">${p.tag}<strong>${esc(p.name)}</strong><small>${esc(p.desc)}</small>${p.updated ? `<span class="m-pol__meta">${icon("i-clock", "ico ico--xs")}${esc(p.updated)}</span>` : ""}</span></button></li>`;
  }
  function polListHTML() {
    const q = A.pol.q.trim().toLowerCase();
    const list = policiesData().filter((p) => (A.pol.cat === "all" || p.key === A.pol.cat) && (!q || `${p.name} ${p.cat} ${p.desc}`.toLowerCase().includes(q)));
    if (!list.length) return emptyHTML({ ic: "i-book", title: `No policies match${q ? ` “${esc(A.pol.q.trim())}”` : ""}`, text: "Try another word or category, or ask Bloom GPT.", action: `<button class="btn btn--quiet btn--sm" type="button" data-act="ask" data-v="${esc(A.pol.q.trim() ? `Find a policy about ${A.pol.q.trim()}` : "Find a policy")}">Ask Bloom GPT</button>` });
    const feature = !q && A.pol.cat === "all" ? list.find((p) => p.updated) : null;
    return `${feature ? `<p class="m-label">Recently updated</p>${policyFeatureHTML(feature)}<p class="m-label">All policies</p>` : ""}<ul class="m-cards">${list.filter((p) => p !== feature).map(polRowHTML).join("")}</ul>`;
  }
  // FAQ accordions, from the page's FAQ chapter
  function faqListHTML(cat) {
    return `<div class="m-faqs">${$$(`#faq-panel-${cat} .faqs__item`).map((d) => `<details class="faqs__item m-faq"><summary class="faqs__q"><span>${$(".faqs__q span", d).innerHTML}</span>${icon("i-plus", "ico ico--sm faqs__chev")}</summary><div class="faqs__a"><p>${faqAnswer(d).innerHTML}</p></div></details>`).join("")}</div>`;
  }

  PAGES.policy = {
    over: true,
    title: (name) => name,
    acts: () => `<button class="pg-bar__btn" type="button" data-go="search" aria-label="Search">${icon("i-search")}</button>`,
    render(name) {
      const p = policyBy(name);
      if (!p) return emptyHTML({ ic: "i-book", title: "We couldn’t find this policy" });
      const related = policiesData().filter((x) => x.name !== p.name).sort((a, b) => (b.key === p.key) - (a.key === p.key));
      const card = policies.find((c) => c.dataset.name === name);
      const toastText = $(".policy__go", card).dataset.toast;
      return `<div class="m-hero m-media ${p.img}" aria-hidden="true"></div>
        <div class="m-detail m-detail--over">
          <div class="m-detail__tags">${p.tag}${p.updated ? `<span class="m-pol__meta">${icon("i-clock", "ico ico--xs")}${esc(p.updated)}</span>` : ""}</div>
          <h1 class="m-detail__title m-detail__title--xl" tabindex="-1">${esc(p.name)}</h1>
          <p class="m-detail__lede">${esc(p.desc)}</p>
          <dl class="d-facts"><div><dt>Category</dt><dd>${esc(p.cat)}</dd></div><div><dt>Last updated</dt><dd>${esc(p.updated.replace(/^updated\s*/i, "") || "Kept current by its owner")}</dd></div><div><dt>Download</dt><dd>PDF copy</dd></div><div><dt>Library</dt><dd>${policiesData().length} of 24 policies</dd></div></dl>
          <ul class="m-list">${rowHTML({ lead: `<span class="orb orb--sm"></span>`, title: `Ask Bloom GPT about ${esc(p.name)}`, sub: "A quick summary, and what changed", act: "ask", v: p.name === "Data Security" ? "What changed in Data Security?" : `Tell me about ${p.name}` })}</ul>
        </div>
        <section class="m-sec" aria-label="Related policies">${secHead("Related policies")}${railHTML(related.map((r) => `<button class="m-card m-mini" type="button" data-go="policy/${esc(r.name)}"><span class="m-mini__img m-media ${r.img}" aria-hidden="true"></span><span class="m-mini__txt">${r.tag}<strong>${esc(r.name)}</strong></span></button>`), "m-mini-rail")}</section>
        <section class="m-sec" aria-label="Questions about policies">${secHead("Questions about policies")}${faqListHTML("policies")}</section>
        <div class="m-actionbar"><button class="btn btn--ghost m-actionbar__half" type="button" data-toast="Downloading ${esc(p.name)} as a PDF…">${icon("i-download", "ico ico--sm")}Download</button><button class="btn btn--primary m-actionbar__main" type="button" data-toast="${esc(toastText)}">Read policy${icon("i-arrow", "ico ico--sm btn__arrow")}</button></div>`;
    }
  };

  /* COMMUNITIES ----------------------------------------------------- */
  PAGES.communities = {
    title: () => "Communities",
    render() {
      const c = copyOf("#sports");
      return `${intro({ kick: c.kicker, title: c.title, sub: c.sub })}
        <div data-live="grpRail">${railHTML(groupsData().map(groupCardHTML), "m-sport-rail", "Communities")}</div>
        <section class="m-sec" aria-label="Your groups">${secHead("Your groups")}<div data-live="grpMine">${myGroupsHTML()}</div></section>
        <button class="soft-link soft-link--sm m-sec__more" type="button" data-toast="Opening all communities…">${esc($(".sports__outro-text").textContent)}${icon("i-arrow", "ico ico--sm")}</button>`;
    },
    live: { grpRail: () => railHTML(groupsData().map(groupCardHTML), "m-sport-rail", "Communities"), grpMine: () => myGroupsHTML() }
  };
  const joinBtnHTML = (g, cls = "") => `<button class="btn btn--join ${cls}" type="button" aria-pressed="${g.joined}" data-act="join" data-v="${esc(g.name)}" style="--tint:${g.tint}">${g.joined ? "Joined" : "Join group"}</button>`;
  const facesHTML = (g) => `<span class="stack" aria-hidden="true">${g.faces.map((f) => `<i class="${f}"></i>`).join("")}</span>`;
  function groupCardHTML(g) {
    return `<article class="m-sport" style="--tint:${g.tint}">
      <button class="m-task__hit" type="button" data-go="community/${esc(g.name)}" aria-label="${esc(g.name)}, ${g.members} members"></button>
      <span class="m-sport__media ${g.img}" aria-hidden="true"></span>
      <span class="sport__num" aria-hidden="true">${pad(g.i + 1)}</span>
      <div class="m-sport__info"><p class="m-sport__name">${esc(g.name)}</p>
        <div class="sport__foot">${facesHTML(g)}<span>${g.members} members</span>${joinBtnHTML(g)}</div></div></article>`;
  }
  function myGroupsHTML() {
    const mine = groupsData().filter((g) => g.joined);
    if (!mine.length) return emptyHTML({ ic: "i-ball", title: "You haven’t joined a group yet", text: "Join one above and the schedule lands in your inbox." });
    return `<ul class="m-list">${mine.map((g) => rowHTML({ lead: `<span class="m-row__photo ${g.img}"></span>`, title: esc(g.name), sub: `${g.members} members · meets every week`, go: `community/${g.name}` })).join("")}</ul>`;
  }
  PAGES.community = {
    over: true,
    title: (name) => name,
    render(name) {
      const g = groupBy(name);
      if (!g) return emptyHTML({ ic: "i-ball", title: "We couldn’t find this group" });
      const others = groupsData().filter((x) => x.name !== name);
      return `<div class="m-hero m-hero--sport ${g.img}" style="--tint:${g.tint}" aria-hidden="true"></div>
        <div class="m-detail m-detail--over">
          <p class="m-detail__num">${pad(g.i + 1)} / ${pad(groupsData().length)}</p>
          <h1 class="m-detail__title m-detail__title--xl" tabindex="-1">${esc(g.name)}</h1>
          <p class="m-detail__lede">${esc(copyOf("#sports").sub)}</p>
          <div class="m-members">${facesHTML(g)}<span><strong>${g.members} members</strong> · meets every week</span></div>
          <dl class="d-facts"><div><dt>Members</dt><dd>${g.members}</dd></div><div><dt>Meets</dt><dd>Every week</dd></div><div><dt>Schedule</dt><dd>Sent when you join</dd></div><div><dt>Status</dt><dd data-live="grpStatus">${g.joined ? "You’re a member" : "Not joined"}</dd></div></dl>
        </div>
        <section class="m-sec" aria-label="Other communities">${secHead("Other communities")}${railHTML(others.map((o) => `<button class="m-card m-mini" type="button" data-go="community/${esc(o.name)}"><span class="m-mini__img ${o.img}" aria-hidden="true"></span><span class="m-mini__txt"><strong>${esc(o.name)}</strong><small>${o.members} members</small></span></button>`), "m-mini-rail")}</section>
        <div class="m-actionbar" data-live="grpBar">${joinBtnHTML(g, "m-actionbar__main")}</div>`;
    },
    live: { grpBar: (name) => (groupBy(name) ? joinBtnHTML(groupBy(name), "m-actionbar__main") : ""), grpStatus: (name) => (groupBy(name)?.joined ? "You’re a member" : "Not joined") }
  };

  /* DISCOUNTS ------------------------------------------------------- */
  PAGES.discounts = {
    title: () => "Discounts",
    render() {
      const c = copyOf("#discounts");
      return `${intro({ kick: c.kicker, title: c.title, sub: c.sub })}
        <div class="chips m-chips" role="group" aria-label="Categories" data-live="offChips">${offChipsHTML()}</div>
        <div data-live="offList">${offListHTML()}</div>
        <button class="soft-link soft-link--sm m-sec__more" type="button" data-toast="Opening all partner offers…">${esc($("#discounts .soft-link").textContent.trim())}${icon("i-arrow", "ico ico--sm")}</button>`;
    },
    live: { offChips: () => offChipsHTML(), offList: () => offListHTML() }
  };
  function offChipsHTML() {
    const all = offersData();
    return [["all", "All"], ...Object.entries(OFFER_GROUPS)].map(([k, l]) => chipHTML({ label: l, on: A.off.group === k, act: "off-group", v: k, count: k === "all" ? all.length : all.filter((o) => o.group === k).length })).join("");
  }
  function offListHTML() {
    const list = offersData().filter((o) => A.off.group === "all" || o.group === A.off.group);
    const best = list.slice().sort((a, b) => b.pct - a.pct)[0];
    const featured = best ? `<article class="m-card m-deal">
        <button class="m-task__hit" type="button" data-go="discount/${esc(best.code)}" aria-label="${esc(best.name)}, ${esc(best.off)} off"></button>
        <span class="m-deal__plate" aria-hidden="true"><span class="partner__logo ${best.logo}"></span></span>
        <div class="m-deal__txt"><p class="m-label">Top offer</p><p class="partner__cat">${esc(best.cat)}</p><strong class="m-deal__name">${esc(best.name)}</strong><span class="offer"><strong>${esc(best.off)}</strong> off</span></div>
        <button class="partner__code m-deal__code${best.revealed ? " is-revealed" : ""}" type="button" data-act="code" data-v="${esc(best.code)}">${best.revealed ? `${esc(best.code)} ${icon("i-copy", "ico ico--xs")}` : "Get code"}</button></article>` : "";
    return `${featured}<ul class="m-offer-grid">${list.filter((o) => o !== best).map(offerTileHTML).join("")}</ul>`;
  }
  PAGES.discount = {
    title: (code) => offerBy(code)?.name || "Offer",
    render(code) {
      const o = offerBy(code);
      if (!o) return emptyHTML({ ic: "i-tag", title: "This offer has ended" });
      const others = offersData().filter((x) => x.code !== code).sort((a, b) => (b.group === o.group) - (a.group === o.group));
      const how = copyOf("#discounts").sub.replace(/\.$/, "").split(/,\s*or\s*/i);
      return `<div class="m-detail">
          <div class="m-plate" aria-hidden="true"><span class="partner__logo ${o.logo}"></span></div>
          <p class="partner__cat">${esc(o.cat)} · ${OFFER_GROUPS[o.group]}</p>
          <h1 class="m-detail__title" tabindex="-1">${esc(o.name)}</h1>
          <p class="offer m-offer__big"><strong>${esc(o.off)}</strong> off for Bloom employees</p>
          <h2 class="d-faq__label">How to use it</h2>
          <ol class="m-how">${how.map((s, i) => `<li><span class="m-how__num">${pad(i + 1)}</span><p><strong>${i ? "Online" : "In store"}</strong><span>${esc(s.charAt(0).toUpperCase() + s.slice(1))}.</span></p></li>`).join("")}</ol>
          <div class="m-code" data-live="codeBox">${codeBoxHTML(code)}</div>
        </div>
        <section class="m-sec" aria-label="More offers">${secHead("More offers")}${railHTML(others.map((x) => `<button class="m-card m-mini m-mini--offer" type="button" data-go="discount/${esc(x.code)}"><span class="m-mini__plate" aria-hidden="true"><span class="partner__logo ${x.logo}"></span></span><span class="m-mini__txt"><strong>${esc(x.name)}</strong><small>${esc(x.off)} off · ${esc(x.cat)}</small></span></button>`), "m-mini-rail")}</section>
        <div class="m-actionbar" data-live="codeBar">${codeBarHTML(code)}</div>`;
    },
    live: { codeBox: (code) => codeBoxHTML(code), codeBar: (code) => codeBarHTML(code) }
  };
  const codeBoxHTML = (code) => (isRevealed(code)
    ? `<p class="m-code__label">Your code</p><button class="partner__code is-revealed m-code__btn" type="button" data-act="code" data-v="${esc(code)}" aria-label="Copy code ${esc(code)}">${esc(code)} ${icon("i-copy", "ico ico--xs")}</button><p class="m-code__hint">Tap to copy. Show your Bloom ID in store.</p>`
    : `<p class="m-code__label">Your code</p><button class="partner__code m-code__btn" type="button" data-act="code" data-v="${esc(code)}">Tap to reveal your code</button><p class="m-code__hint">One code per employee. It works online and in store.</p>`);
  const codeBarHTML = (code) => `<button class="btn btn--primary m-actionbar__main" type="button" data-act="code" data-v="${esc(code)}">${icon(isRevealed(code) ? "i-copy" : "i-tag", "ico ico--sm")}${isRevealed(code) ? "Copy code" : "Get code"}</button>`;

  /* PERKS ----------------------------------------------------------- */
  PAGES.perks = {
    title: () => "Perks",
    render() {
      const c = copyOf("#perks");
      return `${intro({ kick: c.kicker, title: c.title, sub: c.sub })}
        <div class="chips m-chips" role="group" aria-label="Filter perks" data-live="pkChips">${pkChipsHTML()}</div>
        <div data-live="pkRail">${pkRailHTML()}</div>
        <section class="m-sec" aria-label="All perks">${secHead("All perks")}<div class="perks__index m-perk-index" data-live="pkList">${pkListHTML()}</div></section>`;
    },
    live: { pkChips: () => pkChipsHTML(), pkRail: () => pkRailHTML(), pkList: () => pkListHTML() }
  };
  const pkPool = () => (A.pk.cat === "all" ? perks : perks.filter((x) => x.cat === A.pk.cat));
  function pkChipsHTML() {
    const n = (c) => perks.filter((x) => x.cat === c).length;
    return [["all", "All", perks.length], ...Object.keys(PERK_CATS).filter(n).map((c) => [c, PERK_CATS[c], n(c)])]
      .map(([c, label, count]) => chipHTML({ label, on: A.pk.cat === c, act: "pk-cat", v: c, count, dot: c !== "all", pc: c === "all" ? "" : c })).join("");
  }
  const pkRailHTML = () => railHTML(pkPool().map((x) => spotCardHTML(x, { rail: true })), "m-spot-rail", "Perk spotlight");
  function pkListHTML() {
    const pool = pkPool();
    const shown = A.pk.open ? pool : pool.slice(0, PERK_LIMIT);
    return `<ol class="perk-list">${shown.map((x, i) => `<li><button class="perk-row" type="button" data-go="perk/${x.id}" data-pc="${x.cat}"><span class="perk-row__num">${pad(i + 1)}</span><span class="perk-row__tile">${icon(x.icon)}</span><span class="perk-row__text"><span class="perk-row__title">${esc(x.title)}</span><span class="perk-row__meta">${PERK_CATS[x.cat]}${x.tag ? ` · ${x.tag[1]}` : ""}</span></span>${icon("i-chevron-right", "ico ico--sm m-row__chev")}</button></li>`).join("")}</ol>
      ${pool.length > PERK_LIMIT ? `<button class="btn btn--quiet perks__more" type="button" data-act="pk-more" aria-expanded="${A.pk.open}"><span>${A.pk.open ? "Show fewer" : `Show all ${pool.length} perks`}</span>${icon("i-chevron-down", "ico ico--sm")}</button>` : ""}`;
  }
  PAGES.perk = {
    over: true,
    title: (id) => perkById2(id)?.title || "Perk",
    render(id) {
      const x = perkById2(id);
      if (!x) return emptyHTML({ ic: "i-gift", title: "We couldn’t find this perk" });
      const more = perks.filter((p) => p.cat === x.cat && p.id !== x.id);
      const others = more.length ? more : perks.filter((p) => p.id !== x.id).slice(0, 4);
      return `<div class="m-hero m-hero--perk perk-spot" data-pc="${x.cat}">
          <span class="perk-shot is-active ${x.img || "perk-shot--art"}" data-pc="${x.cat}" aria-hidden="true">${x.img ? "" : `${icon(x.icon, "ico perk-shot__icon")}${icon("i-sparkle", "ico perk-shot__spark")}`}</span>
          <div class="perk-spot__body"><p class="perk-spot__top"><span class="perk-spot__cat" data-pc="${x.cat}"><span class="chip__dot" aria-hidden="true"></span>${PERK_CATS[x.cat]}</span>${x.tag ? `<span class="tag perk-spot__tag">${icon(PERK_TAGS[x.tag[0]], "ico ico--xs")}${x.tag[1]}</span>` : ""}</p>
            <h1 class="perk-spot__title" tabindex="-1">${esc(x.title)}</h1></div>
        </div>
        <div class="m-detail">
          <p class="m-detail__lede">${esc(x.text)}</p>
          <ul class="m-list">${rowHTML({ lead: `<span class="orb orb--sm"></span>`, title: "Ask Bloom GPT about your benefits", sub: "Everything included with your role", act: "ask", v: "Show my benefits" })}</ul>
        </div>
        <section class="m-sec" aria-label="${more.length ? `More in ${PERK_CATS[x.cat]}` : "More perks"}">${secHead(more.length ? `More in ${PERK_CATS[x.cat]}` : "More perks")}<ul class="m-list">${others.map((p) => rowHTML({ lead: `<span class="perk-row__tile" data-pc="${p.cat}">${icon(p.icon)}</span>`, title: esc(p.title), sub: `${PERK_CATS[p.cat]}${p.tag ? ` · ${p.tag[1]}` : ""}`, go: `perk/${p.id}` })).join("")}</ul></section>
        <div class="m-actionbar"><button class="btn btn--primary m-actionbar__main" type="button" data-toast="${esc(x.toast)}">${esc(x.cta)}${icon("i-arrow", "ico ico--sm btn__arrow")}</button></div>`;
    }
  };

  /* ---------------------------------------------------------------
     HELP — FAQ, support and Bloom GPT
     --------------------------------------------------------------- */
  const HELP_ASKS = ["What needs my attention?", "Show my tasks", "Find a policy", "What’s new?", "Find a colleague", "Show my benefits"];
  PAGES.help = {
    root: true, title: () => "Bloom GPT",
    render() {
      const c = copyOf("#faq");
      const help = $(".faq__help p");
      return `${intro({ kick: c.kicker, title: "Bloom GPT", sub: c.sub })}
        <section class="m-gpt-card" aria-labelledby="m-gpt-title">
          <p class="gpt__kicker">${icon("i-sparkle", "ico ico--sm")}Bloom GPT</p>
          <h2 class="m-gpt-card__title" id="m-gpt-title">${$("#gpt-title").innerHTML.replace(/<i class="gpt__caret"[^>]*><\/i>/, "")}</h2>
          <p class="m-gpt-card__sub">${esc($(".gpt__sub").textContent)}</p>
          <button class="gpt__composer m-gpt-card__composer" type="button" data-go="gpt"><span class="orb" aria-hidden="true"></span><span class="m-gpt-card__ph">${esc($("#gpt-input").getAttribute("placeholder"))}</span><span class="gpt__send" aria-hidden="true">${icon("i-arrow-up")}</span></button>
          <p class="gpt__label">Try asking</p>
          <div class="m-gpt-card__chips">${HELP_ASKS.map((q) => `<button class="chip gpt-chip" type="button" data-act="ask" data-v="${esc(q)}">${icon(GPT_ICON[q] || "i-sparkle", "ico ico--sm")}${esc(q)}</button>`).join("")}</div>
          <p class="gpt__noticed m-noticed" data-live="noticed">${gptNoticedHTML()}</p>
        </section>
        <section class="m-sec" id="m-faq" aria-labelledby="m-faq-title">${secHead(c.title).replace('class="m-sec__title"', 'class="m-sec__title" id="m-faq-title"')}
          <div class="chips m-chips m-chips--wrap" role="tablist" aria-label="Question categories" data-live="faqTabs">${faqTabsHTML()}</div>
          <div data-live="faqs">${faqListHTML(A.faq)}</div></section>
        <section class="faq__help m-help" aria-label="Help and support">
          <span class="faq__help-icon" aria-hidden="true">${icon("i-help")}</span>
          <p>${help.innerHTML}</p>
          <div class="m-help__acts"><button class="btn btn--primary btn--sm" type="button" data-toast="A support request has been started.">Contact support</button><button class="btn btn--quiet btn--sm" type="button" data-toast="Opening the help centre…">Visit help centre</button></div>
        </section>`;
    },
    live: { noticed: () => gptNoticedHTML(), faqTabs: () => faqTabsHTML(), faqs: () => faqListHTML(A.faq) }
  };
  function faqTabsHTML() {
    return $$("#faq-tabs .tab").map((t) => chipHTML({ label: t.firstChild.textContent.trim(), on: A.faq === t.dataset.tab, act: "faq-cat", v: t.dataset.tab, count: $(".tab__count", t).textContent, role: "tab" })).join("");
  }
  function showFaq(i) {
    const d = $$("#faq .faqs__item")[i];
    if (!d) return;
    A.faq = d.closest(".faqs__panel").id.replace("faq-panel-", "");
    closeModal(false);
    if (A.tab !== "help") setTab("help");
    popToRoot("help", false);
    const pg = A.stacks.help[0];
    refreshPage(pg);
    const idx = $$(".faqs__item", d.closest(".faqs__panel")).indexOf(d);
    const item = $$("#m-faq .m-faq", pg)[idx];
    if (!item) return;
    item.open = true;
    pg.scrollTo({ top: item.offsetTop - 80, behavior: smooth() });
    $("summary", item).focus({ preventScroll: true });
  }
  // FAQ accordions open and close with the page's motion
  appEl.addEventListener("click", (e) => {
    const s = e.target.closest(".m-faq > summary");
    if (!s || reduceMotion) return;
    const d = s.parentElement;
    const ans = $(".faqs__a", d);
    if (!ans?.animate) return;
    e.preventDefault();
    if (d._anim) d._anim.cancel();
    if (d.open) {
      d._anim = ans.animate([{ height: `${ans.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
      d._anim.onfinish = () => { d.open = false; d._anim = null; };
    } else {
      d.open = true;
      d._anim = ans.animate([{ height: "0px", opacity: 0 }, { height: `${ans.offsetHeight}px`, opacity: 1 }], { duration: 480, easing: EXPO });
      d._anim.onfinish = () => { d._anim = null; };
    }
  });

  /* Bloom GPT on phones: the page's own assistant, over the app. Its
     actions open app screens instead of scrolling the page. */
  const HASH_PAGE = { "#perks": "perks", "#discounts": "discounts", "#faq": "tab/help", "#policies": "policies", "#people": "people", "#sports": "communities", "#attention": "tab/tasks", "#announcements": "ann/0" };
  const APP_ACTS = {
    task: (v) => gptLeave(() => go(`task/${v}`)),
    filter: (v) => gptLeave(() => goTasks("approvals", { app: v })),
    inbox: (v) => gptLeave(() => goTasks({ inbox: "approvals", draft: "drafts", mine: "pending", history: "mine" }[v] || "all")),
    draft: (v) => gptLeave(() => { goTasks("drafts"); push("request", v); const x = reqById(v); if (x) setTimeout(() => openRequestForm(x, "edit"), reduceMotion ? 0 : 560); }),
    policy: (v) => gptLeave(() => go(`policy/${v}`)),
    person: (v) => gptLeave(() => go(`person/joiner:${v}`)),
    ann: (v) => gptLeave(() => showAnn(Number(v))),
    wish: (v) => gptLeave(() => openWish(`b${v}`)),
    congrats: () => gptLeave(() => openWish("a")),
    perk: (v) => gptLeave(() => go(`perk/${v}`)),
    sport: (v) => gptLeave(() => go(`community/${v}`)),
    drawer: (v) => gptLeave(() => (v === "profile" ? (setTab("profile"), push("myprofile")) : setTab("help"))),
    goto: (v) => gptLeave(() => go(HASH_PAGE[v] || "tab/home"))
  };
  Object.keys(APP_ACTS).forEach((k) => {
    const desk = GPT_ACTS[k];
    GPT_ACTS[k] = (...args) => (isApp() ? APP_ACTS[k] : desk)(...args);
  });

  /* ---------------------------------------------------------------
     PROFILE — you, your preferences, support and account
     --------------------------------------------------------------- */
  const NOTIFY_KEY = "bloo-x-notify";
  const pushOn = () => { try { return JSON.parse(store.get(NOTIFY_KEY) || "{}").push !== false; } catch { return true; } };
  const reports = () => people.filter((p) => p.manager === me.name);
  PAGES.profile = {
    root: true, title: () => "Profile",
    render() {
      const isDark = root.getAttribute("data-theme") === "dark";
      const crimson = root.getAttribute("data-palette") === "crimson";
      // the page's own switch graphics (sun and moon, blue and red), in rows like Language's
      const sw = (sel) => $(`.mo__prefs ${sel} .switch`).outerHTML;
      return `<header class="m-me">
          <span class="avatar m-me__avatar ${me.img}">${me.initials}</span>
          <h1 class="m-me__name" tabindex="-1">${esc(me.name)}</h1>
          <p class="m-me__role">${esc(me.role)} · ${esc(me.team)}</p>
          <p class="m-me__tags"><span class="tag">${icon("i-pin", "ico ico--xs")}${esc(me.location)}</span><span class="tag">${icon("i-calendar", "ico ico--xs")}Since ${esc(me.doj.split(" ").slice(1).join(" "))}</span></p>
        </header>
        ${groupBlock("Personal", [
          rowHTML({ lead: tile("i-user"), title: "My profile", sub: "Details, contact and your team", go: "myprofile" })
        ])}
        ${groupBlock("Preferences", [
          switchRowHTML({ cls: "pref--push", lead: tile("i-bell"), title: "Push notifications", off: "Off", on: "On", checked: pushOn(), label: "Push notifications", attrs: ' data-act="push-notify"', sw: `<span class="switch switch--push" aria-hidden="true"><span class="switch__thumb"></span></span>` }),
          switchRowHTML({ cls: "pref--theme", lead: `<span class="gpt-tile" aria-hidden="true">${icon("i-sun", "ico pref__sun")}${icon("i-moon", "ico pref__moon")}</span>`, title: "Theme", off: "Light", on: "Dark", checked: isDark, label: "Dark theme", attrs: " data-theme-switch", sw: sw(".pref--theme") }),
          switchRowHTML({ cls: "pref--accent", lead: `<span class="gpt-tile" aria-hidden="true"><span class="pref__swatches"><i class="sw sw--azure"></i><i class="sw sw--crimson"></i></span></span>`, title: "Accent", off: "Blue", on: "Red", checked: crimson, label: "Red accent", attrs: " data-palette-switch", sw: sw(".pref--accent") }),
          rowHTML({ lead: tile("i-globe"), title: "Language", sub: "English", act: "language" })
        ])}
        ${groupBlock("Support", [
          rowHTML({ lead: tile("i-help"), title: "Help & support", sub: "Bloom GPT and our support team", go: "tab/help" }),
          rowHTML({ lead: tile("i-book"), title: "FAQ", sub: "Quick answers", go: "faq/0" })
        ])}
        ${groupBlock("Account", [rowHTML({ lead: tile("i-logout", "var(--warm)"), title: "Sign out", end: "", act: "sign-out", cls: "m-row--danger" })])}`;
    }
  };
  const groupBlock = (label, rows) => `<section class="m-sec m-group-block" aria-label="${label}"><p class="m-label">${label}</p><ul class="m-list">${rows.join("")}</ul></section>`;
  // My profile: who you are, what Bloom has on record, and your team, on one page
  PAGES.myprofile = {
    title: () => "My profile",
    render() {
      const mine = reports();
      const db = quickLinks().find((x) => x.src === "darwinbox");
      const how = [...$$("#faq-panel-general .faqs__item")].find((d) => /personal information/i.test(d.textContent));
      return `<div class="m-detail">
        <div class="d-profile"><span class="avatar ${me.img}">${me.initials}</span><h1 class="m-detail__title" tabindex="-1">${esc(me.name)}</h1><p class="meta">${esc(me.role)}, ${esc(me.team)}</p></div>
        <section class="m-block" aria-label="My details"><p class="m-label">My details</p>
          <ul class="m-list">${[["i-mail", "Email", me.email], ["i-pin", "Location", me.location], ["i-calendar", "Date of joining", me.doj], ["i-briefcase", "Role", `${me.role}, ${me.team}`]]
            .map(([ic, t, v]) => infoRowHTML({ lead: tile(ic), title: esc(v), sub: t })).join("")}</ul>
          ${how ? `<p class="d-note">${faqAnswer(how).innerHTML}</p>` : ""}
          ${db ? `<a class="btn btn--ghost m-detail__cta" href="${esc(db.href)}" target="_blank" rel="noopener"><span class="app-mark app-mark--db" aria-hidden="true"></span>Open Darwinbox${icon("i-external", "ico ico--sm")}</a>` : ""}
        </section>
        <section class="m-block" aria-label="My team"><p class="m-label">My team · ${esc(me.team)}</p>
          <ul class="m-list">${infoRowHTML({ lead: `<span class="avatar">${initialsOf(me.manager)}</span>`, title: esc(me.manager), sub: "Your reporting manager" })}${mine.map((p) => rowHTML({ lead: avatarHTML({ ...p, initials: initialsOf(p.name) }), title: esc(p.name), sub: `${esc(p.role)} · reports to you`, go: `person/joiner:${people.indexOf(p)}` })).join("")}</ul>
        </section>
        <div class="d-actions"><button class="btn btn--primary" type="button" data-toast="Opening your full profile…">View full profile</button></div>
      </div>`;
    }
  };
  function languageHTML() {
    return `<ul class="m-list">${rowHTML({ lead: tile("i-globe"), title: "English", sub: "In use", end: icon("i-check", "ico ico--sm m-row__check"), cls: "m-sheet-first", attrs: ' aria-current="true"' })}${rowHTML({ lead: tile("i-globe"), title: "العربية", sub: "Arabic · designing soon", end: "", attrs: ' aria-disabled="true" lang="ar"' })}</ul>`;
  }

  /* ---------------------------------------------------------------
     NOTIFICATIONS — from the bell, over the app
     --------------------------------------------------------------- */
  const NOTIF_KINDS = [["all", "All"], ["tasks", "Tasks"], ["announcements", "Announcements"], ["people", "People"], ["policies", "Policies"]];
  function notifsData() {
    const list = $$("#notif-list .notif").map((li, i) => {
      const p = $("p", li).cloneNode(true);
      const time = $("time", p);
      time?.remove();
      return { id: `n${i}`, li, kind: li.dataset.kind, go: li.dataset.go, lead: li.firstElementChild.outerHTML, html: p.innerHTML, time: time?.textContent || "", unread: li.classList.contains("is-unread") };
    });
    // Earlier: what else changed, read from the page's own data
    const back = reqsIn("mine").find((x) => x.status === "returned");
    if (back) list.push({ id: "d-back", kind: "tasks", go: `request/${back.id}`, lead: reqIcon(back), html: `<strong>${esc(back.steps[back.step - 1])}</strong> sent back <strong>${esc(back.title)}</strong>. ${esc(back.note || "")}` });
    list.push({ id: "d-anniv", kind: "people", go: "person/anniv:0", lead: avatarHTML(anniversary, "avatar--sm"), html: `<strong>${esc(anniversary.name)}</strong> celebrates ${anniversary.years} years at Bloom today.` });
    list.push({ id: "d-join", kind: "people", go: "person/joiner:0", lead: avatarHTML({ ...people[0], initials: initialsOf(people[0].name) }, "avatar--sm"), html: `<strong>${esc(people[0].name)}</strong> joined ${esc(people[0].team)}. Say hello.` });
    list.push({ id: "d-drill", kind: "announcements", go: `ann/${groupStart("drill")}`, lead: `<span class="feed__icon feed__icon--drill">${icon("i-flame")}</span>`, html: `The <strong>fire safety drill</strong> is on 26 Sep, 10:30 – 11:00 AM, on all floors.` });
    list.push({ id: "d-eid", kind: "announcements", go: `ann/${groupStart("eid")}`, lead: `<span class="feed__icon feed__icon--eid">${icon("i-moon")}</span>`, html: `<strong>Eid Al Adha</strong> holidays run 25 – 29 May.` });
    return list;
  }
  PAGES.notifications = {
    modal: true,
    title: () => "Notifications",
    bar: () => `<header class="pg-bar pg-bar--modal"><button class="pg-bar__btn" type="button" data-modal-close aria-label="Close notifications">${icon("i-x")}</button><h1 class="pg-bar__title m-modal__title" tabindex="-1">Notifications</h1><div class="pg-bar__acts" data-live="notifAll">${notifAllHTML()}</div></header>`,
    render: () => `<div class="chips m-chips" role="group" aria-label="Show" data-live="notifChips">${notifChipsHTML()}</div><div data-live="notifList">${notifListHTML()}</div>`,
    live: { notifAll: () => notifAllHTML(), notifChips: () => notifChipsHTML(), notifList: () => notifListHTML() },
    opened(el) { setTimeout(() => $("h1", el)?.focus({ preventScroll: true }), 80); }
  };
  // On the smallest phones it's an icon, as wide as the close button, so the title stays centred
  const notifAllHTML = () => `<button class="link-btn m-link m-markall" type="button" data-act="notif-all"${$$("#notif-list .notif.is-unread").length ? "" : ' aria-disabled="true"'}>${icon("i-check-all", "ico m-markall__ic")}<span class="m-markall__txt">Mark all read</span></button>`;
  function notifChipsHTML() {
    const all = notifsData();
    return NOTIF_KINDS.map(([k, l]) => {
      const n = all.filter((x) => (k === "all" || x.kind === k) && x.unread).length;
      return chipHTML({ label: l, on: A.nf === k, act: "notif-kind", v: k, count: n || null });
    }).join("");
  }
  function notifListHTML() {
    const all = notifsData().filter((x) => A.nf === "all" || x.kind === A.nf);
    if (!all.length) return emptyHTML({ ic: "i-bell", title: "Nothing here yet", text: "When something needs you, it shows up here." });
    const item = (x) => `<li><button class="m-notif${x.unread ? " is-unread" : ""}" type="button" data-act="notif-open" data-v="${x.id}"><span class="m-notif__lead">${x.lead}</span><span class="m-notif__txt"><span>${x.html}</span>${x.time ? `<time>${esc(x.time)}</time>` : ""}</span>${x.unread ? '<span class="m-notif__dot" aria-label="Unread"></span>' : ""}</button></li>`;
    const fresh = all.filter((x) => x.time);
    const earlier = all.filter((x) => !x.time);
    const unread = all.filter((x) => x.unread).length;
    return `${!unread && A.nf === "all" ? `<p class="m-caught">${icon("i-check", "ico ico--sm")}You’re all caught up</p>` : ""}
      ${fresh.length ? `<p class="m-label">Recent</p><ul class="m-list m-notifs">${fresh.map(item).join("")}</ul>` : ""}
      ${earlier.length ? `<p class="m-label">Earlier</p><ul class="m-list m-notifs">${earlier.map(item).join("")}</ul>` : ""}`;
  }
  function openNotif(id) {
    const x = notifsData().find((n) => n.id === id);
    if (!x) return;
    if (x.li && x.li.classList.contains("is-unread")) { x.li.classList.remove("is-unread"); syncBell(); }
    closeModal(false);
    setTimeout(() => go(x.go), reduceMotion ? 0 : 120);
  }

  /* ---------------------------------------------------------------
     SEARCH — everything in one field
     --------------------------------------------------------------- */
  const RECENT_KEY = "bloo-x-recent";
  const recents = () => { try { return JSON.parse(store.get(RECENT_KEY) || "[]"); } catch { return []; } };
  const saveRecents = (list) => store.set(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  const remember = (q) => { q = q.trim(); if (q.length > 1) saveRecents([q, ...recents().filter((x) => x.toLowerCase() !== q.toLowerCase())]); };
  const SEARCH_GROUPS = ["Requests", "People", "Policies", "Announcements", "Communities", "Discounts", "Perks", "Apps", "Help", "Bloom GPT"];
  function searchIndexApp() {
    const idx = [];
    const add = (group, label, meta, lead, go) => idx.push({ group, label, meta, lead, go });
    tasksData().forEach((t) => add("Requests", t.title, `${sourceNames[t.src]} · ${t.done ? (t.outcome === "reject" ? "Rejected" : "Approved") : t.due}`, markOf(t.src), `task/${t.i}`));
    ib.items.forEach((x) => add("Requests", x.title, `${IB_TYPES[x.type].label} · ${x.state === "draft" ? "Draft" : STATUS[statusOf(x)]} · ${x.ref}`, reqIcon(x), `request/${x.id}`));
    [["Approvals", "Waiting on you", "tasks/approvals"], ["Pending requests", "With approvers", "tasks/pending"], ["Drafts", "Requests you haven’t sent", "tasks/drafts"], ["My requests", "Track every request", "tasks/mine"]]
      .forEach(([l, m, g]) => add("Requests", l, m, tile("i-tasks"), g));
    peopleData().forEach((p) => add("People", p.name, `${p.role} · ${personNote(p)}`, avatarHTML(p), `person/${p.key}`));
    policiesData().forEach((p) => add("Policies", p.name, p.updated || p.cat, tile("i-book"), `policy/${p.name}`));
    slides.forEach((sl, n) => {
      if (sl.group === "bday") add("Announcements", `${birthdays[sl.i].name}’s birthday`, "Birthday today", avatarHTML(birthdays[sl.i]), `ann/${n}`);
      if (sl.group === "anniv") add("Announcements", `${anniversary.name}, ${anniversary.years} years`, "Work anniversary", avatarHTML(anniversary), `ann/${n}`);
      if (sl.group === "drill") add("Announcements", "Fire safety drill", "26 Sep · 10:30 AM", tile("i-flame", "#E0472B"), `ann/${n}`);
      if (sl.group === "eid") add("Announcements", "Eid Al Adha", "Holiday · 25 – 29 May", tile("i-moon", "#13806A"), `ann/${n}`);
    });
    groupsData().forEach((g) => add("Communities", g.name, `${g.members} members${g.joined ? " · joined" : ""}`, tile("i-ball", g.tint), `community/${g.name}`));
    offersData().forEach((o) => add("Discounts", o.name, `${o.off} off · ${o.cat}`, `<span class="gpt-logo"><span class="partner__logo ${o.logo}"></span></span>`, `discount/${o.code}`));
    perks.forEach((x) => add("Perks", x.title, `${PERK_CATS[x.cat]} perk`, `<span class="perk-row__tile" data-pc="${x.cat}">${icon(x.icon)}</span>`, `perk/${x.id}`));
    quickLinks().forEach((a) => add("Apps", a.name, `${counts[a.src]} pending · ${a.hint}`, `<span class="app-mark ${a.mark}"></span>`, `tasks/approvals/${a.src}`));
    $$("#faq .faqs__item").forEach((d, i) => add("Help", $(".faqs__q span", d).textContent, "FAQ", tile("i-help"), `faq/${i}`));
    add("Help", "Help & support", "FAQs and contacts", tile("i-help"), "tab/help");
    add("Bloom GPT", "Ask Bloom GPT", "Your AI assistant", `<span class="app-mark app-mark--gpt"><span class="orb orb--xs"></span></span>`, "gpt");
    return idx;
  }
  function searchResults(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = searchIndexApp()
      .map((it) => {
        const hay = `${it.label} ${it.meta} ${it.group}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const l = it.label.toLowerCase();
        // a name that starts with the word beats one where a word starts with it, which beats a match inside a word
        return { ...it, score: l.startsWith(terms[0]) ? 0 : new RegExp(`\\b${terms[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(l) ? 1 : l.includes(terms[0]) ? 2 : 3 };
      })
      .filter(Boolean);
    // groups lead with their best match; within a group, best first
    const best = {};
    list.forEach((x) => { best[x.group] = Math.min(best[x.group] ?? 9, x.score); });
    return list.sort((a, b) => best[a.group] - best[b.group] || SEARCH_GROUPS.indexOf(a.group) - SEARCH_GROUPS.indexOf(b.group) || a.score - b.score);
  }
  PAGES.search = {
    modal: true,
    title: () => "Search",
    bar: () => `<header class="pg-bar pg-bar--search"><label class="m-search__field">${icon("i-search", "ico ico--sm")}<input type="search" data-input="sr" placeholder="Search people, policies, apps…" aria-label="Search Bloom Multiverse" autocomplete="off" enterkeyhint="search" aria-controls="m-search-body"></label><button class="m-search__cancel" type="button" data-modal-close>Cancel</button></header>`,
    prepare() { A.sr = { q: "", view: "live", group: "all" }; },
    render: () => `<div class="m-search__body" id="m-search-body" aria-live="polite">${searchBodyHTML()}</div>`,
    opened(el) { setTimeout(() => $("input", el)?.focus(), reduceMotion ? 0 : 280); }
  };
  let searchList = [];
  const hl = (text, q) => {
    const safe = esc(text);
    const t = q.trim().split(/\s+/)[0];
    if (!t) return safe;
    const i = text.toLowerCase().indexOf(t.toLowerCase());
    return i < 0 ? safe : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + t.length))}</mark>${esc(text.slice(i + t.length))}`;
  };
  function resultRow(it, i, q) {
    return `<li><button class="m-row m-result" type="button" data-act="sr-open" data-v="${i}"><span class="m-row__lead">${it.lead}</span><span class="m-row__txt"><strong>${hl(it.label, q)}</strong><small>${esc(it.meta)}</small></span>${chevron}</button></li>`;
  }
  function searchBodyHTML() {
    const { q, view, group } = A.sr;
    const query = q.trim();
    if (!query) {
      const rec = recents();
      const sugg = [["What needs my attention?", "tasks/approvals", "i-bolt"], ["Data Security", "policy/Data Security", "i-shield"], ["New joiners", "people", "i-users"], ["Fire safety drill", `ann/${groupStart("drill")}`, "i-flame"], ["Discounts", "discounts", "i-tag"], ["My drafts", "tasks/drafts", "i-edit"]];
      searchList = [];
      return `${rec.length ? `<div class="m-sec__head"><p class="m-label">Recent searches</p><button class="link-btn" type="button" data-act="sr-clear">Clear</button></div>
          <ul class="m-list">${rec.map((r) => `<li class="m-recent"><button class="m-row" type="button" data-act="sr-recent" data-v="${esc(r)}"><span class="m-row__lead">${tile("i-clock")}</span><span class="m-row__txt"><strong>${esc(r)}</strong></span></button><button class="icon-btn m-recent__x" type="button" data-act="sr-forget" data-v="${esc(r)}" aria-label="Remove ${esc(r)} from recent searches">${icon("i-x", "ico ico--sm")}</button></li>`).join("")}</ul>`
        : emptyHTML({ ic: "i-search", title: "Search Bloom Multiverse", text: "People, policies, requests, perks, communities, discounts and help, in one place." })}
        <p class="m-label">Suggested</p>
        <div class="chips m-chips m-chips--wrap">${sugg.map(([l, g, ic]) => `<button class="chip gpt-chip" type="button" data-go="${esc(g)}">${icon(ic, "ico ico--sm")}${esc(l)}</button>`).join("")}</div>
        <p class="m-label">Jump to an app</p>
        <div class="m-search__apps">${quickLinks().map((a) => `<button class="m-app" type="button" data-go="tasks/approvals/${a.src}"><span class="app-mark app-mark--lg ${a.mark}" aria-hidden="true"></span><span class="m-app__name">${esc(a.name)}</span><span class="m-app__hint">${counts[a.src]} pending</span></button>`).join("")}</div>`;
    }
    if (view === "loading") return skeletonHTML(4);
    const all = searchResults(query);
    const ask = { group: "Bloom GPT", label: `Ask Bloom GPT “${query}”`, meta: "Get an answer", lead: `<span class="app-mark app-mark--gpt"><span class="orb orb--xs"></span></span>`, go: `gpt/${query}` };
    if (!all.length) {
      searchList = [ask];
      return `${emptyHTML({ ic: "i-search", title: `No results for “${esc(query)}”`, text: "Try a person’s name, a policy or an app." })}<ul class="m-list">${resultRow(ask, 0, "")}</ul>`;
    }
    const groups = [...new Set(all.map((x) => x.group))]; // already in best-first order
    if (view === "results") {
      const list = group === "all" ? all : all.filter((x) => x.group === group);
      searchList = [...list, ask];
      return `<p class="m-search__count">${plural(all.length, "result", "results")} for “${esc(query)}”</p>
        <div class="chips m-chips" role="group" aria-label="Show">${chipHTML({ label: "All", on: group === "all", act: "sr-group", v: "all", count: all.length })}${groups.map((g) => chipHTML({ label: g, on: group === g, act: "sr-group", v: g, count: all.filter((x) => x.group === g).length })).join("")}</div>
        <ul class="m-list">${searchList.map((it, i) => resultRow(it, i, query)).join("")}</ul>`;
    }
    // live: the best three of each group
    searchList = [];
    let html = "";
    groups.forEach((g) => {
      const items = all.filter((x) => x.group === g);
      html += `<div class="m-sec__head m-sec__head--sm"><p class="m-label">${g}</p>${items.length > 3 ? `<button class="link-btn" type="button" data-act="sr-all" data-v="${g}">See all ${items.length}</button>` : ""}</div><ul class="m-list">`;
      items.slice(0, 3).forEach((it) => { html += resultRow(it, searchList.length, query); searchList.push(it); });
      html += "</ul>";
    });
    searchList.push(ask);
    return `${html}<ul class="m-list">${resultRow(ask, searchList.length - 1, "")}</ul>
      <button class="btn btn--quiet m-search__all" type="button" data-act="sr-all" data-v="all">See all ${all.length} results</button>`;
  }
  function renderAppSearch() {
    const body = A.modal?.name === "search" && $("#m-search-body", A.modal.el);
    if (body) rerender(body, searchBodyHTML());
  }
  function runSearch(q, submit) {
    A.sr.q = q;
    const input = A.modal && $('[data-input="sr"]', A.modal.el);
    if (input && input.value !== q) input.value = q;
    if (!q.trim()) { A.sr.view = "live"; renderAppSearch(); return; }
    if (submit) remember(q);
    A.sr.group = "all";
    A.sr.view = "loading";
    renderAppSearch();
    setTimeout(() => { if (A.sr.view === "loading") { A.sr.view = "results"; renderAppSearch(); } }, reduceMotion ? 0 : 280);
  }
  function openResult(i) {
    const it = searchList[i];
    if (!it) return;
    remember(A.sr.q);
    closeModal(false);
    go(it.go);
  }

  /* ---------------------------------------------------------------
     Gestures — swipe back from the left edge; drag a sheet down
     --------------------------------------------------------------- */
  (() => {
    let s = null;
    appViews.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      const pg = topPage();
      s = (e.touches.length === 1 && t.clientX < 22 && A.stacks[A.tab].length > 1 && !A.modal) ? { x: t.clientX, y: t.clientY, pg, prev: A.stacks[A.tab].at(-2), on: false, dx: 0 } : null;
    }, { passive: true });
    appViews.addEventListener("touchmove", (e) => {
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.on) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { s = null; return; }
        if (dx < 10) return;
        s.on = true;
        s.prev.classList.remove("is-under");
      }
      e.preventDefault();
      s.dx = Math.max(0, dx);
      const w = s.pg.offsetWidth;
      s.pg.style.transform = `translateX(${s.dx}px)`;
      s.prev.style.transform = `translateX(${(-24 + (s.dx / w) * 24).toFixed(2)}%)`;
      s.prev.style.opacity = (0.4 + (s.dx / w) * 0.6).toFixed(3);
    }, { passive: false });
    const end = () => {
      if (!s?.on) { s = null; return; }
      const { pg, prev, dx } = s;
      s = null;
      const w = pg.offsetWidth;
      const clear = () => { pg.style.transform = ""; prev.style.transform = ""; prev.style.opacity = ""; };
      if (dx > w * 0.33) {
        // finish the swipe, then pop without a second slide
        motion(pg, [{ transform: `translateX(${dx}px)` }, { transform: "translateX(100%)" }], { duration: 240, easing: "ease-out" }).then(() => {
          clear();
          const stack = A.stacks[A.tab];
          if (stack.at(-1) !== pg) return;
          stack.pop();
          pg.remove();
          prev.inert = false;
          prev._page.def.activate?.(prev);
          focusPage(prev);
          syncBack();
        });
        motion(prev, [{ transform: prev.style.transform, opacity: prev.style.opacity }, { transform: "none", opacity: 1 }], { duration: 240, easing: "ease-out" });
      } else {
        Promise.all([
          motion(pg, [{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 260 }),
          motion(prev, [{ transform: prev.style.transform, opacity: prev.style.opacity }, { transform: "translateX(-24%)", opacity: 0.4 }], { duration: 260 })
        ]).then(() => { clear(); prev.classList.add("is-under"); });
      }
    };
    appViews.addEventListener("touchend", end);
    appViews.addEventListener("touchcancel", end);

    const panel = $(".app-sheet__panel", sheetEl);
    let d = null;
    panel.addEventListener("touchstart", (e) => {
      const onHandle = e.target.closest(".app-sheet__grab, .app-sheet__head");
      const body = $(".app-sheet__body", panel);
      d = onHandle || body.scrollTop <= 0 ? { y: e.touches[0].clientY, dy: 0, handle: !!onHandle } : null;
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (!d) return;
      d.dy = Math.max(0, e.touches[0].clientY - d.y);
      if (!d.handle && d.dy < 8) return;
      if (d.dy > 0) e.preventDefault();
      panel.style.transform = `translateY(${d.dy}px)`;
    }, { passive: false });
    panel.addEventListener("touchend", () => {
      if (!d) return;
      const dy = d.dy;
      d = null;
      if (dy > 110) closeSheet();
      else if (dy > 0) motion(panel, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 300 }).then(() => { panel.style.transform = ""; });
    });
  })();

  /* ---------------------------------------------------------------
     Offline — the app keeps what it synced, and says so
     --------------------------------------------------------------- */
  const offlineEl = $("#app-offline");
  function showOffline(on) { offlineEl.hidden = !on; }
  addEventListener("offline", () => { if (A.on) showOffline(true); });
  addEventListener("online", () => { if (!offlineEl.hidden) { showOffline(false); if (A.on) toast("Back online", "i-check"); } });

  /* ---------------------------------------------------------------
     Mouse: rails move under a drag, as they would under a finger
     (the app in the iPhone mockup, or in a narrow desktop window)
     --------------------------------------------------------------- */
  (() => {
    let d = null;
    const railOf = (el) => {
      for (; el && el !== document.body; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return el;
      }
      return null;
    };
    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener("pointerdown", (e) => {
      if (!A.on || e.pointerType !== "mouse" || e.button !== 0 || e.target.closest("input, textarea, select, [contenteditable]")) return;
      const el = railOf(e.target);
      if (el) d = { el, x0: e.clientX, left: el.scrollLeft, moved: false, x: e.clientX, t: e.timeStamp, v: 0 };
    });
    const end = () => {
      if (!d) return;
      const { el, moved, v } = d;
      d = null;
      if (!moved) return;
      root.classList.remove("is-grabbing");
      // the click that ends a drag isn't a tap
      addEventListener("click", swallow, true);
      setTimeout(() => removeEventListener("click", swallow, true), 0);
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
      // carry on a little, then settle on a card
      el.scrollTo({ left: el.scrollLeft - v * 140, behavior: smooth() });
    };
    addEventListener("pointermove", (e) => {
      if (!d) return;
      if (!(e.buttons & 1)) { end(); return; }
      const dx = e.clientX - d.x0;
      if (!d.moved) {
        if (Math.abs(dx) < 6) return;
        d.moved = true;
        d.el.style.scrollSnapType = "none";
        d.el.style.scrollBehavior = "auto";
        root.classList.add("is-grabbing");
        getSelection()?.removeAllRanges();
      }
      d.v = (e.clientX - d.x) / Math.max(1, e.timeStamp - d.t);
      d.x = e.clientX;
      d.t = e.timeStamp;
      d.el.scrollLeft = d.left - dx;
    });
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    // links and pictures in the app don't get picked up and dragged away
    document.addEventListener("dragstart", (e) => { if (A.on && e.target.closest?.("#app")) e.preventDefault(); });
  })();

  /* ---------------------------------------------------------------
     In the iPhone mockup: tell the device around the app which theme
     the app is in, and when the status bar sits on a photo
     --------------------------------------------------------------- */
  let toldMockup = "";
  function tellMockup(ready) {
    if (window.name !== MOCKUP || !A.on) return;
    const pg = gpt.open || A.modal ? null : topPage();
    const over = pg && $(".pg-bar--over", pg);
    const msg = {
      bloom: "chrome",
      theme: root.getAttribute("data-theme"),
      palette: root.getAttribute("data-palette") || "",
      tone: over && !over.classList.contains("is-scrolled") ? "light" : ""
    };
    const said = JSON.stringify(msg);
    try {
      if (ready) parent.postMessage({ bloom: "app-ready" }, "*");
      if (ready || said !== toldMockup) parent.postMessage(msg, "*");
      toldMockup = said;
    } catch { /* not framed */ }
  }
  if (window.name === MOCKUP) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; tellMockup(false); });
    }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-theme", "data-palette"] });
  }

  /* ---------------------------------------------------------------
     Desktop page (#desktop): ☰ → Mobile app opens the iPhone mockup
     over the page; the app inside keeps its own state
     --------------------------------------------------------------- */
  let mockup = null;
  function openMockup(trigger) {
    if (mockup) return;
    closeNav(false);
    mockup = mountMockup({
      overlay: true,
      onTheme: (theme, palette) => { applyTheme(theme === "dark" ? "dark" : "light"); applyPalette(palette === "crimson" ? "crimson" : "azure"); },
      onClose: () => {
        mockup = null;
        body.style.overflow = "";
        setFlagCursor(store.get(FC_KEY) !== "off");
        // the ☰ item closed with its menu, so focus goes back to ☰
        (trigger && !trigger.closest(".mo") ? trigger : menuBtn).focus({ preventScroll: true });
      }
    });
    if (!mockup) return;
    body.style.overflow = "hidden";
    setFlagCursor(false);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-open-mockup]"); if (b) openMockup(b); });

  /* ---------------------------------------------------------------
     SIGN IN — splash, login (Bloom ID or biometrics), then the app.
     Once a session, and again after Sign out. The steps play in
     #app-auth, over the tabs, on one sky that keeps drifting; the
     biometric prompt is the app's sheet. The motion is the page's own:
     the hero's constellation (Bloom at its core, the four apps around
     it), its line reveals and swash, tiles that pop, and your photo,
     which flies into the Profile tab on the way in.
     --------------------------------------------------------------- */
  const AUTH_KEY = "bloo-x-signed-in";
  const SPRING = "cubic-bezier(.34,1.56,.64,1)";
  const authEl = $("#app-auth");
  const AUTH = { started: false, timers: [] };
  const authWait = (ms, fn) => AUTH.timers.push(setTimeout(fn, reduceMotion ? Math.min(ms, 400) : ms));
  const isSignedIn = () => { try { return sessionStorage.getItem(AUTH_KEY) === "1"; } catch { return false; } };
  const setSignedIn = (on) => { try { if (on) sessionStorage.setItem(AUTH_KEY, "1"); else sessionStorage.removeItem(AUTH_KEY); } catch { /* the session forgets */ } };
  // A sprite icon drawn inline, so its strokes can draw and its parts move
  const inlinePaths = (id) => $$(`#${id} path`).map((p, i) => `<path d="${p.getAttribute("d")}" pathLength="1" style="--i:${i}"/>`).join("");
  // Bloom's icon: the logo's B, white on the logo's red
  const bloomIcon = () => `<span class="auth-icon"><svg class="auth-icon__b" viewBox="0 0 42 43">${inlinePaths("i-bloom")}</svg><i class="auth-icon__sheen"></i></span>`;
  const authBar = () => `<header class="auth__bar"><span class="brand__word has-logo" role="img" aria-label="Bloom Multiverse"></span></header>`;
  // Each line rises out of its own mask, as the hero's do
  const authLine = (html, cls = "") => `<span class="auth-line ${cls}"><span class="auth-line__in">${html}</span></span>`;
  // The hero's constellation before sign-in: Bloom at the core and, on the login, the four apps (no counts yet)
  function authOrbitHTML(full) {
    const lines = $("#orbit .orbit__lines");
    const pick = (sel) => $$(sel, lines).map((x) => x.outerHTML).join("");
    const nodes = full ? $$("#orbit .orbit__node").map((n, i) => `<span class="auth-orbit__node" style="--x:${n.style.getPropertyValue("--x")};--y:${n.style.getPropertyValue("--y")};--i:${i}">${markOf(n.dataset.filter)}</span>`).join("") : "";
    return `<div class="auth-orbit${full ? "" : " auth-orbit--splash"}" aria-hidden="true">
      <svg class="auth-orbit__lines" viewBox="${lines.getAttribute("viewBox")}"><g class="auth-orbit__rings">${pick(".ring")}</g>${full ? `<g class="auth-orbit__beams">${pick(".beam")}${pick(".ring-dot")}</g>` : ""}</svg>
      <span class="auth-orbit__core">${bloomIcon()}</span>${nodes}</div>`;
  }
  // The login's headline is the hero's tagline, swash and all
  const taglineLines = () => {
    const t = $(".hero__tagline");
    return `${authLine(esc(t.firstChild.textContent.trim()))} ${authLine($("em", t).outerHTML, "auth-line--em")}`;
  };
  const AUTH_STEPS = {
    splash: () => `<section class="auth auth--splash" aria-label="Bloom Multiverse is opening">
        <div class="auth-splash">${authOrbitHTML(false)}
          <p class="auth-splash__name">${authLine("Bloom")} ${authLine("Multiverse", "auth-line--accent")}</p>
          <p class="auth-splash__tag">Employee workspace</p></div>
        <span class="auth-load" aria-hidden="true"><i></i></span></section>`,
    login: () => `<section class="auth auth--login" aria-labelledby="auth-title">${authBar()}
        <div class="auth-vis">${authOrbitHTML(true)}</div>
        <div class="auth__body">${kicker("Sign in")}
          <h1 class="auth__title" id="auth-title" tabindex="-1">${taglineLines()}</h1>
          <p class="auth__sub">Access company resources, announcements and more in one place.</p></div>
        <div class="auth__actions">
          <button class="btn btn--primary auth__btn auth__btn--id" type="button" data-act="auth-sso"><span class="auth__btn-label">Log in with Bloom ID</span>${icon("i-arrow", "ico ico--sm btn__arrow")}</button>
          <button class="btn btn--ghost auth__btn" type="button" data-act="auth-bio" data-v="finger">${icon("i-fingerprint", "ico ico--sm")}Use biometrics</button>
          <p class="auth__help">Need help? <button class="link-btn" type="button" data-act="auth-help">Contact IT support</button></p>
        </div></section>`,
    done: () => `<section class="auth auth--done" aria-labelledby="auth-done-title">${authBar()}
        <div class="auth__done" role="status">
          <span class="auth-me" aria-hidden="true"><svg class="auth-me__ring" viewBox="0 0 124 124"><circle cx="62" cy="62" r="60"/><circle cx="62" cy="62" r="60" pathLength="1"/></svg>${avatarHTML(me, "auth-me__dp")}<span class="auth-me__ok">${icon("i-check")}</span></span>
          ${kicker("Signed in")}
          <h1 class="auth__title auth__title--center" id="auth-done-title" tabindex="-1">${authLine("Welcome back,")} ${authLine(`${esc(me.first)}<span class="hero__dot">.</span>`, "auth-line--name")}</h1>
          <p class="auth__sub">Getting your workspace ready…</p>
          <ul class="auth-sync" aria-hidden="true">${APP_ORDER.map((a, i) => `<li style="--i:${i}">${markOf(a)}<span class="auth-sync__ok">${icon("i-check")}</span></li>`).join("")}</ul>
        </div>
        <span class="auth-load auth-load--done" aria-hidden="true"><i></i></span></section>`
  };
  function showAuth(step) {
    AUTH.timers.forEach(clearTimeout);
    AUTH.timers = [];
    appEl.classList.add("is-authing");
    authEl.hidden = false;
    if (!$(".auth-sky", authEl)) authEl.innerHTML = `<div class="auth-sky" aria-hidden="true"><i></i><i></i><i></i></div>`;
    // the splash's constellation rises into the login's: measure it before it goes
    const splashOrbit = $(".auth-step:not(.is-leaving) .auth-orbit--splash", authEl);
    const from = splashOrbit?.getBoundingClientRect();
    const prev = $$(":scope > :not(.auth-sky)", authEl);
    const next = document.createElement("div");
    next.className = "auth-step";
    next.innerHTML = AUTH_STEPS[step]();
    authEl.append(next);
    // what was showing (a step, a scan) fades as the next one comes in
    prev.forEach((el) => {
      el.classList.add("is-leaving");
      el.inert = true;
      motion(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" }).then(() => el.remove());
    });
    const orbit = $(".auth-orbit", next);
    const to = orbit?.getBoundingClientRect();
    if (from && to?.width && !reduceMotion) {
      next.firstElementChild.classList.add("is-flown");
      splashOrbit.style.visibility = "hidden";
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      motion(orbit, [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: "none" }], { duration: 1000 });
    }
    setTimeout(() => $("h1", next)?.focus({ preventScroll: true }), 60);
    if (step === "splash") authWait(2100, () => showAuth("login"));
    if (step === "done") authWait(2500, finishAuth);
  }
  function signInWithId(btn) {
    if (btn.getAttribute("aria-busy") === "true") return;
    // the button folds into a spinner
    btn.setAttribute("aria-busy", "true");
    btn.setAttribute("aria-label", "Signing in…");
    btn.insertAdjacentHTML("beforeend", `<span class="auth__spin" aria-hidden="true"></span>`);
    authWait(1300, () => showAuth("done"));
  }
  const BIO = {
    finger: { tab: "Fingerprint", title: "Confirm fingerprint", text: "Tap the icon, then place your finger on the sensor.", scan: "Read my fingerprint", busy: "Reading fingerprint" },
    face: { tab: "Face ID", title: "Sign in with Face ID", text: "Look at your front camera, or tap the icon to scan.", scan: "Scan my face", busy: "Scanning face" }
  };
  // Fingerprint and Face ID drawn twice: a faint base, and a lit copy that moves
  const glyphHTML = (kind, cls = "") => {
    const paths = inlinePaths(kind === "face" ? "i-faceid" : "i-fingerprint");
    return `<svg class="auth-glyph auth-glyph--${kind} ${cls}" viewBox="0 0 24 24" aria-hidden="true"><g class="auth-glyph__base">${paths}</g><g class="auth-glyph__lit">${paths}</g></svg>`;
  };
  const bioPanelHTML = (kind) => `<div class="auth-bio__panel" id="auth-bio-panel" role="tabpanel" aria-label="${BIO[kind].tab}">
      <button class="auth-bio__scan" type="button" data-act="auth-scan" data-v="${kind}" aria-label="${BIO[kind].scan}"><i class="auth-bio__wave"></i><i class="auth-bio__wave"></i>${glyphHTML(kind)}</button>
      <h3 class="auth-bio__title">${BIO[kind].title}</h3>
      <p class="auth-bio__text">${BIO[kind].text}</p></div>`;
  const bioHTML = (kind) => `<div class="auth-bio">
      <div class="tabs auth-bio__tabs" role="tablist" aria-label="Sign in with">
        <span class="tabs__indicator" aria-hidden="true"></span>
        ${Object.keys(BIO).map((k) => `<button class="tab${k === kind ? " is-selected" : ""}" type="button" role="tab" aria-selected="${k === kind}" aria-controls="auth-bio-panel" tabindex="${k === kind ? 0 : -1}" data-act="auth-bio" data-v="${k}">${icon(k === "face" ? "i-faceid" : "i-fingerprint", "ico ico--sm")}${BIO[k].tab}</button>`).join("")}
      </div>
      ${bioPanelHTML(kind)}
      <button class="btn btn--ghost auth-bio__cancel" type="button" data-sheet-close>Cancel</button>
    </div>`;
  function showBio(kind) {
    const b = BIO[kind];
    if (A.sheet?.bio) {
      if (A.sheet.bio === kind) return;
      // switch in place: the pill slides across, the prompt comes in from its side
      A.sheet.bio = kind;
      A.sheet.render = () => bioHTML(kind);
      $("#app-sheet-title").textContent = b.title;
      const tabs = $(".auth-bio__tabs", sheetBody);
      $$('[role="tab"]', tabs).forEach((t) => {
        const on = t.dataset.v === kind;
        t.classList.toggle("is-selected", on);
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
      });
      moveIndicator(tabs);
      const panel = $(".auth-bio__panel", sheetBody);
      panel.insertAdjacentHTML("afterend", bioPanelHTML(kind));
      panel.remove();
      motion($(".auth-bio__panel", sheetBody), [{ opacity: 0, transform: `translateX(${kind === "face" ? 28 : -28}px)` }, { opacity: 1, transform: "none" }], { duration: 460 });
      return;
    }
    openSheet({ title: b.title, render: () => bioHTML(kind), cls: "app-sheet--bio" });
    A.sheet.bio = kind;
    // the pill starts under its tab, rather than sliding in from the edge
    const tabs = $(".auth-bio__tabs", sheetBody);
    const ind = $(".tabs__indicator", tabs);
    ind.style.transition = "none";
    moveIndicator(tabs);
    void ind.offsetWidth;
    ind.style.transition = "";
  }
  function scanBio(kind) {
    closeSheet(false);
    const ticks = Array.from({ length: 48 }, (_, i) => `<line x1="80" y1="7" x2="80" y2="17" transform="rotate(${i * 7.5} 80 80)" style="--i:${i}"/>`).join("");
    const scan = document.createElement("div");
    scan.className = `auth-scan auth-scan--${kind}`;
    scan.setAttribute("role", "status");
    scan.innerHTML = `<div class="auth-scan__box" aria-hidden="true"><i class="auth-scan__ripple"></i>
        <div class="auth-scan__hud">
          <svg class="auth-scan__ring" viewBox="0 0 160 160"><g class="auth-scan__ticks">${ticks}</g><circle class="auth-scan__done" cx="80" cy="80" r="68" pathLength="1"/></svg>
          ${glyphHTML(kind, "auth-scan__glyph")}
          <svg class="auth-scan__ok" viewBox="0 0 24 24"><path d="${$("#i-check path").getAttribute("d")}" pathLength="1"/></svg>
          <i class="auth-scan__beam"></i>
        </div></div>
      <p class="auth-scan__label">${BIO[kind].busy}<span class="auth-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>`;
    authEl.append(scan);
    motion(scan, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: "ease-out" });
    authWait(1900, () => {
      scan.classList.add("is-verified");
      $(".auth-scan__label", scan).innerHTML = `<span class="auth-scan__verified">${icon("i-check", "ico ico--sm")}Verified</span>`;
    });
    authWait(2900, () => showAuth("done"));
  }
  // Home comes up as the sign-in fades: the greeting's lines rise again, the rest follows, the bar slides in
  function enterHome() {
    const pg = topPage();
    if (!pg || reduceMotion) return;
    const opts = (delay) => ({ duration: 900, delay, fill: "backwards" });
    $$(".m-hello .hero__line-in", pg).forEach((el, i) => motion(el, [{ translate: "0 110%" }, { translate: "0 0" }], opts(160 + i * 90)));
    [$(".m-hello .hero__date", pg), $(".m-hello__tag", pg), $(".m-frags", pg), $(".m-sec", pg)].filter(Boolean)
      .forEach((el, i) => motion(el, [{ opacity: 0, translate: "0 22px" }, { opacity: 1, translate: "0 0" }], opts(100 + i * 90)));
    motion($(".app-nav__bar", appNav), [{ translate: "0 160%" }, { translate: "0 0" }], { duration: 800, delay: 240, easing: SPRING, fill: "backwards" });
  }
  // Your photo leaves the welcome and lands in the Profile tab
  function flyPhoto(from, dp) {
    const to = dp.getBoundingClientRect();
    if (!to.width) return;
    const box = appEl.getBoundingClientRect();
    const fly = document.createElement("span");
    fly.className = "auth-fly";
    fly.setAttribute("aria-hidden", "true");
    fly.innerHTML = avatarHTML(me);
    Object.assign(fly.style, { left: `${from.left - box.left}px`, top: `${from.top - box.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    appEl.append(fly);
    dp.style.visibility = "hidden";
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // across and down on different curves, so it arcs into the bar
    const across = fly.animate([{ transform: "none" }, { transform: `translateX(${dx}px)` }], { duration: 820, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" });
    fly.firstElementChild.animate([{ transform: "none" }, { transform: `translateY(${dy}px) scale(${to.width / from.width})` }], { duration: 820, easing: "cubic-bezier(.6,0,.4,1)", fill: "forwards" });
    across.finished.catch(() => {}).then(() => {
      fly.remove();
      dp.style.visibility = "";
      motion(dp, [{ scale: 1.5 }, { scale: 1 }], { duration: 520, easing: SPRING });
    });
  }
  function finishAuth() {
    setSignedIn(true);
    setTab("home");
    const from = $(".auth-step:last-child .auth-me__dp", authEl)?.getBoundingClientRect();
    appEl.classList.remove("is-authing");
    const dp = $(".app-nav__dp", appNav);
    if (from && dp && !reduceMotion) flyPhoto(from, dp);
    enterHome();
    authEl.inert = true;
    motion(authEl, [{ opacity: 1 }, { opacity: 0, transform: "scale(1.05)" }], { duration: 560, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).then(() => {
      authEl.getAnimations().forEach((a) => a.cancel());
      authEl.hidden = true;
      authEl.inert = false;
      authEl.replaceChildren();
      focusPage(topPage());
    });
  }
  function signOut() {
    setSignedIn(false);
    closeModal(false);
    if (gpt.open) closeGpt();
    showAuth("login");
  }

  /* ---------------------------------------------------------------
     Mode — the app on phones, the page everywhere else
     --------------------------------------------------------------- */
  function setAppMode() {
    // Only the desktop page (#desktop) gives way to the page on wider screens;
    // anywhere else the app, once open, stays the app
    const on = appMQ.matches || !DESKTOP;
    if (on === A.on && root.classList.contains("is-app") === on) return;
    A.on = on;
    root.classList.toggle("is-app", on);
    if (on) {
      closeNav(false); closeMenus(); closeSearch(); closeDrawer(); closeInbox(); hideTip();
      mockup?.close();
      ensureRoot(A.tab);
      if (!AUTH.started) { AUTH.started = true; if (!isSignedIn()) showAuth("splash"); }
      TABS.forEach((t) => { const s = stackOf(t); s.classList.toggle("is-active", t === A.tab); s.inert = t !== A.tab; });
      syncBadges();
      requestAnimationFrame(() => { syncNav(); $$(".pg", appEl).forEach(updateBar); });
      if (!navigator.onLine) showOffline(true);
      tellMockup(true);
    } else {
      closeModal(false);
      closeSheet(false);
      if (gpt.open) closeGpt();
      unwindBack();
      scheduleMeasure();
    }
    setFlagCursor(store.get(FC_KEY) !== "off");
  }
  appMQ.addEventListener("change", setAppMode);
  addEventListener("resize", () => { if (A.on) syncNav(); });
  setAppMode();
