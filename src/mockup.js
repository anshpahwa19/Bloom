  /* ==================================================================
     BlooMultiverse — mockup.js
     Screens wider than a phone see the phone app in an iPhone. The
     page, as it first arrived, runs in a phone-sized frame (it opens
     there as the app), and index.html's #mockup draws the device
     around it: the frame, the Dynamic Island, the status bar and the
     home indicator. Phones get the app full screen, and #desktop opens
     the full desktop page, which is kept for development.
     index.html runs this file first and stops after it in mockup mode,
     so none of the page's own scripts start behind the phone.
     ================================================================== */
  // Phones get the app instead of the page. Keep in step with the query in
  // index.html's head script, which sets the mode class before paint.
  const APP_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 520px)";
  // The full desktop page, kept for development: open the file with #desktop
  const DESKTOP = location.hash === "#desktop";
  // The frame's name tells the copy inside that it runs in the mockup
  const MOCKUP = "bloom-mockup";
  // A clean copy of the page, taken before any script changes it: the frame loads it
  const PRISTINE = matchMedia(APP_QUERY).matches ? "" : document.documentElement.outerHTML;

  // An iPhone 15's screen in points; the frame adds a band and a bezel
  const MK_SCREEN = [393, 852];
  const MK_FRAME = 14;          // band + bezel on each side, as in mobile.css
  const MK_KEYS = 6;            // the side buttons stand out of the frame
  const MK_MIN_H = 720;         // short windows get a shorter phone before a smaller one
  const MK_CLOCK = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

  /* Load the app into the phone. overlay: over the desktop page (#desktop,
     ☰ → Mobile app), with a close button. onTheme follows the app's theme
     and accent; onClose runs after an overlay closes. */
  function mountMockup({ overlay = false, onTheme = null, onClose = null } = {}) {
    const de = document.documentElement;
    const el = document.getElementById("mockup");
    if (!el || !PRISTINE) return null;
    if (el._mk) return el._mk;
    const screen = el.querySelector(".mk__screen");
    const note = el.querySelector(".mk__note");
    const clock = el.querySelector(".mk__time");
    const closeBtn = el.querySelector("[data-mk-close]");
    el.classList.remove("is-ready", "is-light", "is-light-bottom", "is-stuck");
    note.textContent = "Opening the app…";

    // Fit the phone to the window: a shorter phone first, then a smaller one
    const fit = () => {
      const w = innerWidth - 32;
      const h = innerHeight - 48;
      const fullW = MK_SCREEN[0] + 2 * (MK_FRAME + MK_KEYS);
      const sW = Math.min(1, w / fullW);
      let tall = MK_SCREEN[1];
      let s = Math.min(sW, h / (tall + 2 * MK_FRAME));
      if (s < 0.9) {
        tall = Math.round(Math.max(MK_MIN_H, Math.min(MK_SCREEN[1], h / Math.min(sW, 0.9) - 2 * MK_FRAME)));
        s = Math.min(sW, h / (tall + 2 * MK_FRAME));
      }
      el.style.setProperty("--mk-h", `${tall}px`);
      el.style.setProperty("--mk-s", Math.max(0.3, s).toFixed(4));
    };
    fit();
    addEventListener("resize", fit);

    // The status bar keeps time
    const tick = () => { clock.textContent = MK_CLOCK.formatToParts(new Date()).filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim(); };
    tick();
    const clockTimer = setInterval(tick, 15000);

    // The page as it arrived, without scripts that aren't ours, in the current theme
    const doc = new DOMParser().parseFromString(PRISTINE, "text/html");
    doc.querySelectorAll("script:not([data-bloom])").forEach((s) => s.remove());
    const html = doc.documentElement;
    html.classList.remove("is-mockup", "js");
    html.setAttribute("data-theme", de.getAttribute("data-theme") || "light");
    if (de.hasAttribute("data-palette")) html.setAttribute("data-palette", de.getAttribute("data-palette"));
    else html.removeAttribute("data-palette");
    const frame = document.createElement("iframe");
    frame.name = MOCKUP;
    frame.title = "BlooMultiverse mobile app";
    frame.srcdoc = `<!doctype html>${html.outerHTML}`;
    screen.insertBefore(frame, screen.querySelector(".mk__status"));

    // The app says when it's up, and which theme and status bar it wants
    let ready = false;
    const stuck = setTimeout(() => {
      if (ready) return;
      el.classList.add("is-stuck");
      note.textContent = "The app couldn’t start in this window. Open this page on your phone to use it.";
    }, 9000);
    const setTheme = onTheme || ((theme, palette) => {
      de.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
      if (palette === "crimson") de.setAttribute("data-palette", "crimson");
      else de.removeAttribute("data-palette");
    });
    const onMsg = (e) => {
      const d = e.source === frame.contentWindow && e.data;
      if (!d || typeof d.bloom !== "string") return;
      if (d.bloom === "app-ready" && !ready) {
        ready = true;
        clearTimeout(stuck);
        el.classList.remove("is-stuck");
        el.classList.add("is-ready");
      }
      if (d.bloom === "chrome") {
        el.classList.toggle("is-light", d.tone === "light");
        el.classList.toggle("is-light-bottom", d.bottom === "light");
        if (d.theme !== de.getAttribute("data-theme") || (d.palette || "") !== (de.getAttribute("data-palette") || "")) setTheme(d.theme, d.palette);
      }
    };
    addEventListener("message", onMsg);

    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
    const onClick = (e) => { if (e.target.closest("[data-mk-close]")) close(); };
    if (overlay) {
      el.classList.add("is-overlay");
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "BlooMultiverse mobile app");
      document.addEventListener("keydown", onKey, true);
      el.addEventListener("click", onClick);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-open")));
      setTimeout(() => closeBtn?.focus(), 60);
    }

    function close() {
      if (!el._mk) return;
      el._mk = null;
      removeEventListener("resize", fit);
      removeEventListener("message", onMsg);
      document.removeEventListener("keydown", onKey, true);
      el.removeEventListener("click", onClick);
      clearInterval(clockTimer);
      clearTimeout(stuck);
      el.classList.remove("is-open");
      const done = () => {
        frame.remove();
        el.classList.remove("is-overlay", "is-ready", "is-light", "is-light-bottom", "is-stuck");
        ["role", "aria-modal", "aria-label"].forEach((a) => el.removeAttribute(a));
        onClose?.();
      };
      if (overlay && !matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(done, 320);
      else done();
    }
    el._mk = { el, frame, close };
    return el._mk;
  }
