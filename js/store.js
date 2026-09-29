// 모아 — localStorage 래퍼. 네임스페이스: moa/v1/*
// v2 Supabase 이식 때 이 파일의 인터페이스만 갈아끼우면 된다.

const NS = 'moa/v1/';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(NS + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.warn('[moa] 저장 실패 (용량 초과 가능):', e);
    return false;
  }
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

export const todayKey = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const store = {
  get: read,
  set: write,
  uid,

  // ---- Entries ----
  entries: () => read('entries', []),
  saveEntries: (list) => write('entries', list),
  addEntry(entry) {
    const list = this.entries();
    list.push({ id: uid(), createdAt: new Date().toISOString(), ...entry });
    this.saveEntries(list);
    return list[list.length - 1];
  },
  updateEntry(id, patch) {
    const list = this.entries().map((e) => (e.id === id ? { ...e, ...patch } : e));
    this.saveEntries(list);
  },
  removeEntry(id) {
    this.saveEntries(this.entries().filter((e) => e.id !== id));
  },
  entriesByDate(dateKey) {
    return this.entries()
      .filter((e) => (e.date || e.createdAt.slice(0, 10)) === dateKey)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  // ---- Entities (Person/Place/Tag) ----
  entities: () => read('entities', { people: [], places: [], tags: [] }),
  saveEntities: (e) => write('entities', e),

  // ---- Habits ----
  habits: () => read('habits', []),
  saveHabits: (h) => write('habits', h),

  // ---- DayCards (파생 데이터 — 재계산 가능) ----
  daycards: () => read('daycards', {}),
  saveDaycards: (d) => write('daycards', d),

  // ---- Settings ----
  settings: () => read('settings', { llmProvider: 'openai', apiKeys: {} }),
  saveSettings: (s) => write('settings', s),

  // 첫 실행 시 환영 카드 (빈 날은 없다)
  seedIfEmpty() {
    if (read('seeded', false)) return;
    const key = todayKey();
    this.addEntry({
      date: key,
      type: 'manual',
      source: 'moa',
      raw: '모아 첫 실행',
      polished:
        '모아에 온 걸 환영해! 여기는 네 세컨드 브레인이 될 곳이야. ' +
        '끄적 탭에서 아무렇게나 써봐. 예쁘게 다듬어줄게. ' +
        '[[모아]] 사용법이 궁금하면 탐색 탭에서 이 카드를 눌러봐.',
      tags: ['환영'],
      people: [],
      places: [],
      links: [],
      confidence: 1,
      editedByUser: false,
    });
    write('seeded', true);
  },
};
