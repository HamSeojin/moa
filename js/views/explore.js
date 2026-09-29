// 모아 — 탐색 탭 (검색 · 그래프 · 백링크)
import { store } from '../store.js';
import { buildGraph, renderGraph } from '../graph.js';
import { backlinks } from '../extract.js';

export function renderExplore(el) {
  el.innerHTML = `
    <h2><span class="hl">탐색</span>하기</h2>
    <div class="field">
      <input id="ex-q" class="input" placeholder="검색... (예: 여수, 우진)">
    </div>
    <div id="ex-results"></div>
    <div class="spacer"></div>
    <h2 style="font-size:19px"><span class="hl">연결</span> 그래프</h2>
    <div class="graph-wrap"><svg id="ex-graph"></svg></div>
    <div class="hand-note" id="ex-hint">노드를 눌러보면 연결된 것만 보여줘!</div>
    <div id="ex-detail"></div>
  `;

  const svg = el.querySelector('#ex-graph');
  const detail = el.querySelector('#ex-detail');
  let focus = null;

  const draw = () => {
    renderGraph(svg, buildGraph(focus), (node) => {
      focus = focus === node.id ? null : node.id;
      el.querySelector('#ex-hint').textContent = focus
        ? `「${node.label}」와 연결된 것들만 보는 중. 다시 누르면 전체로!`
        : '노드를 눌러보면 연결된 것만 보여줘!';
      draw();
      if (focus) showBacklinks(node);
      else detail.innerHTML = '';
    });
  };

  const showBacklinks = (node) => {
    const bl = backlinks(node.label.replace(/^#/, ''));
    detail.innerHTML = `
      <div class="sticker tape tape-butter">
        <div class="hand" style="font-size:21px">「${node.label}」 백링크 ${bl.length}개</div>
        ${bl.length ? bl.map((e) => `
          <div class="tl-card" style="margin:8px 0;padding:10px;background:var(--paper);border:2px solid var(--ink);border-radius:12px">
            <div class="tl-time">${(e.date || '').slice(5)}</div>
            <div class="hand" style="font-size:19px">${(e.polished || e.raw || '').slice(0, 80)}</div>
          </div>`).join('') : '<div class="hand-note">아직 이 이름을 언급한 기록이 없어.</div>'}
      </div>`;
  };

  draw();

  // 검색
  el.querySelector('#ex-q').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    const box = el.querySelector('#ex-results');
    if (!q) { box.innerHTML = ''; return; }
    const hits = store.entries().filter((e) =>
      ((e.polished || '') + (e.raw || '') + (e.tags || []).join(' ') +
       (e.people || []).join(' ') + (e.places || []).join(' ')).toLowerCase().includes(q)
    ).slice(-20).reverse();
    box.innerHTML = hits.length ? `
      <div class="sticker">
        <div class="hand" style="font-size:20px">${hits.length}개 찾았어!</div>
        ${hits.map((e) => `
          <div style="margin:10px 0;padding-bottom:10px;border-bottom:2px dashed var(--paper-deep)">
            <div class="tl-time">${(e.date || e.createdAt.slice(0, 10)).slice(5)}</div>
            <div class="hand" style="font-size:19px">${(e.polished || e.raw || '').slice(0, 90)}</div>
          </div>`).join('')}
      </div>` : `<div class="hand-note">검색 결과가 없어. 다른 단어로?</div>`;
  });
}
