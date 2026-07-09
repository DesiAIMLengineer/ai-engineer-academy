// Shared utilities used across all pages.
const API = "/api";

function getToken() { return localStorage.getItem("token"); }
function getUser() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } }
function setSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function requireAuth() {
  if (!getToken()) window.location.href = "/index.html";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

const NAV_ITEMS = [
  { href: "/dashboard.html", label: "Dashboard", icon: "◆" },
  { href: "/syllabus.html", label: "Syllabus", icon: "☰" },
  { href: "/quiz.html", label: "Weekly Quiz", icon: "✓" },
  { href: "/tracker.html", label: "Time Tracker", icon: "◷" },
  { href: "/chatbot.html", label: "Ask a Doubt", icon: "◍" },
];

function renderSidebar(activePage) {
  const user = getUser();
  const el = document.getElementById("sidebar");
  if (!el) return;
  const navHtml = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="${activePage === item.href ? "active" : ""}">${item.icon} &nbsp;${item.label}</a>`
  ).join("");
  el.innerHTML = `
    <div class="brand"><span class="spark">◆</span> AI Engineer Academy</div>
    <nav>${navHtml}</nav>
    <div class="footer-nav">
      <div class="muted" style="margin-bottom:8px;">${user ? "Signed in as " + user.name : ""}</div>
      <button class="btn-ghost" style="width:100%;" onclick="logout()">Log out</button>
    </div>
  `;
}

function logout() {
  clearSession();
  window.location.href = "/index.html";
}

function fmtMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
