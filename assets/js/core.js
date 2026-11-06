/* ============================================================================
   core.js — chrome behaviour shared by every page
   ----------------------------------------------------------------------------
   No dependencies. Native IntersectionObserver + requestAnimationFrame drive
   the motion layer, so the site works offline, from file://, and on a static
   host with zero build step.

   Exposed as window.Lab for the page-specific scripts:
     Lab.data(name)        -> Promise<SITE_DATA[name]>   (JSON, then fallback)
     Lab.wipeTo(url)       -> play the page transition, then navigate
     Lab.reveal()          -> (re)wire [data-reveal] elements
     Lab.countUp(el)       -> animate a [data-count] element
     Lab.typeText(el, str) -> typewriter helper used by the hero terminal
     Lab.tilt()/magnet()   -> (re)wire 3D tilt / magnetic-chips on new DOM
     Lab.scramble(el)      -> settle-scramble a text node
     Lab.reduce            -> prefers-reduced-motion
     Lab.touch             -> coarse pointer / no hover
   ========================================================================== */
(function () {
  "use strict";

  const doc = document;
  const root = doc.documentElement;

  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------------------------------------------------------------- config */
  const SITE = {
    name: "Ali Taher",
    alias: "lool0x01",
    email: "alielbadry365@gmail.com",
    location: "lool0x01",
    cv: "assets/Ali-Taher-CV.pdf",
    links: {
      github: "https://github.com/alielbadry",
      hackerone: "https://hackerone.com/lool0x01",
      yeswehack: "https://yeswehack.com/hunters/lool0x01",
      linkedin: "https://www.linkedin.com/in/alielbadry365/"
    }
  };
  window.SITE = SITE;

  /* --------------------------------------------------------------- helpers */
  const $ = (sel, ctx) => (ctx || doc).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  /* ------------------------------------------------------------------ data */
  const cache = Object.create(null);

  function data(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    const url = "assets/data/" + name + ".json";
    return fetch(url, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(() => (window.SITE_DATA && window.SITE_DATA[name]) || null)
      .then((value) => {
        cache[name] = value;
        return value;
      });
  }

  /* --------------------------------------------------------------- 1. nav */
  function initNav() {
    const nav = $(".nav");
    const burger = $(".nav__burger");
    const panel = $(".nav__panel");

    if (nav) {
      const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 12);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (burger && panel) {
      const setOpen = (open) => {
        burger.setAttribute("aria-expanded", String(open));
        panel.classList.toggle("is-open", open);
        panel.inert = !open;
      };
      setOpen(false);
      burger.addEventListener("click", () => {
        setOpen(burger.getAttribute("aria-expanded") !== "true");
      });
      panel.addEventListener("click", (e) => {
        if (e.target.closest("a")) setOpen(false);
      });
      doc.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setOpen(false);
      });
    }
  }

  /* ------------------------------------------------- 2. page transitions */
  function wipeTo(url) {
    const wipe = $("#wipe");
    if (!wipe || REDUCE) {
      window.location.href = url;
      return;
    }
    if (wipe.dataset.state === "covering") return;
    wipe.dataset.state = "covering";
    window.setTimeout(() => {
      window.location.href = url;
    }, 840);
  }

  function initTransitions() {
    const wipe = $("#wipe");
    if (wipe) {
      if (REDUCE) {
        wipe.dataset.state = "";
      } else {
        // On arrival the panels are covering; slide them away.
        wipe.dataset.state = "revealing";
        window.setTimeout(() => {
          wipe.dataset.state = "";
        }, 900);
      }
    }

    doc.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      if (/^(mailto:|tel:|https?:)/i.test(href)) return;
      if (!/\.html(\?|#|$)/i.test(href)) return;
      e.preventDefault();
      wipeTo(a.href);
    });

    // Coming back via bfcache: re-arm scroll-driven state.
    window.addEventListener("pageshow", (e) => {
      if (e.persisted && wipe) wipe.dataset.state = "";
    });
  }

  /* ------------------------------------------------------ 3. scroll meter */
  function initProgress() {
    const bar = $(".progress__bar");
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = doc.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
      bar.style.setProperty("--p", p.toFixed(4));
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!raf) raf = window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  /* ----------------------------------------------------------- 4. reveals */
  function reveal() {
    const els = $$("[data-reveal]");
    if (!els.length) return;

    if (REDUCE || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.dataset.delay) el.style.setProperty("--d", el.dataset.delay + "ms");
          el.classList.add("is-in");
          if (el.matches("[data-count]")) runCount(el);
          el.querySelectorAll("[data-count]").forEach(runCount);
          if (el.matches("[data-scramble]")) scramble(el);
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );

    els.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------- 5. count-up */
  function countUp(el) {
    const target = parseFloat(el.dataset.count || "0");
    const dur = parseInt(el.dataset.dur || "1500", 10);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const host = el.closest(".stat__num, .bigstat__num") || el;

    const render = (v) => {
      let out = decimals ? v.toFixed(decimals) : String(Math.round(v));
      const pad = parseInt(el.dataset.pad || "0", 10);
      if (pad) out = out.padStart(pad, "0");
      el.textContent = out;
    };

    if (REDUCE) {
      render(target);
      return;
    }

    host.classList.add("is-rolling");
    const start = performance.now();
    const from = 0;

    const step = (now) => {
      const t = clamp((now - start) / dur, 0, 1);
      render(lerp(from, target, easeOutExpo(t)));
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else {
        render(target);
        host.classList.remove("is-rolling");
      }
    };
    window.requestAnimationFrame(step);
  }

  /* Guarded wrapper so a [data-count] node only ever animates once, however
     many times its reveal ancestor fires (filters, re-renders, bfcache). */
  function runCount(el) {
    if (!el || el.dataset.counted === "true") return;
    el.dataset.counted = "true";
    countUp(el);
  }

  /* -------------------------------------------------- 6. marquee reversal */
  function initMarquees() {
    /* The marquee is CSS-only: it drifts left at a constant speed and never
       reverses on scroll or pauses on hover. Kept as a hook for future tune. */
  }

  /* ---------------------------------------------------------- 7. scramble */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#_%";

  function scramble(el) {
    if (REDUCE) return;
    const final = el.dataset.scramble || el.textContent;
    el.dataset.scramble = final;
    const total = final.length;
    const ticks = 16;
    let frame = 0;

    const run = () => {
      frame += 1;
      const revealed = Math.floor((frame / ticks) * total);
      let out = "";
      for (let i = 0; i < total; i += 1) {
        const ch = final.charAt(i);
        if (i < revealed || ch === " ") {
          out += ch;
        } else {
          out += GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        }
      }
      el.textContent = out;
      if (frame < ticks) {
        window.requestAnimationFrame(run);
      } else {
        el.textContent = final;
      }
    };
    window.requestAnimationFrame(run);
  }

  /* ------------------------------------------------------------ 8. cursor */
  function initCursor() {
    const cursor = $("#cursor");
    if (!cursor || TOUCH) return;

    const dot = $(".cursor__dot", cursor);
    const ring = $(".cursor__ring", cursor);
    const label = $(".cursor__label", cursor);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let started = false;
    let raf = 0;

    const loop = () => {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      label.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      raf = window.requestAnimationFrame(loop);
    };

    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType === "touch") return;
        mx = e.clientX;
        my = e.clientY;
        if (!started) {
          started = true;
          cursor.classList.add("is-live");
          window.requestAnimationFrame(loop);
        }
        const view = e.target.closest("[data-cursor], a, button");
        const wants = view && view.closest("[data-cursor='view']");
        cursor.classList.toggle("is-view", Boolean(wants));
        if (wants) label.textContent = wants.dataset.cursorLabel || "View";
      },
      { passive: true }
    );

    window.addEventListener("pointerleave", () => {
      cursor.classList.remove("is-live");
      started = false;
      if (raf) window.cancelAnimationFrame(raf);
    });
  }

  /* -------------------------------------------------------------- 9. tilt */
  function initTilt() {
    if (REDUCE || TOUCH) return;
    $$("[data-tilt]").forEach((el) => {
      if (el.dataset.tiltReady === "true") return;
      el.dataset.tiltReady = "true";
      const max = parseFloat(el.dataset.tilt || "6");
      const move = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (px * max * 2).toFixed(2) + "deg");
        el.style.setProperty("--rx", (-py * max * 2).toFixed(2) + "deg");
      };
      const reset = () => {
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
      };
      el.addEventListener("pointermove", move, { passive: true });
      el.addEventListener("pointerleave", reset);
    });
  }

  /* ------------------------------------------------------------ 10. magnet */
  function initMagnet() {
    if (REDUCE || TOUCH) return;
    $$("[data-magnet]").forEach((el) => {
      if (el.dataset.magnetReady === "true") return;
      el.dataset.magnetReady = "true";
      const strength = parseFloat(el.dataset.magnet || "5");
      const move = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", ((px - 0.5) * strength * 2).toFixed(2) + "px");
        el.style.setProperty("--my", ((py - 0.5) * strength * 2).toFixed(2) + "px");
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      };
      const reset = () => {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      };
      el.addEventListener("pointermove", move, { passive: true });
      el.addEventListener("pointerleave", reset);
    });
  }

  /* ------------------------------------------------------------- 11. audio */
  /* Ambient bed — a single looping track (assets/audio/ambient.mp3). The bed
     fades in on the gate's "Click to Enter" gesture. The Sound toggle is a
     pause/resume control: it fades the bed out and pauses it, and the next
     click resumes from the exact point it stopped (no rewind). */
  function initAudio() {
    const btn = $(".audio");
    if (!btn) return;

    const KEY = "lool0x01:audio";
    const TARGET = 0.7;            /* bed level */
    const FADE = 1400;             /* fade-in on start */
    const SRC = "assets/audio/ambient.mp3?v=2";

    let bed = null;
    let on = false;
    let gen = 0;

    const note = (msg) => {
      btn.title = msg;
    };

    function track() {
      if (bed) return bed;
      const audio = new window.Audio(SRC);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      audio.addEventListener("error", () => {
        btn.dataset.missing = "true";
        note("Ambient source unavailable");
      });
      bed = audio;
      return audio;
    }

    function ramp(audio, from, to, delay, ms, g) {
      window.setTimeout(() => {
        if (g !== gen || !audio) return;
        audio.volume = clamp(from, 0, 1);
        const t0 = performance.now();
        const tick = (now) => {
          if (g !== gen) return;
          const p = clamp((now - t0) / ms, 0, 1);
          audio.volume = clamp(lerp(from, to, p), 0, 1);
          if (p < 1) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }, delay);
    }

    const start = () => {
      const audio = track();
      gen += 1;
      const g = gen;
      note("");
      /* No rewind: a freshly created element already sits at 0, and every
         later start resumes from wherever the bed was paused. */
      audio.volume = 0;
      audio.play().then(() => {
        if (g !== gen) return;
        ramp(audio, 0, TARGET, 0, FADE, g);
      }).catch(() => {
        if (g !== gen) return;
        on = false;
        btn.setAttribute("aria-pressed", "false");
        note("Your browser blocked playback — click again to retry");
      });
    };

    const stop = () => {
      gen += 1;
      const g = gen;
      if (!bed) return;
      ramp(bed, bed.volume, 0, 0, 420, g);
      window.setTimeout(() => {
        if (g !== gen) return;
        if (bed) bed.pause();
      }, 460);
    };

    const setOn = (next) => {
      on = next;
      btn.setAttribute("aria-pressed", String(next));
      try {
        window.localStorage.setItem(KEY, next ? "on" : "off");
      } catch (err) {
        /* private mode — preference simply not remembered */
      }
      if (next) start();
      else stop();
    };

    btn.addEventListener("click", () => setOn(!on));

    /* The gate's "Click to Enter" is the user gesture that starts the bed.
       After that the Sound toggle pauses/resumes it; it never rewinds. */
    doc.addEventListener("lab:audio", (e) => {
      const want = e.detail !== "off";
      if (want && !on) setOn(true);
      else if (!want && on) setOn(false);
    });

    doc.addEventListener("visibilitychange", () => {
      if (!bed) return;
      if (doc.hidden) {
        bed.pause();
      } else if (on) {
        bed.play().catch(() => {});
      }
    });

    // Restore the remembered preference, but never autoplay without a gesture.
    let saved = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch (err) {
      saved = null;
    }
    if (saved === "on") {
      on = true;
      btn.setAttribute("aria-pressed", "true");
      const arm = () => {
        doc.removeEventListener("pointerdown", arm);
        if (on) start();
      };
      doc.addEventListener("pointerdown", arm, { once: true });
    }
  }

  /* ------------------------------------------------- 12b. background stars */
  /* A drifting, twinkling starfield drawn on a fixed canvas behind the page —
     the same recipe (1 star per ~9000px², alpha bounce between 0.08 and 1) the
     v4 build uses for its big-statement band, lifted to a site-wide backdrop. */
  function initStars() {
    if (REDUCE) return;

    const cv = doc.createElement("canvas");
    cv.className = "stars-canvas";
    cv.setAttribute("aria-hidden", "true");

    const anchor = doc.querySelector(".field-canvas");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(cv, anchor);
    else doc.body.insertBefore(cv, doc.body.firstChild);

    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) {
      cv.remove();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let stars = [];
    let raf = 0;

    function size() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      W = cv.width = Math.round(w * dpr);
      H = cv.height = Math.round(h * dpr);
      cv.style.width = w + "px";
      cv.style.height = h + "px";

      const count = Math.max(60, Math.round((w * h) / 9000));
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.2 * dpr + 0.3,
          a: Math.random(),
          d: Math.random() * 0.02 + 0.004
        });
      }
      paint();
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.globalAlpha = s.a * 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283185);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick(t) {
      raf = window.requestAnimationFrame(tick);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.a += s.d;
        if (s.a > 1 || s.a < 0.08) s.d *= -1;
      }
      paint();
    }

    function start() {
      if (!raf) raf = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    size();
    start();

    window.addEventListener("resize", size);
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) stop();
      else start();
    });
  }

  /* ---------------------------------------------- 12c. big statement */
  /* The v4 statement band: a sentence that lights up word by word as it
     travels through the viewport, over its own twinkling starfield. */
  function initStatement() {
    const stmt = $("#statementText");
    if (!stmt) return;

    const words = stmt.textContent.trim().split(/\s+/);
    stmt.innerHTML = words
      .map((w) => {
        const hot = /(shows|actually|run)/i.test(w.replace(/[^a-z]/gi, "")) ? " hot" : "";
        return '<span class="w' + hot + '">' + w + "</span>";
      })
      .join(" ");

    const spans = $$(".w", stmt);
    if (!spans.length) return;

    const lit = () => {
      const r = stmt.getBoundingClientRect();
      const start = window.innerHeight * 0.85;
      const end = window.innerHeight * 0.35;
      let p = (start - r.top) / (start - end);
      p = Math.max(0, Math.min(1, p));
      const n = Math.round(p * spans.length);
      for (let i = 0; i < spans.length; i++) spans[i].classList.toggle("on", i < n);
    };

    lit();
    window.addEventListener("scroll", lit, { passive: true });
    window.addEventListener("resize", lit);
  }

  function initStarfield(cv) {
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let stars = [];
    let raf = 0;

    function paint() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.globalAlpha = s.a * 0.7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283185);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function size() {
      const r = cv.getBoundingClientRect();
      W = cv.width = Math.max(1, Math.round(r.width * dpr));
      H = cv.height = Math.max(1, Math.round(r.height * dpr));
      const count = Math.round((r.width * r.height) / 9000);
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.2 * dpr + 0.3,
          a: Math.random(),
          d: Math.random() * 0.02 + 0.004
        });
      }
      paint();
    }

    function tick(t) {
      raf = window.requestAnimationFrame(tick);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.a += s.d;
        if (s.a > 1 || s.a < 0.08) s.d *= -1;
      }
      paint();
    }

    function start() {
      if (!raf) raf = window.requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    size();
    if (REDUCE) return;

    start();
    window.addEventListener("resize", size);
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) stop();
      else start();
    });
    /* re-seed if the band resizes (fonts landing, viewport change) */
    if ("ResizeObserver" in window) {
      let t = 0;
      new window.ResizeObserver(() => {
        window.clearTimeout(t);
        t = window.setTimeout(size, 120);
      }).observe(cv);
    }
  }

  function initStatementStars() {
    const cv = $(".bigstatement__stars");
    if (cv) initStarfield(cv);
  }

  /* -------------------------------------------------- 12. typewriter helper */
  function typeText(el, text, speed) {
    return new Promise((resolve) => {
      if (REDUCE || !el) {
        if (el) el.textContent = text;
        resolve();
        return;
      }
      const delay = speed || 26;
      let i = 0;
      const tick = () => {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i < text.length) {
          window.setTimeout(tick, delay + Math.random() * delay * 0.9);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  /* ---------------------------------------------------------------- 13. boot */
  const Lab = {
    data,
    wipeTo,
    reveal,
    countUp,
    scramble,
    typeText,
    tilt: initTilt,
    magnet: initMagnet,
    SITE,
    REDUCE,
    TOUCH,
    $,
    $$
  };
  window.Lab = Lab;

  function init() {
    // Inner pages have no entry gate; reveal state must be armed immediately.
    if (!doc.getElementById("gate")) root.classList.add("is-entered");

    initNav();
    initTransitions();
    initProgress();
    initStars();
    initStatement();
    initStatementStars();
    initMarquees();
    initCursor();
    initTilt();
    initMagnet();
    initAudio();
    reveal();

    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    doc.dispatchEvent(new CustomEvent("lab:ready"));

    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(() => doc.dispatchEvent(new CustomEvent("lab:fonts")));
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();