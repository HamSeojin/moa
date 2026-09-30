// 모아 — [[위키링크]] 파싱 · 엔티티 정규화 · 추출 결과 반영
import { store, todayKey } from './store.js?v=1.4.6';

export function extractWikilinks(text = '') {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

// 이름 정규화: 소문자·공백 제거 비교로 "엄마/어머니" 같은 표기를 묶는다.
// aliases에 있으면 정식이름으로 통일.
function normalizeName(kind, raw) {
  const { people, places, tags } = store.entities();
  const list = kind === 'person' ? people : kind === 'place' ? places : tags;
  const key = raw.replace(/\s+/g, '').toLowerCase();
  for (const e of list) {
    const names = [e.name, ...(e.aliases || [])].map((n) =>
      n.replace(/\s+/g, '').toLowerCase()
    );
    if (names.includes(key)) return e.name;
  }
  return raw;
}

export function upsertEntity(kind, rawName) {
  const name = rawName.trim();
  if (!name) return null;
  const entities = store.entities();
  const listKey = kind === 'person' ? 'people' : kind === 'place' ? 'places' : 'tags';
  const canonical = normalizeName(kind, name);
  let ent = entities[listKey].find((e) => e.name === canonical);
  if (!ent) {
    ent = { id: store.uid(), name: canonical, aliases: canonical === name ? [] : [name], count: 0 };
    entities[listKey].push(ent);
  } else if (canonical !== name && !(ent.aliases || []).includes(name)) {
    ent.aliases.push(name);
  }
  ent.count = (ent.count || 0) + 1;
  store.saveEntities(entities);
  return ent.name;
}

// LLM 추출 결과를 entry에 반영하고 entry id를 반환
export function applyExtraction(entryId, result = {}) {
  const tags = (result.tags || []).map((t) => upsertEntity('tag', t)).filter(Boolean);
  const people = (result.people || []).map((p) => upsertEntity('person', p)).filter(Boolean);
  const places = (result.places || []).map((p) => upsertEntity('place', p)).filter(Boolean);
  // 링크: 다듬어진 본문의 [[위키링크]] + LLM이 뽑은 키워드를 합쳐 중복 제거
  const entry = store.entries().find((e) => e.id === entryId) || {};
  const links = [
    ...new Set([
      ...extractWikilinks(entry.polished || entry.raw || ''),
      ...(result.links || []).map((l) => String(l).trim()).filter(Boolean),
    ]),
  ];

  // todos는 별도 Entry로 (할일 카드)
  const todos = result.todos || [];
  const dateKey = todayKey();
  for (const t of todos) {
    store.addEntry({
      date: dateKey,
      type: 'manual',
      source: 'todo',
      raw: t,
      polished: '☐ ' + t,
      tags: ['할일'],
      people: [],
      places: [],
      links: [],
      confidence: 1,
      editedByUser: false,
    });
  }

  store.updateEntry(entryId, {
    tags, people, places, links,
    mood: result.mood || null,
    confidence: 0.8,
  });
}

// 백링크: 이 노트(엔트리/엔티티 이름)를 links에 언급한 엔트리들
export function backlinks(name) {
  const key = name.replace(/\s+/g, '').toLowerCase();
  return store.entries().filter((e) =>
    (e.links || []).some((l) => l.replace(/\s+/g, '').toLowerCase() === key)
  );
}
