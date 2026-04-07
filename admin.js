// admin.js - Admin paneel logica
// ================================

"use strict";

// ── Staat ────────────────────────────────────────────────────────
let currentSection = "dashboard";
let arguments_data = [];
let users_data = [];

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await checkSession();
});

async function checkSession() {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();
    if (data.authenticated) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ── Login ─────────────────────────────────────────────────────────
function showLogin() {
  const loginSection = document.getElementById("loginSection");
  const adminPanel = document.getElementById("adminPanel");
  if (loginSection) loginSection.style.display = "flex";
  if (adminPanel) adminPanel.style.display = "none";
}

function showDashboard() {
  const loginSection = document.getElementById("loginSection");
  const adminPanel = document.getElementById("adminPanel");
  if (loginSection) loginSection.style.display = "none";
  if (adminPanel) adminPanel.style.display = "grid";
  loadAllData();
  navigateTo("dashboard");
}

// Exporteer naar window voor inline handlers
window.handleLogin = async function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const usernameEl = document.getElementById("loginUsername");
  const passwordEl = document.getElementById("loginPassword");
  const errorEl = document.getElementById("loginError");

  if (!usernameEl || !passwordEl) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value.trim();

  if (!username || !password) {
    showFormError(errorEl, "Vul alle velden in.");
    return;
  }

  setButtonLoading(btn, true);
  clearFormError(errorEl);

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      showDashboard();
      showSnackbar("Welkom terug, " + username + "!", "success");
    } else {
      showFormError(errorEl, data.message || "Onjuiste inloggegevens.");
      passwordEl.value = "";
    }
  } catch {
    showFormError(errorEl, "Verbindingsfout - probeer opnieuw.");
  } finally {
    setButtonLoading(btn, false);
  }
};

window.handleLogout = async function () {
  try {
    await fetch("/admin/logout", { method: "POST" });
  } catch {}
  showLogin();
  showSnackbar("Je bent uitgelogd.", "default");
};

// ── Navigatie ─────────────────────────────────────────────────────
window.navigateTo = function (section) {
  currentSection = section;

  // Verberg alle secties
  document.querySelectorAll(".admin-content-section").forEach((el) => {
    el.style.display = "none";
  });
  // Deactiveer alle links
  document.querySelectorAll(".admin-sidebar__link").forEach((link) => {
    link.classList.remove("admin-sidebar__link--active");
    link.removeAttribute("aria-current");
  });

  // Toon gekozen sectie
  const target = document.getElementById("section-" + section);
  if (target) target.style.display = "block";

  // Markeer actieve link
  const activeLink = document.querySelector(`[data-section="${section}"]`);
  if (activeLink) {
    activeLink.classList.add("admin-sidebar__link--active");
    activeLink.setAttribute("aria-current", "page");
  }

  // Laad sectie-specifieke data
  if (section === "argumenten") renderArguments();
  if (section === "gebruikers") renderUsers();
};

// ── Data laden ────────────────────────────────────────────────────
async function loadAllData() {
  await Promise.all([fetchArguments(), fetchUsers()]);
  renderDashboard();
}

async function fetchArguments() {
  try {
    const res = await fetch("/api/arguments");
    arguments_data = await res.json();
  } catch {
    arguments_data = [];
  }
}

async function fetchUsers() {
  try {
    const res = await fetch("/api/users");
    users_data = await res.json();
  } catch {
    users_data = [];
  }
}

// ── Dashboard ─────────────────────────────────────────────────────
function renderDashboard() {
  const countArgs = document.getElementById("dashCountArgs");
  const countUsers = document.getElementById("dashCountUsers");
  if (countArgs) countArgs.textContent = arguments_data.length;
  if (countUsers) countUsers.textContent = users_data.length;
}

// ── Argumenten beheer ─────────────────────────────────────────────
function renderArguments() {
  const container = document.getElementById("argumentsList");
  if (!container) return;

  container.innerHTML = "";

  if (!arguments_data.length) {
    container.innerHTML = `<p style="color:var(--color-on-surface-muted); font-size:var(--text-sm);">Geen argumenten gevonden.</p>`;
    return;
  }

  arguments_data.forEach((arg, index) => {
    const card = document.createElement("div");
    card.className = "card card--elevated";
    card.style.marginBottom = "var(--space-4)";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-4); flex-wrap:wrap;">
        <div style="flex:1; min-width:0;">
          <div class="card__eyebrow">Argument ${index + 1}</div>
          <div class="form-field" style="margin-bottom:var(--space-3);">
            <label class="form-label" for="arg-title-${index}">Titel</label>
            <input class="form-input"
                   id="arg-title-${index}"
                   type="text"
                   value="${escapeHtml(arg.title || "")}"
                   onchange="updateArgField(${index}, 'title', this.value)"
                   aria-label="Titel van argument ${index + 1}" />
          </div>
          <div class="form-field" style="margin-bottom:var(--space-3);">
            <label class="form-label" for="arg-content-${index}">Inhoud</label>
            <textarea class="form-input form-textarea"
                      id="arg-content-${index}"
                      rows="4"
                      onchange="updateArgField(${index}, 'content', this.value)"
                      aria-label="Inhoud van argument ${index + 1}">${escapeHtml(arg.content || "")}</textarea>
          </div>
          <div class="form-field" style="margin-bottom:0;">
            <label class="form-label" for="arg-author-${index}">Auteur</label>
            <input class="form-input"
                   id="arg-author-${index}"
                   type="text"
                   value="${escapeHtml(arg.author || "")}"
                   onchange="updateArgField(${index}, 'author', this.value)"
                   aria-label="Auteur van argument ${index + 1}" />
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:var(--space-2); flex-shrink:0;">
          <button class="btn btn--sm btn--ghost"
                  onclick="deleteArgument(${index})"
                  aria-label="Argument ${index + 1} verwijderen"
                  style="color:var(--color-error);">
            <span class="material-icons-round" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

window.updateArgField = function (index, field, value) {
  if (arguments_data[index]) {
    arguments_data[index][field] = value;
  }
};

window.addArgument = function () {
  const newId =
    arguments_data.length > 0
      ? Math.max(...arguments_data.map((a) => a.id || 0)) + 1
      : 1;
  arguments_data.push({
    id: newId,
    title: "Nieuw argument " + newId,
    content: "Voer hier de inhoud van het argument in.",
    section: "argumenten",
    author: "Persoon 2",
  });
  renderArguments();
};

window.deleteArgument = function (index) {
  if (confirm(`Weet je zeker dat je argument ${index + 1} wilt verwijderen?`)) {
    arguments_data.splice(index, 1);
    renderArguments();
    showSnackbar("Argument verwijderd.", "warning");
  }
};

window.saveArguments = async function () {
  const btn = document.getElementById("saveArgsBtn");
  setButtonLoading(btn, true);
  try {
    const res = await fetch("/api/arguments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arguments_data),
    });
    if (res.ok) {
      showSnackbar("Argumenten opgeslagen!", "success");
    } else if (res.status === 401) {
      showSnackbar("Sessie verlopen - log opnieuw in.", "error");
      showLogin();
    } else {
      showSnackbar("Opslaan mislukt. Probeer opnieuw.", "error");
    }
  } catch {
    showSnackbar("Verbindingsfout bij opslaan.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
};

// ── Gebruikers beheer ─────────────────────────────────────────────
function renderUsers() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  users_data.forEach((user, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:var(--space-3);">
          <div class="card__author-avatar" style="width:32px;height:32px;font-size:14px;" aria-hidden="true">
            P${index + 1}
          </div>
          <input class="form-input"
                 type="text"
                 value="${escapeHtml(user.name || "")}"
                 onchange="updateUserField(${index}, 'name', this.value)"
                 style="max-width:140px;"
                 aria-label="Naam van gebruiker ${index + 1}" />
        </div>
      </td>
      <td>
        <input class="form-input"
               type="email"
               value="${escapeHtml(user.email || "")}"
               onchange="updateUserField(${index}, 'email', this.value)"
               style="max-width:200px;"
               aria-label="E-mail van gebruiker ${index + 1}" />
      </td>
      <td>
        <select class="form-input"
                onchange="updateUserField(${index}, 'section', this.value)"
                style="max-width:200px;"
                aria-label="Sectie van gebruiker ${index + 1}">
          <option value="Inleiding & Stelling" ${user.section === "Inleiding & Stelling" ? "selected" : ""}>Inleiding & Stelling</option>
          <option value="Argumenten" ${user.section === "Argumenten" ? "selected" : ""}>Argumenten</option>
          <option value="Tegenargument" ${user.section === "Tegenargument" ? "selected" : ""}>Tegenargument</option>
          <option value="Conclusie & Weerlegging" ${user.section === "Conclusie & Weerlegging" ? "selected" : ""}>Conclusie & Weerlegging</option>
        </select>
      </td>
      <td>
        <span class="badge badge--primary">${escapeHtml(user.section || "Onbekend")}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.updateUserField = function (index, field, value) {
  if (users_data[index]) {
    users_data[index][field] = value;
    // Herrender de badge in dezelfde rij
    renderUsers();
  }
};

window.saveUsers = async function () {
  const btn = document.getElementById("saveUsersBtn");
  setButtonLoading(btn, true);
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(users_data),
    });
    if (res.ok) {
      showSnackbar("Gebruikers opgeslagen!", "success");
    } else if (res.status === 401) {
      showSnackbar("Sessie verlopen - log opnieuw in.", "error");
      showLogin();
    } else {
      showSnackbar("Opslaan mislukt. Probeer opnieuw.", "error");
    }
  } catch {
    showSnackbar("Verbindingsfout bij opslaan.", "error");
  } finally {
    setButtonLoading(btn, false);
  }
};

// ── Hulpfuncties ──────────────────────────────────────────────────
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add("btn--loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn--loading");
    btn.disabled = false;
  }
}

function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = "flex";
}

function clearFormError(el) {
  if (!el) return;
  el.textContent = "";
  el.style.display = "none";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Hergebruik snackbar uit main.js als die geladen is
window.showSnackbar =
  window.showSnackbar ||
  function (msg, type) {
    console.log(`[${type || "info"}] ${msg}`);
  };
