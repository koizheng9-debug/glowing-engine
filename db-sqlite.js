// db-sqlite.js — async wrapper around Node.js built-in SQLite (for local dev)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'todoboard.db'));

// ── Schema ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS task_completed (
    task_id TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS task_in_progress (
    task_id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS calendar_assignments (
    day_key TEXT NOT NULL,
    task_id TEXT NOT NULL,
    PRIMARY KEY (day_key, task_id)
  );
  CREATE TABLE IF NOT EXISTS day_done (
    day_key TEXT NOT NULL,
    task_id TEXT NOT NULL,
    PRIMARY KEY (day_key, task_id)
  );
  CREATE TABLE IF NOT EXISTS weekly_people (
    day_key TEXT PRIMARY KEY,
    people TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '#6366f1',
    bg TEXT NOT NULL DEFAULT '#eef2ff',
    reason TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    deadline TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'week',
    steps TEXT NOT NULL DEFAULT '[]',
    calendar_only INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );
`);

// ── Async-wrapped query helpers ─────────────────────────────────────

async function init() {
  // SQLite schema already created synchronously above — nothing to do
}

async function getState() {
  const completed = db.prepare('SELECT task_id, completed_at FROM task_completed').all();
  const completedIds = completed.map(r => r.task_id);
  const completedDates = Object.fromEntries(
    completed.filter(r => r.completed_at).map(r => [r.task_id, r.completed_at])
  );
  const inProgressIds = db.prepare('SELECT task_id FROM task_in_progress').all().map(r => r.task_id);
  const calRows = db.prepare('SELECT day_key, task_id FROM calendar_assignments').all();
  const calendarMap = {};
  for (const row of calRows) (calendarMap[row.day_key] ||= []).push(row.task_id);
  const dayDoneRows = db.prepare('SELECT day_key, task_id FROM day_done').all();
  const dayDoneMap = {};
  for (const row of dayDoneRows) (dayDoneMap[row.day_key] ||= []).push(row.task_id);
  const weeklyPeople = Object.fromEntries(
    db.prepare('SELECT day_key, people FROM weekly_people').all().map(r => [r.day_key, r.people])
  );
  return { completedIds, completedDates, inProgressIds, calendarMap, dayDoneMap, weeklyPeople };
}

async function getProjects() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order').all();
  const allTasks = db.prepare('SELECT * FROM tasks ORDER BY created_at').all();
  return projects.map(p => ({
    ...p,
    tasks: allTasks
      .filter(t => t.project_id === p.id)
      .map(t => ({
        ...t, projectId: p.id,
        steps: JSON.parse(t.steps || '[]'),
        calendarOnly: !!t.calendar_only,
      })),
  }));
}

async function completeTask(taskId, completedAt) {
  db.prepare('INSERT OR REPLACE INTO task_completed (task_id, completed_at) VALUES (?, ?)').run(taskId, completedAt);
}

async function uncompleteTask(taskId) {
  db.prepare('DELETE FROM task_completed WHERE task_id = ?').run(taskId);
}

async function toggleInProgress(taskId) {
  const exists = db.prepare('SELECT 1 AS one FROM task_in_progress WHERE task_id = ?').get(taskId);
  if (exists) { db.prepare('DELETE FROM task_in_progress WHERE task_id = ?').run(taskId); return false; }
  db.prepare('INSERT INTO task_in_progress (task_id) VALUES (?)').run(taskId);
  return true;
}

async function assignToDay(dayKey, taskId) {
  db.prepare('INSERT OR IGNORE INTO calendar_assignments (day_key, task_id) VALUES (?, ?)').run(dayKey, taskId);
}

async function removeFromDay(dayKey, taskId) {
  db.prepare('DELETE FROM calendar_assignments WHERE day_key = ? AND task_id = ?').run(dayKey, taskId);
}

async function toggleDayDone(dayKey, taskId) {
  const exists = db.prepare('SELECT 1 AS one FROM day_done WHERE day_key = ? AND task_id = ?').get(dayKey, taskId);
  if (exists) { db.prepare('DELETE FROM day_done WHERE day_key = ? AND task_id = ?').run(dayKey, taskId); return false; }
  db.prepare('INSERT INTO day_done (day_key, task_id) VALUES (?, ?)').run(dayKey, taskId);
  return true;
}

async function setWeeklyPeople(dayKey, people) {
  db.prepare('INSERT OR REPLACE INTO weekly_people (day_key, people) VALUES (?, ?)').run(dayKey, people);
}

async function createTask({ id, projectId, title, deadline, note, time, priority, steps, calendarOnly }) {
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO tasks (id, project_id, title, deadline, note, time, priority, steps, calendar_only, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, title, deadline || '', note || '', time || '', priority || 'week', JSON.stringify(steps || []), calendarOnly ? 1 : 0, createdAt);
  return { id, projectId, title, deadline: deadline || '', note: note || '', time: time || '', priority: priority || 'week', steps: steps || [], calendarOnly: !!calendarOnly, createdAt };
}

async function updateTask(id, { title, deadline, note, steps }) {
  db.prepare('UPDATE tasks SET title = ?, deadline = ?, note = ?, steps = ? WHERE id = ?')
    .run(title, deadline || '', note || '', JSON.stringify(steps || []), id);
}

async function createProject({ id, title, emoji, accent, bg, reason }) {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM projects').get();
  const sortOrder = row.next;
  db.prepare('INSERT INTO projects (id, title, emoji, accent, bg, reason, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, title, emoji || '', accent || '#6366f1', bg || '#eef2ff', reason || '', sortOrder);
  return { id, title, emoji: emoji || '', accent: accent || '#6366f1', bg: bg || '#eef2ff', reason: reason || '', sort_order: sortOrder };
}

async function updateProject(id, { title, emoji, reason }) {
  db.prepare('UPDATE projects SET title = ?, emoji = ?, reason = ? WHERE id = ?').run(title, emoji || '', reason || '', id);
}

async function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  db.prepare('DELETE FROM task_completed WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM task_in_progress WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM calendar_assignments WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM day_done WHERE task_id = ?').run(id);
}

async function getHabits() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'weekly_habits'").get();
  return row ? JSON.parse(row.value) : null;
}

async function setHabits(habits) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('weekly_habits', ?)").run(JSON.stringify(habits));
}

async function reorderProjects(orderedIds) {
  const stmt = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?');
  for (let i = 0; i < orderedIds.length; i++) {
    stmt.run(i, orderedIds[i]);
  }
}

module.exports = { init, getState, getProjects, completeTask, uncompleteTask, toggleInProgress, assignToDay, removeFromDay, toggleDayDone, setWeeklyPeople, createTask, updateTask, deleteTask, createProject, updateProject, getHabits, setHabits, reorderProjects };
