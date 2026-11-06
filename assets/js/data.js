/* ============================================================================
   data.js — offline mirror of assets/data/*.json
   ----------------------------------------------------------------------------
   assets/data/*.json is the canonical source. This file exists so the demo also
   works when opened straight from disk (file://), where fetch() of local JSON
   is blocked. core.js always tries the JSON first and only falls back to this.

   Keep the two in sync — or delete this file and serve over http:// instead.
   ========================================================================== */
window.SITE_DATA = {
  skills: {
    updated: "2026-11",
    groups: [
      {
        id: "vulnerabilities",
        label: "Vulnerabilities Found",
        filter: "Vulnerabilities",
        items: [
          "IDOR",
          "BOLA",
          "BFLA",
          "Privilege escalation",
          "SSRF",
          "XSS",
          "CSRF",
          "SQL injection",
          "NoSQL injection",
          "Authentication bypass",
          "JWT & session flaws",
          "OAuth / SSO misconfiguration",
          "Cross-tenant data exposure",
          "Business logic abuse"
        ]
      },
      {
        id: "technical",
        label: "Technical Skills",
        filter: "Technical",
        items: [
          "Web application pentesting",
          "REST API security testing",
          "GraphQL security testing",
          "Authentication & session analysis",
          "Access-control modelling",
          "Recon & asset discovery",
          "Burp Suite extension scripting",
          "Python tooling",
          "JavaScript code review",
          "HTTP & protocol analysis",
          "Cloud & SaaS configuration review",
          "Threat modelling",
          "Technical report writing"
        ]
      },
      {
        id: "tools",
        label: "Tools I Use",
        filter: "Tools",
        items: [
          "Burp Suite",
          "Caido",
          "Nmap",
          "ffuf",
          "Nuclei",
          "Subfinder",
          "Amass",
          "Postman",
          "mitmproxy",
          "Docker"
        ]
      }
    ]
  },

  projects: {
    note: "Placeholder entries only.",
    items: [
      {
        id: "recon-toolkit",
        index: "01",
        title: "Recon automation toolkit",
        summary: "Add details — what the toolkit automates, which inputs it takes, what it outputs, and the one thing it does better than the tools it replaces.",
        status: "Add details",
        placeholder: true,
        tags: ["Python", "Automation", "Recon"]
      },
      {
        id: "burp-extensions",
        index: "02",
        title: "Burp Suite extension / BApp scripts",
        summary: "Add details — the extension's purpose, the Burp API surface it hooks, and a link to the repository or BApp store listing.",
        status: "Add details",
        placeholder: true,
        tags: ["Java", "Python", "Burp Extender API"]
      },
      {
        id: "public-writeups",
        index: "03",
        title: "Public write-ups",
        summary: "Add details — published, responsibly disclosed write-ups. Link each one, and keep unreported or in-progress research out of this list.",
        status: "Add details",
        placeholder: true,
        tags: ["Research", "Disclosure", "Writing"]
      }
    ]
  },

  certifications: {
    note: "Certifications as supplied.",
    items: [
      { index: "01", issuer: "APIsec", title: "CASA", subtitle: "Certified API Security Analyst" },
      { index: "02", issuer: "APIsec", title: "API Penetration Testing", subtitle: "APIsec certification track" },
      { index: "03", issuer: "APIsec", title: "OWASP API Top 10", subtitle: "API security risk coverage" },
      { index: "04", issuer: "FIRST", title: "CVSS v4.0", subtitle: "Common Vulnerability Scoring System" }
    ]
  }
};
