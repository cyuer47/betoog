// main.js – Centrale JavaScript logica
// ======================================

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

  // Bepaal beginthema
  const stored = getStoredTheme();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = stored || (prefersDark ? "dark" : "light");
  setTheme(initialTheme);

  if (btn) {
    btn.addEventListener("click", () => {
      const current = html.getAttribute("data-theme");
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  // Luister naar systeem-theme-wijzigingen
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
  const onScroll = () => {
    navbar.classList.toggle("navbar--scrolled", window.scrollY > 20);
  };
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

  // Sluit bij klik buiten
  document.addEventListener("click", (e) => {
    if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) {
      toggle();
    }
  });

  // Sluit bij Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) toggle();
  });

  // Sluit bij link-klik
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (isOpen) toggle();
    });
  });
})();

// ── Scroll voortgangsbalk ─────────────────────────────────────────
(function initProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  const onScroll = () => {
    const total = document.body.scrollHeight - window.innerHeight;
    const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
    bar.style.width = Math.min(100, pct) + "%";
    bar.parentElement.setAttribute("aria-valuenow", Math.round(pct));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
})();

// ── Scroll reveal animaties ───────────────────────────────────────
(function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );
    items.forEach((el) => observer.observe(el));
  } else {
    // Fallback: alles zichtbaar
    items.forEach((el) => el.classList.add("reveal--visible"));
  }
})();

// ── Argument selector ─────────────────────────────────────────────
window.selectArgument = function (num, clickedBtn) {
  // Verberg alle panes
  document.querySelectorAll(".arg-selector__pane").forEach((pane) => {
    pane.classList.remove("arg-selector__pane--active");
  });
  // Deactiveer alle tabs
  document.querySelectorAll(".arg-selector__tab").forEach((tab) => {
    tab.classList.remove("arg-selector__tab--active");
    tab.setAttribute("aria-selected", "false");
  });

  // Activeer gekozen pane
  const pane = document.getElementById("pane-arg" + num);
  if (pane) {
    pane.classList.add("arg-selector__pane--active");
  }
  // Activeer gekozen tab
  if (clickedBtn) {
    clickedBtn.classList.add("arg-selector__tab--active");
    clickedBtn.setAttribute("aria-selected", "true");
  }
};

// Laad argumenten dynamisch van API
(function loadArguments() {
  fetch("/api/arguments")
    .then((r) => r.json())
    .then((data) => {
      if (!Array.isArray(data)) return;
      data.forEach((arg, i) => {
        const n = i + 1;
        const titleEl = document.getElementById("arg" + n + "-title");
        const textEl = document.getElementById("arg" + n + "-text");
        if (titleEl) titleEl.textContent = arg.title || titleEl.textContent;
        if (textEl) textEl.textContent = arg.content || textEl.textContent;
      });
    })
    .catch(() => {}); // Stilte als de API niet bereikbaar is
})();

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
  const iconName = icons[type] || icons.default;

  bar.innerHTML = `
    <span class="material-icons-round" aria-hidden="true">${iconName}</span>
    <span>${message}</span>
  `;

  container.appendChild(bar);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => bar.classList.add("snackbar--show"));
  });

  setTimeout(() => {
    bar.classList.remove("snackbar--show");
    setTimeout(() => bar.remove(), 400);
  }, duration);
};

// ── Modal / Dialog ────────────────────────────────────────────────
window.showModal = function () {
  const overlay = document.getElementById("shareModal");
  if (!overlay) return;
  overlay.classList.add("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "false");
  // Focus op sluiten-knop
  setTimeout(() => {
    const closeBtn = overlay.querySelector(".modal__close");
    if (closeBtn) closeBtn.focus();
  }, 100);
};

window.hideModal = function () {
  const overlay = document.getElementById("shareModal");
  if (!overlay) return;
  overlay.classList.remove("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "true");
};

// Sluit modal bij overlay-klik
document.addEventListener("click", (e) => {
  const overlay = document.getElementById("shareModal");
  if (overlay && e.target === overlay) hideModal();
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
        showSnackbar("Link gekopieerd naar klembord!", "success");
        hideModal();
      })
      .catch(() => {
        fallbackCopy(url);
      });
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
    showSnackbar("Kopiëren mislukt – kopieer de URL handmatig.", "error");
  }
  ta.remove();
  hideModal();
}

// ── Delen via e-mail ─────────────────────────────────────────────
window.shareViaEmail = function () {
  const subject = encodeURIComponent(
    "Betoog: Digitalisering op de middelbare school",
  );
  const body = encodeURIComponent(
    "Bekijk dit betoog over digitalisering op school:\n\n" +
      window.location.href,
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

  if (!consent) {
    setTimeout(() => banner.classList.add("cookie-banner--show"), 1500);
  }
})();

window.acceptCookies = function () {
  try {
    localStorage.setItem("cookie-consent", "accepted");
  } catch {}
  const banner = document.getElementById("cookieBanner");
  if (banner) banner.classList.remove("cookie-banner--show");
  showSnackbar("Cookies geaccepteerd. Bedankt!", "success");
  // Laad AdSense nu
  if (window.initAds) window.initAds();
};

window.declineCookies = function () {
  try {
    localStorage.setItem("cookie-consent", "declined");
  } catch {}
  const banner = document.getElementById("cookieBanner");
  if (banner) banner.classList.remove("cookie-banner--show");
  showSnackbar("Je hebt niet-essentiële cookies geweigerd.", "default");
};

// ── Ripple effect op knoppen ──────────────────────────────────────
(function initRipple() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `
      position:absolute;
      border-radius:50%;
      background:rgba(255,255,255,0.25);
      width:${size}px;
      height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      pointer-events:none;
      transform:scale(0);
      animation:rippleAnim 0.5s ease-out forwards;
    `;
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

// ── Actieve navlink markeren ──────────────────────────────────────
(function markActiveNavLink() {
  const current = window.location.pathname;
  document
    .querySelectorAll(".navbar__nav-link, .mobile-menu__link")
    .forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      const isActive =
        href === "/"
          ? current === "/" || current === "/index.html"
          : current === href || current.startsWith(href.replace(".html", ""));
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
