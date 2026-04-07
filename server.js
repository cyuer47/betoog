// server.js - Node.js HTTP server zonder Express
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Laad .env bestand
function loadEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...vals] = trimmed.split("=");
        process.env[key.trim()] = vals.join("=").trim();
      }
    });
  } catch {
    console.warn("⚠️  Geen .env bestand gevonden - gebruik standaardwaarden.");
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "geheim123";

// Sessie-opslag (in-memory)
const sessions = new Map();
function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function isAuthenticated(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return false;
  return sessions.has(match[1]);
}

// Bestandspaden
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "public", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
ensureDataDir();

// MIME types
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

// Stuur statisch bestand
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

function readJSON(file, fallback = []) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, file),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
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

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// Route: POST /admin/login
async function handleAdminLogin(req, res) {
  const body = await parseBody(req);
  if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
    const token = generateToken();
    sessions.set(token, { user: ADMIN_USER, loginAt: Date.now() });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${token}; HttpOnly; Path=/; Max-Age=86400`,
    });
    res.end(JSON.stringify({ success: true }));
  } else {
    jsonResponse(res, 401, {
      success: false,
      message: "Onjuiste inloggegevens",
    });
  }
}

// Route: POST /admin/logout
function handleAdminLogout(req, res) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) sessions.delete(match[1]);
  res.writeHead(302, {
    "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
    Location: "/admin.html",
  });
  res.end();
}

// Route: GET /api/arguments
function handleGetArguments(req, res) {
  const args = readJSON("arguments.json", getDefaultArguments());
  jsonResponse(res, 200, args);
}

// Route: POST /api/arguments
async function handlePostArguments(req, res) {
  if (!isAuthenticated(req)) {
    jsonResponse(res, 401, { error: "Niet ingelogd" });
    return;
  }
  const body = await parseBody(req);
  if (!Array.isArray(body)) {
    jsonResponse(res, 400, { error: "Verwacht een array" });
    return;
  }
  writeJSON("arguments.json", body);
  jsonResponse(res, 200, { success: true });
}

// Route: GET /api/users
function handleGetUsers(req, res) {
  if (!isAuthenticated(req)) {
    jsonResponse(res, 401, { error: "Niet ingelogd" });
    return;
  }
  const users = readJSON("users.json", getDefaultUsers());
  jsonResponse(res, 200, users);
}

// Route: POST /api/users
async function handlePostUsers(req, res) {
  if (!isAuthenticated(req)) {
    jsonResponse(res, 401, { error: "Niet ingelogd" });
    return;
  }
  const body = await parseBody(req);
  writeJSON("users.json", body);
  jsonResponse(res, 200, { success: true });
}

// Route: GET /api/session
function handleGetSession(req, res) {
  jsonResponse(res, 200, { authenticated: isAuthenticated(req) });
}

// Standaard data
function getDefaultArguments() {
  return [
    {
      id: 1,
      title: "Argument 1: Betere voorbereiding op de arbeidsmarkt",
      content:
        "Leerlingen die digitale vaardigheden beheersen, zijn beter voorbereid op de moderne arbeidsmarkt. Bijna alle sectoren vragen tegenwoordig digitale basiskennis. Door digitalisering te verbeteren op school, zorgen we dat jongeren niet achterblijven.",
      section: "argumenten",
      author: "Persoon 2",
    },
    {
      id: 2,
      title: "Argument 2: Efficiënter en gepersonaliseerd leren",
      content:
        "Digitale tools maken adaptief leren mogelijk. Software past zich aan het niveau van de leerling aan, waardoor iedereen in eigen tempo leert. Dit verhoogt het leerrendement aanzienlijk ten opzichte van klassikaal onderwijs.",
      section: "argumenten",
      author: "Persoon 2",
    },
    {
      id: 3,
      title: "Argument 3: Duurzaamheid en toegankelijkheid",
      content:
        "Digitale leermiddelen zijn goedkoper op de lange termijn dan papieren boeken. Bovendien zijn e-books en online platforms altijd beschikbaar, ook vanuit huis. Dit vergroot de toegankelijkheid voor leerlingen met een beperking of ziekte.",
      section: "argumenten",
      author: "Persoon 2",
    },
  ];
}

function getDefaultUsers() {
  return [
    {
      id: 1,
      name: "Persoon 1",
      section: "Inleiding & Stelling",
      email: "persoon1@school.nl",
    },
    {
      id: 2,
      name: "Persoon 2",
      section: "Argumenten",
      email: "persoon2@school.nl",
    },
    {
      id: 3,
      name: "Persoon 3",
      section: "Conclusie & Weerlegging",
      email: "persoon3@school.nl",
    },
  ];
}

// Initialiseer JSON-bestanden als ze niet bestaan
function initDataFiles() {
  const argsPath = path.join(DATA_DIR, "arguments.json");
  const usersPath = path.join(DATA_DIR, "users.json");
  if (!fs.existsSync(argsPath))
    writeJSON("arguments.json", getDefaultArguments());
  if (!fs.existsSync(usersPath)) writeJSON("users.json", getDefaultUsers());
}
initDataFiles();

// Hoofd-handler
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // API routes
  if (pathname === "/admin/login" && method === "POST") {
    await handleAdminLogin(req, res);
    return;
  }
  if (pathname === "/admin/logout" && method === "POST") {
    handleAdminLogout(req, res);
    return;
  }
  if (pathname === "/api/arguments" && method === "GET") {
    handleGetArguments(req, res);
    return;
  }
  if (pathname === "/api/arguments" && method === "POST") {
    await handlePostArguments(req, res);
    return;
  }
  if (pathname === "/api/users" && method === "GET") {
    handleGetUsers(req, res);
    return;
  }
  if (pathname === "/api/users" && method === "POST") {
    await handlePostUsers(req, res);
    return;
  }
  if (pathname === "/api/session" && method === "GET") {
    handleGetSession(req, res);
    return;
  }

  // Statische bestanden
  let filePath = path.join(
    PUBLIC_DIR,
    pathname === "/" ? "index.html" : pathname,
  );

  // Beveilig: geen toegang buiten public/
  if (!filePath.startsWith(PUBLIC_DIR)) {
    serve404(res);
    return;
  }

  // Directory → index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  // Voeg .html toe als geen extensie
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath += ".html";
  }

  if (fs.existsSync(filePath)) {
    serveStatic(res, filePath);
  } else {
    serve404(res);
  }
});

server.listen(PORT, () => {
  //console.log(`\n🚀 Server draait op http://localhost:${PORT}`);
  //console.log(`📁 Statische bestanden: ${PUBLIC_DIR}`);
  //console.log(`🔐 Admin: ${ADMIN_USER} / ${ADMIN_PASS}`);
  console.log("\nRoutes:");
  console.log("  GET  /               → index.html");
  console.log("  GET  /about.html     → about.html");
  console.log("  GET  /admin.html     → admin.html");
  console.log("  POST /admin/login    → inloggen");
  console.log("  GET  /api/arguments  → argumenten ophalen");
  console.log("  POST /api/arguments  → argumenten opslaan");
  console.log("  GET  /api/users      → gebruikers ophalen");
  console.log("  POST /api/users      → gebruikers opslaan\n");
});
