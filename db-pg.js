// db-pg.js — PostgreSQL version (for cloud deployment on Neon / Render)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper: run a single query
const q = (text, params) => pool.query(text, params);

// ── Init: create schema ─────────────────────────────────────────────
async function init() {
  await q(`
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
    CREATE TABLE IF NOT EXISTS daily_notes (
      day_key TEXT PRIMARY KEY,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '#6366f1',
      bg TEXT NOT NULL DEFAULT '#eef2ff',
      reason TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      board_column INTEGER NOT NULL DEFAULT 0
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
  // Migration: add board_column if missing (for existing databases)
  try {
    await q("ALTER TABLE projects ADD COLUMN board_column INTEGER NOT NULL DEFAULT 0");
    // Distribute existing projects across 3 columns
    const { rows: projs } = await q('SELECT id, sort_order FROM projects ORDER BY sort_order');
    for (let i = 0; i < projs.length; i++) {
      await q('UPDATE projects SET board_column = $1, sort_order = $2 WHERE id = $3', [i % 3, Math.floor(i / 3), projs[i].id]);
    }
  } catch(e) { /* column already exists */ }
}

// ── Query helpers ───────────────────────────────────────────────────

async function getState() {
  const { rows: completed } = await q('SELECT task_id, completed_at FROM task_completed');
  const completedIds = completed.map(r => r.task_id);
  const completedDates = Object.fromEntries(
    completed.filter(r => r.completed_at).map(r => [r.task_id, r.completed_at])
  );
  const { rows: ipRows } = await q('SELECT task_id FROM task_in_progress');
  const inProgressIds = ipRows.map(r => r.task_id);
  const { rows: calRows } = await q('SELECT day_key, task_id FROM calendar_assignments');
  const calendarMap = {};
  for (const row of calRows) (calendarMap[row.day_key] ||= []).push(row.task_id);
  const { rows: dayDoneRows } = await q('SELECT day_key, task_id FROM day_done');
  const dayDoneMap = {};
  for (const row of dayDoneRows) (dayDoneMap[row.day_key] ||= []).push(row.task_id);
  const { rows: wpRows } = await q('SELECT day_key, people FROM weekly_people');
  const weeklyPeople = Object.fromEntries(wpRows.map(r => [r.day_key, r.people]));
  const { rows: dnRows } = await q('SELECT day_key, notes FROM daily_notes');
  const dailyNotes = Object.fromEntries(dnRows.map(r => [r.day_key, r.notes]));
  return { completedIds, completedDates, inProgressIds, calendarMap, dayDoneMap, weeklyPeople, dailyNotes };
}

async function getProjects() {
  const { rows: projects } = await q('SELECT * FROM projects ORDER BY sort_order');
  const { rows: allTasks } = await q('SELECT * FROM tasks ORDER BY created_at');
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
  await q(
    'INSERT INTO task_completed (task_id, completed_at) VALUES ($1, $2) ON CONFLICT (task_id) DO UPDATE SET completed_at = $2',
    [taskId, completedAt]
  );
}

async function uncompleteTask(taskId) {
  await q('DELETE FROM task_completed WHERE task_id = $1', [taskId]);
}

async function toggleInProgress(taskId) {
  const { rows } = await q('SELECT 1 FROM task_in_progress WHERE task_id = $1', [taskId]);
  if (rows.length > 0) {
    await q('DELETE FROM task_in_progress WHERE task_id = $1', [taskId]);
    return false;
  }
  await q('INSERT INTO task_in_progress (task_id) VALUES ($1)', [taskId]);
  return true;
}

async function assignToDay(dayKey, taskId) {
  await q('INSERT INTO calendar_assignments (day_key, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [dayKey, taskId]);
}

async function removeFromDay(dayKey, taskId) {
  await q('DELETE FROM calendar_assignments WHERE day_key = $1 AND task_id = $2', [dayKey, taskId]);
}

async function toggleDayDone(dayKey, taskId) {
  const { rows } = await q('SELECT 1 FROM day_done WHERE day_key = $1 AND task_id = $2', [dayKey, taskId]);
  if (rows.length > 0) {
    await q('DELETE FROM day_done WHERE day_key = $1 AND task_id = $2', [dayKey, taskId]);
    return false;
  }
  await q('INSERT INTO day_done (day_key, task_id) VALUES ($1, $2)', [dayKey, taskId]);
  return true;
}

async function setWeeklyPeople(dayKey, people) {
  await q(
    'INSERT INTO weekly_people (day_key, people) VALUES ($1, $2) ON CONFLICT (day_key) DO UPDATE SET people = $2',
    [dayKey, people]
  );
}

async function setDailyNotes(dayKey, notes) {
  await q(
    'INSERT INTO daily_notes (day_key, notes) VALUES ($1, $2) ON CONFLICT (day_key) DO UPDATE SET notes = $2',
    [dayKey, notes]
  );
}

async function createTask({ id, projectId, title, deadline, note, time, priority, steps, calendarOnly }) {
  const createdAt = new Date().toISOString();
  await q(
    'INSERT INTO tasks (id, project_id, title, deadline, note, time, priority, steps, calendar_only, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [id, projectId, title, deadline || '', note || '', time || '', priority || 'week', JSON.stringify(steps || []), calendarOnly ? 1 : 0, createdAt]
  );
  return { id, projectId, title, deadline: deadline || '', note: note || '', time: time || '', priority: priority || 'week', steps: steps || [], calendarOnly: !!calendarOnly, createdAt };
}

async function updateTask(id, { title, deadline, note, steps }) {
  await q('UPDATE tasks SET title = $1, deadline = $2, note = $3, steps = $4 WHERE id = $5',
    [title, deadline || '', note || '', JSON.stringify(steps || []), id]);
}

async function createProject({ id, title, emoji, accent, bg, reason }) {
  // Find the column with fewest projects, put new project at the bottom
  const { rows: counts } = await q('SELECT board_column, COUNT(*) as cnt FROM projects GROUP BY board_column');
  const colCounts = [0, 0, 0];
  counts.forEach(r => { if (r.board_column >= 0 && r.board_column <= 2) colCounts[r.board_column] = parseInt(r.cnt); });
  const col = colCounts.indexOf(Math.min(...colCounts));
  const { rows } = await q('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM projects WHERE board_column = $1', [col]);
  const sortOrder = rows[0].next;
  await q(
    'INSERT INTO projects (id, title, emoji, accent, bg, reason, sort_order, board_column) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, title, emoji || '', accent || '#6366f1', bg || '#eef2ff', reason || '', sortOrder, col]
  );
  return { id, title, emoji: emoji || '', accent: accent || '#6366f1', bg: bg || '#eef2ff', reason: reason || '', sort_order: sortOrder, board_column: col };
}

async function updateProject(id, { title, emoji, reason }) {
  await q('UPDATE projects SET title = $1, emoji = $2, reason = $3 WHERE id = $4',
    [title, emoji || '', reason || '', id]);
}

async function deleteTask(id) {
  await q('DELETE FROM tasks WHERE id = $1', [id]);
  await q('DELETE FROM task_completed WHERE task_id = $1', [id]);
  await q('DELETE FROM task_in_progress WHERE task_id = $1', [id]);
  await q('DELETE FROM calendar_assignments WHERE task_id = $1', [id]);
  await q('DELETE FROM day_done WHERE task_id = $1', [id]);
}

async function getHabits() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'weekly_habits'");
  return rows.length ? JSON.parse(rows[0].value) : null;
}

async function setHabits(habits) {
  await q(
    "INSERT INTO settings (key, value) VALUES ('weekly_habits', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [JSON.stringify(habits)]
  );
}

async function reorderProjects(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await q('UPDATE projects SET sort_order = $1 WHERE id = $2', [i, orderedIds[i]]);
  }
}

async function moveProject(projectId, targetColumn, targetIndex) {
  await q('UPDATE projects SET board_column = $1, sort_order = $2 WHERE id = $3', [targetColumn, targetIndex, projectId]);
  // Re-index all projects in the target column to avoid gaps
  const { rows: projs } = await q('SELECT id FROM projects WHERE board_column = $1 AND id != $2 ORDER BY sort_order', [targetColumn, projectId]);
  let idx = 0;
  for (const p of projs) {
    if (idx === targetIndex) idx++;
    await q('UPDATE projects SET sort_order = $1 WHERE id = $2', [idx, p.id]);
    idx++;
  }
}

module.exports = { init, getState, getProjects, completeTask, uncompleteTask, toggleInProgress, assignToDay, removeFromDay, toggleDayDone, setWeeklyPeople, setDailyNotes, createTask, updateTask, deleteTask, createProject, updateProject, getHabits, setHabits, reorderProjects, moveProject };
