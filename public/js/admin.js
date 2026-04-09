// admin.js - Admin + teamlid paneel
"use strict";

let currentSection = "dashboard";
let sectionsData = [];
let usersData = [];
let currentUser = null;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await checkSession();
});

async function checkSession() {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
      await showPanel();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ── Login / Logout ────────────────────────────────────────────────
function showLogin() {
  document.getElementById("loginSection").style.display = "flex";
  document.getElementById("adminPanel").style.display = "none";
}

async function showPanel() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("adminPanel").style.display = "grid";
  updateSidebarForRole();
  await loadAllData();
  navigateTo("dashboard");
}

function updateSidebarForRole() {
  // Show/hide admin-only nav items
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = currentUser.role === "admin" ? "" : "none";
  });
  // Update welcome name
  const nameEl = document.getElementById("sidebarUserName");
  if (nameEl) nameEl.textContent = currentUser.name;
  const roleEl = document.getElementById("sidebarUserRole");
  if (roleEl)
    roleEl.textContent =
      currentUser.role === "admin"
        ? "Beheerder"
        : "Teamlid · " + currentUser.section;
}

window.handleLogin = async function (e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const username = document.getElementById("loginUsername")?.value.trim();
  const password = document.getElementById("loginPassword")?.value.trim();
  const errorEl = document.getElementById("loginError");

  if (!username || !password) {
    showFormError(errorEl, "Vul alle velden in.");
    return;
  }
  setButtonLoading(btn, true);
  clearFormError(errorEl);

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      await showPanel();
      showSnackbar("Welkom, " + data.user.name + "!", "success");
    } else {
      showFormError(errorEl, data.message || "Onjuiste inloggegevens.");
      document.getElementById("loginPassword").value = "";
    }
  } catch {
    showFormError(errorEl, "Verbindingsfout - probeer opnieuw.");
  } finally {
    setButtonLoading(btn, false);
  }
};

window.handleLogout = async function () {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  showLogin();
  showSnackbar("Je bent uitgelogd.", "default");
};

// ── Navigatie ─────────────────────────────────────────────────────
window.navigateTo = function (section) {
  currentSection = section;
  document
    .querySelectorAll(".admin-content-section")
    .forEach((el) => (el.style.display = "none"));
  document.querySelectorAll(".admin-sidebar__link").forEach((link) => {
    link.classList.remove("admin-sidebar__link--active");
    link.removeAttribute("aria-current");
  });
  const target = document.getElementById("section-" + section);
  if (target) target.style.display = "block";
  const activeLink = document.querySelector(`[data-section="${section}"]`);
  if (activeLink) {
    activeLink.classList.add("admin-sidebar__link--active");
    activeLink.setAttribute("aria-current", "page");
  }

  if (section === "betoog") renderBetoog();
  if (section === "gebruikers") renderUsers();
  if (section === "wachtwoord") renderPasswordForm();
};

// ── Data laden ────────────────────────────────────────────────────
async function loadAllData() {
  await Promise.all([
    fetchSections(),
    currentUser.role === "admin" ? fetchUsers() : Promise.resolve(),
  ]);
  renderDashboard();
}

async function fetchSections() {
  try {
    const res = await fetch("/api/sections");
    sectionsData = await res.json();
  } catch {
    sectionsData = [];
  }
}

async function fetchUsers() {
  try {
    const res = await fetch("/api/users");
    usersData = await res.json();
  } catch {
    usersData = [];
  }
}

// ── Dashboard ─────────────────────────────────────────────────────
function renderDashboard() {
  const el = document.getElementById("dashCountSections");
  if (el) el.textContent = sectionsData.length;
  const el2 = document.getElementById("dashCountUsers");
  if (el2) el2.textContent = usersData.length || "—";

  // Show sections user can edit
  const myList = document.getElementById("mySectionsList");
  if (!myList) return;
  myList.innerHTML = "";

  const canEdit = sectionsData.filter((s) => canEditSection(s.id));
  if (!canEdit.length) {
    myList.innerHTML = `<p style="color:var(--color-on-surface-muted);font-size:var(--text-sm)">Je hebt geen bewerkbare secties.</p>`;
    return;
  }
  canEdit.forEach((s) => {
    const div = document.createElement("div");
    div.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;padding:var(--space-3);background:var(--color-primary-surface);border-radius:var(--radius-lg);";
    div.innerHTML = `
      <span style="font-size:var(--text-sm);font-weight:var(--weight-medium)">${escapeHtml(s.label)}: ${escapeHtml(s.title)}</span>
      <button class="btn btn--sm btn--primary" onclick="navigateTo('betoog');setTimeout(()=>openSectionEditor('${s.id}'),100)" aria-label="Bewerk ${escapeHtml(s.label)}">
        <span class="material-icons-round" aria-hidden="true">edit</span> Bewerk
      </button>`;
    myList.appendChild(div);
  });
}

function canEditSection(sectionId) {
  if (currentUser.role === "admin") return true;
  const map = {
    inleiding: "Inleiding & Stelling",
    stelling: "Inleiding & Stelling",
    argument1: "Argumenten",
    argument2: "Argumenten",
    argument3: "Argumenten",
    tegenargument: "Conclusie & Weerlegging",
    weerlegging: "Conclusie & Weerlegging",
    conclusie: "Conclusie & Weerlegging",
  };
  return map[sectionId] === currentUser.section;
}

// ── Betoog bewerken ───────────────────────────────────────────────
function renderBetoog() {
  const container = document.getElementById("betoogSectionsList");
  if (!container) return;
  container.innerHTML = "";

  sectionsData.forEach((s) => {
    const editable = canEditSection(s.id);
    const card = document.createElement("div");
    card.className = "card card--elevated";
    card.id = `betoog-card-${s.id}`;
    card.style.marginBottom = "var(--space-4)";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-4);flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);">
            <span class="badge badge--primary">${escapeHtml(s.label)}</span>
            ${s.author_name ? `<span style="font-size:var(--text-xs);color:var(--color-on-surface-muted)">door ${escapeHtml(s.author_name)}</span>` : ""}
            ${!editable ? `<span class="badge badge--warning">Alleen lezen</span>` : ""}
          </div>
          <div id="view-${s.id}">
            <h3 style="font-family:var(--font-display);font-size:var(--text-lg);color:var(--color-primary-dark);margin-bottom:var(--space-2)">${escapeHtml(s.title)}</h3>
            <div style="font-size:var(--text-sm);color:var(--color-on-surface-muted);line-height:1.7;white-space:pre-line">${escapeHtml(s.content.substring(0, 200))}${s.content.length > 200 ? "…" : ""}</div>
          </div>
          <div id="edit-${s.id}" style="display:none">
            <div class="form-field">
              <label class="form-label" for="title-${s.id}">Titel</label>
              <input class="form-input" id="title-${s.id}" type="text" value="${escapeHtml(s.title)}" />
            </div>
            <div class="form-field">
              <label class="form-label" for="content-${s.id}">Inhoud (gebruik lege regel voor nieuwe alinea)</label>
              <textarea class="form-input form-textarea" id="content-${s.id}" rows="8">${escapeHtml(s.content)}</textarea>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);flex-shrink:0;" id="actions-${s.id}">
          ${
            editable
              ? `
            <button class="btn btn--sm btn--primary" id="editBtn-${s.id}" onclick="openSectionEditor('${s.id}')" aria-label="Bewerk ${escapeHtml(s.label)}">
              <span class="material-icons-round" aria-hidden="true">edit</span>
            </button>`
              : ""
          }
        </div>
      </div>`;
    container.appendChild(card);
  });
}

window.openSectionEditor = function (id) {
  const viewEl = document.getElementById("view-" + id);
  const editEl = document.getElementById("edit-" + id);
  const actionsEl = document.getElementById("actions-" + id);
  if (!viewEl || !editEl) return;
  viewEl.style.display = "none";
  editEl.style.display = "block";
  actionsEl.innerHTML = `
    <button class="btn btn--sm btn--primary" onclick="saveSectionEditor('${id}')" aria-label="Opslaan">
      <span class="material-icons-round" aria-hidden="true">save</span>
    </button>
    <button class="btn btn--sm btn--ghost" onclick="cancelSectionEditor('${id}')" aria-label="Annuleren">
      <span class="material-icons-round" aria-hidden="true">close</span>
    </button>`;
};

window.cancelSectionEditor = function (id) {
  const s = sectionsData.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("title-" + id).value = s.title;
  document.getElementById("content-" + id).value = s.content;
  const viewEl = document.getElementById("view-" + id);
  const editEl = document.getElementById("edit-" + id);
  const actionsEl = document.getElementById("actions-" + id);
  if (viewEl) viewEl.style.display = "block";
  if (editEl) editEl.style.display = "none";
  if (actionsEl)
    actionsEl.innerHTML = `<button class="btn btn--sm btn--primary" id="editBtn-${id}" onclick="openSectionEditor('${id}')" aria-label="Bewerk">
    <span class="material-icons-round" aria-hidden="true">edit</span></button>`;
};

window.saveSectionEditor = async function (id) {
  const title = document.getElementById("title-" + id)?.value.trim();
  const content = document.getElementById("content-" + id)?.value.trim();
  if (!title || !content) {
    showSnackbar("Titel en inhoud zijn verplicht.", "error");
    return;
  }

  try {
    const res = await fetch(`/api/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    if (res.ok) {
      // Update local data
      const s = sectionsData.find((x) => x.id === id);
      if (s) {
        s.title = title;
        s.content = content;
      }
      cancelSectionEditor(id);
      // Update view
      const viewEl = document.getElementById("view-" + id);
      if (viewEl)
        viewEl.innerHTML = `
        <h3 style="font-family:var(--font-display);font-size:var(--text-lg);color:var(--color-primary-dark);margin-bottom:var(--space-2)">${escapeHtml(title)}</h3>
        <div style="font-size:var(--text-sm);color:var(--color-on-surface-muted);line-height:1.7;white-space:pre-line">${escapeHtml(content.substring(0, 200))}${content.length > 200 ? "…" : ""}</div>`;
      showSnackbar("Sectie opgeslagen!", "success");
    } else {
      showSnackbar(data.error || "Opslaan mislukt.", "error");
      if (res.status === 401) {
        showLogin();
      }
    }
  } catch {
    showSnackbar("Verbindingsfout bij opslaan.", "error");
  }
};

// ── Gebruikers beheer (admin only) ────────────────────────────────
function renderUsers() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  usersData.forEach((user) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div class="card__author-avatar" aria-hidden="true">${escapeHtml(user.name.substring(0, 2).toUpperCase())}</div>
          <div>
            <div style="font-weight:var(--weight-medium);font-size:var(--text-sm)">${escapeHtml(user.name)}</div>
            <div style="font-size:var(--text-xs);color:var(--color-on-surface-muted)">${escapeHtml(user.username)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email || "—")}</td>
      <td><span class="badge badge--primary">${escapeHtml(user.section || "—")}</span></td>
      <td><span class="badge ${user.role === "admin" ? "badge--warning" : "badge--success"}">${user.role === "admin" ? "Beheerder" : "Teamlid"}</span></td>
      <td>
        <div style="display:flex;gap:var(--space-2);">
          <button class="btn btn--sm btn--secondary" onclick="openUserEditModal(${user.id})" aria-label="Bewerk ${escapeHtml(user.name)}">
            <span class="material-icons-round" aria-hidden="true">edit</span>
          </button>
          <button class="btn btn--sm btn--ghost" onclick="deleteUser(${user.id}, '${escapeHtml(user.name)}')" aria-label="Verwijder ${escapeHtml(user.name)}" style="color:var(--color-error)">
            <span class="material-icons-round" aria-hidden="true">delete</span>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.openUserEditModal = function (userId) {
  const user = usersData.find((u) => u.id === userId);
  if (!user) return;
  document.getElementById("editUserId").value = user.id;
  document.getElementById("editUserName").value = user.name;
  document.getElementById("editUserUsername").value = user.username;
  document.getElementById("editUserEmail").value = user.email || "";
  document.getElementById("editUserSection").value = user.section || "";
  document.getElementById("editUserRole").value = user.role;
  document.getElementById("editUserPassword").value = "";
  const overlay = document.getElementById("userEditModal");
  overlay.classList.add("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "false");
};

window.closeUserEditModal = function () {
  const overlay = document.getElementById("userEditModal");
  overlay.classList.remove("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "true");
};

window.saveUserEdit = async function () {
  const id = document.getElementById("editUserId").value;
  const name = document.getElementById("editUserName").value.trim();
  const username = document.getElementById("editUserUsername").value.trim();
  const email = document.getElementById("editUserEmail").value.trim();
  const section = document.getElementById("editUserSection").value;
  const role = document.getElementById("editUserRole").value;
  const password = document.getElementById("editUserPassword").value.trim();

  if (!name || !username) {
    showSnackbar("Naam en gebruikersnaam zijn verplicht.", "error");
    return;
  }

  const payload = { name, username, email, section, role };
  if (password) payload.password = password;

  try {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchUsers();
      renderUsers();
      closeUserEditModal();
      showSnackbar("Gebruiker bijgewerkt!", "success");
    } else {
      showSnackbar(data.error || "Opslaan mislukt.", "error");
    }
  } catch {
    showSnackbar("Verbindingsfout.", "error");
  }
};

window.openAddUserModal = function () {
  document.getElementById("addUserName").value = "";
  document.getElementById("addUserUsername").value = "";
  document.getElementById("addUserEmail").value = "";
  document.getElementById("addUserSection").value = "Argumenten";
  document.getElementById("addUserRole").value = "member";
  document.getElementById("addUserPassword").value = "";
  const overlay = document.getElementById("userAddModal");
  overlay.classList.add("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "false");
};

window.closeAddUserModal = function () {
  const overlay = document.getElementById("userAddModal");
  overlay.classList.remove("modal-overlay--open");
  overlay.setAttribute("aria-hidden", "true");
};

window.saveNewUser = async function () {
  const name = document.getElementById("addUserName").value.trim();
  const username = document.getElementById("addUserUsername").value.trim();
  const email = document.getElementById("addUserEmail").value.trim();
  const section = document.getElementById("addUserSection").value;
  const role = document.getElementById("addUserRole").value;
  const password = document.getElementById("addUserPassword").value.trim();

  if (!name || !username || !password) {
    showSnackbar("Naam, gebruikersnaam en wachtwoord zijn verplicht.", "error");
    return;
  }

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, section, role, password }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchUsers();
      renderUsers();
      closeAddUserModal();
      showSnackbar("Gebruiker toegevoegd!", "success");
    } else {
      showSnackbar(data.error || "Toevoegen mislukt.", "error");
    }
  } catch {
    showSnackbar("Verbindingsfout.", "error");
  }
};

window.deleteUser = async function (id, name) {
  if (!confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) return;
  try {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      await fetchUsers();
      renderUsers();
      showSnackbar("Gebruiker verwijderd.", "warning");
    } else {
      showSnackbar(data.error || "Verwijderen mislukt.", "error");
    }
  } catch {
    showSnackbar("Verbindingsfout.", "error");
  }
};

// ── Wachtwoord wijzigen ───────────────────────────────────────────
function renderPasswordForm() {
  // Already in HTML, just clear it
  ["currentPassword", "newPassword", "newPasswordConfirm"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

window.changePassword = async function (e) {
  e.preventDefault();
  const current = document.getElementById("currentPassword")?.value;
  const next = document.getElementById("newPassword")?.value;
  const confirm = document.getElementById("newPasswordConfirm")?.value;
  const errorEl = document.getElementById("passwordError");

  if (next !== confirm) {
    showFormError(errorEl, "Nieuwe wachtwoorden komen niet overeen.");
    return;
  }
  if (!next || next.length < 6) {
    showFormError(errorEl, "Wachtwoord moet minimaal 6 tekens zijn.");
    return;
  }
  clearFormError(errorEl);

  try {
    const res = await fetch("/api/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    if (res.ok) {
      showSnackbar("Wachtwoord gewijzigd!", "success");
      renderPasswordForm();
    } else {
      showFormError(errorEl, data.error || "Wijzigen mislukt.");
    }
  } catch {
    showFormError(errorEl, "Verbindingsfout.");
  }
};

// ── Hulpfuncties ──────────────────────────────────────────────────
function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("btn--loading", loading);
  btn.disabled = loading;
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

window.showSnackbar =
  window.showSnackbar ||
  function (msg, type) {
    console.log(`[${type}] ${msg}`);
  };

window.togglePasswordVisibility = function (inputId, iconId) {
  const input = document.getElementById(inputId);
  const eye = document.getElementById(iconId);
  if (!input || !eye) return;
  input.type = input.type === "password" ? "text" : "password";
  eye.textContent = input.type === "password" ? "visibility" : "visibility_off";
};
