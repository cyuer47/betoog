// main.js - Centrale JavaScript logica
"use strict";

// ── Loading screen ──────────────────────────────────────────────
(function initLoadingScreen() {
  const screen = document.getElementById("loadingScreen");
  if (!screen) return;
  window.addEventListener("load", () => {
    setTimeout(() => {
      screen.classList.add("loading-screen--hidden");
      setTimeout(() => screen.remove(), 600);
    }, 800);
  });
})();

// ── Dark mode ────────────────────────────────────────────────────
(function initTheme() {
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const STORAGE_KEY = "digitaalschool-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
  function setTheme(theme) {
    html.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
    if (btn) {
      const icon = btn.querySelector(".material-icons-round");
      if (icon)
        icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
      btn.setAttribute(
        "aria-label",
        theme === "dark"
          ? "Wissel naar lichte modus"
          : "Wissel naar donkere modus",
      );
    }
  }
  const stored = getStoredTheme();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(stored || (prefersDark ? "dark" : "light"));
  if (btn)
    btn.addEventListener("click", () => {
      setTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!getStoredTheme()) setTheme(e.matches ? "dark" : "light");
    });
})();

// ── Sticky navbar ─────────────────────────────────────────────────
(function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const onScroll = () =>
    navbar.classList.toggle("navbar--scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

// ── Hamburger menu ────────────────────────────────────────────────
(function initMobileMenu() {
  const btn = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;
  let isOpen = false;
  function toggle() {
    isOpen = !isOpen;
    menu.classList.toggle("mobile-menu--open", isOpen);
    menu.setAttribute("aria-hidden", String(!isOpen));
    btn.setAttribute("aria-expanded", String(isOpen));
    const icon = btn.querySelector(".material-icons-round");
    if (icon) icon.textContent = isOpen ? "close" : "menu";
    btn.setAttribute("aria-label", isOpen ? "Menu sluiten" : "Menu openen");
  }
  btn.addEventListener("click", toggle);
  document.addEventListener("click", (e) => {
    if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) toggle();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) toggle();
  });
  menu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      if (isOpen) toggle();
    }),
  );
})();

// ── Scroll voortgangsbalk ─────────────────────────────────────────
(function initProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  const onScroll = () => {
    const total = document.body.scrollHeight - window.innerHeight;
    const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
    bar.style.width = Math.min(100, pct) + "%";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
})();

// ── Scroll reveal ─────────────────────────────────────────────────
(function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal--visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );
    items.forEach((el) => observer.observe(el));
  } else {
    items.forEach((el) => el.classList.add("reveal--visible"));
  }
})();

// ── Argument selector ─────────────────────────────────────────────
window.selectArgument = function (num, clickedBtn) {
  document
    .querySelectorAll(".arg-selector__pane")
    .forEach((p) => p.classList.remove("arg-selector__pane--active"));
  document.querySelectorAll(".arg-selector__tab").forEach((t) => {
    t.classList.remove("arg-selector__tab--active");
    t.setAttribute("aria-selected", "false");
  });
  const pane = document.getElementById("pane-arg" + num);
  if (pane) pane.classList.add("arg-selector__pane--active");
  if (clickedBtn) {
    clickedBtn.classList.add("arg-selector__tab--active");
    clickedBtn.setAttribute("aria-selected", "true");
  }
};

// ── Dynamisch content laden van API ──────────────────────────────
(async function loadContent() {
  try {
    const res = await fetch("/api/sections");
    if (!res.ok) return;
    const sections = await res.json();

    sections.forEach((section) => {
      // Titel
      const titleEl = document.getElementById(`section-title-${section.id}`);
      if (titleEl) titleEl.textContent = section.title;

      // Content (meerdere paragrafen)
      const contentEl = document.getElementById(
        `section-content-${section.id}`,
      );
      if (contentEl) {
        const paragraphs = section.content.split("\n\n").filter(Boolean);
        contentEl.innerHTML = paragraphs
          .map(
            (p) =>
              `<p class="card__text" style="margin-top:var(--space-4)">${escapeHtml(p)}</p>`,
          )
          .join("");
      }

      // Auteur
      const authorEl = document.getElementById(`section-author-${section.id}`);
      if (authorEl && section.author_name)
        authorEl.textContent = section.author_name;
    });

    // Teamleden laden op about pagina
    await loadTeamIfNeeded();
  } catch (e) {
    console.warn("[Content] Kon secties niet laden:", e.message);
  }
})();

async function loadTeamIfNeeded() {
  const grid = document.getElementById("teamGrid");
  if (!grid) return;
  // Team data staat in about-page via users API (public info only via sections author names)
  // We load it from sections author names
  try {
    const res = await fetch("/api/sections");
    if (!res.ok) return;
    const sections = await res.json();
    // Build unique authors
    const seen = new Set();
    const authors = [];
    for (const s of sections) {
      if (s.author_name && !seen.has(s.author_name)) {
        seen.add(s.author_name);
        authors.push(s.author_name);
      }
    }
    // Update team card names
    authors.forEach((name, i) => {
      const card = document.querySelector(`[data-team-index="${i}"]`);
      if (card) {
        const nameEl = card.querySelector(".team-card__name");
        if (nameEl) nameEl.textContent = name;
      }
    });
  } catch {}
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Snackbar ──────────────────────────────────────────────────────
window.showSnackbar = function (message, type = "default", duration = 3500) {
  const container = document.getElementById("snackbarContainer");
  if (!container) return;
  const bar = document.createElement("div");
  bar.className = "snackbar" + (type !== "default" ? " snackbar--" + type : "");
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    default: "info",
  };
  bar.innerHTML = `<span class="material-icons-round" aria-hidden="true">${icons[type] || icons.default}</span><span>${message}</span>`;
  container.appendChild(bar);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => bar.classList.add("snackbar--show")),
  );
  setTimeout(() => {
    bar.classList.remove("snackbar--show");
    setTimeout(() => bar.remove(), 400);
  }, duration);
};

// ── Modal ─────────────────────────────────────────────────────────
window.showModal = function () {
  const overlay = document.getElementById("shareModal");
  if (!overlay) return;
  overlay.classList.add("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    const c = overlay.querySelector(".modal__close");
    if (c) c.focus();
  }, 100);
};
window.hideModal = function () {
  const overlay = document.getElementById("shareModal");
  if (!overlay) return;
  overlay.classList.remove("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "true");
};
document.addEventListener("click", (e) => {
  const o = document.getElementById("shareModal");
  if (o && e.target === o) hideModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideModal();
});

// ── Link kopiëren ────────────────────────────────────────────────
window.copyLink = function () {
  const url = window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showSnackbar("Link gekopieerd!", "success");
        hideModal();
      })
      .catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
};
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0;";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showSnackbar("Link gekopieerd!", "success");
  } catch {
    showSnackbar("Kopiëren mislukt.", "error");
  }
  ta.remove();
  hideModal();
}
window.shareViaEmail = function () {
  const subject = encodeURIComponent(
    "Betoog: Digitalisering op de middelbare school",
  );
  const body = encodeURIComponent(
    "Bekijk dit betoog:\n\n" + window.location.href,
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  hideModal();
};

// ── Cookie banner ────────────────────────────────────────────────
(function initCookieBanner() {
  const banner = document.getElementById("cookieBanner");
  if (!banner) return;
  let consent = null;
  try {
    consent = localStorage.getItem("cookie-consent");
  } catch {}
  if (!consent)
    setTimeout(() => banner.classList.add("cookie-banner--show"), 1500);
})();
window.acceptCookies = function () {
  try {
    localStorage.setItem("cookie-consent", "accepted");
  } catch {}
  const banner = document.getElementById("cookieBanner");
  if (banner) banner.classList.remove("cookie-banner--show");
  showSnackbar("Cookies geaccepteerd!", "success");
};
window.declineCookies = function () {
  try {
    localStorage.setItem("cookie-consent", "declined");
  } catch {}
  const banner = document.getElementById("cookieBanner");
  if (banner) banner.classList.remove("cookie-banner--show");
};

// ── Actieve navlink markeren ──────────────────────────────────────
(function markActiveNavLink() {
  const current = window.location.pathname.replace(/\/$/, "") || "/";
  document
    .querySelectorAll(".navbar__nav-link, .mobile-menu__link")
    .forEach((link) => {
      const href = (link.getAttribute("href") || "").replace(/\/$/, "") || "/";
      const isActive =
        href === "/"
          ? current === "/"
          : current === href || current.startsWith(href);
      link.classList.toggle(
        "navbar__nav-link--active",
        isActive && link.classList.contains("navbar__nav-link"),
      );
      link.classList.toggle(
        "mobile-menu__link--active",
        isActive && link.classList.contains("mobile-menu__link"),
      );
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
})();

// ── Ripple effect ─────────────────────────────────────────────────
(function initRipple() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.25);width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;pointer-events:none;transform:scale(0);animation:rippleAnim 0.5s ease-out forwards;`;
    if (!document.getElementById("ripple-style")) {
      const style = document.createElement("style");
      style.id = "ripple-style";
      style.textContent =
        "@keyframes rippleAnim{to{transform:scale(1);opacity:0}}";
      document.head.appendChild(style);
    }
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
})();
