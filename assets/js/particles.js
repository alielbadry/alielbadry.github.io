/* ============================================================================
   particles.js — the "attack surface" field
   ----------------------------------------------------------------------------
   A raw-canvas constellation that sits behind every page. Design intent:

     · unnamed nodes  = the generic surface (drift, link within range)
     · labelled nodes = api. / admin. / auth. / /v1/users — the interesting parts
     · lime pings     = a finding landing on a labelled node, tagged IDOR,
                        SSRF or BOLA, then fading out

   Pointer repels nodes; holding the pointer down attracts them. The loop stops
   completely while the tab is hidden and never starts under
   prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("field");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.hidden = true;
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const LINK = 148;
  const REPEL = 168;
  const TAGS = ["IDOR", "SSRF", "BOLA"];

  let W = 0;
  let H = 0;
  let dpr = 1;
  let nodes = [];
  let labels = [];
  let pings = [];
  let raf = 0;
  let running = false;
  let last = 0;
  let nextPing = 0;

  const pointer = { x: -9999, y: -9999, down: false, active: false };
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ------------------------------------------------------------- geometry */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    const count = Math.round(Math.min(78, Math.max(26, (W * H) / 26000)));

    nodes = Array.from({ length: count }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-0.16, 0.16),
      vy: rand(-0.16, 0.16),
      r: rand(0.7, 1.8),
      o: rand(0.18, 0.5)
    }));

    // labelled nodes, kept in the margins so they never sit under body copy
    const spots = [
      { t: "api.", x: 0.12, y: 0.24 },
      { t: "admin.", x: 0.86, y: 0.32 },
      { t: "auth.", x: 0.17, y: 0.74 },
      { t: "/v1/users", x: 0.82, y: 0.82 }
    ];

    labels = spots.map((s) => ({
      t: s.t,
      x: s.x * W,
      y: s.y * H,
      bx: s.x * W,
      by: s.y * H,
      phase: rand(0, Math.PI * 2),
      r: 2.4
    }));
  }

  /* --------------------------------------------------------------- motion */
  function step(now) {
    raf = 0;
    if (!running) return;

    const dt = Math.min(34, now - last || 16) / 16.67;
    last = now;

    ctx.clearRect(0, 0, W, H);

    /* connections between generic nodes */
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        const t = 1 - Math.sqrt(d2) / LINK;
        ctx.strokeStyle = "rgba(255,255,255," + (t * 0.09).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    /* generic nodes */
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];

      if (pointer.active) {
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REPEL && dist > 0.001) {
          const force = (1 - dist / REPEL) * (pointer.down ? -0.5 : 0.9);
          n.vx += (dx / dist) * force * 0.06;
          n.vy += (dy / dist) * force * 0.06;
        }
      }

      n.vx *= 0.995;
      n.vy *= 0.995;
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(230,230,236," + n.o.toFixed(2) + ")";
      ctx.fill();
    }

    /* labelled nodes + links to their nearest neighbours */
    const t = now / 1000;
    labels.forEach((l) => {
      l.x = l.bx + Math.cos(t * 0.32 + l.phase) * 16;
      l.y = l.by + Math.sin(t * 0.27 + l.phase) * 13;

      let linked = 0;
      for (let i = 0; i < nodes.length && linked < 3; i += 1) {
        const n = nodes[i];
        const dx = n.x - l.x;
        const dy = n.y - l.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LINK * 1.25) continue;
        linked += 1;
        const alpha = (1 - dist / (LINK * 1.25)) * 0.2;
        ctx.strokeStyle = "rgba(234,40,69," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(234,40,69,0.85)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(l.x, l.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(234,40,69,0.22)";
      ctx.stroke();

      ctx.font = "300 11px 'Geist Mono', 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(155,154,154,0.62)";
      ctx.textBaseline = "middle";
      ctx.fillText(l.t, l.x + 13, l.y + 1);
    });

    /* finding pings */
    if (now > nextPing && labels.length) {
      nextPing = now + rand(2100, 3600);
      const host = labels[Math.floor(Math.random() * labels.length)];
      pings.push({
        x: host.x,
        y: host.y,
        tag: TAGS[Math.floor(Math.random() * TAGS.length)],
        born: now,
        life: rand(1800, 2400)
      });
    }

    pings = pings.filter((p) => {
      const age = (now - p.born) / p.life;
      if (age >= 1) return false;

      const radius = 6 + age * 46;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,82,82," + ((1 - age) * 0.5).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,82,82," + (1 - age).toFixed(3) + ")";
      ctx.fill();

      const pad = 5;
      ctx.font = "400 9px 'Geist Mono', 'JetBrains Mono', monospace";
      const w = ctx.measureText(p.tag).width + pad * 2;
      const bx = p.x + 10;
      const by = p.y - 20 - age * 14;
      ctx.beginPath();
      ctx.rect(bx, by, w, 15);
      ctx.fillStyle = "rgba(6,5,6," + ((1 - age) * 0.85).toFixed(3) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,82,82," + ((1 - age) * 0.4).toFixed(3) + ")";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,82,82," + (1 - age).toFixed(3) + ")";
      ctx.textBaseline = "middle";
      ctx.fillText(p.tag, bx + pad, by + 8);

      return true;
    });

    raf = window.requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    nextPing = last + 900;
    raf = window.requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  /* -------------------------------------------------------------- plumbing */
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener(
    "pointerdown",
    () => {
      pointer.down = true;
    },
    { passive: true }
  );

  window.addEventListener("pointerup", () => {
    pointer.down = false;
  });

  doc_visibility();

  function doc_visibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
        canvas.classList.add("is-paused");
      } else {
        canvas.classList.remove("is-paused");
        start();
      }
    });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 180);
  });

  resize();
  start();
})();