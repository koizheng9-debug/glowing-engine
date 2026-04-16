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
  CREATE TABLE IF NOT EXISTS seeded (
    key TEXT PRIMARY KEY
  );
`);

// ── Seed: runtime state (v1) ─────────────────────────────────────────
const isSeeded = db.prepare("SELECT 1 AS one FROM seeded WHERE key = 'v1'").get();
if (!isSeeded) {
  db.exec('BEGIN');
  try {
    const initialDoneIds = ['d3', 'd4', 'd14', 't1', 't2', 't5', 't10'];
    const insertDone = db.prepare('INSERT OR IGNORE INTO task_completed (task_id) VALUES (?)');
    for (const id of initialDoneIds) insertDone.run(id);

    const insertProgress = db.prepare('INSERT OR IGNORE INTO task_in_progress (task_id) VALUES (?)');
    for (const id of ['t7', 't8']) insertProgress.run(id);

    const cal = {
      '2026-04-13': ['t1', 't2', 't7', 't8'],
      '2026-04-14': ['t10', 't5'],
      '2026-04-15': ['t2', 't15', 't19'],
      '2026-04-16': ['t16'],
      '2026-04-17': ['t17'],
    };
    const insertCal = db.prepare('INSERT OR IGNORE INTO calendar_assignments (day_key, task_id) VALUES (?, ?)');
    for (const [dayKey, ids] of Object.entries(cal)) {
      for (const id of ids) insertCal.run(dayKey, id);
    }

    const dayDone = {
      '2026-04-13': ['t1', 't2', 't7', 't8'],
      '2026-04-14': ['t10', 't5'],
      '2026-04-15': ['t2'],
    };
    const insertDayDone = db.prepare('INSERT OR IGNORE INTO day_done (day_key, task_id) VALUES (?, ?)');
    for (const [dayKey, ids] of Object.entries(dayDone)) {
      for (const id of ids) insertDayDone.run(dayKey, id);
    }

    const people = {
      '2026-04-13': 'Jivesh + storytelling 活动的人',
      '2026-04-14': 'Jivesh + 画画的 Linda & Oscar',
      '2026-04-15': '普拉提nick',
    };
    const insertPeople = db.prepare('INSERT OR IGNORE INTO weekly_people (day_key, people) VALUES (?, ?)');
    for (const [dayKey, p] of Object.entries(people)) insertPeople.run(dayKey, p);

    db.prepare("INSERT INTO seeded (key) VALUES ('v1')").run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ── Seed: projects & tasks (projects_v1) ────────────────────────────
const projectsSeeded = db.prepare("SELECT 1 AS one FROM seeded WHERE key = 'projects_v1'").get();
if (!projectsSeeded) {
  db.exec('BEGIN');
  try {
    const insertProject = db.prepare(
      'INSERT OR IGNORE INTO projects (id, title, emoji, accent, bg, reason, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertTask = db.prepare(
      'INSERT OR IGNORE INTO tasks (id, project_id, title, deadline, note, time, priority, steps, calendar_only, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    const s = (arr) => JSON.stringify(arr || []);

    insertProject.run('system',     '个人系统 & Workflow',      '⚙️',  '#6366f1', '#eef2ff', '让自己的信息摄入和思考系统更高效、更顺手。', 0);
    insertProject.run('work',       '工作 & 行业',               '💼',  '#0ea5e9', '#e0f2fe', '跟自己行业里的人多交流、交朋友——多精进、多讨论。', 1);
    insertProject.run('investment', '投资研究',                  '📈',  '#10b981', '#d1fae5', '理解自己的投资决策，建立更清醒的判断框架。', 2);
    insertProject.run('ai',         'AI 研究',                   '🤖',  '#8b5cf6', '#ede9fe', '最感兴趣的方向是 AI 时代的创新创业，多交流、多思考。', 3);
    insertProject.run('london',     '伦敦朋友圈构建',             '🏙️', '#f59e0b', '#fef3c7', '在伦敦主动构建自己想要的朋友圈——行业的人、做 AI 创业的人、做艺术的人。每周至少见2个人。', 4);
    insertProject.run('travel',     '出行探索 - 与人交流碰撞',   '✈️',  '#0ea5e9', '#e0f2fe', '通过出行主动进入新圈层——LV 会议热身，SF/NY/其他城市探索第二 Base 的可能性。', 5);
    insertProject.run('art',        '审美中的不可计算性',         '🎨',  '#f43f5e', '#ffe4e6', '探索在 AI 时代，艺术和审美里那些无法被计算和复制的东西。', 6);

    insertTask.run('t13', 'system', '买 Supernote', '4月23日前', '寄到 LV 酒店收货', '', 'later', s(['确认型号', '网上下单，填 LV 酒店地址', '确认快递 4月24日前到']), 0, now);
    insertTask.run('t18', 'work', '后半周与同事打电话', '', '', '', 'week', s(['Simon', 'Leo', '丁丁（新产品）', 'Pat（agent 员工）', 'Tongyuan（agent）', 'Tongyuan 推荐的做技术的人（agent）']), 0, now);
    insertTask.run('t6', 'ai', '读《智慧之旅》— 朱邦复如何从易经看到 AI', '下周内', '', '1-2小时', 'week', s(['重新阅读《智慧之旅》，梳理核心逻辑', '理解他从易经推导出 AI 的思路', '思考这套逻辑对自己的启发']), 0, now);
    insertTask.run('t16', 'london', '见 Matheo & Alyssia', '周四 4/16', '', '', 'week', s(['晚上 19:00']), 1, now);
    insertTask.run('t17', 'london', '见 Mable', '周五 4/17', '', '', 'week', s(['周五见面']), 1, now);
    insertTask.run('t7', 'travel', '查 LV 会议议程 + 排要见的人', '4月13日起，出发前持续', '', '1-2小时', 'week', s(['✓ 4/13 看了 Luma 上的活动', '查会议完整参会名单', '列出想见的人 / 想参加的 side event', '主动联系约 coffee 或 dinner']), 0, now);
    insertTask.run('t8', 'travel', '第二 Base 初步分析', '下周内', '', '半天', 'week', s(['✓ 4/13 打电话给 Qijin，聊了第二 Base 的想法', '重新定义候选城市范围（里斯本、柏林、大湾区、奥斯汀等）', '整理各城市对比维度', '参考 Gemini chat 里的分析，得出初步结论']), 0, now);
    insertTask.run('t15', 'art', '看 Netflix《Abstract》', '本周', '', '', 'week', s(['找时间看 Abstract 纪录片', '记录感受']), 0, now);
    insertTask.run('t9', 'art', 'Turner 电影 — 写观后感', '本周', '', '', 'week', s(['照相机出现的时代，Turner 意味着什么？', '写下真实感受和思考']), 0, now);
    insertTask.run('t19', 'art', '研究 Euan Uglow', '', '', '', 'week', s(['了解 Euan Uglow 的画风和创作方式', '思考他的作品与自己学画的关系', '记录感悟']), 0, now);

    insertTask.run('d3', 'system', '重写 Daily News Project Instruction', '', '', '', 'week', s([]), 0, now);
    insertTask.run('d4', 'system', '散步播客从 Gemini 迁移到 Claude', '', '', '', 'week', s([]), 0, now);
    insertTask.run('d14', 'system', '建立下午公园散步工作流', '', '', '', 'week', s([]), 0, now);
    insertTask.run('t1', 'work', '看 Fred 的邮件', '', '', '', 'week', s([]), 0, now);
    insertTask.run('t2', 'work', '回复 Matheo 邮件', '', '', '', 'week', s([]), 0, now);
    insertTask.run('t5', 'investment', '研究 DAT：我为什么会买？什么是泡沫？', '', '', '', 'week', s([]), 0, now);
    insertTask.run('t10', 'art', '画画课（每周持续）', '', '', '', 'week', s([]), 0, now);

    db.prepare("INSERT INTO seeded (key) VALUES ('projects_v1')").run();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ── Migrate dynamic_tasks → tasks (migrate_dyn_v1) ──────────────────
const dynMigrated = db.prepare("SELECT 1 AS one FROM seeded WHERE key = 'migrate_dyn_v1'").get();
if (!dynMigrated) {
  try {
    const tableExists = db.prepare("SELECT 1 AS one FROM sqlite_master WHERE type='table' AND name='dynamic_tasks'").get();
    if (tableExists) {
      const dynTasks = db.prepare('SELECT * FROM dynamic_tasks').all();
      const ins = db.prepare('INSERT OR IGNORE INTO tasks (id, project_id, title, deadline, note, time, priority, steps, calendar_only, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const t of dynTasks) {
        ins.run(t.id, t.project_id, t.title, t.deadline || '', t.note || '', '', 'week', '[]', 0, t.created_at || new Date().toISOString());
      }
    }
    db.prepare("INSERT OR IGNORE INTO seeded (key) VALUES ('migrate_dyn_v1')").run();
  } catch (e) { /* ignore */ }
}

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

module.exports = { init, getState, getProjects, completeTask, toggleInProgress, assignToDay, removeFromDay, toggleDayDone, setWeeklyPeople, createTask, updateTask, deleteTask, updateProject };
