"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { getDb, all, get, run } = require("./db/database");

// ── .env laden ───────────────────────────────────────────────────
function loadEnv() {
  try {
    const lines = fs
      .readFileSync(path.join(__dirname, ".env"), "utf8")
      .split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...vals] = trimmed.split("=");
        process.env[key.trim()] = vals.join("=").trim();
      }
    });
  } catch {
    console.warn("⚠️  Geen .env bestand gevonden.");
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// ── Sessies (in-memory) ──────────────────────────────────────────
const sessions = new Map();

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  return sessions.get(match[1]) || null;
}

function isAuthenticated(req) {
  return !!getSession(req);
}

// ── MIME types ───────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// ── Hulpfuncties ─────────────────────────────────────────────────
function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function serveHtml(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      serve404(res);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      serve404(res);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(data);
  });
}

function serve404(res) {
  const p = path.join(PUBLIC_DIR, "404.html");
  fs.readFile(p, (err, data) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(err ? "<h1>404 - Niet gevonden</h1>" : data);
  });
}

// ── Pagina routes (clean URLs) ───────────────────────────────────
// Maps clean URL → HTML file
const PAGE_ROUTES = {
  "/": "index.html",
  "/about": "about.html",
  "/privacy": "privacy.html",
  "/admin": "admin.html",
  "/admin/login": "admin.html",
};

// ── API handlers ─────────────────────────────────────────────────

// POST /api/login
async function handleLogin(req, res) {
  const db = await getDb();
  const { username, password } = await parseBody(req);
  if (!username || !password) {
    return jsonResponse(res, 400, {
      success: false,
      message: "Vul alle velden in.",
    });
  }
  const user = get(
    db,
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
  );
  if (!user) {
    return jsonResponse(res, 401, {
      success: false,
      message: "Onjuiste inloggegevens.",
    });
  }
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    section: user.section,
    name: user.name,
  });
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": `session=${token}; HttpOnly; Path=/; Max-Age=86400`,
  });
  res.end(
    JSON.stringify({
      success: true,
      user: { name: user.name, role: user.role, section: user.section },
    }),
  );
}

// POST /api/logout
function handleLogout(req, res) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) sessions.delete(match[1]);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
  });
  res.end(JSON.stringify({ success: true }));
}

// GET /api/session
function handleGetSession(req, res) {
  const sess = getSession(req);
  if (sess) {
    jsonResponse(res, 200, {
      authenticated: true,
      user: {
        name: sess.name,
        role: sess.role,
        section: sess.section,
        username: sess.username,
      },
    });
  } else {
    jsonResponse(res, 200, { authenticated: false });
  }
}

// GET /api/sections
async function handleGetSections(req, res) {
  const db = await getDb();
  const rows = all(
    db,
    `SELECT s.id, s.label, s.title, s.content, s.sort_order, u.name as author_name
     FROM sections s LEFT JOIN users u ON s.author_id = u.id
     ORDER BY s.sort_order`,
  );
  jsonResponse(res, 200, rows);
}

// GET /api/sections/:id
async function handleGetSection(req, res, id) {
  const db = await getDb();
  const row = get(
    db,
    `SELECT s.id, s.label, s.title, s.content, s.sort_order, u.name as author_name
     FROM sections s LEFT JOIN users u ON s.author_id = u.id
     WHERE s.id = ?`,
    [id],
  );
  if (!row) return jsonResponse(res, 404, { error: "Niet gevonden" });
  jsonResponse(res, 200, row);
}

// PUT /api/sections/:id
async function handleUpdateSection(req, res, id) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  const db = await getDb();
  const section = get(db, "SELECT * FROM sections WHERE id = ?", [id]);
  if (!section) return jsonResponse(res, 404, { error: "Niet gevonden" });

  // Check permissies: admin mag alles, member mag alleen eigen sectie
  if (sess.role !== "admin") {
    const sectionLabels = {
      inleiding: "Inleiding & Stelling",
      stelling: "Inleiding & Stelling",
      argument1: "Argumenten",
      argument2: "Argumenten",
      argument3: "Argumenten",
      tegenargument: "Conclusie & Weerlegging",
      weerlegging: "Conclusie & Weerlegging",
      conclusie: "Conclusie & Weerlegging",
    };
    const required = sectionLabels[id];
    if (required && sess.section !== required) {
      return jsonResponse(res, 403, { error: "Geen toegang tot deze sectie." });
    }
  }

  const { title, content } = await parseBody(req);
  if (!title || !content)
    return jsonResponse(res, 400, { error: "Titel en inhoud zijn verplicht." });

  run(db, "UPDATE sections SET title = ?, content = ? WHERE id = ?", [
    title,
    content,
    id,
  ]);
  jsonResponse(res, 200, { success: true });
}

// GET /api/users  (admin only)
async function handleGetUsers(req, res) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  if (sess.role !== "admin")
    return jsonResponse(res, 403, { error: "Geen toegang" });
  const db = await getDb();
  const rows = all(
    db,
    "SELECT id, name, username, role, section, email FROM users ORDER BY id",
  );
  jsonResponse(res, 200, rows);
}

// PUT /api/users/:id  (admin only)
async function handleUpdateUser(req, res, id) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  if (sess.role !== "admin")
    return jsonResponse(res, 403, { error: "Geen toegang" });
  const db = await getDb();
  const { name, username, password, section, email, role } =
    await parseBody(req);
  const existing = get(db, "SELECT * FROM users WHERE id = ?", [id]);
  if (!existing)
    return jsonResponse(res, 404, { error: "Gebruiker niet gevonden" });

  const newPass = password || existing.password;
  run(
    db,
    "UPDATE users SET name = ?, username = ?, password = ?, section = ?, email = ?, role = ? WHERE id = ?",
    [
      name || existing.name,
      username || existing.username,
      newPass,
      section || existing.section,
      email || existing.email,
      role || existing.role,
      id,
    ],
  );
  jsonResponse(res, 200, { success: true });
}

// POST /api/users  (admin only - add user)
async function handleAddUser(req, res) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  if (sess.role !== "admin")
    return jsonResponse(res, 403, { error: "Geen toegang" });
  const db = await getDb();
  const { name, username, password, section, email, role } =
    await parseBody(req);
  if (!name || !username || !password)
    return jsonResponse(res, 400, {
      error: "Naam, gebruikersnaam en wachtwoord zijn verplicht.",
    });
  try {
    run(
      db,
      "INSERT INTO users (name, username, password, role, section, email) VALUES (?, ?, ?, ?, ?, ?)",
      [name, username, password, role || "member", section || "", email || ""],
    );
    jsonResponse(res, 201, { success: true });
  } catch (e) {
    jsonResponse(res, 400, { error: "Gebruikersnaam bestaat al." });
  }
}

// DELETE /api/users/:id  (admin only)
async function handleDeleteUser(req, res, id) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  if (sess.role !== "admin")
    return jsonResponse(res, 403, { error: "Geen toegang" });
  if (parseInt(id) === sess.userId)
    return jsonResponse(res, 400, {
      error: "Je kunt jezelf niet verwijderen.",
    });
  const db = await getDb();
  run(db, "DELETE FROM users WHERE id = ?", [id]);
  jsonResponse(res, 200, { success: true });
}

// GET /api/arguments
function handleGetArguments(req, res) {
  const filePath = path.join(PUBLIC_DIR, "data", "arguments.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return jsonResponse(res, 500, { error: "Kon argumenten niet laden" });
    }
    try {
      const args = JSON.parse(data);
      jsonResponse(res, 200, args);
    } catch {
      jsonResponse(res, 500, { error: "Ongeldige JSON" });
    }
  });
}

// PUT /api/me/password
async function handleChangePassword(req, res) {
  if (!isAuthenticated(req))
    return jsonResponse(res, 401, { error: "Niet ingelogd" });
  const sess = getSession(req);
  const db = await getDb();
  const { oldPassword, newPassword } = await parseBody(req);

  if (!oldPassword || !newPassword)
    return jsonResponse(res, 400, {
      error: "Oud en nieuw wachtwoord zijn verplicht.",
    });

  const user = get(db, "SELECT * FROM users WHERE id = ?", [sess.userId]);
  if (!user)
    return jsonResponse(res, 404, { error: "Gebruiker niet gevonden" });

  if (user.password !== oldPassword)
    return jsonResponse(res, 401, {
      error: "Oud wachtwoord is onjuist.",
    });

  run(db, "UPDATE users SET password = ? WHERE id = ?", [
    newPassword,
    sess.userId,
  ]);
  jsonResponse(res, 200, {
    success: true,
    message: "Wachtwoord succesvol gewijzigd.",
  });
}

// ── Router ───────────────────────────────────────────────────────
async function router(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // ── API Routes ──
  if (pathname === "/api/login" && method === "POST")
    return handleLogin(req, res);
  if (pathname === "/admin/login" && method === "POST")
    return handleLogin(req, res);
  if (pathname === "/api/logout" && method === "POST")
    return handleLogout(req, res);
  if (pathname === "/api/session" && method === "GET")
    return handleGetSession(req, res);
  if (pathname === "/api/sections" && method === "GET")
    return handleGetSections(req, res);
  if (pathname === "/api/arguments" && method === "GET")
    return handleGetArguments(req, res);
  if (pathname === "/api/users" && method === "GET")
    return handleGetUsers(req, res);
  if (pathname === "/api/users" && method === "POST")
    return handleAddUser(req, res);
  if (pathname === "/api/me/password" && method === "PUT")
    return handleChangePassword(req, res);

  // Dynamic section routes
  const sectionMatch = pathname.match(/^\/api\/sections\/([a-z0-9]+)$/);
  if (sectionMatch) {
    if (method === "GET") return handleGetSection(req, res, sectionMatch[1]);
    if (method === "PUT") return handleUpdateSection(req, res, sectionMatch[1]);
  }

  // Dynamic user routes
  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userMatch) {
    if (method === "PUT") return handleUpdateUser(req, res, userMatch[1]);
    if (method === "DELETE") return handleDeleteUser(req, res, userMatch[1]);
  }

  // ── Redirect .html → clean URLs ──
  if (pathname.endsWith(".html")) {
    const clean = pathname.replace(".html", "") || "/";
    res.writeHead(301, { Location: clean });
    return res.end();
  }

  // ── Page Routes (clean URLs) ──
  const htmlFile = PAGE_ROUTES[pathname];
  if (htmlFile) {
    return serveHtml(res, path.join(PUBLIC_DIR, htmlFile));
  }

  // ── Static assets ──
  const staticPath = path.join(PUBLIC_DIR, pathname);
  if (!staticPath.startsWith(PUBLIC_DIR)) return serve404(res);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return serveStatic(res, staticPath);
  }

  serve404(res);
}

// ── Start ────────────────────────────────────────────────────────
(async () => {
  await getDb(); // init DB before accepting requests
  const server = http.createServer(async (req, res) => {
    try {
      await router(req, res);
    } catch (err) {
      console.error("Server fout:", err);
      jsonResponse(res, 500, { error: "Interne serverfout" });
    }
  });
  server.listen(PORT, () => {
    console.log(`\n🚀 Server draait op http://localhost:${PORT}`);
    console.log("📄 Clean URLs: /, /about, /privacy, /admin");
    console.log(
      "🔌 API: /api/login, /api/sections, /api/arguments, /api/users\n",
    );
  });
})();
