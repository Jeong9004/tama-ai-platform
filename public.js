// TAMA AI Platform 공개 사이트 — 정적 데이터(data/site.json)만 읽는다. 서버 없음.
// 메뉴: 홈·의뢰 / 개발 방법론 / AI 개발팀 / 완료 프로젝트. 방법론·AI 팀은 공개 사례 프로젝트의 기록으로 그린다.
import { esc, arr, icon, brandMark, closeOverlay, runCountUps, skeleton, emptyState } from './views/ui.js';
import * as home from './views/public_home.js';
import * as team from './views/team.js';
import * as method from './views/method.js';

const PAGES = [
  { id: 'home', label: '홈 · 새 프로젝트 의뢰', icon: 'home' },
  { id: 'method', label: '개발 방법론', icon: 'method' },
  { id: 'team', label: 'AI 개발팀', icon: 'team' },
  { id: 'projects', label: '완료 프로젝트', icon: 'results' },
];

const state = { data: null, error: null, sent: false };

try {
  const q = new URLSearchParams(location.search);
  if (q.get('sent') === '1') {
    state.sent = true;
    history.replaceState(null, '', location.pathname + (location.hash || '#/'));
  }
} catch { /* 주소 정리 실패는 무시 */ }

function route() {
  const id = (location.hash || '#/').replace(/^#\/?/, '').split(/[/?]/)[0];
  return PAGES.some((p) => p.id === id) ? id : 'home';
}

function shell() {
  if (document.getElementById('shell')) return;
  document.getElementById('app').innerHTML = `
  <div class="shell" id="shell">
    <aside class="side" id="side">
      <div class="side-top">
        <a class="brand" href="#/">${brandMark()}<span class="brand-txt"><span class="brand-name">TAMA AI Platform</span><span class="brand-sub">AI 개발팀 플랫폼</span></span></a>
        <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="side-menu" aria-label="메뉴 열기">${icon('menu', 22)}</button>
      </div>
      <div class="side-menu" id="side-menu"></div>
    </aside>
    <main class="main" id="main"><div class="page" id="content"></div></main>
  </div>`;
  const side = document.getElementById('side');
  const btn = document.getElementById('menu-btn');
  btn.addEventListener('click', () => {
    const open = !side.classList.contains('open');
    side.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  document.getElementById('side-menu').addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
}

function closeMenu() {
  document.getElementById('side')?.classList.remove('open');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
}

function side(cur) {
  const n = arr(state.data?.projects).length;
  document.getElementById('side-menu').innerHTML = `
    <nav class="nav" aria-label="사이트 메뉴">${PAGES.map((p) => `<a href="#/${p.id === 'home' ? '' : p.id}" class="${p.id === cur ? 'on' : ''}"${p.id === cur ? ' aria-current="page"' : ''}>
      ${icon(p.icon)}<span>${p.label}</span>${p.id === 'projects' && n ? `<span class="count soft">${n}</span>` : ''}</a>`).join('')}</nav>
    <div class="side-foot"><div class="side-note pub">의뢰하신 프로젝트의 진행 상황은<br>접수 후 담당자가 따로 안내해 드립니다.</div>
      <a class="side-link" href="./admin.html">${icon('shield', 16)}<span>관리자 로그인</span></a></div>`;
}

function caseNote(v) {
  const name = v?.project?.name || '';
  return `<div class="case-note">${icon('flag', 15)}<span>아래는 완료 프로젝트 <b>「${esc(name)}」</b>를 실제로 진행한 기록입니다. 프로젝트마다 같은 방법론과 팀 구성으로 진행합니다.</span></div>`;
}

function paint() {
  const cur = route();
  document.body.dataset.tab = cur === 'team' ? 'team' : 'home';
  side(cur);
  const el = document.getElementById('content');
  if (state.error) {
    el.innerHTML = emptyState('페이지를 불러오지 못했습니다', '잠시 후 새로고침해 주세요.', 'alert');
    return;
  }
  const d = state.data;
  const ctx = {
    site: d.site, projects: d.projects, sent: state.sent,
    clearSent: () => { state.sent = false; paint(); },
    view: d.showcase?.view,
  };
  if (cur === 'home') {
    home.render(el, ctx);
    document.title = 'TAMA AI Platform';
  } else if (cur === 'projects') {
    el.innerHTML = `<header class="page-head"><div class="eyebrow">완료 프로젝트</div>
      <h1 class="page-title">AI 개발팀이 끝까지 만든 프로젝트</h1>
      <p class="page-lead">진행 대시보드와 결과물은 해당 고객만 열람할 수 있어, 여기서는 요약만 보여드립니다.</p></header>
      ${home.projectsSection(d.projects, { full: true })}`;
    document.title = '완료 프로젝트 — TAMA AI Platform';
  } else {
    const page = PAGES.find((p) => p.id === cur);
    if (!ctx.view) { el.innerHTML = emptyState('공개된 사례가 없습니다', '', 'inbox'); return; }
    el.innerHTML = `${caseNote(ctx.view)}<div id="case"></div>`;
    (cur === 'team' ? team : method).render(el.querySelector('#case'), ctx);
    document.title = `${page.label} — TAMA AI Platform`;
  }
  runCountUps(el, cur);
}

async function start() {
  shell();
  document.getElementById('content').innerHTML = skeleton();
  side(route());
  try {
    const res = await fetch('./data/site.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    state.data = await res.json();
  } catch (e) {
    state.error = e;
  }
  paint();
}

window.addEventListener('hashchange', () => { closeOverlay(); closeMenu(); paint(); window.scrollTo(0, 0); });
start();
