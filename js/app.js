// 모아 — 탭 라우팅·초기화
import { store } from './store.js';
import { renderToday } from './views/today.js';
import { renderJot } from './views/jot.js';
import { renderHabit } from './views/habit.js';
import { renderRecap } from './views/recap.js';
import { renderExplore } from './views/explore.js';
import { renderSettings } from './views/settings.js';

const VIEWS = {
  today: { el: 'view-today', render: renderToday },
  jot: { el: 'view-jot', render: renderJot },
  habit: { el: 'view-habit', render: renderHabit },
  recap: { el: 'view-recap', render: renderRecap },
  explore: { el: 'view-explore', render: renderExplore },
  settings: { el: 'view-settings', render: renderSettings },
};

let current = 'today';

export function navigate(name) {
  if (!VIEWS[name]) return;
  current = name;
  for (const [key, v] of Object.entries(VIEWS)) {
    document.getElementById(v.el).hidden = key !== name;
  }
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelector('.app-header .icon-btn').style.transform =
    name === 'settings' ? 'rotate(40deg)' : '';
  try {
    VIEWS[name].render(document.getElementById(VIEWS[name].el));
  } catch (e) {
    console.error('[moa] 렌더 실패:', name, e);
  }
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-tab]').forEach((el) => {
  el.addEventListener('click', () => navigate(el.dataset.tab));
});

store.seedIfEmpty();
navigate('today');
