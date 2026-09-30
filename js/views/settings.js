// 모아 — 설정 탭 (LLM 제공자 · 구글 · 데이터 관리)
import { store } from '../store.js?v=1.4.9';
import { PROVIDERS, currentProvider, todayUsage, testConnection } from '../llm.js?v=1.4.9';
import { MODELS, DEFAULT_MODELS } from '../models.js?v=1.4.9';
import { appleSettings, calendarSource, testApple } from '../apple.js?v=1.4.9';

// 콤보박스 옵션 생성. 저장된 값이 목록에 없으면(기존 직접 입력) 맨 앞에 유지.
function modelOptions(provider, current) {
  const list = MODELS[provider];
  const ids = new Set(list.map((m) => m.id));
  let opts = list
    .map((m) => `<option value="${m.id}"${m.id === current ? ' selected' : ''}>${m.label}</option>`)
    .join('');
  if (current && !ids.has(current)) {
    opts = `<option value="${current}" selected>${current} (기존 설정)</option>` + opts;
  }
  return opts;
}

export function renderSettings(el) {
  const s = store.settings();

  el.innerHTML = `
    <h2><span class="hl">설정</span></h2>

    <div class="sticker tape">
      <div class="card-title">🧠 LLM 제공자</div>
      <div class="spacer"></div>
      <div class="radio-cards">
        ${Object.entries(PROVIDERS).map(([key, p]) => `
          <label class="radio-card">
            <input type="radio" name="llm" value="${key}" ${currentProvider() === key ? 'checked' : ''}>
            ${p.label}${p.needsProxy ? '<br><span class="muted">프록시 필요</span>' : ''}
          </label>`).join('')}
      </div>
      <div class="field">
        <label>OpenAI API 키</label>
        <input id="set-openai-key" type="password" class="input mono" placeholder="sk-..." value="${s.apiKeys?.openai || ''}">
      </div>
      <div class="field">
        <label>Claude API 키</label>
        <input id="set-claude-key" type="password" class="input mono" placeholder="sk-ant-..." value="${s.apiKeys?.claude || ''}">
      </div>
      <div class="field">
        <label>Gemini API 키 <span class="muted">(AI Studio에서 발급)</span></label>
        <input id="set-gemini-key" type="password" class="input mono" placeholder="AIza..." value="${s.apiKeys?.gemini || ''}">
      </div>
      <div class="field">
        <label>Claude 프록시 URL <span class="muted">(Cloudflare Workers 등)</span></label>
        <input id="set-proxy" class="input mono" placeholder="https://moa-claude.xxx.workers.dev" value="${s.claudeProxy || ''}">
      </div>
      <div class="notice">Claude는 브라우저에서 직접 호출할 수 없어요 (CORS 미지원). README의 워커 예제로 5분이면 프록시를 만들 수 있어요. 키는 이 기기에만 저장돼요.</div>
      <div class="field">
        <label>OpenAI 모델</label>
        <select id="set-openai-model" class="input mono">${modelOptions('openai', s.openaiModel || DEFAULT_MODELS.openai)}</select>
      </div>
      <div class="field">
        <label>Claude 모델</label>
        <select id="set-claude-model" class="input mono">${modelOptions('claude', s.claudeModel || DEFAULT_MODELS.claude)}</select>
      </div>
      <div class="field">
        <label>Gemini 모델</label>
        <select id="set-gemini-model" class="input mono">${modelOptions('gemini', s.geminiModel || DEFAULT_MODELS.gemini)}</select>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="set-test" style="font-size:14px;padding:8px 18px;white-space:nowrap;flex-shrink:0">🔌 연결 테스트</button>
        <span id="set-test-msg" class="muted" style="font-size:14px;word-break:keep-all"></span>
      </div>
      <div class="hand-note">오늘 LLM 호출: ${todayUsage()}회</div>
    </div>

    <div class="sticker tape tape-sky">
      <div class="card-title">🔗 Google 연동</div>
      <div class="field">
        <label>OAuth 클라이언트 ID</label>
        <input id="set-gid" class="input mono" placeholder="xxx.apps.googleusercontent.com" value="${s.googleClientId || ''}">
      </div>
      <div class="notice">Google Cloud Console에서 웹용 OAuth 클라이언트 ID를 발급받아 입력해줘. 승인된 JavaScript 원본에 이 앱 주소를 등록해야 해. 범위: 캘린더 읽기 · Gmail 읽기.</div>
    </div>

    <div class="sticker tape">
      <div class="card-title">🍎 Apple 캘린더</div>
      <div class="field">
        <label>가져오기 원본</label>
        <div class="radio-cards">
          <label class="radio-card">
            <input type="radio" name="calsrc" value="google" ${calendarSource() !== 'apple' ? 'checked' : ''}>
            Google 캘린더
          </label>
          <label class="radio-card">
            <input type="radio" name="calsrc" value="apple" ${calendarSource() === 'apple' ? 'checked' : ''}>
            Apple 캘린더
          </label>
        </div>
      </div>
      <div class="field">
        <label>Apple ID (이메일)</label>
        <input id="set-apple-id" class="input mono" placeholder="you@icloud.com" value="${appleSettings().appleId}">
      </div>
      <div class="field">
        <label>앱 암호</label>
        <input id="set-apple-pw" type="password" class="input mono" placeholder="xxxx-xxxx-xxxx-xxxx" value="${appleSettings().appPassword}">
      </div>
      <div class="field">
        <label>CalDAV 프록시 URL <span class="muted">(Cloudflare Workers)</span></label>
        <input id="set-apple-proxy" class="input mono" placeholder="https://moa-apple.xxx.workers.dev" value="${appleSettings().proxy || 'https://moa-apple.813nanalove.workers.dev'}">
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="set-apple-test" style="font-size:14px;padding:8px 18px;white-space:nowrap;flex-shrink:0">🔌 연결 테스트</button>
        <span id="set-apple-test-msg" class="muted" style="font-size:14px;word-break:keep-all"></span>
      </div>
      <div class="notice">앱 암호는 appleid.apple.com → 로그인 및 보안 → 앱 암호에서 발급해 (언제든 폐기 가능). 프록시 배포 방법은 README의 Apple 캘린더 섹션 참조. 앱 암호는 이 기기에만 저장돼요.</div>
    </div>

    <div class="sticker tape tape-mint">
      <div class="card-title">💾 데이터</div>
      <div class="spacer"></div>
      <div class="row">
        <button class="btn btn-sky" id="set-export">내보내기</button>
        <label class="btn btn-ghost">가져오기<input type="file" id="set-import" accept="application/json" hidden></label>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost danger" id="set-wipe" style="border-color:#C0564F">모든 데이터 지우기</button>
      <div id="set-msg" class="muted"></div>
    </div>

    <div class="muted" style="text-align:center;margin:22px 0 30px">moa v1.4.9 · 2026-10-01</div>
  `;

  const save = () => {
    const cur = store.settings();
    cur.llmProvider = el.querySelector('input[name="llm"]:checked').value;
    cur.apiKeys = {
      openai: el.querySelector('#set-openai-key').value.trim(),
      claude: el.querySelector('#set-claude-key').value.trim(),
      gemini: el.querySelector('#set-gemini-key').value.trim(),
    };
    cur.claudeProxy = el.querySelector('#set-proxy').value.trim();
    cur.openaiModel = el.querySelector('#set-openai-model').value.trim();
    cur.claudeModel = el.querySelector('#set-claude-model').value.trim();
    cur.geminiModel = el.querySelector('#set-gemini-model').value.trim();
    cur.googleClientId = el.querySelector('#set-gid').value.trim();
    cur.calendarSource = el.querySelector('input[name="calsrc"]:checked').value;
    cur.appleId = el.querySelector('#set-apple-id').value.trim();
    cur.appleAppPassword = el.querySelector('#set-apple-pw').value.trim();
    cur.appleProxy = el.querySelector('#set-apple-proxy').value.trim();
    store.saveSettings(cur);
  };
  el.querySelectorAll('input, select').forEach((i) => i.addEventListener('change', save));

  const msg = el.querySelector('#set-msg');
  el.querySelector('#set-apple-test').addEventListener('click', async () => {
    save();
    const btn = el.querySelector('#set-apple-test');
    const tmsg = el.querySelector('#set-apple-test-msg');
    btn.disabled = true;
    tmsg.textContent = '확인 중...';
    try {
      const cals = await testApple();
      tmsg.textContent = cals.length
        ? `✅ 캘린더 ${cals.length}개 연결됨 (${cals.slice(0, 3).join(' · ')}${cals.length > 3 ? '…' : ''})`
        : '✅ 연결됐지만 캘린더가 없어.';
    } catch (e) {
      tmsg.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
    }
  });
  el.querySelector('#set-test').addEventListener('click', async () => {
    save();
    const btn = el.querySelector('#set-test');
    const tmsg = el.querySelector('#set-test-msg');
    btn.disabled = true;
    tmsg.textContent = '확인 중...';
    try {
      await testConnection();
      tmsg.textContent = '✅ 연결 성공!';
    } catch (e) {
      tmsg.textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false;
    }
  });
  el.querySelector('#set-export').addEventListener('click', () => {
    save();
    const data = {
      exportedAt: new Date().toISOString(),
      entries: store.entries(),
      entities: store.entities(),
      habits: store.habits(),
      daycards: store.daycards(),
      settings: { ...store.settings(), apiKeys: {} }, // 키는 제외
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `moa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    msg.textContent = '내보냈어! (API 키는 제외됨)';
  });

  el.querySelector('#set-import').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.entries) store.saveEntries(d.entries);
        if (d.entities) store.saveEntities(d.entities);
        if (d.habits) store.saveHabits(d.habits);
        if (d.daycards) store.saveDaycards(d.daycards);
        msg.textContent = '가져왔어! 탭을 이동하면 반영돼.';
      } catch { msg.textContent = '파일을 읽지 못했어.'; }
    };
    r.readAsText(f);
  });

  el.querySelector('#set-wipe').addEventListener('click', () => {
    if (!confirm('정말 모든 기록을 지울까? 되돌릴 수 없어!')) return;
    Object.keys(localStorage).filter((k) => k.startsWith('moa/v1/')).forEach((k) => localStorage.removeItem(k));
    location.reload();
  });
}
