/* ============================================================================
   pages.js — inner-page rendering: skills, certifications, projects, contact
   ----------------------------------------------------------------------------
   Every list here is rendered from assets/data/*.json (with the data.js mirror
   as a file:// fallback). Nothing is hard-coded into the markup, so adding an
   item means editing one JSON file.
   ========================================================================== */
(function () {
  "use strict";

  const doc = document;
  const Lab = window.Lab;
  if (!Lab) return;

  const { $, $$, data } = Lab;

  const el = (tag, cls, text) => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* -------------------------------------------------------------- 1. skills */
  function initSkills() {
    const host = $("#skills-root");
    if (!host) return;

    data("skills").then((payload) => {
      if (!payload || !payload.groups) return;

      const filter = el("div", "filter");
      filter.setAttribute("role", "tablist");
      filter.setAttribute("aria-label", "Filter by category");

      const groups = payload.groups.map((group) => {
        const section = el("section", "skill-group");
        section.dataset.group = group.id;
        section.dataset.reveal = "";

        const head = el("div", "section__head");
        const title = el("h2", "eyebrow");
        title.append(
          el("span", "eyebrow__brace", "{"),
          el("span", null, group.label),
          el("span", "eyebrow__brace", "}"),
          el("span", "eyebrow__dash", "_"),
          el("span", "eyebrow__rule")
        );
        const count = el("span", "small", String(group.items.length).padStart(2, "0") + " items");
        head.append(title, count);

        const list = el("ul", "chips chips--grid");
        group.items.forEach((item, i) => {
          const li = el("li", "chip");
          li.dataset.cat = group.id;
          li.dataset.magnet = "4";
          li.append(
            el("span", "chip__dot"),
            el("span", "chip__label", item),
            el("span", "chip__idx", String(i + 1).padStart(2, "0"))
          );
          list.append(li);
        });

        section.append(head, list);
        return { group, section };
      });

      const total = payload.groups.reduce((n, g) => n + g.items.length, 0);
      const tabs = [{ id: "all", label: "All", count: total }].concat(
        payload.groups.map((g) => ({ id: g.id, label: g.filter || g.label, count: g.items.length }))
      );

      tabs.forEach((tab, i) => {
        const btn = el("button", "filter__btn");
        btn.type = "button";
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", String(i === 0));
        btn.dataset.filter = tab.id;
        btn.append(el("span", null, tab.label), el("b", null, String(tab.count)));
        filter.append(btn);
      });

      host.append(filter);
      groups.forEach(({ section }) => host.append(section));
      // reveal on first render — without this the [data-reveal] sections stay
      // at opacity 0 until a filter click re-runs Lab.reveal().
      Lab.reveal();

      const apply = (id) => {
        $$(".filter__btn", filter).forEach((btn) => {
          btn.setAttribute("aria-selected", String(btn.dataset.filter === id));
        });

        groups.forEach(({ group, section }) => {
          const show = id === "all" || id === group.id;
          section.hidden = !show;
          if (!show) return;

          // light stagger so the switch reads as a state change, not a reload
          if (Lab.REDUCE) return;
          $$(".chip", section).forEach((chip, i) => {
            chip.animate(
              [
                { opacity: 0, transform: "translateY(10px)" },
                { opacity: 1, transform: "translateY(0)" }
              ],
              { duration: 420, delay: i * 28, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "both" }
            );
          });
        });

        Lab.reveal();
      };

      // Wire the chips now that they exist (init ran before this render).
      if (typeof Lab.magnet === "function") Lab.magnet();

      filter.addEventListener("click", (e) => {
        const btn = e.target.closest(".filter__btn");
        if (!btn) return;
        apply(btn.dataset.filter);
      });

      filter.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const all = $$(".filter__btn", filter);
        const current = all.indexOf(doc.activeElement);
        if (current < 0) return;
        e.preventDefault();
        const next = all[(current + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
        next.focus();
        apply(next.dataset.filter);
      });
    });
  }

  /* ----------------------------------------------- 2. projects (placeholders) */
  function initProjects() {
    const host = $("#projects-root");
    if (!host) return;

    data("projects").then((payload) => {
      if (!payload || !payload.items) return;

      payload.items.forEach((item, i) => {
        const placeholder = item.placeholder !== false;
        const card = el("article", "project");
        if (placeholder) card.dataset.placeholder = "true";
        card.dataset.reveal = "";
        card.dataset.delay = String(i * 90);

        const top = el("div", "project__top");
        top.append(el("span", "project__idx", item.index || String(i + 1).padStart(2, "0")));
        if (placeholder) top.append(el("span", "pill pill--dashed", item.status || "Add details"));

        card.append(top);
        card.append(el("h3", "project__title", item.title));
        card.append(el("p", "project__desc", item.summary));

        if (item.tags && item.tags.length) {
          const meta = el("div", "project__meta");
          item.tags.forEach((tag) => meta.append(el("span", null, tag)));
          card.append(meta);
        }

        if (!placeholder && item.link) {
          const link = el("a", "project__link", item.linkLabel || "View project");
          link.href = item.link;
          link.target = "_blank";
          link.rel = "noopener noreferrer me";
          card.append(link);
        }

        if (placeholder) {
          card.append(el("p", "project__todo", "Placeholder — no client work, CVE or bounty is claimed here"));
        }

        host.append(card);
      });

      Lab.reveal();
    });
  }

  /* ------------------------------------------------------- 3. certifications */
  function initCerts() {
    const host = $("#certs-root");
    if (!host) return;

    data("certifications").then((payload) => {
      if (!payload || !payload.items) return;

      payload.items.forEach((item, i) => {
        const plate = el("article", "plate");
        plate.dataset.tilt = "5";
        plate.dataset.reveal = "";
        plate.dataset.delay = String(i * 80);

        const inner = el("div", "plate__inner");
        const top = el("div", "plate__top");
        top.append(
          el("span", null, item.issuer),
          el("span", "plate__no", item.index || String(i + 1).padStart(2, "0"))
        );

        inner.append(
          top,
          el("h3", "plate__title", item.title),
          el("p", "plate__sub", item.subtitle || ""),
          el("span", "plate__seal", "★")
        );

        plate.append(inner);
        host.append(plate);
      });

      if (typeof Lab.tilt === "function") Lab.tilt();
      Lab.reveal();
    });
  }

  /* ------------------------------------------------- 4. contact form + copy */
  function flash(node, message) {
    const original = node.dataset.label || node.textContent;
    node.dataset.label = original;
    node.textContent = message;
    window.setTimeout(() => {
      node.textContent = node.dataset.label;
    }, 1800);
  }

  function initCopy() {
    $$("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.copy;
        const done = () => flash(btn, "Copied");

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(value).then(done).catch(() => fallback());
        } else {
          fallback();
        }

        function fallback() {
          const input = doc.createElement("textarea");
          input.value = value;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.opacity = "0";
          doc.body.append(input);
          input.select();
          try {
            doc.execCommand("copy");
            done();
          } catch (err) {
            flash(btn, "Copy failed");
          }
          input.remove();
        }
      });
    });
  }

  function initContact() {
    const form = $("[data-contact]");
    if (!form) return;

    const status = $("[data-contact-status]", form);
    const setStatus = (msg) => {
      if (status) status.textContent = msg;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const get = (name) => (form.elements[name] ? form.elements[name].value.trim() : "");
      const name = get("name");
      const email = get("email");
      const subject = get("subject");
      const message = get("message");

      if (!name || !email || !message) {
        setStatus("Add your name, an email address and a message first.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("That email address looks incomplete.");
        return;
      }

      const finalSubject = subject || "Website contact — " + name;
      const body = message + "\n\n— " + name + "\n" + email;
      const href =
        "mailto:" +
        Lab.SITE.email +
        "?subject=" +
        encodeURIComponent(finalSubject) +
        "&body=" +
        encodeURIComponent(body);

      setStatus("Opening your mail client... if nothing happens, write to " + Lab.SITE.email);
      window.location.href = href;
    });

    // Optional live validation hint
    const emailField = form.elements.email;
    if (emailField) {
      emailField.addEventListener("blur", () => {
        const value = emailField.value.trim();
        if (!value) return;
        emailField.setAttribute("aria-invalid", String(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)));
      });
    }
  }

  /* ---------------------------------------------------------------- 5. boot */
  function boot() {
    initSkills();
    initProjects();
    initCerts();
    initContact();
    initCopy();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
