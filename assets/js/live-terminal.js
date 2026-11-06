/* ============================================================================
   live-terminal.js — "Live Engagement Terminal" (hero component)
   ----------------------------------------------------------------------------
   Self-contained: no deps. All scenario data lives in the SCENARIOS object
   below — edit that object to change commands, output and the panel values.
   On this site it waits for the entry gate (window 'lab:entered' event) before
   it starts; standalone (no #gate) it starts immediately.
   ========================================================================== */
(function () {
  "use strict";

  /* ===================================================================
     SCENARIOS — edit these. All data is fictional (example.com only).
     Line kinds:
       {k:'cmd',  text:'...', cmt:true?}            typed at the shell prompt
       {k:'out'|'note'|'ok'|'warn'|'find', parts} streamed output line
       {k:'bar',  target:0-100, text:'...'}         animated progress bar
       {k:'kv',   label:'...', parts, fx?, cvss?}   report key/value row
     parts: string  OR  array of  string | ['id'|'ok'|'find'|'cmt', text]
       'id'  → light red + decrypt/scramble   'ok' → bright red
       'find'→ hot red                        'cmt'→ grey italic
     fx:'finding' → flashes the line, shifts the frame glow and bumps the
     findings counter. tag:'FINDING' → also pops the FINDING chip.
     =================================================================== */
  var SCENARIOS = {
    recon: {
      severity: "LEAD", sevKind: "violet", cvss: null, ring: 100, findings: 1,
      announce: "Lead queued: exposed source map at api.example.com/static/app.js.map.",
      lines: [
        { k: "cmd", text: "whoami" },
        { k: "out", parts: ["Ali · handle ", ["id", "lool0x01"], " · web & API security researcher"] },
        { k: "cmd", text: "cat scope.txt" },
        { k: "out", parts: ["*.example.com · api.example.com · auth.example.com", ["cmt", "   # fictional target"]] },
        { k: "cmd", text: "subfinder -d example.com -silent | httpx -silent -status-code" },
        { k: "bar", target: 100, text: "214 subdomains · 61 alive" },
        { k: "out", parts: [["id", "https://api.example.com"], "        [", ["ok", "200"], "]"] },
        { k: "out", parts: [["id", "https://auth.example.com"], "       [", ["ok", "302"], "]"] },
        { k: "out", parts: [["id", "https://admin.example.com"], "      [", ["find", "403"], "]", ["cmt", "  ← interesting"]] },
        { k: "cmd", text: "gau example.com | grep -E \"/api/v[0-9]/\" | sort -u | wc -l" },
        { k: "out", parts: [["id", "388"], " endpoints mapped"] },
        { k: "cmd", text: "nuclei -u api.example.com -severity medium,high -silent" },
        { k: "warn", parts: [["find", "⚠ exposed-source-map"], "   ", ["id", "https://api.example.com/static/app.js.map"]], fx: "finding" },
        { k: "ok", parts: ["✓ recon complete · 1 lead queued for manual testing"] }
      ]
    },

    exploit: {
      severity: "CRITICAL", sevKind: "ember", cvss: 9.3, ring: 62, findings: 1,
      announce: "Critical finding: cross-tenant invoice read via broken object-level authorization. CVSS 9.3.",
      lines: [
        { k: "cmd", cmt: true, text: "# log in as tenant A, then ask for tenant B's data" },
        { k: "cmd", text: "curl -s -H \"Authorization: Bearer $TOKEN_A\" https://api.example.com/v1/orgs/1042/invoices" },
        { k: "out", parts: ["403 Forbidden · expected ", ["ok", "✓"]] },
        { k: "cmd", text: "curl -s -H \"Authorization: Bearer $TOKEN_A\" https://api.example.com/v1/orgs/1043/invoices/9001" },
        { k: "find", parts: ["200 OK — tenant B's invoice returned"], fx: "finding", tag: "FINDING" },
        { k: "cmd", text: "ffuf -u https://api.example.com/v1/orgs/FUZZ/invoices -w ids.txt -mc 200 -t 10 -rate 5" },
        { k: "bar", target: 62, text: "hits: 17 · cross-tenant read confirmed" },
        { k: "cmd", text: "diff <(jwt $TOKEN_A) <(jwt $TOKEN_B)" },
        { k: "out", parts: [["find", "- \"tenant\": \"a1042\""], "   ", ["ok", "+ \"tenant\": \"b1043\""]] },
        { k: "note", parts: ["isolation check is missing server-side: the ID is trusted, not the session."] }
      ]
    },

    report: {
      severity: "CRITICAL", sevKind: "ember", cvss: 9.3, ring: 100, findings: 1,
      announce: "Report submitted: cross-tenant invoice read, CVSS 9.3, accepted and resolved.",
      lines: [
        { k: "cmd", text: "report new --class bola --scope tenant-isolation" },
        { k: "kv", label: "Title", parts: ["Cross-tenant invoice read via broken object-level authorization"] },
        { k: "kv", label: "Severity", parts: [["find", "CRITICAL"], " · CVSS 4.0 → ", ["id", "9.3"]], fx: "finding", tag: "FINDING", cvss: true },
        { k: "kv", label: "Impact", parts: ["any authenticated user can read other tenants' billing data (PII)"] },
        { k: "kv", label: "PoC", parts: [["id", "3"], " requests, reproducible, attached"] },
        { k: "kv", label: "Fix", parts: ["enforce tenant ownership checks server-side on every object lookup;"] },
        { k: "kv", label: "", parts: ["derive the tenant from the session, never from the URL or body"] },
        { k: "cmd", text: "report submit --platform hackerone" },
        { k: "ok", parts: [["ok", "✓ submitted"], " · triaged · accepted · resolved"] },
        { k: "bar", target: 100, text: "report complete" }
      ]
    }
  };

  var ORDER = ["recon", "exploit", "report"];
  var CYCLE_MS = 25000;
  var RING_C = 2 * Math.PI * 18;

  var root = document.getElementById("let");
  if (!root) return;

  var q = {
    lines:    root.querySelector(".let__lines"),
    screen:   root.querySelector(".let__screen"),
    tabwrap:  root.querySelector(".let__tabrow"),
    tabs:     Array.prototype.slice.call(root.querySelectorAll(".let__tab")),
    tabline:  root.querySelector(".let__tabline"),
    count:    root.querySelector(".let__count-n"),
    sev:      root.querySelector(".let__sev"),
    cvss:     root.querySelector(".let__cvss-v"),
    ring:     root.querySelector(".let__ring-fg"),
    ringpct:  root.querySelector(".let__ring-t"),
    live:     root.querySelector(".let__sr"),
    frame:    root.querySelector(".let__frame"),
    replay:   root.querySelector('[data-act="replay"]'),
    copy:     root.querySelector('[data-act="copy"]')
  };

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var runId = 0, cur = "recon", lineNo = 0, findings = 0;
  var paused = false, timer = null, pending = null, autoTimer = null, interacted = false;

  var caret = document.createElement("span");
  caret.className = "let__caret";
  caret.setAttribute("aria-hidden", "true");

  /* ---- scheduler (pause-aware) ---- */
  function schedule(fn, ms) {
    pending = { fn: fn };
    if (paused) return;
    clearTimeout(timer);
    timer = setTimeout(function () { pending = null; fn(); }, ms);
  }
  function setPaused(p) {
    if (p === paused) return;
    paused = p;
    if (p) { clearTimeout(timer); clearTimeout(autoTimer); }
    else {
      if (pending) { var fn = pending.fn; timer = setTimeout(function () { pending = null; fn(); }, 0); }
      else scheduleAuto();
    }
  }
  function scheduleAuto() {
    if (interacted || paused) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (paused || interacted) return;
      select(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length], false);
    }, CYCLE_MS);
  }

  /* ---- small helpers ---- */
  function make(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function scramble(node, finalText) {
    if (REDUCE) { node.textContent = finalText; return; }
    var pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-";
    var dur = 420, start = performance.now(), len = finalText.length;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur), out = "", i;
      for (i = 0; i < len; i++) {
        if (i < p * len) out += finalText.charAt(i);
        else if (finalText.charAt(i) === " ") out += " ";
        else out += pool.charAt((Math.random() * pool.length) | 0);
      }
      node.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else node.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }
  function buildParts(parts) {
    var frag = document.createDocumentFragment();
    var list = Array.isArray(parts) ? parts : [parts];
    list.forEach(function (p) {
      if (typeof p === "string") { frag.appendChild(document.createTextNode(p)); return; }
      var role = p[0], txt = p[1];
      var s = make("span", "ln__" + role, txt);
      frag.appendChild(s);
      if (role === "id") scramble(s, txt);
    });
    return frag;
  }
  function plain(parts) {
    if (typeof parts === "string") return parts;
    return (parts || []).map(function (p) { return typeof p === "string" ? p : p[1]; }).join("");
  }
  function placeCaret(node) { caret.parentNode && caret.parentNode.removeChild(caret); if (node) node.appendChild(caret); }
  function scrollScreen() { q.screen.scrollTop = q.screen.scrollHeight; }

  /* ---- panel ---- */
  function setupPanel(scn) {
    findings = 0;
    q.count.textContent = "0";
    q.sev.textContent = scn.severity;
    q.sev.setAttribute("data-sev", scn.sevKind || "none");
    q.cvss.textContent = scn.cvss == null ? "—" : "0.0";
    q.ringpct.textContent = "0%";
    q.ring.style.strokeDashoffset = RING_C;
    requestAnimationFrame(function () {
      q.ring.style.strokeDashoffset = String(RING_C * (1 - scn.ring / 100));
      q.ringpct.textContent = scn.ring + "%";
    });
    if (scn.cvss != null) rollCvss(scn.cvss);
  }
  function rollCvss(target) {
    if (REDUCE) { q.cvss.textContent = target.toFixed(1); return; }
    var dur = 900, start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      q.cvss.textContent = (target * p).toFixed(1);
      if (p < 1) requestAnimationFrame(frame); else q.cvss.textContent = target.toFixed(1);
    }
    requestAnimationFrame(frame);
  }
  function fireFinding(ln, tag, announceText) {
    ln.setAttribute("data-flash", "true");
    setTimeout(function () { ln.setAttribute("data-flash", "false"); }, 620);
    root.setAttribute("data-glow", "ember");
    setTimeout(function () {
      if (root.getAttribute("data-glow") === "ember") root.setAttribute("data-glow", "violet");
    }, 600);
    if (tag) {
      var t = make("span", "let__tag", tag);
      (ln.querySelector(".ln__body") || ln).appendChild(t);
      requestAnimationFrame(function () { t.setAttribute("data-show", "true"); });
    }
    findings += 1;
    q.count.textContent = String(findings);
    if (announceText) q.live.textContent = announceText;
  }

  /* ---- rendering ---- */
  function gapAfter(line) {
    if (line.k === "cmd") return 260 + Math.random() * 170;   // pause before output
    if (line.k === "bar") return 220;
    return 60 + Math.random() * 60;                            // output stagger
  }

  function typeCmd(node, text, done) {
    if (REDUCE) { node.textContent = text; done(); return; }
    var j = 0;
    function tick() {
      node.textContent = text.slice(0, j);
      j += 1;
      scrollScreen();
      if (j <= text.length) schedule(tick, 28 + Math.random() * 27);
      else done();
    }
    schedule(tick, 60);
  }

  function renderBar(ln, body, line, done) {
    var wrap = make("span", "let__barwrap");
    wrap.appendChild(document.createTextNode("["));
    var fill = make("span", "let__barfill");
    var rest = make("span", "let__barrest");
    wrap.appendChild(fill);
    wrap.appendChild(rest);
    wrap.appendChild(document.createTextNode("]"));
    var pct = make("span", "let__barpct", "0%");
    pct.style.marginLeft = "8px";
    wrap.appendChild(pct);
    if (line.text) { var t = make("span", "let__bartxt", line.text); t.style.marginLeft = "10px"; wrap.appendChild(t); }
    body.appendChild(wrap);

    var slots = 10;
    function paint(v) {
      var n = Math.round((v / 100) * slots);
      fill.textContent = new Array(n + 1).join("█");
      rest.textContent = new Array((slots - n) + 1).join("░");
      pct.textContent = v + "%";
    }
    if (REDUCE) { paint(line.target); done(); return; }
    var dur = 700 + Math.random() * 400, start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      paint(Math.round(line.target * p));
      if (p < 1) requestAnimationFrame(frame); else { paint(line.target); done(); }
    }
    requestAnimationFrame(frame);
  }

  function renderLine(line, done) {
    lineNo += 1;
    var ln = make("div", "ln");
    ln.setAttribute("data-k", line.k || "out");
    var no = make("span", "ln__no", String(lineNo));
    no.setAttribute("aria-hidden", "true");
    ln.appendChild(no);
    var body = make("span", "ln__body");
    ln.appendChild(body);
    q.lines.appendChild(ln);
    scrollScreen();

    if (line.k === "cmd") {
      body.appendChild(make("span", "ln__ps", "lool0x01@hunt"));
      body.appendChild(make("span", "ln__sig", ":~$"));
      body.appendChild(document.createTextNode(" "));
      var typed = make("span", line.cmt ? "ln__cmt" : "ln__cmd");
      body.appendChild(typed);
      placeCaret(typed);
      typeCmd(typed, line.text, done);
      return;
    }

    if (line.k === "bar") { renderBar(ln, body, line, done); return; }

    if (line.k === "kv") {
      var label = (line.label || "").padEnd(9, " ");
      body.appendChild(document.createTextNode(label + (line.label ? " : " : "   ")));
      body.appendChild(buildParts(line.parts));
      if (line.fx === "finding") fireFinding(ln, line.tag, SCENARIOS[cur].announce);
      animateIn(ln, done);
      return;
    }

    body.appendChild(buildParts(line.parts || line.text));
    if (line.k === "find" || line.fx === "finding") fireFinding(ln, line.tag, SCENARIOS[cur].announce);
    animateIn(ln, done);
  }

  function animateIn(ln, done) {
    if (REDUCE) { placeCaret(ln.querySelector(".ln__body")); done(); return; }
    ln.style.opacity = "0";
    ln.style.transform = "translateY(4px)";
    requestAnimationFrame(function () {
      ln.style.transition = "opacity .28s cubic-bezier(.65,.05,0,1), transform .28s cubic-bezier(.65,.05,0,1)";
      ln.style.opacity = "1";
      ln.style.transform = "none";
    });
    placeCaret(ln.querySelector(".ln__body"));
    done();
  }

  function renderInstant(line) {
    lineNo += 1;
    var ln = make("div", "ln");
    ln.setAttribute("data-k", line.k || "out");
    var no = make("span", "ln__no", String(lineNo));
    no.setAttribute("aria-hidden", "true");
    ln.appendChild(no);
    var body = make("span", "ln__body");
    ln.appendChild(body);
    q.lines.appendChild(ln);
    if (line.k === "cmd") {
      body.appendChild(make("span", "ln__ps", "lool0x01@hunt"));
      body.appendChild(make("span", "ln__sig", ":~$"));
      body.appendChild(document.createTextNode(" "));
      body.appendChild(make("span", line.cmt ? "ln__cmt" : "ln__cmd", line.text));
    } else if (line.k === "bar") {
      var slots = 10, n = Math.round(line.target / 100 * slots);
      body.appendChild(document.createTextNode("[" + new Array(n + 1).join("█") + new Array((slots - n) + 1).join("░") + "] " + line.target + "%" + (line.text ? "  " + line.text : "")));
    } else if (line.k === "kv") {
      var label = (line.label || "").padEnd(9, " ");
      body.appendChild(document.createTextNode(label + (line.label ? " : " : "   ")));
      body.appendChild(buildParts(line.parts));
    } else {
      body.appendChild(buildParts(line.parts || line.text));
    }
    if (line.tag) { var t = make("span", "let__tag", line.tag); t.setAttribute("data-show", "true"); t.style.opacity = "1"; t.style.transform = "none"; body.appendChild(t); }
  }

  /* ---- scenario runner ---- */
  function runScenario(key) {
    var id = ++runId;
    clearTimeout(timer); pending = null; clearTimeout(autoTimer);
    var scn = SCENARIOS[key];
    lineNo = 0;
    q.lines.innerHTML = "";
    root.removeAttribute("data-glow");
    setupPanel(scn);

    if (REDUCE) {
      scn.lines.forEach(renderInstant);
      findings = scn.findings;
      q.count.textContent = String(findings);
      q.cvss.textContent = scn.cvss == null ? "—" : scn.cvss.toFixed(1);
      q.ring.style.strokeDashoffset = String(RING_C * (1 - scn.ring / 100));
      q.ringpct.textContent = scn.ring + "%";
      q.live.textContent = scn.announce;
      scrollScreen();
      scheduleAuto();
      return;
    }

    var i = 0;
    function step() {
      if (id !== runId) return;
      if (i >= scn.lines.length) { scheduleAuto(); return; }
      var line = scn.lines[i++];
      renderLine(line, function () {
        if (id !== runId) return;
        schedule(step, gapAfter(line));
      });
    }
    step();
  }

  /* ---- tabs ---- */
  function moveTabline() {
    var active = q.tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
    if (!active) return;
    var r = active.getBoundingClientRect(), pr = q.tabwrap.getBoundingClientRect();
    q.tabline.style.width = r.width + "px";
    q.tabline.style.transform = "translateX(" + (r.left - pr.left) + "px)";
  }
  function select(key, user) {
    if (user) { interacted = true; clearTimeout(autoTimer); }
    cur = key;
    q.tabs.forEach(function (t) {
      var on = t.getAttribute("data-scn") === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on) q.screen.setAttribute("aria-labelledby", t.id);
    });
    moveTabline();
    runScenario(key);
  }
  q.tabs.forEach(function (tab, idx) {
    tab.addEventListener("click", function () { select(tab.getAttribute("data-scn"), true); });
    tab.addEventListener("keydown", function (e) {
      var n = null;
      if (e.key === "ArrowRight") n = (idx + 1) % q.tabs.length;
      else if (e.key === "ArrowLeft") n = (idx - 1 + q.tabs.length) % q.tabs.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = q.tabs.length - 1;
      if (n != null) {
        e.preventDefault();
        q.tabs[n].focus();
        select(q.tabs[n].getAttribute("data-scn"), true);
      }
    });
  });

  /* ---- actions ---- */
  q.replay.addEventListener("click", function () { interacted = true; clearTimeout(autoTimer); runScenario(cur); });
  q.copy.addEventListener("click", function () {
    interacted = true; clearTimeout(autoTimer);
    var txt = scenarioText(cur);
    var done = function () {
      q.copy.setAttribute("data-done", "true");
      q.copy.textContent = "Copied";
      setTimeout(function () { q.copy.setAttribute("data-done", "false"); q.copy.textContent = "Copy"; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  });
  function scenarioText(key) {
    return SCENARIOS[key].lines.map(function (ln) {
      if (ln.k === "cmd") return "lool0x01@hunt:~$ " + ln.text;
      if (ln.k === "bar") return "[" + new Array(11).join("█") + "] " + ln.target + "%  " + (ln.text || "");
      if (ln.k === "kv") return (((ln.label || "") + "        ").slice(0, 9)) + (ln.label ? " : " : "   ") + plain(ln.parts);
      return plain(ln.parts || ln.text);
    }).join("\n");
  }

  /* ---- pause off-screen / hidden ---- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { setPaused(!en.isIntersecting); });
    }, { threshold: 0.12 }).observe(root);
  }
  document.addEventListener("visibilitychange", function () { setPaused(document.hidden); });
  window.addEventListener("resize", moveTabline);

  /* ---- start (wait for the site's entry gate when present) ---- */
  function start() { select("recon", false); }
  window.LiveEngagementTerminal = { start: start, select: select };

  var gateEl = document.getElementById("gate");
  var behindGate = gateEl && !gateEl.hidden &&
    !document.documentElement.classList.contains("is-entered");
  if (behindGate) {
    window.addEventListener("lab:entered", function () { start(); }, { once: true });
  } else {
    start();
  }
})();
