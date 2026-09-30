// 모아 — 탐색 탭 그래프 (SVG, 원형 레이아웃)
// 노드: 엔트리(작은 점) · 사람 · 태그 · 장소 / 엣지: links[] + 동시 언급

import { store } from './store.js?v=1.4.5';

const NODE_COLORS = {
  entry: '#CBE6F8',
  person: '#FFE0B8',
  tag: '#DCD2F7',
  place: '#CDEBC8',
};

export function buildGraph(focusName = null) {
  const entries = store.entries();
  const { people, places, tags } = store.entities();
  const nodes = [];
  const edges = [];
  const seen = new Set();

  const addNode = (id, label, kind) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label, kind });
  };

  for (const p of people) addNode('person:' + p.name, p.name, 'person');
  for (const t of tags) addNode('tag:' + t.name, '#' + t.name, 'tag');
  for (const p of places) addNode('place:' + p.name, p.name, 'place');

  for (const e of entries) {
    const eid = 'entry:' + e.id;
    addNode(eid, (e.polished || e.raw || '').slice(0, 14) || '기록', 'entry');
    const linkTo = (kind, name) => {
      const nid = kind + ':' + name;
      if (seen.has(nid)) edges.push([eid, nid]);
    };
    (e.people || []).forEach((n) => linkTo('person', n));
    (e.tags || []).forEach((n) => linkTo('tag', n));
    (e.places || []).forEach((n) => linkTo('place', n));
    // [[위키링크]] → 같은 이름의 엔티티가 있으면 연결
    for (const l of e.links || []) {
      for (const kind of ['person', 'tag', 'place']) {
        const nid = kind + ':' + l;
        if (seen.has(nid)) edges.push([eid, nid]);
      }
    }
  }

  // 포커스가 있으면 1-hop 이웃만
  if (focusName) {
    const fid = focusName;
    const neighborIds = new Set([fid]);
    for (const [a, b] of edges) {
      if (a === fid) neighborIds.add(b);
      if (b === fid) neighborIds.add(a);
    }
    return {
      nodes: nodes.filter((n) => neighborIds.has(n.id)),
      edges: edges.filter(([a, b]) => neighborIds.has(a) && neighborIds.has(b)),
    };
  }
  return { nodes, edges };
}

export function renderGraph(svg, graph, onNodeClick) {
  const W = 600, H = 420, cx = W / 2, cy = H / 2;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const { nodes, edges } = graph;
  if (!nodes.length) {
    svg.innerHTML = `<text x="${cx}" y="${cy}" text-anchor="middle" class="hand" font-size="22" fill="#6B5F61">아직 엮인 기록이 없어 ✎</text>`;
    return;
  }
  const pos = {};
  const R = Math.min(W, H) / 2 - 60;
  nodes.forEach((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    pos[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const ns = 'http://www.w3.org/2000/svg';
  for (const [a, b] of edges) {
    if (!pos[a] || !pos[b]) continue;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', pos[a].x); line.setAttribute('y1', pos[a].y);
    line.setAttribute('x2', pos[b].x); line.setAttribute('y2', pos[b].y);
    line.setAttribute('class', 'g-edge');
    svg.appendChild(line);
  }
  for (const n of nodes) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'g-node');
    const r = n.kind === 'entry' ? 9 : 20;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', pos[n.id].x); c.setAttribute('cy', pos[n.id].y);
    c.setAttribute('r', r);
    c.setAttribute('fill', NODE_COLORS[n.kind] || '#fff');
    g.appendChild(c);
    if (n.kind !== 'entry') {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', pos[n.id].x); t.setAttribute('y', pos[n.id].y + r + 16);
      t.textContent = n.label.length > 10 ? n.label.slice(0, 10) + '…' : n.label;
      g.appendChild(t);
    }
    g.addEventListener('click', () => onNodeClick && onNodeClick(n));
    svg.appendChild(g);
  }
}
