// 모아 — 설정 탭 (LLM 제공자 · 구글 · 데이터 관리)
import { store } from '../store.js';
import { PROVIDERS, currentProvider, todayUsage } from '../llm.js';

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
        <label>Claude 프록시 URL <span class="muted">(Cloudflare Workers 등)</span></label>
        <input id="set-proxy" class="input mono" placeholder="https://moa-claude.xxx.workers.dev" value="${s.claudeProxy || ''}">
      </div>
      <div class="notice">Claude는 브라우저에서 직접 호출할 수 없어요 (CORS 미지원). README의 워커 예제로 5분이면 프록시를 만들 수 있어요. 키는 이 기기에만 저장돼요.</div>
      <div class="field">
        <label>OpenAI 모델</label>
        <input id="set-openai-model" class="input mono" value="${s.openaiModel || 'gpt-4o-mini'}">
      </div>
      <div class="field">
        <label>Claude 모델</label>
        <input id="set-claude-model" class="input mono" value="${s.claudeModel || 'claude-sonnet-4-20250514'}">
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

    <div class="muted" style="text-align:center;margin:22px 0 30px">moa v1.0.0 · 2026-09-29</div>
  `;

  const save = () => {
    const cur = store.settings();
    cur.llmProvider = el.querySelector('input[name="llm"]:checked').value;
    cur.apiKeys = {
      openai: el.querySelector('#set-openai-key').value.trim(),
      claude: el.querySelector('#set-claude-key').value.trim(),
    };
    cur.claudeProxy = el.querySelector('#set-proxy').value.trim();
    cur.openaiModel = el.querySelector('#set-openai-model').value.trim();
    cur.claudeModel = el.querySelector('#set-claude-model').value.trim();
    cur.googleClientId = el.querySelector('#set-gid').value.trim();
    store.saveSettings(cur);
  };
  el.querySelectorAll('input').forEach((i) => i.addEventListener('change', save));

  const msg = el.querySelector('#set-msg');
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
