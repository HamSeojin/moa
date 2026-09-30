// 모아 — 해빗 탭 (설정에서 사용자가 직접 추가)
import { store, todayKey } from '../store.js?v=1.4.4';

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
      return `<div class="habit-row ${done ? 'done' : ''}" data-id="${h.id}">
        <div class="habit-check">${done ? '✔' : ''}</div>
        <div class="habit-name">${h.name}</div>
        ${s > 1 ? `<div class="streak">${s}일째 🔥</div>` : ''}
        <button class="icon-btn btn-del" data-id="${h.id}" style="width:34px;height:34px;font-size:15px" aria-label="삭제">✕</button>
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
