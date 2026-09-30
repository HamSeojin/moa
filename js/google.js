// 모아 — Google 연동 (GIS OAuth → Calendar/Gmail 읽기)
// 설정 탭에서 OAuth 클라이언트 ID를 입력해야 동작한다.

import { store, todayKey } from './store.js?v=1.4.3';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly';
let gisLoaded = false;
let tokenClient = null;

function loadGis() {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => { gisLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('GIS 로드 실패'));
    document.head.appendChild(s);
  });
}

export function googleClientId() {
  return (store.settings().googleClientId || '').trim();
}

export async function ensureToken() {
  const clientId = googleClientId();
  if (!clientId) {
    const e = new Error('Google 클라이언트 ID를 설정 탭에 입력해줘!');
    e.code = 'NO_CLIENT_ID';
    throw e;
  }
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) reject(new Error('구글 인증 실패: ' + resp.error));
          else {
            store.set('google_token', { token: resp.access_token, at: Date.now() });
            resolve(resp.access_token);
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}

async function gfetch(url, token) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Google API 오류: ' + res.status);
  return res.json();
}

// 오늘 일정 → Entry 형태로 정규화
export async function fetchTodayEvents() {
  const token = await ensureToken();
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  const data = await gfetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`,
    token
  );
  const key = todayKey();
  return (data.items || []).map((ev) => ({
    date: key,
    type: 'import',
    source: 'google-calendar',
    sourceId: ev.id,
    raw: ev.summary || '(제목 없음)',
    polished: `📅 ${ev.summary || '(제목 없음)'}`,
    tags: ['일정'],
    people: [],
    places: ev.location ? [ev.location] : [],
    links: [],
    confidence: 1,
    editedByUser: false,
    start: ev.start?.dateTime || ev.start?.date,
  }));
}

const MAIL_WHITELIST_HINT = ['예약', '주문', '배송', '결제', '청구', '예매', '확정'];

// 최근 메일에서 예약/택배/청구 후보만 → Entry 형태로 (제안 상태)
export async function fetchMailCandidates() {
  const token = await ensureToken();
  const data = await gfetch(
    'https://www.googleapis.com/gmail/v1/users/me/messages?q=newer_than:2d+-category:promotions&maxResults=10',
    token
  );
  const key = todayKey();
  const out = [];
  for (const m of data.messages || []) {
    const full = await gfetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject%20From`,
      token
    );
    const headers = Object.fromEntries(
      (full.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value])
    );
    const subject = headers.subject || '';
    const from = headers.from || '';
    if (!MAIL_WHITELIST_HINT.some((k) => subject.includes(k))) continue;
    out.push({
      date: key,
      type: 'import',
      source: 'google-mail',
      sourceId: m.id,
      raw: subject,
      polished: `✉️ ${subject}`,
      tags: ['메일'],
      people: [],
      places: [],
      links: [],
      confidence: 0.5,
      editedByUser: false,
      suggest: true, // 제안 상태 — 사용자가 확정해야 타임라인에 고정
      meta: { from },
    });
  }
  return out;
}
