const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve Vite build in production
app.use(express.static(path.join(__dirname, 'dist')));

// ── API routes (all async) ──────────────────────────────────────────

app.get('/api/state', async (req, res) => {
  try { res.json(await db.getState()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects', async (req, res) => {
  try { res.json(await db.getProjects()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
  const { title, emoji, reason } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  try { await db.updateProject(req.params.id, { title: title.trim(), emoji, reason }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
  const { projectId, title, deadline, note, time, priority, steps, calendarOnly } = req.body;
  if (!projectId || !title || !title.trim()) {
    return res.status(400).json({ error: 'projectId and title are required' });
  }
  const id = 'dyn_' + crypto.randomBytes(6).toString('hex');
  try {
    const task = await db.createTask({ id, projectId, title: title.trim(), deadline, note, time, priority, steps, calendarOnly });
    res.json({ ok: true, task });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', async (req, res) => {
  const { title, deadline, note, steps } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  try { await db.updateTask(req.params.id, { title: title.trim(), deadline, note, steps }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try { await db.deleteTask(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  const completedAt = new Date().toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  });
  try { await db.completeTask(req.params.id, completedAt); res.json({ ok: true, completedAt }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/:id/uncomplete', async (req, res) => {
  try { await db.uncompleteTask(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks/:id/toggle-progress', async (req, res) => {
  try { const inProgress = await db.toggleInProgress(req.params.id); res.json({ ok: true, inProgress }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendar/assign', async (req, res) => {
  const { dayKey, taskId } = req.body;
  try { await db.assignToDay(dayKey, taskId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendar/remove', async (req, res) => {
  const { dayKey, taskId } = req.body;
  try { await db.removeFromDay(dayKey, taskId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/day-done/toggle', async (req, res) => {
  const { dayKey, taskId } = req.body;
  try { const done = await db.toggleDayDone(dayKey, taskId); res.json({ ok: true, done }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/weekly-people/:dayKey', async (req, res) => {
  try { await db.setWeeklyPeople(req.params.dayKey, req.body.people || ''); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Fallback to React app for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── Start (with async init for PG) ─────────────────────────────────

const PORT = process.env.PORT || 3001;

(async () => {
  if (db.init) await db.init();

  app.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
      }
      if (localIP !== 'localhost') break;
    }
    console.log('\n✅ TodoBoard server started');
    console.log(`   本机访问:  http://localhost:${PORT}`);
    console.log(`   手机访问:  http://${localIP}:${PORT}  (需同一 WiFi)\n`);
  });
})();
