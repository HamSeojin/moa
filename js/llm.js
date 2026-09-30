// 모아 — LLM 제공자 추상화
// 사용법: chat({ system, messages: [{role, content}], json: true }) → 텍스트 반환
// 제공자는 설정 탭에서 사용자가 선택. 키는 localStorage에만 저장 (개인용).

import { store } from './store.js?v=1.4.9';
import { callOpenAI } from './providers/openai.js?v=1.4.9';
import { callClaude } from './providers/claude.js?v=1.4.9';
import { callGemini } from './providers/gemini.js?v=1.4.9';

export const PROVIDERS = {
  openai: { label: 'OpenAI', call: callOpenAI, needsProxy: false },
  claude: { label: 'Claude', call: callClaude, needsProxy: true },
  gemini: { label: 'Gemini', call: callGemini, needsProxy: false },
};

export function currentProvider() {
  const s = store.settings();
  return s.llmProvider && PROVIDERS[s.llmProvider] ? s.llmProvider : 'openai';
}

export function isConfigured() {
  const s = store.settings();
  const p = currentProvider();
  if (p === 'claude') return !!(s.apiKeys?.claude && s.claudeProxy);
  return !!s.apiKeys?.[p];
}

export async function chat({ system, messages, json = false }) {
  const settings = store.settings();
  const name = currentProvider();
  const provider = PROVIDERS[name];
  const key = settings.apiKeys?.[name];
  if (!key) {
    const e = new Error('API 키가 없어요. 설정 탭에서 입력해줘!');
    e.code = 'NO_KEY';
    throw e;
  }
  if (provider.needsProxy && !settings.claudeProxy) {
    const e = new Error('Claude는 브라우저 직접 호출이 안 돼요. 설정 탭에 프록시 URL을 입력해줘!');
    e.code = 'PROXY_NEEDED';
    throw e;
  }
  bumpUsage();
  return provider.call({ key, proxy: settings.claudeProxy, system, messages, json, settings });
}

function bumpUsage() {
  const key = 'usage-' + new Date().toISOString().slice(0, 10);
  const n = store.get(key, 0);
  store.set(key, n + 1);
}

export function todayUsage() {
  return store.get('usage-' + new Date().toISOString().slice(0, 10), 0);
}

// 연결 테스트: 실제 제공자 경로로 최소 ping을 보내 키·프록시·CORS를 검증.
// 사용량 카운트에는 포함하지 않는다.
export async function testConnection() {
  const settings = store.settings();
  const name = currentProvider();
  const provider = PROVIDERS[name];
  const key = settings.apiKeys?.[name];
  if (!key) throw new Error('API 키를 먼저 입력해줘!');
  if (provider.needsProxy && !settings.claudeProxy)
    throw new Error('프록시 URL을 먼저 입력해줘!');
  await provider.call({
    key,
    proxy: settings.claudeProxy,
    system: 'You are a connectivity test. Reply with only the word: ok',
    messages: [{ role: 'user', content: 'ping' }],
    json: false,
    settings,
  });
  return true;
}
