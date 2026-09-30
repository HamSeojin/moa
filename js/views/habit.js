// 모아 — 해빗 탭 (설정에서 사용자가 직접 추가)
import { store, todayKey } from '../store.js?v=1.4.7';

function streak(h) {
  const checks = h.checks || {};
  let n = 0;
  const d = new Date();
  while (true) {
    const key = todayKey(d);
    if (checks[key]) { n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}

// 펼친 월별 기록 상태 (리렌더 사이 유지)
let expandedId = null;
let viewY = new Date().getFullYear();
let viewM = new Date().getMonth();

// 월별 달력 HTML
function monthGrid(h, y, m) {
  const checks = h.checks || {};
  const startDay = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const todayK = todayKey();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let monthDone = 0;
  let cells = '';
  for (let i = 0; i < startDay; i++) cells += '<span class="mcell empty"></span>';
  for (let d = 1; d <= dim; d++) {
    const dt = new Date(y, m, d);
    const k = todayKey(dt);
    const done = !!checks[k];
    if (done) monthDone++;
    cells += `<span class="mcell${done ? ' on' : ''}${k === todayK ? ' today' : ''}${dt > now ? ' future' : ''}">${d}</span>`;
  }
  const total = Object.keys(checks).length;
  return `
    <div class="mnav">
      <button class="icon-btn mprev" aria-label="이전 달">‹</button>
      <span class="hand-note" style="margin:0">${y}년 ${m + 1}월 · ${monthDone}/${dim}일 · 전체 ${total}일</span>
      <button class="icon-btn mnext" aria-label="다음 달">›</button>
    </div>
    <div class="mgrid">
      ${'일월화수목금토'.split('').map((w) => `<span class="mcell wday">${w}</span>`).join('')}
      ${cells}
    </div>`;
}
function last7(h) {
  const checks = h.checks || {};
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = todayKey(d);
    days.push({ key: k, done: !!checks[k], label: '일월화수목금토'[d.getDay()], today: i === 0 });
  }
  return days;
}

export function renderHabit(el) {
  const key = todayKey();
  const habits = store.habits();

  el.innerHTML = `
    <h2><span class="hl">해빗</span> 정원</h2>
    <div id="habit-list"></div>
    <div class="sticker tape tape-sky">
      <div class="field">
        <label for="habit-name">새 해빗 심기 🌱</label>
        <input id="habit-name" class="input" placeholder="예: 물 2L 마시기">
      </div>
      <button class="btn btn-mint btn-block" id="habit-add">심기!</button>
    </div>
  `;

  const list = el.querySelector('#habit-list');
  if (!habits.length) {
    list.innerHTML = `<div class="empty-doodle"><span class="big">🌱</span>
      <div class="hand">아직 심은 해빗이 없어.<br>아래에서 매일 하고 싶은 걸 하나 심어봐!</div></div>`;
  } else {
    list.innerHTML = habits.map((h) => {
      const done = !!h.checks?.[key];
      const s = streak(h);
      const days = last7(h);
      const weekDone = days.filter((d) => d.done).length;
      const expanded = expandedId === h.id;
      return `<div class="habit-card" data-id="${h.id}">
        <div class="habit-row ${done ? 'done' : ''}" data-id="${h.id}">
          <div class="habit-check">${done ? '✔' : ''}</div>
          <div class="habit-name">${h.name}</div>
          ${s > 1 ? `<div class="streak">${s}일째 🔥</div>` : ''}
          <button class="icon-btn btn-del" data-id="${h.id}" style="width:34px;height:34px;font-size:15px" aria-label="삭제">✕</button>
        </div>
        <div class="habit-week">
          ${days.map((d) => `<span class="hdot${d.done ? ' on' : ''}${d.today ? ' today' : ''}">${d.label}</span>`).join('')}
          <button class="link-btn hist-toggle" data-id="${h.id}" style="white-space:nowrap">${expanded ? '접기 ▲' : `기록 전체 보기 (${weekDone}/7)`}</button>
        </div>
        ${expanded ? `<div class="habit-month">${monthGrid(h, viewY, viewM)}</div>` : ''}
      </div>`;
    }).join('');

    list.querySelectorAll('.habit-row').forEach((row) => {
      row.addEventListener('click', (ev) => {
        if (ev.target.closest('.btn-del')) return;
        const id = row.dataset.id;
        const hs = store.habits();
        const h = hs.find((x) => x.id === id);
        h.checks = h.checks || {};
        if (h.checks[key]) delete h.checks[key];
        else h.checks[key] = true;
        store.saveHabits(hs);
        renderHabit(el);
      });
    });
    list.querySelectorAll('.btn-del').forEach((b) => {
      b.addEventListener('click', () => {
        if (!confirm('이 해빗을 뽑아낼까?')) return;
        store.saveHabits(store.habits().filter((h) => h.id !== b.dataset.id));
        renderHabit(el);
      });
    });
    list.querySelectorAll('.hist-toggle').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = b.dataset.id;
        if (expandedId === id) { expandedId = null; }
        else {
          expandedId = id;
          const t = new Date(); viewY = t.getFullYear(); viewM = t.getMonth();
        }
        renderHabit(el);
      });
    });
    list.querySelectorAll('.mprev').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        viewM--; if (viewM < 0) { viewM = 11; viewY--; }
        renderHabit(el);
      });
    });
    list.querySelectorAll('.mnext').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        viewM++; if (viewM > 11) { viewM = 0; viewY++; }
        renderHabit(el);
      });
    });
  }

  const addHabit = () => {
    const nameEl = el.querySelector('#habit-name');
    const name = nameEl.value.trim();
    if (!name) return;
    const hs = store.habits();
    hs.push({ id: store.uid(), name, checks: {}, createdAt: new Date().toISOString() });
    store.saveHabits(hs);
    renderHabit(el);
  };
  el.querySelector('#habit-add').addEventListener('click', addHabit);
  el.querySelector('#habit-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addHabit();
  });
}
