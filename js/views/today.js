// 모아 — 오늘 탭 (타임라인)
import { store, todayKey } from '../store.js?v=1.4.9';
import { chat, isConfigured } from '../llm.js?v=1.4.9';
import { PROMPTS } from '../prompts.js?v=1.4.9';
import { fetchTodayEvents, fetchMailCandidates, googleClientId } from '../google.js?v=1.4.9';
import { fetchAppleTodayEvents, appleConfigured, calendarSource } from '../apple.js?v=1.4.9';
import { navigate } from '../app.js?v=1.4.9';

function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderLinks(text = '') {
  return text.replace(/\[\[([^\]]+)\]\]/g, '<a class="wikilink" href="#" data-wiki="$1">[[ $1 ]]</a>');
}

function tagHtml(list = [], cls = '') {
  return list.map((t) => `<span class="tag ${cls}">${t}</span>`).join('');
}

// ---- 하루 요약: 캐시 + 백그라운드 갱신 (타임라인을 막지 않음) ----
function summaryFp(entries) {
  const s = entries.map((e) => e.id + '|' + e.createdAt + '|' + (e.polished || e.raw || '')).join('\n');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'fp' + (h >>> 0).toString(36);
}

function paintSummary(bodyEl, cached, entries) {
  if (cached) {
    bodyEl.innerHTML = `<div class="hand">${cached.summary}</div>
      <div class="hand-note">${cached.note}</div>`;
  } else if (!entries.length) {
    bodyEl.innerHTML = `<div>아직 오늘의 기록이 비어 있어. 빈 날은 없게 만들자 ✎</div>
      <div class="hand-note">끄적 탭에서 아무렇게나 한 줄 써봐!</div>`;
  } else {
    bodyEl.innerHTML = `<div>오늘 기록 ${entries.length}개 쌓이는 중 ✎</div>
      <div class="hand-note">설정에서 LLM 키를 입력하면 예쁜 하루 요약을 만들어줘!</div>`;
  }
}

async function ensureSummary(bodyEl, entries, key, force = false) {
  if (!isConfigured() || !entries.length) { paintSummary(bodyEl, null, entries); return; }
  const fp = summaryFp(entries);
  const ck = 'summary.' + key;
  const cached = store.get(ck, null);
  if (!force && cached && cached.fp === fp) { paintSummary(bodyEl, cached, entries); return; }
  if (cached) paintSummary(bodyEl, cached, entries); // 일단 예전 요약 보여주기
  else bodyEl.innerHTML = `<div class="hand-note">하루 요약 만드는 중... ✎</div>`;
  try {
    const text = entries.map((e) => e.polished || e.raw).join('\n');
    const out = await chat({
      system: PROMPTS.daily.system,
      messages: [{ role: 'user', content: `오늘 기록:\n${text}\n\n위 형식의 JSON으로.` }],
      json: true,
    });
    const j = JSON.parse(out);
    const fresh = {
      fp,
      summary: j.summary,
      note: `오늘 기록 ${entries.length}개 · 어제보다 ${entries.length >= 3 ? '알차게' : '가볍게'} 쌓이는 중`,
    };
    store.set(ck, fresh);
    if (bodyEl.isConnected) paintSummary(bodyEl, fresh, entries);
  } catch (e) {
    if (!cached && bodyEl.isConnected)
      bodyEl.innerHTML = `<div class="hand-note">요약을 만들지 못했어. (${e.message})</div>`;
  }
}

export async function renderToday(el) {
  const key = todayKey();
  const entries = store.entriesByDate(key);

  el.innerHTML = `
    <h2><span class="hl">오늘</span><span class="date-stamp">${key.slice(5).replace('-', '월 ')}일</span></h2>
    <div class="sticker tape" id="today-summary">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="hand-note" style="margin:0">🖋️ 하루 요약</div>
        <button class="btn btn-ghost" id="btn-summary-refresh" style="font-size:12px;padding:4px 10px;white-space:nowrap;flex-shrink:0">↻ 다시 만들기</button>
      </div>
      <div id="summary-body"><div class="hand-note">하루 요약 만드는 중... ✎</div></div>
    </div>
    <div class="row" style="margin:6px 0">
      <button class="btn btn-sky" id="btn-cal" style="font-size:14px;padding:8px 16px">📅 캘린더 가져오기</button>
      <button class="btn btn-butter" id="btn-mail" style="font-size:14px;padding:8px 16px">✉️ 메일 확인</button>
    </div>
    <div id="import-msg" class="muted"></div>
    <div class="timeline" id="timeline"></div>
    <div class="spacer"></div>
    <button class="btn btn-block" id="btn-jot">✏️ 끄적으러 가기</button>
  `;

  // 요약: 캐시 먼저 보여주고, 바뀌었을 때만 백그라운드에서 갱신 (타임라인을 기다리게 하지 않음)
  const summaryBody = el.querySelector('#summary-body');
  ensureSummary(summaryBody, entries, key);
  el.querySelector('#btn-summary-refresh').addEventListener('click', () =>
    ensureSummary(summaryBody, store.entriesByDate(key), key, true));

  // 타임라인
  const tl = el.querySelector('#timeline');
  if (!entries.length) {
    tl.innerHTML = `<div class="empty-doodle"><span class="big">🕊️</span><div class="hand">아직 비어 있어.<br>끄적 탭에서 첫 기록을 남겨봐!</div></div>`;
  } else {
    tl.innerHTML = entries.map((e) => `
      <div class="tl-item">
        <div class="tl-time">${fmtTime(e.createdAt)}</div>
        <div class="sticker tl-card ${e.suggest ? 'tape-butter' : ''}" data-id="${e.id}">
          <span class="src-badge ${e.suggest ? 'src-suggest' : e.type === 'import' ? 'src-import' : 'src-manual'}">
            ${e.suggest ? '제안' : e.type === 'import' ? '자동' : '끄적'}
          </span>
          <div class="hand">${renderLinks(e.polished || e.raw)}</div>
          ${(e.photos || []).map((p) => `<img src="${p}" class="daycard-photo" loading="lazy">`).join('')}
          <div style="margin-top:6px">${tagHtml(e.tags)}${tagHtml(e.people, 'person')}${tagHtml(e.places, 'place')}</div>
          ${e.suggest ? `<div class="row" style="margin-top:8px">
            <button class="btn btn-mint btn-confirm" data-id="${e.id}" style="font-size:13px;padding:6px 14px">확정</button>
            <button class="btn btn-ghost btn-drop" data-id="${e.id}" style="font-size:13px;padding:6px 14px">아니야</button>
          </div>` : ''}
        </div>
      </div>`).join('');

    el.querySelectorAll('.btn-confirm').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        store.updateEntry(b.dataset.id, { suggest: false, confidence: 1 });
        renderToday(el);
      }));
    el.querySelectorAll('.btn-drop').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        store.removeEntry(b.dataset.id);
        renderToday(el);
      }));
  }

  el.querySelector('#btn-jot').addEventListener('click', () => navigate('jot'));

  const msg = el.querySelector('#import-msg');
  el.querySelector('#btn-cal').addEventListener('click', async () => {
    const src = calendarSource();
    msg.textContent = '캘린더 가져오는 중...';
    try {
      let items;
      if (src === 'apple') {
        if (!appleConfigured()) throw new Error('설정 탭에서 Apple ID·앱 암호·프록시 URL을 먼저 입력해줘!');
        items = await fetchAppleTodayEvents();
      } else {
        if (!googleClientId()) throw new Error('설정 탭에서 Google 클라이언트 ID를 먼저 입력해줘!');
        items = await fetchTodayEvents();
      }
      const existing = new Set(store.entries().map((e) => e.sourceId).filter(Boolean));
      let n = 0;
      for (const it of items) {
        if (existing.has(it.sourceId)) continue;
        store.addEntry(it); n++;
      }
      msg.textContent = n ? `${n}개 일정을 가져왔어!` : '새 일정이 없어. 이미 다 있어!';
      renderToday(el);
    } catch (e) { msg.textContent = '가져오기 실패: ' + e.message; }
  });

  el.querySelector('#btn-mail').addEventListener('click', async () => {
    if (!googleClientId()) { msg.textContent = '설정 탭에서 Google 클라이언트 ID를 먼저 입력해줘!'; return; }
    msg.textContent = '메일 확인 중...';
    try {
      const items = await fetchMailCandidates();
      const existing = new Set(store.entries().map((e) => e.sourceId).filter(Boolean));
      let n = 0;
      for (const it of items) {
        if (existing.has(it.sourceId)) continue;
        store.addEntry(it); n++;
      }
      msg.textContent = n ? `${n}개를 '제안'으로 가져왔어. 확정해줘!` : '새로운 메일 후보가 없어!';
      renderToday(el);
    } catch (e) { msg.textContent = '가져오기 실패: ' + e.message; }
  });
}
