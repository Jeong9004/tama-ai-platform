// TAMA AI Platform 대시보드 — 해시 라우터, 상태, 폴링, 공통 레이아웃(좌측 메뉴)
import { api, READONLY } from './api.js';
import { esc, arr, icon, brandMark, toast, closeOverlay, runCountUps, skeleton, emptyState, fmtClock } from './views/ui.js';
import * as home from './views/home.js';
import * as overview from './views/overview.js';
import * as progress from './views/progress.js';
import * as team from './views/team.js';
import * as method from './views/method.js';
import * as requests from './views/requests.js';
import * as results from './views/results.js';
import * as ops from './views/ops.js';

const TABS = [
  { id: 'overview', label: '개요', icon: 'overview', view: overview },
  { id: 'progress', label: '진행', icon: 'progress', view: progress },
  { id: 'team', label: 'AI 팀', icon: 'team', view: team },
  { id: 'method', label: '방법론', icon: 'method', view: method },
  { id: 'requests', label: '요청·자료', icon: 'requests', view: requests },
  { id: 'results', label: '결과물', icon: 'results', view: results },
  { id: 'ops', label: 'AI 연결', icon: 'ops', view: ops, ops: true },
];
const POLL_MS = 5000;

const state = {
  projects: null,
  views: {}, viewText: {}, viewAud: {}, viewErr: {},
  audience: loadAudience(),
  offline: false, lastOk: null,
  route: null, pendingPaint: false,
};
let renderSeq = 0;

function loadAudience() {
  try {
    const v = localStorage.getItem('studio.audience');
    if (v === 'ops' || v === 'client') return v;
  } catch { /* 저장소 없음 */ }
  return READONLY ? 'ops' : 'client';
}
function saveAudience(v) { try { localStorage.setItem('studio.audience', v); } catch { /* 저장 불가 시 이번 세션만 */ } }

function parseRoute() {
  const raw = (location.hash || '#/').slice(1);
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  const parts = path.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (parts[0] === 'p' && parts[1]) {
    const tab = TABS.some((t) => t.id === parts[2]) ? parts[2] : 'overview';
    return { name: 'project', id: parts[1], tab, params };
  }
  return { name: 'home', params };
}

export function navigate(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

// ---------- 껍데기 ----------
function ensureShell() {
  if (document.getElementById('shell')) return;
  document.getElementById('app').innerHTML = `
  <div class="shell" id="shell">
    <aside class="side" id="side">
      <div class="side-top">
        <a class="brand" href="#/">${brandMark()}<span class="brand-txt"><span class="brand-name">TAMA AI Platform</span><span class="brand-sub">AI 개발팀 진행 대시보드</span></span></a>
        <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="side-menu" aria-label="메뉴 열기">${icon('menu', 22)}</button>
      </div>
      <div class="side-menu" id="side-menu"></div>
    </aside>
    <main class="main" id="main">
      <div class="banner" id="banner" role="status" hidden></div>
      <div class="page" id="content"></div>
    </main>
  </div>`;

  const side = document.getElementById('side');
  const btn = document.getElementById('menu-btn');
  btn.addEventListener('click', () => {
    const open = !side.classList.contains('open');
    side.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  const menu = document.getElementById('side-menu');
  menu.addEventListener('click', async (e) => {
    if (e.target.closest('#logout')) {
      (await import('./vault.js')).logout();
      location.reload();
      return;
    }
    if (e.target.closest('a')) closeMenu();
  });
  menu.addEventListener('change', (e) => {
    if (e.target.id === 'proj-select') {
      const r = state.route;
      const tab = r && r.name === 'project' ? r.tab : 'overview';
      closeMenu();
      navigate(`#/p/${encodeURIComponent(e.target.value)}/${tab}`);
    } else if (e.target.id === 'aud-toggle') {
      setAudience(e.target.checked ? 'ops' : 'client');
    }
  });

  const content = document.getElementById('content');
  content.addEventListener('focusout', () => {
    setTimeout(() => { if (state.pendingPaint && !isEditing()) { state.pendingPaint = false; safePaint(); } }, 60);
  });
}
function closeMenu() {
  const side = document.getElementById('side');
  if (!side) return;
  side.classList.remove('open');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
}

function renderSide(route) {
  const el = document.getElementById('side-menu');
  const projects = arr(state.projects);
  let html = '';
  if (route.name === 'project') {
    const v = state.views[route.id];
    const openQ = v ? arr(v.questions).filter((q) => q.state === 'open').length : 0;
    const known = projects.some((p) => p.id === route.id);
    html += `<div class="side-sec"><label class="side-label" for="proj-select">프로젝트</label>
      <div class="select-wrap"><select id="proj-select">
        ${projects.map((p) => `<option value="${esc(p.id)}"${p.id === route.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
        ${known ? '' : `<option value="${esc(route.id)}" selected>${esc(v?.project?.name || route.id)}</option>`}
      </select>${icon('chevronDown', 16)}</div></div>`;
    html += `<nav class="nav" aria-label="프로젝트 메뉴">${TABS.filter((t) => !t.ops || state.audience === 'ops').map((t) => {
      const on = t.id === route.tab;
      return `<a href="#/p/${encodeURIComponent(route.id)}/${t.id}" class="${on ? 'on' : ''}${t.ops ? ' ops' : ''}"${on ? ' aria-current="page"' : ''}>
        ${icon(t.icon)}<span>${t.label}</span>
        ${t.id === 'requests' && openQ ? `<span class="count" title="답변을 기다리는 질문 ${openQ}건">${openQ}</span>` : ''}
        ${t.ops ? '<span class="ops-tag">운영자</span>' : ''}</a>`;
    }).join('')}</nav>
    <a class="side-link" href="#/">${icon('home', 16)}<span>전체 프로젝트</span></a>`;
  } else {
    html += `<nav class="nav" aria-label="프로젝트 목록">
      <a href="#/" class="on" aria-current="page">${icon('home')}<span>프로젝트</span></a>
      ${projects.map((p) => `<a href="#/p/${encodeURIComponent(p.id)}/overview">${icon('results')}<span class="ellip">${esc(p.name)}</span></a>`).join('')}
      <a href="#/?new=1">${icon('plus')}<span>새 프로젝트 의뢰</span></a>
    </nav>`;
  }
  html += `<div class="side-foot">
    <label class="switch"><input type="checkbox" id="aud-toggle"${state.audience === 'ops' ? ' checked' : ''}>
      <span class="track"><span class="thumb"></span></span>
      <span class="sw-txt"><span class="sw-t">운영자 모드</span><small>${state.audience === 'ops' ? '비용·AI 연결 표시 중' : '고객 보기'}</small></span></label>
    ${READONLY
      ? `<div class="side-note">웹 관리자 · 보기 전용</div><button type="button" class="side-link logout" id="logout">${icon('x', 16)}<span>로그아웃</span></button>`
      : '<div class="side-note">로컬 전용 · 127.0.0.1</div>'}</div>`;
  el.innerHTML = html;
}

function setBanner() {
  const b = document.getElementById('banner');
  if (!b) return;
  if (state.offline) {
    b.hidden = false;
    b.innerHTML = `${icon('wifiOff', 16)}<span>서버와 연결이 끊겼습니다. 다시 연결하는 중…${state.lastOk ? ` (마지막 갱신 ${fmtClock(state.lastOk)})` : ''}</span>`;
  } else {
    b.hidden = true;
    b.innerHTML = '';
  }
}
function setOffline(v) {
  if (!v) state.lastOk = Date.now();
  if (state.offline !== v) { state.offline = v; setBanner(); }
}

// ---------- 데이터 ----------
async function reloadProjects({ quiet = false } = {}) {
  try {
    const data = await api.projects();
    setOffline(false);
    const changed = JSON.stringify(data) !== JSON.stringify(state.projects);
    state.projects = arr(data);
    return changed;
  } catch (e) {
    if (e.status === 0) setOffline(true);
    else if (!quiet) toast(e.message, 'bad');
    if (!state.projects) state.projects = [];
    return false;
  }
}

async function loadView(id, { quiet = false } = {}) {
  try {
    const data = await api.view(id, state.audience);
    setOffline(false);
    const text = JSON.stringify(data);
    delete state.viewErr[id];
    if (text === state.viewText[id] && state.viewAud[id] === state.audience) return false;
    state.views[id] = data;
    state.viewText[id] = text;
    state.viewAud[id] = state.audience;
    return true;
  } catch (e) {
    if (e.status === 0) setOffline(true);
    else {
      state.viewErr[id] = e;
      if (!quiet && e.status !== 404) toast(e.message, 'bad');
    }
    return false;
  }
}

function isEditing() {
  const a = document.activeElement;
  const content = document.getElementById('content');
  if (!a || !content || !content.contains(a)) return false;
  if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT') return !['checkbox', 'radio', 'button', 'submit', 'file'].includes(a.type);
  return false;
}

function safePaint() {
  if (isEditing()) { state.pendingPaint = true; return; }
  const y = window.scrollY;
  paint();
  window.scrollTo(0, y);
}

function makeCtx(route) {
  return {
    route, id: route.id, tab: route.tab, params: route.params, readonly: READONLY,
    view: route.id ? state.views[route.id] : null,
    projects: state.projects,
    audience: state.audience,
    api, navigate, toast,
    // 서버에서 다시 받아 그린다(force: 바뀐 게 없어도 다시 그림)
    refresh: async ({ force = true } = {}) => {
      if (route.name === 'project') {
        const changed = await loadView(route.id, { quiet: false });
        if (changed || force) safePaint();
      } else {
        const changed = await reloadProjects();
        if (changed || force) safePaint();
      }
    },
    reloadProjects: async () => { await reloadProjects(); renderSide(state.route); },
    repaint: () => safePaint(),
  };
}

function paint() {
  const route = state.route;
  if (!route) return;
  renderSide(route);
  setBanner();
  const content = document.getElementById('content');
  const ctx = makeCtx(route);
  if (route.name === 'home') {
    home.render(content, ctx);
    document.title = 'TAMA AI Platform';
  } else {
    const v = state.views[route.id];
    if (!v) {
      const err = state.viewErr[route.id];
      content.innerHTML = err && err.status === 404
        ? emptyState('프로젝트를 찾을 수 없습니다', '주소가 바뀌었거나 삭제된 프로젝트입니다.', 'alert', `<a class="btn ghost" href="#/">전체 프로젝트로</a>`)
        : state.offline
          ? emptyState('서버에 연결할 수 없습니다', 'studio 서버가 켜져 있는지 확인해 주세요. 연결되면 자동으로 다시 불러옵니다.', 'wifiOff')
          : emptyState('프로젝트를 불러오지 못했습니다', err ? err.message : '', 'alert', `<button class="btn ghost" type="button" id="retry">다시 시도</button>`);
      content.querySelector('#retry')?.addEventListener('click', () => render());
      return;
    }
    const tab = TABS.find((t) => t.id === route.tab) || TABS[0];
    tab.view.render(content, ctx);
    document.title = `${tab.label} · ${v.project?.name || ''} — TAMA AI Platform`;
  }
  runCountUps(content, route.id || 'home');
}

async function render() {
  ensureShell();
  const seq = ++renderSeq;
  const route = parseRoute();
  const prev = state.route;
  state.route = route;
  document.body.dataset.tab = route.name === 'project' ? route.tab : 'home';
  closeOverlay();
  closeMenu();

  if (route.name === 'project' && route.tab === 'ops' && state.audience !== 'ops') {
    location.replace(`#/p/${encodeURIComponent(route.id)}/overview`);
    return;
  }
  const content = document.getElementById('content');
  const needProjects = !state.projects;
  const needView = route.name === 'project' && (!state.views[route.id] || state.viewAud[route.id] !== state.audience);
  if (needProjects || needView) {
    renderSide(route);
    if (needView || route.name === 'home') content.innerHTML = skeleton();
  }
  if (needProjects) await reloadProjects();
  if (needView) await loadView(route.id);
  if (seq !== renderSeq) return;

  const samePage = prev && prev.name === route.name && prev.id === route.id && prev.tab === route.tab;
  paint();
  if (!samePage) window.scrollTo(0, 0);
}

async function setAudience(aud) {
  state.audience = aud;
  saveAudience(aud);
  state.views = {}; state.viewText = {}; state.viewAud = {};
  const r = state.route;
  toast(aud === 'ops' ? '운영자 모드: 비용과 AI 연결 정보를 함께 표시합니다' : '고객 보기로 전환했습니다', 'info');
  if (r && r.name === 'project' && r.tab === 'ops' && aud !== 'ops') {
    location.hash = `#/p/${encodeURIComponent(r.id)}/overview`;
    return;
  }
  await render();
}

// ---------- 폴링 ----------
async function tick() {
  if (document.hidden) return;
  const r = state.route;
  if (!r) return;
  if (r.name === 'project') {
    const v = state.views[r.id];
    const live = v && v.status && v.status.live;
    if (!live && !state.offline && v) return;
    const changed = await loadView(r.id, { quiet: true });
    if (state.route !== r) return;
    if (changed) { await reloadProjects({ quiet: true }); safePaint(); }
    else if (!v && state.views[r.id]) safePaint();
  } else {
    const anyRunning = arr(state.projects).some((p) => p.state && p.state !== 'done');
    if (!anyRunning && !state.offline) return;
    const changed = await reloadProjects({ quiet: true });
    if (changed && state.route === r) safePaint();
  }
}

window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
setInterval(tick, POLL_MS);
render();
