  /* ==================================================================
     BlooMultiverse — frame.js
     Only the phone app is shown. Phones get it full screen. Wider
     screens get it at a phone's size — 393 × 852, an iPhone 15's
     screen — centred on the page, with nothing drawn around it: the
     page itself is the app, so tools such as Figma's HTML capture read
     it as it is.
     To lay out exactly as on that phone, the app is given a phone-sized
     viewport (the is-framed class): #screen becomes the screen and holds
     its fixed layers, the stylesheets' media queries and viewport units
     are resolved for 393 × 852, and matchMedia answers for it too.
     Beside it, "Figma capture view" (or #figma) lays every screen out at
     once for Figma's HTML capture (the capture board, in mobile.js).
     #desktop opens the full desktop page, kept for development.
     index.html runs this file before app.js and mobile.js.
     ================================================================== */
  // Phones get the app. Keep in step with the query in index.html's head
  // script, which sets the mode classes before paint.
  const APP_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 520px)";
  // The full desktop page, kept for development: open the file with #desktop
  const DESKTOP = location.hash === "#desktop";
  // The phone-sized screen wider screens get, in CSS px (keep in step with section 5 of mobile.css)
  const FRAME = [393, 852];
  const FRAMED = document.documentElement.classList.contains("is-framed");

  /* How the phone-sized screen answers a media query. Size, hover and
     pointer are the phone's; anything else (theme, reduced motion) is
     left to the browser. frameMedia returns "all", "not all" or the part
     still for the browser to decide. */
  function frameFeature(f) {
    const m = /^\(\s*(min-|max-)?(width|height|hover|pointer)\s*(?::\s*([^)]+))?\)$/i.exec(f.trim());
    if (!m) return null;
    const [, range, name, raw = ""] = m;
    const v = raw.trim().toLowerCase();
    if (name === "hover") return v === "none";            // a phone can't hover
    if (name === "pointer") return !v || v === "coarse";  // and points with a finger
    const px = parseFloat(v) * (/r?em$/.test(v) ? 16 : 1);
    const size = FRAME[name.toLowerCase() === "width" ? 0 : 1];
    return range === "min-" ? size >= px : range === "max-" ? size <= px : size === px;
  }
  function frameMedia(text) {
    const left = [];
    for (const q of text.split(",")) {
      let holds = true;
      const rest = [];
      for (const f of q.trim().split(/\s+and\s+/i)) {
        const r = frameFeature(f);
        if (r === null) rest.push(f.trim());
        else if (!r) { holds = false; break; }
      }
      if (!holds) continue;
      if (!rest.length) return "all";
      left.push(rest.join(" and "));
    }
    return left.length ? left.join(", ") : "not all";
  }

  // app.js and mobile.js share this scope, so their matchMedia is this one
  const nativeMatchMedia = window.matchMedia.bind(window);
  const matchMedia = !FRAMED ? nativeMatchMedia : (q) => {
    const t = frameMedia(q);
    if (t !== "all" && t !== "not all") return nativeMatchMedia(t);
    return { matches: t === "all", media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  };

  // Where the screen sits in the window: fixed layers inside it measure from here
  const screenEl = document.getElementById("screen");
  const frameOffset = () => (FRAMED ? screenEl.getBoundingClientRect() : { left: 0, top: 0 });

  if (FRAMED) {
    // Bloom GPT is a full-screen layer too, so it lives in the screen
    screenEl.append(document.getElementById("gpt-page"));
    // Resolve our stylesheets for the phone-sized screen: media queries become
    // "all"/"not all" (or what's left for the browser), and vw/vh become px.
    // url(…) and strings are skipped whole, so data URIs are never touched.
    const VP = /url\([^)]*\)|"[^"]*"|'[^']*'|(-?(?:\d+\.?\d*|\.\d+))(?:s|d|l)?v(w|h|min|max)\b/g;
    const toPx = (css) => css.replace(VP, (m, n, u) => (n === undefined ? m : `${+(n * FRAME[u === "w" || u === "min" ? 0 : 1] / 100).toFixed(3)}px`));
    const resolve = (rules) => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) {
          const t = frameMedia(rule.media.mediaText);
          if (t !== rule.media.mediaText) rule.media.mediaText = t;
        }
        if (rule.style) {
          const css = rule.style.cssText;
          const px = toPx(css);
          if (px !== css) rule.style.cssText = px;
        }
        if (rule.cssRules) resolve(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode?.hasAttribute?.("data-bloom")) resolve(sheet.cssRules);
    }
    // The page's dialogs open in the browser's top layer, outside the screen:
    // they place themselves over it from these
    const place = () => {
      const r = screenEl.getBoundingClientRect();
      document.documentElement.style.setProperty("--fx", `${r.left}px`);
      document.documentElement.style.setProperty("--fb", `${window.innerHeight - r.bottom}px`);
    };
    place();
    addEventListener("resize", place);
    addEventListener("scroll", place, { passive: true });
  }
