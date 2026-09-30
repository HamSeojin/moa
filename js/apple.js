// 모아 — Apple 캘린더(iCloud CalDAV) 연동
// 브라우저 직접 호출 불가 (CORS 미지원) → Cloudflare Worker 프록시 경유.
// 설정 탭에서 Apple ID + 앱 암호 + 프록시 URL 입력.

import { store, todayKey } from './store.js?v=1.4.5';

export function appleSettings() {
  const s = store.settings();
  return {
    appleId: (s.appleId || '').trim(),
    appPassword: (s.appleAppPassword || '').trim(),
    proxy: (s.appleProxy || '').trim(),
  };
}

export function appleConfigured() {
  const a = appleSettings();
  return !!(a.appleId && a.appPassword && a.proxy);
}

export function calendarSource() {
  return store.settings().calendarSource === 'apple' ? 'apple' : 'google';
}

async function applePost(body) {
  const { proxy } = appleSettings();
  const res = await fetch(proxy.replace(/\/$/, '') + '/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Apple 캘린더 오류 (${res.status})`);
  }
  return data;
}

// 연결 테스트 → 캘린더 이름 목록
export async function testApple() {
  const { appleId, appPassword } = appleSettings();
  if (!appleId || !appPassword || !appleSettings().proxy) {
    throw new Error('Apple ID·앱 암호·프록시 URL을 먼저 입력해줘!');
  }
  const data = await applePost({ appleId, appPassword, action: 'test' });
  return data.calendars || [];
}

// 오늘 일정 → Entry 형태로 정규화
export async function fetchAppleTodayEvents() {
  const { appleId, appPassword } = appleSettings();
  if (!appleId || !appPassword || !appleSettings().proxy) {
    throw new Error('설정 탭에서 Apple ID·앱 암호·프록시 URL을 먼저 입력해줘!');
  }
  const data = await applePost({
    appleId,
    appPassword,
    date: todayKey(),
    tz: 'Asia/Seoul',
    action: 'events',
  });
  const key = todayKey();
  return (data.events || []).map((ev) => ({
    date: key,
    type: 'import',
    source: 'apple-calendar',
    sourceId: 'apple-' + ev.key,
    raw: ev.summary || '(제목 없음)',
    polished: `📅 ${ev.summary || '(제목 없음)'}`,
    tags: ['일정'],
    people: [],
    places: ev.location ? [ev.location] : [],
    links: [],
    confidence: 1,
    editedByUser: false,
    start: ev.start,
  }));
}
