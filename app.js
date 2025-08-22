// Local Storage keys & helpers
const LS_KEYS = { GOALS: 'gt_goals', SESSIONS: 'gt_sessions', STATE: 'gt_state' };
const readLS = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeLS = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Data
let goals = readLS(LS_KEYS.GOALS, []);
let sessions = readLS(LS_KEYS.SESSIONS, []);
let state = readLS(LS_KEYS.STATE, {});

// Date utils (ISO weeks starting Monday)
const toDate = (d) => (d instanceof Date ? d : new Date(d));
const startOfWeek = (d) => { d = toDate(d); const day = (d.getDay() + 6) % 7; // Mon=0
  const s = new Date(d); s.setHours(0,0,0,0); s.setDate(d.getDate() - day); return s; };
const endOfWeek = (d) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999); return e; };
const fmtDate = (d) => new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(toDate(d));
const todayISO = () => { const t = new Date(); t.setHours(0,0,0,0); return t.toISOString().slice(0,10); };

// Elements
const weekDateEl = document.getElementById('weekDate');
const weekLabelEl = document.getElementById('weekLabel');
const prevBtn = document.getElementById('prevWeek');
const nextBtn = document.getElementById('nextWeek');

const goalsListEl = document.getElementById('goalsList');
const sessionsListEl = document.getElementById('sessionsList');

const goalForm = document.getElementById('goalForm');
const goalName = document.getElementById('goalName');
const goalWeekly = document.getElementById('goalWeekly');
const goalUnit = document.getElementById('goalUnit');
const clearAllBtn = document.getElementById('clearAll');

const sessionForm = document.getElementById('sessionForm');
const sessionGoal = document.getElementById('sessionGoal');
const sessionAmount = document.getElementById('sessionAmount');
const sessionDate = document.getElementById('sessionDate');

// Init state
if (!state.viewDate) state.viewDate = todayISO();
weekDateEl.value = state.viewDate;
sessionDate.value = todayISO();

function persist() {
  writeLS(LS_KEYS.GOALS, goals);
  writeLS(LS_KEYS.SESSIONS, sessions);
  writeLS(LS_KEYS.STATE, state);
}

// Rendering
function renderGoalOptions() {
  sessionGoal.innerHTML = '';
  if (goals.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '— No goals yet —';
    sessionGoal.appendChild(opt);
    sessionGoal.disabled = true;
  } else {
    sessionGoal.disabled = false;
    for (const g of goals) {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = `${g.name}`;
      sessionGoal.appendChild(opt);
    }
  }
}

function getWeekRange() {
  const d = new Date(state.viewDate);
  return { start: startOfWeek(d), end: endOfWeek(d) };
}

function sumForGoalInRange(goalId, start, end) {
  return sessions
    .filter(s => s.goalId === goalId && new Date(s.date) >= start && new Date(s.date) <= end)
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
}

function countSessionsForGoalInRange(goalId, start, end) {
  return sessions.filter(s => s.goalId === goalId && new Date(s.date) >= start && new Date(s.date) <= end).length;
}

function renderProgress() {
  const { start, end } = getWeekRange();
  weekLabelEl.textContent = `${fmtDate(start)} — ${fmtDate(end)}`;

  goalsListEl.innerHTML = '';
  if (goals.length === 0) {
    goalsListEl.innerHTML = `<div class="empty">No goals yet. Create one on the right.</div>`;
    return;
  }

  for (const g of goals) {
    const done = sumForGoalInRange(g.id, start, end);
    const cnt = countSessionsForGoalInRange(g.id, start, end);
    const pct = g.weekly > 0 ? Math.min(100, Math.round(done / g.weekly * 100)) : 0;

    const el = document.createElement('div');
    el.className = 'goal';
    el.innerHTML = `
      <div>
        <div class="title">${g.name}</div>
        <div class="meta">${done.toFixed(2)} / ${Number(g.weekly).toFixed(2)} ${g.unit} · ${cnt} session${cnt!==1?'s':''}</div>
        <div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div>
      </div>
      <div class="row" style="justify-self:end; align-self:center; gap:6px">
        <button class="btn-secondary" data-action="quick-add" data-id="${g.id}" title="Quick add 1 ${g.unit}">+1</button>
        <button class="btn-secondary" data-action="delete-goal" data-id="${g.id}" title="Delete goal">✕</button>
      </div>`;
    goalsListEl.appendChild(el);
  }

  // attach small button handlers
  goalsListEl.querySelectorAll('button[data-action="quick-add"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      addSession({ goalId:id, amount:1, date: state.viewDate });
    });
  });
  goalsListEl.querySelectorAll('button[data-action="delete-goal"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Delete this goal? This will also remove its sessions.')) {
        deleteGoal(id);
      }
    });
  });
}

function renderSessions() {
  sessionsListEl.innerHTML = '';
  if (sessions.length === 0) {
    sessionsListEl.innerHTML = `<div class="empty">No sessions yet.</div>`;
    return;
  }
  // Show latest 12 sessions
  const latest = [...sessions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,12);
  for (const s of latest) {
    const g = goals.find(g => g.id === s.goalId);
    const el = document.createElement('div');
    el.className = 'session';
    el.innerHTML = `
      <div>
        <div class="amount">${s.amount} ${g ? g.unit : ''} — ${g ? g.name : 'Unknown goal'}</div>
        <div class="date">${fmtDate(s.date)}</div>
      </div>
      <button class="btn-secondary" data-action="edit" data-id="${s.id}">Edit</button>
      <button class="btn-danger" data-action="delete" data-id="${s.id}">Delete</button>
    `;
    sessionsListEl.appendChild(el);
  }

  sessionsListEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Delete this session?')) deleteSession(id);
    });
  });

  sessionsListEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const s = sessions.find(x => x.id === id);
      if (!s) return;
      const g = goals.find(g => g.id === s.goalId);
      const newAmount = prompt(`Edit amount for ${g ? g.name : 'session'} (${g ? g.unit : ''})`, s.amount);
      if (newAmount === null) return;
      const parsed = Number(newAmount);
      if (!Number.isFinite(parsed) || parsed < 0) { alert('Invalid amount'); return; }
      s.amount = parsed; persist(); refresh();
    });
  });
}

function refresh() {
  renderGoalOptions();
  renderProgress();
  renderSessions();
}

// Mutations
function addGoal({ name, weekly, unit }) {
  const g = { id: uid(), name: name.trim(), weekly: Number(weekly), unit: unit.trim(), createdAt: new Date().toISOString() };
  goals.push(g); persist(); refresh();
  sessionGoal.value = g.id; // pre-select in session form
}

function deleteGoal(goalId) {
  goals = goals.filter(g => g.id !== goalId);
  sessions = sessions.filter(s => s.goalId !== goalId);
  persist(); refresh();
}

function addSession({ goalId, amount, date }) {
  if (!goals.find(g => g.id === goalId)) { alert('Please create a goal first.'); return; }
  const s = { id: uid(), goalId, amount: Number(amount), date: date || todayISO(), createdAt: new Date().toISOString() };
  sessions.push(s); persist(); refresh();
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  persist(); refresh();
}

// Event bindings
goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!goalName.value.trim()) return alert('Please enter a goal name');
  if (!goalUnit.value.trim()) return alert('Please enter a unit');
  const weekly = Number(goalWeekly.value);
  if (!Number.isFinite(weekly) || weekly < 0) return alert('Weekly amount must be a non-negative number');
  addGoal({ name: goalName.value, weekly, unit: goalUnit.value });
  goalName.value = ''; goalWeekly.value = ''; goalUnit.value = '';
});

clearAllBtn.addEventListener('click', () => {
  if (confirm('This will remove ALL goals and sessions. Continue?')) {
    goals = []; sessions = []; persist(); refresh();
  }
});

sessionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const goalId = sessionGoal.value; if (!goalId) return alert('Choose a goal');
  const amount = Number(sessionAmount.value);
  if (!Number.isFinite(amount) || amount < 0) return alert('Amount must be a non-negative number');
  const date = sessionDate.value || todayISO();
  addSession({ goalId, amount, date });
  sessionAmount.value = '';
});

weekDateEl.addEventListener('change', () => {
  state.viewDate = weekDateEl.value || todayISO();
  persist(); refresh();
});

prevBtn.addEventListener('click', () => {
  const d = new Date(state.viewDate || todayISO());
  d.setDate(d.getDate() - 7);
  state.viewDate = d.toISOString().slice(0,10); weekDateEl.value = state.viewDate; persist(); refresh();
});

nextBtn.addEventListener('click', () => {
  const d = new Date(state.viewDate || todayISO());
  d.setDate(d.getDate() + 7);
  state.viewDate = d.toISOString().slice(0,10); weekDateEl.value = state.viewDate; persist(); refresh();
});

// Initial render
refresh();
