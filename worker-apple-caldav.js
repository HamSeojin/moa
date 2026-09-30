// 모아 — Apple 캘린더(iCloud CalDAV) 프록시 Worker
// Cloudflare Workers에 배포하는 stateless 프록시.
// 비밀(Apple ID·앱 암호)을 저장하지 않음 — 요청마다 전달받아 iCloud에 중계만 함.
//
// 배포: Cloudflare 대시보드 → Workers → Create → 이 파일 내용 붙여넣기 → Deploy.
//       (또는 `npx wrangler deploy` — wrangler.toml 필요)
//
// POST /
//   { "appleId": "you@icloud.com", "appPassword": "xxxx-xxxx-xxxx-xxxx",
//     "date": "2026-09-30", "tz": "Asia/Seoul", "action": "events" }
//   → { "ok": true, "events": [{ key, summary, start, end, location, allDay, calendar }] }
//   { "action": "test", ... } → { "ok": true, "calendars": ["캘린더", "가족"] }
//
// 앱 암호 발급: appleid.apple.com → 로그인 및 보안 → 앱 암호 (언제든 폐기 가능)

const ICLOUD = 'https://caldav.icloud.com';

const cors = (res) => {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
};

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (req.method === 'GET')
      return cors(Response.json({ ok: true, usage: 'POST {appleId, appPassword, date, tz, action}' }));
    if (req.method !== 'POST')
      return cors(Response.json({ error: 'POST only' }, { status: 405 }));
    let body;
    try { body = await req.json(); }
    catch { return cors(Response.json({ error: 'JSON 본문이 필요해요' }, { status: 400 })); }
    const { appleId, appPassword, date, tz = 'Asia/Seoul', action = 'events' } = body || {};
    if (!appleId || !appPassword)
      return cors(Response.json({ error: 'Apple ID와 앱 암호가 필요해요' }, { status: 400 }));
    const auth = 'Basic ' + btoa(`${appleId}:${appPassword}`);
    try {
      const cals = await discoverCalendars(auth);
      if (action === 'test')
        return cors(Response.json({ ok: true, calendars: cals.map((c) => c.name) }));
      const events = await queryDay(auth, cals, date || todayStr(tz), tz);
      return cors(Response.json({ ok: true, events }));
    } catch (e) {
      return cors(Response.json({ error: e.message || '알 수 없는 오류' }, { status: e.status || 500 }));
    }
  },
};

// ---- CalDAV 통신 ----

async function dav(auth, url, { method = 'PROPFIND', depth = '0', body = '' } = {}) {
  let target = url;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(target, {
      method,
      redirect: 'manual', // 크로스 호스트 리다이렉트에서 Authorization이 떨어지는 문제 방지
      headers: {
        authorization: auth,
        depth,
        'content-type': 'application/xml; charset=utf-8',
      },
      body: body || undefined,
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      target = new URL(loc, target).toString();
      continue;
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      const e = new Error('Apple ID 또는 앱 암호가 올바르지 않아요 (앱 암호를 다시 확인해줘)');
      e.status = 401;
      throw e;
    }
    if (!res.ok) {
      const e = new Error(`iCloud 오류 (${res.status})`);
      e.status = 502;
      throw e;
    }
    return text;
  }
  const e = new Error('iCloud 리다이렉트 처리 실패');
  e.status = 502;
  throw e;
}

async function discoverCalendars(auth) {
  // 1. principal 찾기
  const step1 = stripNs(await dav(auth, ICLOUD + '/', {
    body: '<?xml version="1.0" encoding="UTF-8"?><propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>',
  }));
  const principal = firstHref(step1.match(/<current-user-principal>[\s\S]*?<\/current-user-principal>/)?.[0] || '');
  if (!principal) throw fail('iCloud principal을 찾지 못했어요');

  // 2. calendar-home-set 찾기
  const step2 = stripNs(await dav(auth, new URL(principal, ICLOUD).toString(), {
    body: '<?xml version="1.0" encoding="UTF-8"?><propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><prop><c:calendar-home-set/></prop></propfind>',
  }));
  const homeSet = firstHref(step2.match(/<calendar-home-set>[\s\S]*?<\/calendar-home-set>/)?.[0] || '');
  if (!homeSet) throw fail('캘린더 홈을 찾지 못했어요');

  // 3. 캘린더 목록
  const step3 = stripNs(await dav(auth, new URL(homeSet, ICLOUD).toString(), {
    depth: '1',
    body: '<?xml version="1.0" encoding="UTF-8"?><propfind xmlns="DAV:"><prop><resourcetype/><displayname/></prop></propfind>',
  }));
  const cals = [];
  for (const m of step3.matchAll(/<response>([\s\S]*?)<\/response>/g)) {
    const blk = m[1];
    const href = firstHref(blk);
    const rt = blk.match(/<resourcetype>([\s\S]*?)<\/resourcetype>/)?.[1] || '';
    if (!href || !/<calendar[\s/>]/.test(rt)) continue;
    if (/inbox|outbox|notification/i.test(href)) continue;
    const name = blk.match(/<displayname>([^<]*)<\/displayname>/)?.[1] || href;
    cals.push({ name: unescapeXml(name.trim()), url: new URL(href, ICLOUD).toString() });
  }
  return cals;
}

async function queryDay(auth, cals, date, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const startUtc = wallToUtc({ y, mo, d, h: 0, mi: 0, s: 0 }, tz);
  const endUtc = new Date(new Date(startUtc).getTime() + 86400000).toISOString();
  const range = { start: toIcsUtc(startUtc), end: toIcsUtc(endUtc) };
  const events = [];
  for (const cal of cals) {
    const xml = stripNs(await dav(auth, cal.url, {
      method: 'REPORT',
      depth: '1',
      body: `<?xml version="1.0" encoding="UTF-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${range.start}" end="${range.end}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`,
    }));
    for (const m of xml.matchAll(/<response>([\s\S]*?)<\/response>/g)) {
      const cd = m[1].match(/<calendar-data>([\s\S]*?)<\/calendar-data>/);
      if (!cd) continue;
      for (const ev of parseVevents(unescapeXml(cd[1]), tz)) {
        events.push({ ...ev, calendar: cal.name });
      }
    }
  }
  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return events;
}

function fail(msg) {
  const e = new Error(msg);
  e.status = 502;
  return e;
}

// ---- XML/ICS 파싱 (순수 함수 — node 테스트 가능) ----

// 네임스페이스 프리픽스 제거 (d:, c: 등) — 로컬명만 남김
export function stripNs(xml) {
  return xml.replace(/<(\/?)([A-Za-z_][\w.-]*):/g, '<$1');
}

function firstHref(block) {
  const m = block.match(/<href>([^<]+)<\/href>/);
  return m ? m[1] : null;
}

export function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function unescapeIcsText(s) {
  return s.replace(/\\([\\,;nN])/g, (_, c) => ({ '\\': '\\', ',': ',', ';': ';', n: '\n', N: '\n' }[c]));
}

export function parseVevents(ics, tz) {
  const lines = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded = [];
  for (const ln of lines) {
    if (/^[ \t]/.test(ln) && unfolded.length) unfolded[unfolded.length - 1] += ln.slice(1);
    else unfolded.push(ln);
  }
  const out = [];
  let cur = null;
  for (const ln of unfolded) {
    if (ln === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (ln === 'END:VEVENT') {
      if (cur) { const ev = buildEvent(cur, tz); if (ev) out.push(ev); }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = ln.match(/^([^:;]+)(;[^:]*)?:(.*)$/);
    if (!m) continue;
    const [, name, pstr = '', value] = m;
    if (!(name in cur)) cur[name] = { params: parseParams(pstr), value };
  }
  return out;
}

function parseParams(pstr) {
  const p = {};
  for (const part of pstr.split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i > 0) p[part.slice(0, i)] = part.slice(i + 1).replace(/^"|"$/g, '');
  }
  return p;
}

function buildEvent(p, tz) {
  if ((p.STATUS?.value || '').toUpperCase() === 'CANCELLED') return null;
  const uid = p.UID?.value || '';
  const start = parseIcsDate(p.DTSTART, tz);
  if (!start) return null;
  let end = parseIcsDate(p.DTEND, tz);
  if (!end && p.DURATION) end = addDuration(start, p.DURATION.value);
  const recId = p['RECURRENCE-ID']?.value;
  return {
    key: uid + '|' + (recId || start.iso),
    summary: unescapeIcsText(p.SUMMARY?.value || ''),
    start: start.iso,
    end: end?.iso || null,
    allDay: start.allDay,
    location: unescapeIcsText(p.LOCATION?.value || ''),
  };
}

// → { iso, allDay } | null. iso는 UTC ISO 문자열 또는 YYYY-MM-DD(종일)
export function parseIcsDate(prop, tz) {
  if (!prop) return null;
  const v = prop.value;
  const params = prop.params || {};
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    return { iso: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const parts = { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] };
  if (m[7]) {
    return {
      iso: new Date(Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s)).toISOString(),
      allDay: false,
    };
  }
  return { iso: wallToUtc(parts, params.TZID || tz), allDay: false };
}

function addDuration(start, dur) {
  const m = dur.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m || start.allDay) return null;
  const ms = ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0)) * 1000;
  return { iso: new Date(new Date(start.iso).getTime() + ms).toISOString(), allDay: false };
}

// tz 기준 wall-clock → UTC ISO. Intl로 오프셋을 구해 DST까지 정확히 변환.
export function wallToUtc(parts, tz) {
  const { y, mo, d, h, mi, s } = parts;
  const base = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = base;
  for (let i = 0; i < 4; i++) {
    const next = base - tzOffsetAt(tz, guess);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess).toISOString();
}

function tzOffsetAt(tz, utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asTzMs = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return asTzMs - utcMs;
}

function toIcsUtc(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function todayStr(tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
}
