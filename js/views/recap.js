// 모아 — 회고 탭 (하루 카드 · 주간 카드)
import { store, todayKey } from '../store.js?v=1.4.6';
import { chat, isConfigured } from '../llm.js?v=1.4.6';
import { PROMPTS } from '../prompts.js?v=1.4.6';

function shiftKey(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return todayKey(dt);
}

export function renderRecap(el, dateKey = todayKey()) {
  const entries = store.entriesByDate(dateKey);
  const cards = store.daycards();
  const saved = cards[dateKey];

  el.innerHTML = `
    <h2><span class="hl">회고</span> 카드</h2>
    <div class="row" style="justify-content:center;margin:4px 0 10px">
      <button class="icon-btn" id="rc-prev" aria-label="이전 날">◀</button>
      <div class="date-stamp" style="margin:0 16px">${dateKey.slice(5).replace('-', '월 ')}일</div>
      <button class="icon-btn" id="rc-next" aria-label="다음 날">▶</button>
    </div>
    <div class="sticker tape" id="rc-card">
      ${saved ? `
        <div class="hand">${saved.summary}</div>
        <ul class="highlight">${saved.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
        <div class="hand-note">기록 ${entries.length}개로 만든 카드 ✿</div>
      ` : entries.length ? `
        <div>아직 이 날의 카드가 없어.</div>
        <button class="btn btn-block" id="rc-make">오늘 카드 만들기 🖼️</button>
      ` : `
        <div class="empty-doodle"><span class="big">🖼️</span><div class="hand">이 날은 기록이 비어 있어.<br>빈 날은 없다는 거, 알지?</div></div>
      `}
    </div>
    <div id="rc-msg" class="muted"></div>
    <div class="spacer"></div>
    <div class="sticker tape tape-mint">
      <div class="card-title">주간 회고</div>
      <div class="hand-note">이번 주 기록으로 한 장의 카드를 만들어봐!</div>
      <div class="spacer"></div>
      <button class="btn btn-mint btn-block" id="rc-week">이번 주 카드 만들기</button>
      <div id="rc-week-out"></div>
    </div>
  `;

  el.querySelector('#rc-prev').addEventListener('click', () => renderRecap(el, shiftKey(dateKey, -1)));
  el.querySelector('#rc-next').addEventListener('click', () => renderRecap(el, shiftKey(dateKey, 1)));

  const msg = el.querySelector('#rc-msg');
  const makeBtn = el.querySelector('#rc-make');
  if (makeBtn) {
    makeBtn.addEventListener('click', async () => {
      msg.textContent = '카드 만드는 중... ✎';
      try {
        let card;
        if (isConfigured()) {
          const text = entries.map((e) => e.polished || e.raw).join('\n');
          const out = await chat({
            system: PROMPTS.daily.system,
            messages: [{ role: 'user', content: `${dateKey} 기록:\n${text}\n\n위 형식의 JSON으로.` }],
            json: true,
          });
          card = JSON.parse(out);
        } else {
          card = {
            summary: `${entries.length}개의 기록이 쌓인 하루`,
            highlights: entries.slice(0, 3).map((e) => (e.polished || e.raw).slice(0, 40)),
          };
        }
        const all = store.daycards();
        all[dateKey] = { ...card, at: new Date().toISOString() };
        store.saveDaycards(all);
        renderRecap(el, dateKey);
      } catch (e) { msg.textContent = '실패: ' + e.message; }
    });
  }

  el.querySelector('#rc-week').addEventListener('click', async () => {
    const out = el.querySelector('#rc-week-out');
    out.innerHTML = '<div class="muted">주간 카드 만드는 중...</div>';
    try {
      const weekEntries = [];
      for (let i = 0; i < 7; i++) {
        weekEntries.push(...store.entriesByDate(shiftKey(todayKey(), -i)));
      }
      if (!weekEntries.length) { out.innerHTML = '<div class="hand-note">이번 주 기록이 비어 있어!</div>'; return; }
      let card;
      if (isConfigured()) {
        const text = weekEntries.map((e) => e.polished || e.raw).join('\n');
        const res = await chat({
          system: PROMPTS.weekly.system,
          messages: [{ role: 'user', content: `이번 주 기록:\n${text}\n\n위 형식의 JSON으로.` }],
          json: true,
        });
        card = JSON.parse(res);
      } else {
        card = {
          summary: `이번 주 ${weekEntries.length}개의 기록`,
          highlights: weekEntries.slice(0, 5).map((e) => (e.polished || e.raw).slice(0, 40)),
          habitNote: '',
        };
      }
      out.innerHTML = `
        <div class="spacer"></div>
        <div class="hand">${card.summary}</div>
        <ul class="highlight">${card.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
        ${card.habitNote ? `<div class="hand-note">${card.habitNote}</div>` : ''}`;
    } catch (e) { out.innerHTML = '<div class="muted">실패: ' + e.message + '</div>'; }
  });
}
