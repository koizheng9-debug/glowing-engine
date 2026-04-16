// db-pg.js — PostgreSQL version (for cloud deployment on Neon / Render)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper: run a single query
const q = (text, params) => pool.query(text, params);

// ── Init: create schema + seed ──────────────────────────────────────
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

  // ── Seed v1: runtime state ──────────────────────────────────────
  const { rows: s1 } = await q("SELECT 1 FROM seeded WHERE key = 'v1'");
  if (s1.length === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const doneIds = ['d3', 'd4', 'd14', 't1', 't2', 't5', 't10'];
      for (const id of doneIds) {
        await client.query('INSERT INTO task_completed (task_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
      }
      for (const id of ['t7', 't8']) {
        await client.query('INSERT INTO task_in_progress (task_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
      }

      const cal = {
        '2026-04-13': ['t1', 't2', 't7', 't8'],
        '2026-04-14': ['t10', 't5'],
        '2026-04-15': ['t2', 't15', 't19'],
        '2026-04-16': ['t16'],
        '2026-04-17': ['t17'],
      };
      for (const [dayKey, ids] of Object.entries(cal)) {
        for (const id of ids) {
          await client.query('INSERT INTO calendar_assignments (day_key, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [dayKey, id]);
        }
      }

      const dayDone = {
        '2026-04-13': ['t1', 't2', 't7', 't8'],
        '2026-04-14': ['t10', 't5'],
        '2026-04-15': ['t2'],
      };
      for (const [dayKey, ids] of Object.entries(dayDone)) {
        for (const id of ids) {
          await client.query('INSERT INTO day_done (day_key, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [dayKey, id]);
        }
      }

      const people = {
        '2026-04-13': 'Jivesh + storytelling 活动的人',
        '2026-04-14': 'Jivesh + 画画的 Linda & Oscar',
        '2026-04-15': '普拉提nick',
      };
      for (const [dayKey, p] of Object.entries(people)) {
        await client.query('INSERT INTO weekly_people (day_key, people) VALUES ($1, $2) ON CONFLICT DO NOTHING', [dayKey, p]);
      }

      await client.query("INSERT INTO seeded (key) VALUES ('v1')");
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── Seed projects_v1: projects & tasks ──────────────────────────
  const { rows: s2 } = await q("SELECT 1 FROM seeded WHERE key = 'projects_v1'");
  if (s2.length === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date().toISOString();
      const s = (arr) => JSON.stringify(arr || []);

      const ip = 'INSERT INTO projects (id, title, emoji, accent, bg, reason, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING';
      await client.query(ip, ['system', '个人系统 & Workflow', '⚙️', '#6366f1', '#eef2ff', '让自己的信息摄入和思考系统更高效、更顺手。', 0]);
      await client.query(ip, ['work', '工作 & 行业', '💼', '#0ea5e9', '#e0f2fe', '跟自己行业里的人多交流、交朋友——多精进、多讨论。', 1]);
      await client.query(ip, ['investment', '投资研究', '📈', '#10b981', '#d1fae5', '理解自己的投资决策，建立更清醒的判断框架。', 2]);
      await client.query(ip, ['ai', 'AI 研究', '🤖', '#8b5cf6', '#ede9fe', '最感兴趣的方向是 AI 时代的创新创业，多交流、多思考。', 3]);
      await client.query(ip, ['london', '伦敦朋友圈构建', '🏙️', '#f59e0b', '#fef3c7', '在伦敦主动构建自己想要的朋友圈——行业的人、做 AI 创业的人、做艺术的人。每周至少见2个人。', 4]);
      await client.query(ip, ['travel', '出行探索 - 与人交流碰撞', '✈️', '#0ea5e9', '#e0f2fe', '通过出行主动进入新圈层——LV 会议热身，SF/NY/其他城市探索第二 Base 的可能性。', 5]);
      await client.query(ip, ['art', '审美中的不可计算性', '🎨', '#f43f5e', '#ffe4e6', '探索在 AI 时代，艺术和审美里那些无法被计算和复制的东西。', 6]);

      const it = 'INSERT INTO tasks (id, project_id, title, deadline, note, time, priority, steps, calendar_only, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING';
      await client.query(it, ['t13', 'system', '买 Supernote', '4月23日前', '寄到 LV 酒店收货', '', 'later', s(['确认型号', '网上下单，填 LV 酒店地址', '确认快递 4月24日前到']), 0, now]);
      await client.query(it, ['t18', 'work', '后半周与同事打电话', '', '', '', 'week', s(['Simon', 'Leo', '丁丁（新产品）', 'Pat（agent 员工）', 'Tongyuan（agent）', 'Tongyuan 推荐的做技术的人（agent）']), 0, now]);
      await client.query(it, ['t6', 'ai', '读《智慧之旅》— 朱邦复如何从易经看到 AI', '下周内', '', '1-2小时', 'week', s(['重新阅读《智慧之旅》，梳理核心逻辑', '理解他从易经推导出 AI 的思路', '思考这套逻辑对自己的启发']), 0, now]);
      await client.query(it, ['t16', 'london', '见 Matheo & Alyssia', '周四 4/16', '', '', 'week', s(['晚上 19:00']), 1, now]);
      await client.query(it, ['t17', 'london', '见 Mable', '周五 4/17', '', '', 'week', s(['周五见面']), 1, now]);
      await client.query(it, ['t7', 'travel', '查 LV 会议议程 + 排要见的人', '4月13日起，出发前持续', '', '1-2小时', 'week', s(['✓ 4/13 看了 Luma 上的活动', '查会议完整参会名单', '列出想见的人 / 想参加的 side event', '主动联系约 coffee 或 dinner']), 0, now]);
      await client.query(it, ['t8', 'travel', '第二 Base 初步分析', '下周内', '', '半天', 'week', s(['✓ 4/13 打电话给 Qijin，聊了第二 Base 的想法', '重新定义候选城市范围（里斯本、柏林、大湾区、奥斯汀等）', '整理各城市对比维度', '参考 Gemini chat 里的分析，得出初步结论']), 0, now]);
      await client.query(it, ['t15', 'art', '看 Netflix《Abstract》', '本周', '', '', 'week', s(['找时间看 Abstract 纪录片', '记录感受']), 0, now]);
      await client.query(it, ['t9', 'art', 'Turner 电影 — 写观后感', '本周', '', '', 'week', s(['照相机出现的时代，Turner 意味着什么？', '写下真实感受和思考']), 0, now]);
      await client.query(it, ['t19', 'art', '研究 Euan Uglow', '', '', '', 'week', s(['了解 Euan Uglow 的画风和创作方式', '思考他的作品与自己学画的关系', '记录感悟']), 0, now]);

      await client.query(it, ['d3', 'system', '重写 Daily News Project Instruction', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['d4', 'system', '散步播客从 Gemini 迁移到 Claude', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['d14', 'system', '建立下午公园散步工作流', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['t1', 'work', '看 Fred 的邮件', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['t2', 'work', '回复 Matheo 邮件', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['t5', 'investment', '研究 DAT：我为什么会买？什么是泡沫？', '', '', '', 'week', s([]), 0, now]);
      await client.query(it, ['t10', 'art', '画画课（每周持续）', '', '', '', 'week', s([]), 0, now]);

      await client.query("INSERT INTO seeded (key) VALUES ('projects_v1')");
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
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
  return { completedIds, completedDates, inProgressIds, calendarMap, dayDoneMap, weeklyPeople };
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

module.exports = { init, getState, getProjects, completeTask, uncompleteTask, toggleInProgress, assignToDay, removeFromDay, toggleDayDone, setWeeklyPeople, createTask, updateTask, deleteTask, updateProject };
