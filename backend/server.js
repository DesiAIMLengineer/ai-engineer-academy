const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");
const curriculum = require("./data/curriculum");

const app = express();
const PORT = process.env.PORT || 4000;
// In production, set a real secret via environment variable JWT_SECRET.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-please";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------- helpers ----------
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function weekMeta(weekNum) {
  const w = curriculum.weeks.find((x) => x.week === Number(weekNum));
  return w || null;
}

// ---------- auth ----------
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and a password of 6+ characters are required." });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name.trim(), email.toLowerCase().trim(), hash);

  const token = jwt.sign({ id: info.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: info.lastInsertRowid, name, email } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/me", authRequired, (req, res) => res.json({ user: req.user }));

// ---------- curriculum (public, read-only) ----------
app.get("/api/curriculum", (req, res) => {
  // Strip quiz answers from the public payload so they aren't visible in devtools.
  const safe = {
    phases: curriculum.phases,
    weeks: curriculum.weeks.map((w) => ({
      ...w,
      quiz: w.quiz.map(({ q, options }) => ({ q, options })),
    })),
  };
  res.json(safe);
});

// ---------- progress ----------
app.get("/api/progress", authRequired, (req, res) => {
  const rows = db.prepare("SELECT week, item_id, completed FROM progress WHERE user_id = ?").all(req.user.id);
  res.json({ progress: rows });
});

app.post("/api/progress", authRequired, (req, res) => {
  const { week, itemId, completed } = req.body || {};
  if (!week || !itemId) return res.status(400).json({ error: "week and itemId are required." });

  if (completed) {
    db.prepare(
      `INSERT INTO progress (user_id, week, item_id, completed, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, item_id) DO UPDATE SET completed = 1, updated_at = datetime('now')`
    ).run(req.user.id, week, itemId);
  } else {
    db.prepare("DELETE FROM progress WHERE user_id = ? AND item_id = ?").run(req.user.id, itemId);
  }
  res.json({ ok: true });
});

// ---------- quizzes ----------
app.get("/api/quiz/:week", authRequired, (req, res) => {
  const w = weekMeta(req.params.week);
  if (!w) return res.status(404).json({ error: "Week not found." });
  res.json({ week: w.week, title: w.title, questions: w.quiz.map(({ q, options }) => ({ q, options })) });
});

app.post("/api/quiz/:week/submit", authRequired, (req, res) => {
  const w = weekMeta(req.params.week);
  if (!w) return res.status(404).json({ error: "Week not found." });
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).json({ error: "answers array is required." });

  let score = 0;
  const feedback = w.quiz.map((question, i) => {
    const correct = answers[i] === question.answer;
    if (correct) score++;
    return { correct, correctAnswer: question.answer };
  });

  db.prepare("INSERT INTO quiz_attempts (user_id, week, score, total) VALUES (?, ?, ?, ?)").run(
    req.user.id,
    w.week,
    score,
    w.quiz.length
  );

  res.json({ score, total: w.quiz.length, feedback });
});

app.get("/api/quiz-history", authRequired, (req, res) => {
  const rows = db
    .prepare("SELECT week, score, total, taken_at FROM quiz_attempts WHERE user_id = ? ORDER BY taken_at DESC")
    .all(req.user.id);
  res.json({ history: rows });
});

// ---------- time tracker ----------
app.post("/api/timer/log", authRequired, (req, res) => {
  const { minutes, note } = req.body || {};
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  if (mins <= 0) return res.status(400).json({ error: "minutes must be a positive number." });

  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO time_logs (user_id, log_date, minutes, note) VALUES (?, ?, ?, ?)").run(
    req.user.id,
    today,
    mins,
    note || null
  );
  res.json({ ok: true, logged: mins });
});

app.get("/api/timer/stats", authRequired, (req, res) => {
  const rows = db
    .prepare("SELECT log_date, SUM(minutes) as minutes FROM time_logs WHERE user_id = ? GROUP BY log_date ORDER BY log_date DESC")
    .all(req.user.id);

  const today = new Date().toISOString().slice(0, 10);
  const todayMinutes = rows.find((r) => r.log_date === today)?.minutes || 0;

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const weekMinutes = rows
    .filter((r) => r.log_date >= startOfWeek.toISOString().slice(0, 10))
    .reduce((sum, r) => sum + r.minutes, 0);

  const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);

  // streak: consecutive days with minutes > 0, counting back from today (or yesterday if not studied yet today)
  const dateSet = new Set(rows.filter((r) => r.minutes > 0).map((r) => r.log_date));
  let streak = 0;
  let cursor = new Date();
  if (!dateSet.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  res.json({
    todayMinutes,
    weekMinutes,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    streak,
    days: rows.slice(0, 30),
  });
});

// ---------- dashboard aggregate stats ----------
app.get("/api/stats", authRequired, (req, res) => {
  const totalItems = curriculum.weeks.reduce((sum, w) => sum + w.checklist.length, 0);
  const doneRows = db
    .prepare("SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND completed = 1")
    .get(req.user.id);
  const completedItems = doneRows.c;

  const quizRows = db
    .prepare("SELECT week, MAX(score) as best, total FROM quiz_attempts WHERE user_id = ? GROUP BY week")
    .all(req.user.id);
  const quizAvg = quizRows.length
    ? Math.round((quizRows.reduce((s, r) => s + r.best / r.total, 0) / quizRows.length) * 100)
    : null;

  // which week is "current": first week with any incomplete item, else last week
  const progressRows = db.prepare("SELECT item_id FROM progress WHERE user_id = ? AND completed = 1").all(req.user.id);
  const doneSet = new Set(progressRows.map((r) => r.item_id));
  let currentWeek = curriculum.weeks[curriculum.weeks.length - 1].week;
  for (const w of curriculum.weeks) {
    const allDone = w.checklist.every((item) => doneSet.has(item.id));
    if (!allDone) {
      currentWeek = w.week;
      break;
    }
  }

  res.json({
    totalItems,
    completedItems,
    percentComplete: Math.round((completedItems / totalItems) * 100),
    quizAvg,
    quizzesTaken: quizRows.length,
    currentWeek,
    totalWeeks: curriculum.weeks.length,
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AI Engineer Academy backend running at http://localhost:${PORT}`);
});
