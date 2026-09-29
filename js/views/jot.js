// 모아 — 끄적 탭 (대충 입력 → LLM 다듬기 → 카드)
import { store, todayKey } from '../store.js';
import { chat, isConfigured } from '../llm.js';
import { PROMPTS } from '../prompts.js';
import { applyExtraction, extractWikilinks } from '../extract.js';

function compressImage(file, maxDim = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function renderJot(el) {
  const speechOK = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  el.innerHTML = `
    <h2><span class="hl">끄적</span>끄적</h2>
    <div class="sticker tape tape-mint">
      <div class="field">
        <label for="jot-input">아무렇게나 써도 돼 ✎</label>
        <textarea id="jot-input" class="textarea" placeholder="오늘 점심에 우진이랑 파스타 먹었어..."></textarea>
      </div>
      <div class="row">
        <button class="btn btn-ghost" id="jot-voice" ${speechOK ? '' : 'disabled'}>🎤 음성</button>
        <label class="btn btn-ghost" style="font-size:16px">📷 사진<input type="file" id="jot-photo" accept="image/*" hidden></label>
      </div>
      ${speechOK ? '' : '<div class="notice">이 브라우저는 음성 인식을 지원하지 않아요. 아이폰에서는 키보드 마이크(받아쓰기)를 써줘!</div>'}
      <div id="jot-photos" class="row" style="flex-wrap:wrap"></div>
      <div class="spacer"></div>
      <button class="btn btn-block" id="jot-save">예쁘게 저장하기 ✨</button>
      <div id="jot-msg" class="muted"></div>
    </div>
    <div id="jot-preview"></div>
  `;

  const input = el.querySelector('#jot-input');
  const msg = el.querySelector('#jot-msg');
  const preview = el.querySelector('#jot-preview');
  const photos = [];

  // 음성 입력
  if (speechOK) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = 'ko-KR';
    rec.onresult = (ev) => {
      input.value += ev.results[0][0].transcript;
    };
    rec.onerror = () => { msg.textContent = '음성 인식에 실패했어. 다시 눌러봐!'; };
    el.querySelector('#jot-voice').addEventListener('click', () => {
      msg.textContent = '듣는 중... 말해봐!';
      rec.start();
    });
    rec.onend = () => { msg.textContent = ''; };
  }

  // 사진 첨부 (압축)
  el.querySelector('#jot-photo').addEventListener('change', async (ev) => {
    const box = el.querySelector('#jot-photos');
    for (const f of ev.target.files) {
      try {
        const dataUrl = await compressImage(f);
        photos.push(dataUrl);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'width:72px;height:72px;object-fit:cover;border:4px solid var(--white);border-radius:2px;box-shadow:0 1px 3px rgba(59,52,54,.1);transform:rotate(-1deg)';
        box.appendChild(img);
      } catch { msg.textContent = '사진을 읽지 못했어.'; }
    }
  });

  el.querySelector('#jot-save').addEventListener('click', async () => {
    const raw = input.value.trim();
    if (!raw && !photos.length) { msg.textContent = '뭔가 써주거나 사진을 넣어줘!'; return; }
    msg.textContent = '다듬는 중... ✎';

    let polished = raw;
    let extraction = null;
    try {
      if (isConfigured() && raw) {
        polished = await chat({
          system: PROMPTS.polish.system,
          messages: [{ role: 'user', content: raw }],
        });
        const out = await chat({
          system: PROMPTS.extract.system,
          messages: [{ role: 'user', content: polished + '\n\n위 형식의 JSON으로.' }],
          json: true,
        });
        extraction = JSON.parse(out);
      }
    } catch (e) {
      msg.textContent = '다듬기에 실패했어. 원문 그대로 저장할게. (' + e.message + ')';
    }

    const entry = store.addEntry({
      date: todayKey(),
      type: 'manual',
      source: 'jot',
      raw,
      polished: polished || '(사진)',
      tags: [],
      people: [],
      places: [],
      links: extractWikilinks(polished),
      photos,
      confidence: extraction ? 0.8 : 0.4,
      editedByUser: false,
    });
    if (extraction) applyExtraction(entry.id, extraction);

    // 해빗 자동 체크 (기록-해빗 연결)
    autoCheckHabits(polished || raw);

    const saved = store.entries().find((e) => e.id === entry.id);
    preview.innerHTML = `
      <div class="sticker tape tape-butter">
        <span class="src-badge src-manual">끄적</span>
        <div class="hand">${(saved.polished || '').replace(/\[\[([^\]]+)\]\]/g, '[[ $1 ]]')}</div>
        ${(saved.photos || []).map((p) => `<img src="${p}" class="daycard-photo">`).join('')}
        <div style="margin-top:6px">
          ${(saved.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}
          ${(saved.people || []).map((t) => `<span class="tag person">${t}</span>`).join('')}
          ${(saved.places || []).map((t) => `<span class="tag place">${t}</span>`).join('')}
        </div>
        <div class="hand-note">저장됐어! 오늘 타임라인에서 볼 수 있어 ✿</div>
      </div>`;
    input.value = '';
    el.querySelector('#jot-photos').innerHTML = '';
    photos.length = 0;
    msg.textContent = '';
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// 기록 텍스트에 해빗 이름이 있으면 자동 체크
function autoCheckHabits(text) {
  const key = todayKey();
  const habits = store.habits();
  let changed = false;
  for (const h of habits) {
    if (text.includes(h.name) && !h.checks?.[key]) {
      h.checks = { ...(h.checks || {}), [key]: true };
      changed = true;
    }
  }
  if (changed) store.saveHabits(habits);
}
