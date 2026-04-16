import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api";

// ── Static UI constants (not task data) ─────────────────────────────
const WEEKLY_HABITS = [
  { id: "h1", text: "至少见 2 个朋友", emoji: "🤝" },
  { id: "h2", text: "画画课", emoji: "🎨" },
  { id: "h3", text: "每天散步 + 听播客", emoji: "🎧" },
  { id: "h4", text: "看我的 Daily News + Twitter 总结系统", emoji: "📰" },
];

const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      date: d,
      dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: d.toDateString() === today.toDateString(),
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    };
  });
}

// ── Components ───────────────────────────────────────────────────────

function TaskRow({ task, accent, bg, done, onComplete, onUncomplete, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDeadline, setEditDeadline] = useState(task.deadline || "");
  const [editSteps, setEditSteps] = useState(task.steps || []);
  const [hovered, setHovered] = useState(false);
  const titleRef = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setEditTitle(task.title);
    setEditDeadline(task.deadline || "");
    setEditSteps(task.steps || []);
    setEditing(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate && onUpdate(task.id, {
      title: editTitle.trim(),
      deadline: editDeadline,
      note: task.note,
      steps: editSteps.filter(s => s.trim()),
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ borderTop: "1px solid #f3f4f6", padding: "10px 14px 12px", background: bg, borderLeft: `2px solid ${accent}` }}>
        {/* 标题 */}
        <div style={{ fontSize: 9.5, color: "#9ca3af", marginBottom: 3 }}>标题</div>
        <input
          ref={titleRef}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => e.key === "Escape" && cancelEdit()}
          style={{ width: "100%", fontSize: 13, fontWeight: 500, border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", outline: "none", color: "#1f2937", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
        />
        {/* 截止时间 */}
        <div style={{ fontSize: 9.5, color: "#9ca3af", marginBottom: 3 }}>截止时间</div>
        <input
          value={editDeadline}
          onChange={e => setEditDeadline(e.target.value)}
          placeholder="如：本周五、4月20日"
          onKeyDown={e => e.key === "Escape" && cancelEdit()}
          style={{ width: "100%", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", outline: "none", color: "#374151", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
        />
        {/* 内容步骤 */}
        <div style={{ fontSize: 9.5, color: "#9ca3af", marginBottom: 5 }}>内容</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
          {editSteps.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: accent, flexShrink: 0 }}>◆</span>
              <input
                value={step}
                onChange={e => setEditSteps(prev => prev.map((s, idx) => idx === i ? e.target.value : s))}
                onKeyDown={e => e.key === "Escape" && cancelEdit()}
                style={{ flex: 1, fontSize: 11.5, border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 7px", outline: "none", color: "#374151", fontFamily: "inherit", background: "#fff" }}
              />
              <button onClick={() => setEditSteps(prev => prev.filter((_, idx) => idx !== i))}
                style={{ fontSize: 11, color: "#d1d5db", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
            </div>
          ))}
          <button
            onClick={() => setEditSteps(prev => [...prev, ""])}
            style={{ alignSelf: "flex-start", fontSize: 11, color: accent, background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginTop: 2 }}
          >+ 添加步骤</button>
        </div>
        {/* 操作按钮 */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={saveEdit} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>保存</button>
          <button onClick={cancelEdit} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}>取消</button>
          {onDelete && (
            <button onClick={() => { if (window.confirm("确定删除这个任务吗？")) onDelete(task.id); }}
              style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#ef4444", cursor: "pointer", marginLeft: "auto" }}>删除</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid #f3f4f6" }}>
      <div
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "9px 14px", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.background = bg; setHovered(true); }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; setHovered(false); }}
      >
        <div style={{ flex: 1 }} onClick={() => task.steps?.length && setOpen(!open)}>
          <p style={{ fontSize: 12.5, color: done ? "#c4c4c4" : "#374151", textDecoration: done ? "line-through" : "none", lineHeight: 1.4, marginBottom: done ? 0 : 3 }}>{task.title}</p>
          {!done && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {task.deadline && <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{task.deadline}</span>}
              {task.time && <span style={{ fontSize: 10.5, background: "#f3f4f6", color: "#9ca3af", padding: "1px 5px", borderRadius: 4 }}>⏱ {task.time}</span>}
              {task.note && <span style={{ fontSize: 10.5, color: "#fb923c" }}>{task.note}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6, flexShrink: 0 }}>
          {!done && hovered && onUpdate && (
            <button onClick={startEdit} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer", whiteSpace: "nowrap" }}>编辑</button>
          )}
          {!done && onComplete && (
            <>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#dbeafe", color: "#2563eb", fontWeight: 500, whiteSpace: "nowrap" }}>进行中</span>
              <button onClick={() => onComplete(task.id)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", color: "#9ca3af", cursor: "pointer", whiteSpace: "nowrap" }}>✓ 完成</button>
            </>
          )}
          {done && (
            <>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#d1fae5", color: "#059669", fontWeight: 500, whiteSpace: "nowrap" }}>已完成</span>
              {onUncomplete && (
                <button onClick={() => onUncomplete(task.id)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #d1d5db", background: "transparent", color: "#9ca3af", cursor: "pointer", whiteSpace: "nowrap" }}>↩ 恢复</button>
              )}
            </>
          )}
          {task.steps?.length > 0 && <span onClick={() => setOpen(!open)} style={{ fontSize: 9, color: "#d1d5db", cursor: "pointer" }}>{open ? "▲" : "▼"}</span>}
        </div>
      </div>
      {open && task.steps?.length > 0 && (
        <div style={{ padding: "0 14px 10px", background: bg }}>
          {task.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 5 }}>
              <span style={{ fontSize: 9, color: accent, marginTop: 3, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: 11.5, color: "#6b7280", lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DoneSection({ tasks, accent, bg, onUncomplete }) {
  const [open, setOpen] = useState(false);
  if (!tasks || tasks.length === 0) return null;
  return (
    <div style={{ borderTop: "1px solid #f3f4f6" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "7px 14px", cursor: "pointer" }}
        onClick={() => setOpen(!open)}
        onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ fontSize: 10.5, color: "#d1d5db" }}>✅ 已完成 {tasks.length} 项</span>
        <span style={{ fontSize: 9, color: "#e5e7eb", marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && tasks.map(t => <TaskRow key={t.id} task={t} accent={accent} bg={bg} done onUncomplete={onUncomplete} />)}
    </div>
  );
}

function AddTaskInline({ project, onAdd }) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const inputRef = useRef(null);

  const open = () => { setActive(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const cancel = () => { setActive(false); setTitle(""); setDeadline(""); };
  const submit = () => {
    if (!title.trim()) return;
    onAdd({ projectId: project.id, title: title.trim(), deadline });
    setTitle(""); setDeadline(""); setActive(false);
  };

  if (!active) {
    return (
      <div style={{ borderTop: "1px solid #f3f4f6" }}>
        <button
          onClick={open}
          style={{ width: "100%", padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12, color: "#d1d5db", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={e => { e.currentTarget.style.background = project.bg; e.currentTarget.style.color = project.accent; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#d1d5db"; }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> 添加任务
        </button>
      </div>
    );
  }

  return (
    <div style={{ borderTop: `2px solid ${project.accent}`, padding: "10px 14px", background: project.bg }}>
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
        placeholder="任务标题…"
        style={{ width: "100%", fontSize: 13, border: "none", background: "transparent", outline: "none", color: "#1f2937", marginBottom: 6, fontFamily: "inherit" }}
      />
      <input
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
        placeholder="截止日期（可选，如：本周五）"
        style={{ width: "100%", fontSize: 11.5, border: "none", background: "transparent", outline: "none", color: "#9ca3af", marginBottom: 8, fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={submit} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 7, border: "none", background: project.accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>添加</button>
        <button onClick={cancel} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}>取消</button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onComplete, onUncomplete, onAddTask, onUpdateTask, onDeleteTask, onUpdateProject }) {
  const [open, setOpen] = useState(true);
  const [showReason, setShowReason] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editEmoji, setEditEmoji] = useState(project.emoji);
  const [editReason, setEditReason] = useState(project.reason);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project.title);
  const nameRef = useRef(null);

  const saveProject = () => {
    if (!editTitle.trim()) return;
    onUpdateProject && onUpdateProject(project.id, { title: editTitle.trim(), emoji: editEmoji, reason: editReason });
    setEditingProject(false);
  };
  const cancelProjectEdit = () => {
    setEditTitle(project.title); setEditEmoji(project.emoji); setEditReason(project.reason);
    setEditingProject(false);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f0f0f0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 10 }}>
      {/* Header */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", cursor: "pointer", borderLeft: `3px solid ${project.accent}`, background: open ? project.bg : "#fff", transition: "background 0.15s" }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        onClick={() => !editingName && setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14 }}>{project.emoji}</span>
          {editingName ? (
            <input
              ref={nameRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (nameValue.trim()) {
                    onUpdateProject && onUpdateProject(project.id, { title: nameValue.trim(), emoji: project.emoji, reason: project.reason });
                  }
                  setEditingName(false);
                }
                if (e.key === "Escape") { setNameValue(project.title); setEditingName(false); }
              }}
              onBlur={() => {
                if (nameValue.trim() && nameValue.trim() !== project.title) {
                  onUpdateProject && onUpdateProject(project.id, { title: nameValue.trim(), emoji: project.emoji, reason: project.reason });
                }
                setEditingName(false);
              }}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#1f2937", border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 8px", outline: "none", background: "#fff", fontFamily: "inherit", flex: 1, minWidth: 0 }}
            />
          ) : (
            <p
              style={{ fontSize: 12.5, fontWeight: 600, color: "#1f2937", cursor: "text", borderBottom: headerHovered ? "1px dashed #d1d5db" : "1px solid transparent" }}
              onClick={e => { e.stopPropagation(); setNameValue(project.title); setEditingName(true); setTimeout(() => nameRef.current?.focus(), 50); }}
            >{project.title}</p>
          )}
          {!editingName && project.doneTasks?.length > 0 && <span style={{ fontSize: 9.5, background: "#f3f4f6", color: "#9ca3af", padding: "1px 6px", borderRadius: 99 }}>{project.doneTasks.length} ✓</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerHovered && onUpdateProject && !editingName && (
            <button
              onClick={e => { e.stopPropagation(); setEditTitle(project.title); setEditEmoji(project.emoji); setEditReason(project.reason); setEditingProject(true); setOpen(true); }}
              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}
            >编辑项目</button>
          )}
          <span style={{ fontSize: 9, color: "#d1d5db" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <>
          {/* Project edit form */}
          {editingProject ? (
            <div style={{ padding: "10px 14px 12px", background: project.bg, borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)}
                  style={{ width: 36, fontSize: 16, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px", fontFamily: "inherit", background: "#fff" }} />
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveProject(); if (e.key === "Escape") cancelProjectEdit(); }}
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontFamily: "inherit", background: "#fff", color: "#1f2937" }} />
              </div>
              <textarea value={editReason} onChange={e => setEditReason(e.target.value)}
                placeholder="为什么做这个项目？"
                rows={2}
                style={{ width: "100%", fontSize: 11.5, border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", fontFamily: "inherit", color: "#6b7280", resize: "none", marginBottom: 8, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveProject} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: project.accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>保存</button>
                <button onClick={cancelProjectEdit} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", cursor: "pointer" }}>取消</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "5px 14px 2px" }}>
              <span style={{ fontSize: 10.5, color: project.accent, cursor: "pointer", opacity: 0.7 }} onClick={() => setShowReason(!showReason)}>
                {showReason ? "收起 ▲" : "为什么做 ▼"}
              </span>
            </div>
          )}

          {!editingProject && showReason && (
            <div style={{ margin: "0 14px 8px", padding: "7px 10px", background: project.bg, borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>{project.reason}</p>
            </div>
          )}

          <div>
            {project.tasks.map(t => <TaskRow key={t.id} task={t} accent={project.accent} bg={project.bg} onComplete={onComplete} onUpdate={onUpdateTask} onDelete={onDeleteTask} />)}
            <DoneSection tasks={project.doneTasks} accent={project.accent} bg={project.bg} onUncomplete={onUncomplete} />
            <AddTaskInline project={project} onAdd={onAddTask} />
          </div>
        </>
      )}
    </div>
  );
}

function FlatTaskCard({ task, onComplete, done, completedDate }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fff", borderRadius: 11, border: "1px solid #f0f0f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", opacity: done ? 0.5 : 1 }}>
      <div
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 14px", borderLeft: `3px solid ${task.projectAccent}` }}
        onMouseEnter={e => e.currentTarget.style.background = task.projectBg}
        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
      >
        <div style={{ flex: 1, cursor: task.steps?.length ? "pointer" : "default" }} onClick={() => task.steps?.length && setOpen(!open)}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, color: done ? "#9ca3af" : "#1f2937", fontWeight: 500, textDecoration: done ? "line-through" : "none", lineHeight: 1.4 }}>{task.title}</p>
            <span style={{ fontSize: 10, color: task.projectAccent, opacity: 0.7 }}>{task.projectEmoji} {task.projectTitle}</span>
          </div>
          {!done && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 3 }}>
              {task.deadline && <span style={{ fontSize: 11, color: "#9ca3af" }}>{task.deadline}</span>}
              {task.time && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#9ca3af", padding: "1px 6px", borderRadius: 4 }}>⏱ {task.time}</span>}
              {task.note && <span style={{ fontSize: 11, color: "#fb923c" }}>{task.note}</span>}
            </div>
          )}
          {done && completedDate && (
            <div style={{ marginTop: 3 }}>
              <span style={{ fontSize: 10.5, color: "#10b981" }}>✓ {completedDate}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, flexShrink: 0 }}>
          {!done && onComplete && (
            <button onClick={() => onComplete(task.id)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: `1px solid ${task.projectAccent}`, background: "transparent", color: task.projectAccent, cursor: "pointer" }}>完成</button>
          )}
          {task.steps?.length > 0 && <span onClick={() => setOpen(!open)} style={{ fontSize: 9, color: "#d1d5db", cursor: "pointer" }}>{open ? "▲" : "▼"}</span>}
        </div>
      </div>
      {open && task.steps?.length > 0 && (
        <div style={{ padding: "8px 14px 12px", background: task.projectBg, borderTop: "1px solid #f3f4f6" }}>
          {task.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 5 }}>
              <span style={{ fontSize: 9, color: task.projectAccent, marginTop: 3, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Week View ────────────────────────────────────────────────────────

function UnscheduledRow({ task: t, onComplete, onDragStart, onTap }) {
  const [open, setOpen] = useState(false);
  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} style={{ borderTop: "1px solid #f3f4f6" }}>
      <div
        style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, cursor: onDragStart ? "grab" : "default" }}
        onMouseEnter={e => e.currentTarget.style.background = t.projectBg}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ width: 3, height: 28, borderRadius: 2, background: t.projectAccent, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12.5, color: "#374151" }}>{t.title}</p>
          <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: t.projectAccent, opacity: 0.7 }}>{t.projectEmoji} {t.projectTitle}</span>
            {t.time && <span style={{ fontSize: 10, color: "#9ca3af" }}>⏱ {t.time}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={onTap} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #9ca3af", background: "transparent", color: "#6b7280", cursor: "pointer" }}>排入</button>
          <button onClick={() => onComplete(t.id)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid " + t.projectAccent, background: "transparent", color: t.projectAccent, cursor: "pointer" }}>完成</button>
          {t.steps?.length > 0 && <span onClick={() => setOpen(!open)} style={{ fontSize: 9, color: "#d1d5db", cursor: "pointer" }}>{open ? "▲" : "▼"}</span>}
        </div>
      </div>
      {open && t.steps?.length > 0 && (
        <div style={{ padding: "0 14px 10px 32px", background: t.projectBg }}>
          {t.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 5 }}>
              <span style={{ fontSize: 9, color: t.projectAccent, marginTop: 3, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: 11.5, color: "#6b7280", lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekView({
  allTasksFlat, completedIds, onComplete,
  calendarMap, dayDoneMap, weeklyPeople,
  onAssignToDay, onRemoveFromDay, onToggleDayDone,
}) {
  const [picking, setPicking] = useState(null);
  const [dragging, setDragging] = useState(null);
  const weekDates = getWeekDates();

  const schedulableTasks = allTasksFlat.filter(t => t.priority !== "later" && !t.calendarOnly);
  const activeTasks = schedulableTasks.filter(t => !completedIds.includes(t.id));
  const taskById = (id) => allTasksFlat.find(t => t.id === id);

  const assignToDay = async (dayKey, taskId) => {
    await onAssignToDay(dayKey, taskId);
    setPicking(null);
    setDragging(null);
  };

  const scheduledIds = new Set(Object.values(calendarMap).flat());
  const unscheduled = activeTasks.filter(t => !scheduledIds.has(t.id));

  return (
    <div>
      {picking && (
        <div onClick={() => setPicking(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 16px 40px", width: "100%" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 16, textAlign: "center" }}>放到哪天？</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {weekDates.map(day => (
                <button key={day.key} onClick={() => assignToDay(day.key, picking)}
                  style={{ padding: "12px 4px", borderRadius: 12, border: day.isToday ? "2px solid #0ea5e9" : "1px solid #e5e7eb", background: day.isToday ? "#e0f2fe" : "#f9fafb", cursor: "pointer", fontSize: 13, color: day.isToday ? "#0ea5e9" : "#374151", fontWeight: day.isToday ? 700 : 400 }}>
                  {day.label}<br/><span style={{ fontSize: 11, color: "#9ca3af" }}>{day.dateStr}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(null)} style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 13, color: "#9ca3af" }}>取消</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {WEEKLY_HABITS.map(h => (
          <span key={h.id} style={{ fontSize: 11.5, color: "#6b7280", background: "#f9fafb", padding: "4px 10px", borderRadius: 99, border: "1px solid #f0f0f0" }}>
            {h.emoji} {h.text}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16 }}>
        {weekDates.map(day => {
          const dayTasks = (calendarMap[day.key] || []).map(taskById).filter(Boolean);
          return (
            <div key={day.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragging) assignToDay(day.key, dragging); }}
                style={{ background: day.isToday ? "#f0f9ff" : "#fff", borderRadius: 10, border: day.isToday ? "1.5px solid #0ea5e9" : "1px solid #f0f0f0", padding: "8px 6px", height: 300, overflow: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: day.isToday ? 700 : 500, color: day.isToday ? "#0ea5e9" : "#9ca3af", marginBottom: 8, textAlign: "center" }}>
                  {day.label}<br/><span style={{ fontSize: 11, fontWeight: 400 }}>{day.dateStr}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayTasks.map(t => {
                    const isFullyDone = completedIds.includes(t.id);
                    const isDayDone = (dayDoneMap[day.key] || []).includes(t.id);
                    const showDone = isFullyDone || isDayDone;
                    return (
                      <div key={t.id}
                        draggable={!showDone}
                        onDragStart={() => !showDone && setDragging(t.id)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => !isFullyDone && onToggleDayDone(day.key, t.id)}
                        style={{ fontSize: 12, color: showDone ? "#9ca3af" : "#374151", background: showDone ? "#f9fafb" : t.projectBg, borderLeft: "2px solid " + (showDone ? "#d1d5db" : t.projectAccent), padding: "5px 7px", borderRadius: 6, cursor: showDone ? "default" : "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, opacity: showDone ? 0.6 : 1 }}>
                        <span style={{ lineHeight: 1.4, flex: 1, textDecoration: showDone ? "line-through" : "none" }}>
                          {showDone ? "✓ " : ""}{t.title}
                        </span>
                        {!showDone && <span onClick={e => { e.stopPropagation(); onRemoveFromDay(day.key, t.id); }} style={{ fontSize: 11, color: "#d1d5db", cursor: "pointer", flexShrink: 0 }}>✕</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <PeopleCell dayKey={day.key} people={weeklyPeople[day.key] || ""} />
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", overflow: "hidden" }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          if (dragging) {
            const fromDay = Object.keys(calendarMap).find(k => (calendarMap[k] || []).includes(dragging));
            if (fromDay) onRemoveFromDay(fromDay, dragging);
            setDragging(null);
          }
        }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>待排 · 选择日期排入某天</p>
        </div>
        {unscheduled.length === 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "20px 14px" }}>所有任务都已排入本周 ✨</p>
        )}
        {unscheduled.map(t => (
          <UnscheduledRow key={t.id} task={t} onComplete={onComplete}
            onDragStart={() => setDragging(t.id)}
            onTap={() => setPicking(t.id)} />
        ))}
      </div>
    </div>
  );
}

function PeopleCell({ dayKey, people }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(people);
  useEffect(() => { setValue(people); }, [people]);
  const save = async () => { setEditing(false); await api.setWeeklyPeople(dayKey, value); };
  if (editing) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #0ea5e9", padding: "7px 6px", height: 79 }}>
        <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} onBlur={save} onKeyDown={e => e.key === "Enter" && save()}
          style={{ width: "100%", height: "100%", border: "none", outline: "none", fontSize: 10, color: "#374151", resize: "none", fontFamily: "inherit", lineHeight: 1.4 }} />
      </div>
    );
  }
  return (
    <div onClick={() => setEditing(true)} style={{ background: "#fff", borderRadius: 10, border: "1px solid #f0f0f0", padding: "7px 6px", height: 79, cursor: "text" }}>
      <p style={{ fontSize: 9.5, color: "#9ca3af", marginBottom: 3 }}>👤</p>
      <p style={{ fontSize: 10, color: value ? "#374151" : "#e5e7eb", lineHeight: 1.4 }}>{value || "—"}</p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────

const TABS = [
  { key: "board", label: "Projects", flex: true },
  { key: "week",  label: "本周",     flex: true },
  { key: "later", label: "本周之后", color: "#9ca3af", bg: "#f9fafb", flex: false },
  { key: "done",  label: "已完成",   color: "#10b981", bg: "#f0fdf4", flex: false },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [completedDates, setCompletedDates] = useState({});
  const [inProgressIds, setInProgressIds] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [dayDoneMap, setDayDoneMap] = useState({});
  const [weeklyPeople, setWeeklyPeople] = useState({});

  useEffect(() => {
    Promise.all([api.fetchState(), api.fetchProjects()])
      .then(([state, projs]) => {
        setCompletedIds(state.completedIds || []);
        setCompletedDates(state.completedDates || {});
        setInProgressIds(state.inProgressIds || []);
        setCalendarMap(state.calendarMap || {});
        setDayDoneMap(state.dayDoneMap || {});
        setWeeklyPeople(state.weeklyPeople || {});
        setProjects(projs || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("无法连接到服务器，请检查后端是否启动。");
        setLoading(false);
      });
  }, []);

  // ── Derived data ─────────────────────────────────────────────────
  // All tasks flat with project info attached
  const allTasksFlat = projects.flatMap(p =>
    p.tasks.map(t => ({ ...t, projectId: p.id, projectTitle: p.title, projectEmoji: p.emoji, projectAccent: p.accent, projectBg: p.bg }))
  );

  const activeTasks   = allTasksFlat.filter(t => !completedIds.includes(t.id));
  const doneTasks     = allTasksFlat.filter(t =>  completedIds.includes(t.id));
  const laterTasks    = activeTasks.filter(t => t.priority === "later");

  const counts = {
    later: laterTasks.length,
    done:  doneTasks.length,
  };

  // Projects enriched with split active/done task lists
  const projectsWithState = projects.map(p => ({
    ...p,
    tasks:     p.tasks.filter(t => !completedIds.includes(t.id)).map(t => ({ ...t, projectAccent: p.accent, projectBg: p.bg })),
    doneTasks: p.tasks.filter(t =>  completedIds.includes(t.id)).map(t => ({ ...t, projectAccent: p.accent, projectBg: p.bg })),
  }));

  const leftProjects  = projectsWithState.filter((_, i) => i < 4);
  const rightProjects = projectsWithState.filter((_, i) => i >= 4);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleComplete = useCallback((taskId) => {
    const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
    setCompletedIds(prev => [...prev, taskId]);
    setCompletedDates(prev => ({ ...prev, [taskId]: today }));
    api.completeTask(taskId);
  }, []);

  const handleUncomplete = useCallback((taskId) => {
    setCompletedIds(prev => prev.filter(id => id !== taskId));
    setCompletedDates(prev => { const next = { ...prev }; delete next[taskId]; return next; });
    api.uncompleteTask(taskId);
  }, []);

  const handleAddTask = useCallback(async ({ projectId, title, deadline, note }) => {
    const res = await api.createTask({ projectId, title, deadline, note });
    if (res.ok && res.task) {
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, tasks: [...p.tasks, res.task] } : p
      ));
    }
  }, []);

  const handleUpdateTask = useCallback(async (id, { title, deadline, note, steps }) => {
    await api.updateTask(id, { title, deadline, note, steps });
    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === id ? { ...t, title, deadline: deadline || "", note: note || "", steps: steps || [] } : t),
    })));
  }, []);

  const handleUpdateProject = useCallback(async (id, { title, emoji, reason }) => {
    await api.updateProject(id, { title, emoji, reason });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title, emoji, reason } : p));
  }, []);

  const handleDeleteTask = useCallback(async (id) => {
    await api.deleteTask(id);
    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.filter(t => t.id !== id),
    })));
  }, []);

  const handleAssignToDay = useCallback(async (dayKey, taskId) => {
    setCalendarMap(prev => {
      const curr = prev[dayKey] || [];
      if (curr.includes(taskId)) return prev;
      return { ...prev, [dayKey]: [...curr, taskId] };
    });
    await api.assignToDay(dayKey, taskId);
  }, []);

  const handleRemoveFromDay = useCallback(async (dayKey, taskId) => {
    setCalendarMap(prev => ({ ...prev, [dayKey]: (prev[dayKey] || []).filter(id => id !== taskId) }));
    await api.removeFromDay(dayKey, taskId);
  }, []);

  const handleToggleDayDone = useCallback((dayKey, taskId) => {
    setDayDoneMap(prev => {
      const curr = prev[dayKey] || [];
      return { ...prev, [dayKey]: curr.includes(taskId) ? curr.filter(id => id !== taskId) : [...curr, taskId] };
    });
    api.toggleDayDone(dayKey, taskId);
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>加载中...</div>
  );
  if (error) return (
    <div style={{ padding: 40, textAlign: "center", color: "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>连接失败</p>
      <p style={{ fontSize: 13 }}>{error}</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: "20px 14px", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 1 }}>我的任务</h1>
          <p style={{ fontSize: 11, color: "#9ca3af" }}>{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginBottom: 18, background: "#fff", padding: 5, borderRadius: 14, border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const count = counts[tab.key];
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                flex: tab.flex ? 1 : "0 0 auto", padding: tab.flex ? "7px 4px" : "7px 14px",
                borderRadius: 10, border: "none", cursor: "pointer",
                background: active ? (tab.bg || "#f3f4f6") : "transparent",
                color: active ? (tab.color || "#374151") : "#9ca3af",
                fontWeight: active ? 600 : 400, fontSize: 12, transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
                <span>{tab.label}</span>
                {count !== undefined && <span style={{ fontSize: 13, fontWeight: 700, color: active ? (tab.color || "#374151") : "#d1d5db" }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Board */}
        {activeTab === "board" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            <div>{leftProjects.map(p => <ProjectCard key={p.id} project={p} onComplete={handleComplete} onUncomplete={handleUncomplete} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onUpdateProject={handleUpdateProject} />)}</div>
            <div>{rightProjects.map(p => <ProjectCard key={p.id} project={p} onComplete={handleComplete} onUncomplete={handleUncomplete} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onUpdateProject={handleUpdateProject} />)}</div>
          </div>
        )}

        {/* Week */}
        <div style={{ display: activeTab === "week" ? "block" : "none" }}>
          <WeekView
            allTasksFlat={allTasksFlat}
            completedIds={completedIds}
            onComplete={handleComplete}
            calendarMap={calendarMap}
            dayDoneMap={dayDoneMap}
            weeklyPeople={weeklyPeople}
            onAssignToDay={handleAssignToDay}
            onRemoveFromDay={handleRemoveFromDay}
            onToggleDayDone={handleToggleDayDone}
          />
        </div>

        {/* Later */}
        {activeTab === "later" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
            {laterTasks.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 50 }}>
                <p style={{ fontSize: 26, marginBottom: 6 }}>✨</p>
                <p style={{ color: "#9ca3af", fontSize: 13 }}>这里没有任务，很好！</p>
              </div>
            )}
            {laterTasks.map(t => <FlatTaskCard key={t.id} task={t} onComplete={handleComplete} />)}
          </div>
        )}

        {/* Done */}
        {activeTab === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
            {doneTasks.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 40 }}>还没有已完成的任务</p>
            )}
            {doneTasks.map(t => <FlatTaskCard key={t.id} task={t} done completedDate={completedDates[t.id]} />)}
          </div>
        )}
      </div>
    </div>
  );
}
