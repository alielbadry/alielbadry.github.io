/* ============================================================================
   home.js — the entry gate, boot sequence, hero and demo terminal
   ----------------------------------------------------------------------------
   Flow: Click to Enter -> 2s boot -> hero reveal -> looping terminal.
   The boot is skipped entirely under prefers-reduced-motion and the gate is
   removed from the DOM, so reduced-motion visitors land straight on the hero.
   ========================================================================== */
(function () {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const Lab = window.Lab;

  if (!Lab) return;

  const gate = doc.getElementById("gate");
  const terminal = doc.querySelector("[data-terminal]");
  let started = false;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  /* ------------------------------------------------------------ 1. the gate */
  function openGate() {
    if (started) return;
    started = true;
    root.classList.remove("is-locked");
    root.classList.add("is-entered");
    gate.classList.add("is-open");
    gate.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      gate.hidden = true;
    }, 960);
    /* signal the Live Engagement Terminal that it may start */
    window.dispatchEvent(new CustomEvent("lab:entered"));
    startTerminal();
  }

  function runBoot() {
    const rows = Array.from(gate.querySelectorAll(".boot__row"));
    const bar = gate.querySelector(".boot__bar i");

    gate.classList.add("is-boot");

    /* Start the ambient bed inside the click gesture, so autoplay policy
       allows it. It plays until the Sound toggle is pressed. */
    doc.dispatchEvent(new CustomEvent("lab:audio", { detail: "on" }));

    const marks = [0, 430, 900, 1480];
    rows.forEach((row, i) => {
      window.setTimeout(() => {
        row.classList.add("is-on");
        if (bar) bar.style.width = Math.round(((i + 1) / (rows.length + 1)) * 100) + "%";
      }, marks[i] || 0);
    });

    window.setTimeout(() => {
      if (bar) bar.style.width = "100%";
    }, 1850);

    window.setTimeout(openGate, 2060);
  }

  if (!gate) {
    root.classList.add("is-entered");
  } else if (Lab.REDUCE) {
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
    root.classList.add("is-entered");
    startTerminal();
    window.dispatchEvent(new CustomEvent("lab:entered"));
  } else {
    root.classList.add("is-locked");
    const enter = gate.querySelector(".gate__enter");
    if (enter) {
      enter.addEventListener("click", runBoot);
      enter.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          runBoot();
        }
      });
      window.setTimeout(() => enter.focus({ preventScroll: true }), 380);
    }
    doc.addEventListener("keydown", (e) => {
      if (!started && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        runBoot();
      }
    });
  }

  /* -------------------------------------------------------- 2. the terminal */
  function el(tag, cls, text) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function cursor() {
    return el("span", "term__cursor");
  }

  function startTerminal() {
    if (!terminal || terminal.dataset.running === "true") return;
    terminal.dataset.running = "true";

    let alive = true;
    doc.addEventListener("visibilitychange", () => {
      alive = !doc.hidden;
    });

    const CMD = "curl -s https://api.example.com/v1/users/1042";

    const cycle = async () => {
      while (terminal.dataset.running === "true") {
        terminal.innerHTML = "";

        /* line 1 — the request being sent */
        const line1 = el("div", "term__line");
        const prompt = el("span", "term__p", "$ ");
        const cmd = el("span", "term__ok");
        const caret = cursor();
        line1.append(prompt, cmd, caret);
        terminal.append(line1);

        await Lab.typeText(cmd, CMD, 24);
        await wait(560 + Math.random() * 260);

        /* line 2 — status transition */
        const line2 = el("div", "term__line");
        line2.append(
          el("span", "muted", "403 "),
          el("span", "muted", "expected"),
          el("span", "term__p", "  →  "),
          el("span", "term__ok", "200 "),
          el("span", "term__ok", "returned")
        );
        terminal.append(line2, caret);
        await wait(620);

        /* line 3 — what it means */
        const line3 = el("div", "term__line");
        const finding = el("span", "term__finding", "FINDING: broken object-level authorization ");
        finding.append(el("b", null, "CVSS 4.0"));
        line3.append(finding);
        terminal.append(line3, caret);

        await wait(2400);

        /* line 4 — the loop seam */
        const line4 = el("div", "term__line");
        line4.append(el("span", "muted", "// re-scoping to the next tenant …"));
        terminal.append(line4, caret);

        await wait(1500);

        if (doc.hidden) {
          await new Promise((resolve) => {
            const resume = () => {
              doc.removeEventListener("visibilitychange", resume);
              resolve();
            };
            doc.addEventListener("visibilitychange", resume);
          });
        }
        if (!alive) alive = true;
      }
    };

    cycle();
  }

  /* --------------------------------------------- 3. first-paint safety net */
  window.addEventListener("load", () => {
    // If something upstream failed, never leave the visitor behind the gate.
    if (gate && !started && !gate.hidden) {
      window.setTimeout(() => {
        if (!started) openGate();
      }, 12000);
    }
  });
})();