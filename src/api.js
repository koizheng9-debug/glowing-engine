// All paths are relative — in dev, Vite proxies /api → :3001;
// in production, Express serves everything on the same origin.

export async function fetchState() {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('Failed to load state');
  return res.json();
}

export async function updateProject(id, { title, emoji, reason }) {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, emoji, reason }),
  });
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to load projects');
  return res.json();
}

export async function completeTask(id) {
  const res = await fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
  return res.json();
}

export async function toggleProgress(id) {
  const res = await fetch(`/api/tasks/${id}/toggle-progress`, { method: 'POST' });
  return res.json();
}

export async function createTask({ projectId, title, deadline, note }) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, title, deadline, note }),
  });
  return res.json();
}

export async function updateTask(id, { title, deadline, note, steps }) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, deadline, note, steps }),
  });
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function assignToDay(dayKey, taskId) {
  await fetch('/api/calendar/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayKey, taskId }),
  });
}

export async function removeFromDay(dayKey, taskId) {
  await fetch('/api/calendar/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayKey, taskId }),
  });
}

export async function toggleDayDone(dayKey, taskId) {
  await fetch('/api/day-done/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayKey, taskId }),
  });
}

export async function setWeeklyPeople(dayKey, people) {
  await fetch(`/api/weekly-people/${dayKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ people }),
  });
}
