// 모아 — 회고 탭 (하루 카드 · 주간 카드)
import { store, todayKey } from '../store.js?v=1.4.9';
import { chat, isConfigured } from '../llm.js?v=1.4.9';
import { PROMPTS } from '../prompts.js?v=1.4.9';
import { generateIllustration } from '../image.js?v=1.4.9';
import { renderDayCardPNG, canvasToDataURL, shareCanvas } from '../card.js?v=1.4.9';

const ILLUST_CACHE = (k) => `moa/v1/illust.${k}`;

function cachedIllust(key) {
  try { return localStorage.getItem(ILLUST_CACHE(key)); } catch (_) { return null; }
}
function saveIllust(key, dataUrl) {
  try { localStorage.setItem(ILLUST_CACHE(key), dataUrl); } catch (_) { /* 용량 초과 시 캐시 생략 */ }
}

function dateLabelOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 ${wd}요일`;
}

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
        <div class="spacer"></div>
        <button class="btn btn-block" id="rc-img">카드 이미지 만들기 🖼️</button>
        <div class="hand-note" style="text-align:center">AI 일러스트 + 종이 카드 PNG · 저장/공유</div>
        <div id="rc-img-out"></div>
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

  // ---- 카드 이미지 (A안 텍스트 카드 + B안 AI 일러스트) ----
  async function makeCardImage(regenIllust) {
    const out = el.querySelector('#rc-img-out');
    const imgBtn = el.querySelector('#rc-img');
    if (imgBtn) imgBtn.disabled = true;
    out.innerHTML = '<div class="muted" id="rc-img-status">카드 그리는 중... ✎</div>';
    const status = out.querySelector('#rc-img-status');
    try {
      const geminiKey = store.settings().apiKeys?.gemini || '';
      let illust = regenIllust ? null : cachedIllust(dateKey);
      if (!illust && geminiKey) {
        status.textContent = 'AI 일러스트 그리는 중... 🎨 (유료, 장당 약 $0.03~0.07)';
        illust = await generateIllustration(geminiKey, {
          summary: saved.summary,
          highlights: saved.highlights,
        });
        saveIllust(dateKey, illust);
      }
      status.textContent = '종이 카드로 합성하는 중... ✂️';
      const canvas = await renderDayCardPNG({
        dateLabel: dateLabelOf(dateKey),
        summary: saved.summary,
        highlights: saved.highlights,
        recordCount: entries.length,
        illustDataUrl: illust,
      });
      const url = canvasToDataURL(canvas);
      out.innerHTML = `
        <div class="spacer"></div>
        <div class="card-preview"><img src="${url}" alt="오늘 카드 이미지"></div>
        <div class="row" style="gap:8px;margin-top:12px">
          <button class="btn" id="rc-share">공유하기</button>
          <button class="btn" id="rc-dl">저장하기</button>
        </div>
        ${geminiKey ? `<button class="btn-text" id="rc-regen">일러스트 다시 그리기 ↻ (유료)</button>` : ''}
        <div class="hand-note" style="text-align:center">${illust ? 'AI 일러스트가 날짜별로 저장돼서 같은 날은 다시 안 그려.' : 'Gemini 키가 없어서 일러스트 없이 텍스트 카드만 만들었어. 설정에서 키를 넣으면 일러스트도 그려줘.'}</div>
      `;
      out.querySelector('#rc-share').addEventListener('click', () => {
        shareCanvas(canvas, `moa-card-${dateKey}.png`).catch((e) => { status.textContent = '공유 실패: ' + e.message; });
      });
      out.querySelector('#rc-dl').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url; a.download = `moa-card-${dateKey}.png`;
        document.body.appendChild(a); a.click(); a.remove();
      });
      const regen = out.querySelector('#rc-regen');
      if (regen) regen.addEventListener('click', () => makeCardImage(true));
    } catch (e) {
      out.innerHTML = `<div class="muted">실패: ${e.message}</div>`;
    } finally {
      if (imgBtn) imgBtn.disabled = false;
    }
  }
  const imgBtn = el.querySelector('#rc-img');
  if (imgBtn) imgBtn.addEventListener('click', () => makeCardImage(false));
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
