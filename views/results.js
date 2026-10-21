// 6 결과물: 문서 / 시험 / 추적성 / 리뷰 기록 / 적합성 감사
import {
  esc, arr, num, icon, fmtTime, fmtNum, fmtSize, fileBadge, fileExt, ART_KIND, DISPO, phaseName,
  reviewerLabel, pageHead, emptyState,
} from './ui.js';
import { suiteName } from './overview.js';

const TABS = [
  { id: 'docs', label: '문서', icon: 'results' },
  { id: 'tests', label: '시험', icon: 'beaker' },
  { id: 'trace', label: '추적성', icon: 'link' },
  { id: 'reviews', label: '리뷰 기록', icon: 'shield' },
  { id: 'audit', label: '적합성 감사', icon: 'audit' },
];
const KIND_ORDER = ['report', 'spec', 'plan', 'doc', 'test', 'review', 'image', 'source'];

const ui = { pid: null, tab: 'docs', doc: null, traceQ: '', traceS: 'all', open: new Set(), param: '' };
const mdCache = new Map();

export function render(el, ctx) {
  const v = ctx.view;
  if (ui.pid !== ctx.id) Object.assign(ui, { pid: ctx.id, tab: 'docs', doc: null, traceQ: '', traceS: 'all', open: new Set() });
  const docParam = ctx.params && ctx.params.get('doc');
  const sig = `${ctx.id}|${docParam || ''}`;
  if (docParam && ui.param !== sig) { ui.tab = 'docs'; ui.doc = docParam; }
  ui.param = sig;

  const counts = {
    docs: arr(v.artifacts).length,
    tests: num(v.kpis?.tests?.passed),
    trace: arr(v.requirements).length,
    reviews: arr(v.reviews).length,
    audit: v.audit ? num(v.audit.clauses) : 0,
  };

  el.innerHTML = `
  ${pageHead({
    eyebrow: '결과물',
    title: '문서와 검증 증거',
    lead: '설계 문서부터 시험 결과, 요구사항 추적성, AI 교차 리뷰 처리 기록, 원본 조항 감사까지 — 개발의 모든 증거를 여기에서 확인하실 수 있습니다.',
  })}
  <div class="tabs" role="tablist" aria-label="결과물 종류">
    ${TABS.map((t) => `<button type="button" role="tab" id="tab-${t.id}" aria-selected="${ui.tab === t.id}" aria-controls="tabpanel" class="${ui.tab === t.id ? 'on' : ''}" data-tab="${t.id}">
      ${icon(t.icon, 16)}<span>${t.label}</span>${counts[t.id] ? `<em>${fmtNum(counts[t.id])}</em>` : ''}</button>`).join('')}
  </div>
  <div id="tabpanel" role="tabpanel" aria-labelledby="tab-${ui.tab}">${panel(v, ctx)}</div>`;

  el.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === ui.tab) return;
    ui.tab = b.dataset.tab;
    ctx.repaint();
  });
  bindPanel(el, v, ctx);
}

function panel(v, ctx) {
  switch (ui.tab) {
    case 'tests': return testsTab(v);
    case 'trace': return traceTab(v);
    case 'reviews': return reviewsTab(v);
    case 'audit': return auditTab(v);
    default: return docsTab(v);
  }
}

function bindPanel(el, v, ctx) {
  if (ui.tab === 'docs') {
    el.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
      ui.doc = b.dataset.doc;
      el.querySelectorAll('[data-doc]').forEach((x) => x.classList.toggle('on', x.dataset.doc === ui.doc));
      showDoc(el, v, ctx, true);
    }));
    showDoc(el, v, ctx, false);
  } else if (ui.tab === 'trace') {
    const input = el.querySelector('#trace-q');
    const body = el.querySelector('#trace-body');
    const cnt = el.querySelector('#trace-count');
    const redraw = () => { const r = traceRows(v); body.innerHTML = r.html; cnt.textContent = r.count; };
    input.addEventListener('input', () => { ui.traceQ = input.value; redraw(); });
    el.querySelector('.trace-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      ui.traceS = b.dataset.s;
      el.querySelectorAll('.trace-seg [data-s]').forEach((x) => {
        x.classList.toggle('on', x.dataset.s === ui.traceS);
        x.setAttribute('aria-pressed', String(x.dataset.s === ui.traceS));
      });
      redraw();
    });
  } else if (ui.tab === 'reviews') {
    el.querySelectorAll('details.rv').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) ui.open.add(d.dataset.rv); else ui.open.delete(d.dataset.rv);
    }));
  }
}

// ---------- 문서 ----------
function docsTab(v) {
  const arts = arr(v.artifacts);
  if (!arts.length) return emptyState('아직 등록된 결과물이 없습니다', 'AI 팀이 문서를 만들면 여기에 차례로 올라옵니다.', 'results');
  if (!ui.doc || !arts.some((a) => a.id === ui.doc)) {
    const first = arts.filter(isMd).sort(kindSort)[0] || arts.slice().sort(kindSort)[0];
    ui.doc = first ? first.id : null;
  }
  const groups = KIND_ORDER.map((k) => ({ k, items: arts.filter((a) => a.kind === k) }))
    .concat([{ k: 'etc', items: arts.filter((a) => !KIND_ORDER.includes(a.kind)) }])
    .filter((g) => g.items.length);
  return `<div class="docs">
    <nav class="doc-list" aria-label="문서 목록">${groups.map((g) => `
      <div class="dl-group"><div class="dl-h">${esc(ART_KIND[g.k] || '기타')} <span>${g.items.length}</span></div>
        ${g.items.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko')).map((a) => `
        <button type="button" class="doc-item${a.id === ui.doc ? ' on' : ''}" data-doc="${esc(a.id)}">
          ${fileBadge(a.file || a.title)}<span class="di-t"><span>${esc(a.title)}</span>
          <small>${a.rev ? `${esc(a.rev)} · ` : ''}${esc(fmtTime(a.ts))} · ${fmtSize(a.size)}</small></span></button>`).join('')}
      </div>`).join('')}
    </nav>
    <article class="viewer" id="viewer" aria-live="polite"></article>
  </div>`;
}
const kindSort = (a, b) => {
  const ka = KIND_ORDER.indexOf(a.kind), kb = KIND_ORDER.indexOf(b.kind);
  return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb);
};

const isMd = (a) => /markdown/i.test(a.mime || '') || /\.md$/i.test(a.file || '');
const isImg = (a) => /^image\//i.test(a.mime || '') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExt(a.file));
const isPdf = (a) => /pdf/i.test(a.mime || '') || fileExt(a.file) === 'pdf';

async function showDoc(el, v, ctx, scroll) {
  const box = el.querySelector('#viewer');
  if (!box) return;
  const a = arr(v.artifacts).find((x) => x.id === ui.doc);
  if (!a) { box.innerHTML = emptyState('왼쪽에서 문서를 고르세요', '', 'results'); return; }
  let url = ctx.api.artifactUrl(ctx.id, a.id);
  if (ctx.api.artifactHref && !isMd(a)) {
    box.innerHTML = '<div class="md-loading"><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>';
    try { url = await ctx.api.artifactHref(ctx.id, a.id); } catch (e) {
      box.innerHTML = emptyState('문서를 불러오지 못했습니다', e.message, 'alert');
      return;
    }
    if (ui.doc !== a.id || !document.body.contains(box)) return;
  }
  const head = `<header class="vw-head">
      <div><div class="vw-kind">${esc(ART_KIND[a.kind] || a.kind || '문서')}${a.rev ? ` · ${esc(a.rev)}` : ''} · ${esc(fmtTime(a.ts))}</div><h2>${esc(a.title)}</h2>
        <div class="vw-file mono">${esc(a.file || '')}</div></div>
      <div class="vw-actions"><a class="btn ghost sm" href="${url}" target="_blank" rel="noopener">${icon('external', 14)} 새 탭</a>
        <a class="btn sm" href="${url}" download="${esc((a.file || a.title || 'file').split('/').pop())}">${icon('download', 14)} 내려받기</a></div>
    </header>`;
  if (scroll && window.matchMedia('(max-width: 960px)').matches) box.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (isMd(a)) {
    const key = `${ctx.id}:${a.id}`;
    if (mdCache.has(key)) { box.innerHTML = head + mdHtml(mdCache.get(key)); return; }
    box.innerHTML = head + '<div class="md-loading"><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>';
    try {
      const text = await ctx.api.artifactText(ctx.id, a.id);
      mdCache.set(key, text);
      if (ui.doc === a.id && document.body.contains(box)) box.innerHTML = head + mdHtml(text);
    } catch (e) {
      if (ui.doc === a.id) box.innerHTML = head + emptyState('문서를 불러오지 못했습니다', e.message, 'alert');
    }
  } else if (isImg(a)) {
    box.innerHTML = head + `<div class="vw-img"><img src="${url}" alt="${esc(a.title)}" loading="lazy"></div>`;
  } else if (isPdf(a)) {
    box.innerHTML = head + `<iframe class="vw-pdf" src="${url}" title="${esc(a.title)}"></iframe>`;
  } else {
    box.innerHTML = head + `<div class="vw-other">${fileBadge(a.file || a.title)}<div><h3>${esc(a.title)}</h3>
      <p>이 형식(${esc(fileExt(a.file).toUpperCase() || '파일')})은 화면에서 미리 볼 수 없습니다. 내려받아 열어 주세요.</p>
      <a class="btn" href="${url}" download="${esc((a.file || 'file').split('/').pop())}">${icon('download', 16)} 내려받기 · ${fmtSize(a.size)}</a></div></div>`;
  }
}

function mdHtml(text) {
  let html;
  try {
    const raw = window.marked ? window.marked.parse(text, { gfm: true }) : `<pre>${esc(text)}</pre>`;
    html = window.DOMPurify ? window.DOMPurify.sanitize(raw) : `<pre>${esc(text)}</pre>`;
  } catch {
    html = `<pre>${esc(text)}</pre>`;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('table').forEach((t) => {
    const w = document.createElement('div');
    w.className = 'md-tbl';
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });
  tmp.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  return `<div class="md">${tmp.innerHTML}</div>`;
}

// ---------- 시험 ----------
function testsTab(v) {
  const t = v.kpis?.tests || {};
  const suites = arr(t.suites);
  if (!suites.length && !t.passed) return emptyState('아직 시험 결과가 없습니다', '', 'beaker');
  const total = num(t.passed) + num(t.failed) + num(t.skipped);
  return `<div class="tests">
    <div class="test-hero card">
      <div class="th-big"><span>${fmtNum(t.passed)}</span><small>/ ${fmtNum(total)}</small></div>
      <div><h3>자동 시험 통과</h3><p>실패 ${fmtNum(num(t.failed))} · 건너뜀 ${fmtNum(num(t.skipped))} — 건너뛴 시험은 실패로 칩니다.</p></div>
      <span class="pill ${num(t.failed) || num(t.skipped) ? 'bad' : 'ok'}">${num(t.failed) || num(t.skipped) ? '확인 필요' : `${icon('check', 13)}전부 통과`}</span>
    </div>
    <div class="suites">${suites.map((s) => {
      const tot = num(s.passed) + num(s.failed) + num(s.skipped);
      const pct = tot ? (num(s.passed) / tot) * 100 : 0;
      const title = /시험|test/i.test(s.suite || '') ? s.suite : `${suiteName(s.suite)} 시험`;
      return `<article class="suite card"><div class="su-h"><h3>${esc(title)}</h3>${s.ts ? `<span class="su-k">${esc(fmtTime(s.ts))}</span>` : ''}</div>
        <div class="su-big">${fmtNum(s.passed)}<small>통과</small></div>
        <div class="bar thick"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="su-f"><span>실패 <b>${fmtNum(num(s.failed))}</b></span><span>건너뜀 <b>${fmtNum(num(s.skipped))}</b></span><span>${pct.toFixed(1)}%</span></div></article>`;
    }).join('')}</div>
  </div>`;
}

// ---------- 추적성 ----------
const REQ_S = { pass: { label: '충족', cls: 'ok' }, fail: { label: '미충족', cls: 'bad' }, na: { label: '해당 없음', cls: 'mute' } };
function traceTab(v) {
  const reqs = arr(v.requirements);
  if (!reqs.length) return emptyState('아직 정의된 요구사항이 없습니다', '', 'link');
  const r = traceRows(v);
  const n = (s) => reqs.filter((x) => x.status === s).length;
  return `<div class="trace">
    <div class="trace-bar">
      <label class="search">${icon('search', 16)}<input id="trace-q" type="search" placeholder="REQ ID · 요구사항 · 시험 이름으로 찾기" value="${esc(ui.traceQ)}" aria-label="요구사항 찾기"></label>
      <div class="seg trace-seg" role="group" aria-label="판정으로 거르기">
        ${[['all', `전체 ${reqs.length}`], ['pass', `충족 ${n('pass')}`], ['fail', `미충족 ${n('fail')}`], ['na', `해당 없음 ${n('na')}`]]
          .map(([k, l]) => `<button type="button" data-s="${k}" class="${ui.traceS === k ? 'on' : ''}" aria-pressed="${ui.traceS === k}">${l}</button>`).join('')}
      </div>
    </div>
    <p class="muted small" id="trace-count">${r.count}</p>
    <div class="tbl-wrap"><table class="tbl trace-tbl"><thead><tr><th>REQ</th><th>요구사항</th><th>판정</th><th>근거 시험</th></tr></thead>
      <tbody id="trace-body">${r.html}</tbody></table></div>
  </div>`;
}
function traceRows(v) {
  const reqs = arr(v.requirements);
  const q = ui.traceQ.trim().toLowerCase();
  const list = reqs.filter((r) => (ui.traceS === 'all' || r.status === ui.traceS)
    && (!q || `${r.req} ${r.title} ${arr(r.evidence).join(' ')}`.toLowerCase().includes(q)));
  const html = list.length ? list.map((r) => {
    const s = REQ_S[r.status] || { label: r.status || '—', cls: 'mute' };
    const ev = arr(r.evidence);
    return `<tr><td class="mono nowrap">${esc(r.req)}</td><td>${esc(r.title || '')}</td>
      <td><span class="pill ${s.cls}">${s.label}</span></td>
      <td class="ev">${ev.length ? `<ul>${ev.slice(0, 4).map((e) => `<li class="mono">${esc(shortTest(e))}</li>`).join('')}</ul>${ev.length > 4 ? `<span class="muted small">외 ${ev.length - 4}개</span>` : ''}` : '<span class="muted">—</span>'}</td></tr>`;
  }).join('') : `<tr><td colspan="4" class="muted center">조건에 맞는 요구사항이 없습니다.</td></tr>`;
  return { html, count: `요구사항 ${reqs.length}개 중 ${list.length}개 표시` };
}
const shortTest = (e) => String(e).replace(/^tests\//, '').replace(/\.py::/, ' :: ');

// ---------- 리뷰 기록 ----------
function reviewsTab(v) {
  const rvs = arr(v.reviews).slice().sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  if (!rvs.length) return emptyState('아직 교차 리뷰 기록이 없습니다', '', 'shield');
  const m = v.methodology || {};
  const fbd = m.findings_by_disposition || {};
  const keys = ['accepted', 'partial', 'deferred', 'rejected'];
  const tot = keys.reduce((a, k) => a + num(fbd[k]), 0);
  return `<div class="rv-sum card">
      <div class="rv-sum-l"><div class="rv-big">${fmtNum(rvs.length)}<small>회</small></div><p>GPT 교차 리뷰 · 지적 ${fmtNum(num(m.findings_total, tot))}건 처리</p></div>
      ${tot ? `<div class="rv-sum-r"><div class="dispo-bar">${keys.map((k) => num(fbd[k]) ? `<i class="d-${k}" style="flex:${num(fbd[k])}" title="${DISPO[k].label} ${fbd[k]}"></i>` : '').join('')}</div>
        <div class="dispo-legend">${keys.map((k) => `<span><i class="d-${k}"></i>${DISPO[k].label} <b>${fmtNum(num(fbd[k]))}</b></span>`).join('')}</div></div>` : ''}
    </div>
    <div class="rv-list">${rvs.map(reviewItem).join('')}</div>`;
}
function sevChips(c) {
  if (!c) return '';
  const parts = [['critical', 'CRIT', 'bad'], ['major', 'MAJ', 'warn'], ['minor', 'MIN', 'mute']]
    .filter(([k]) => c[k] != null)
    .map(([k, l, cls]) => `<span class="sev ${cls}">${l} ${fmtNum(c[k])}</span>`);
  return parts.join('');
}
function reviewItem(r) {
  const f = arr(r.findings);
  return `<details class="rv" data-rv="${esc(r.review)}"${ui.open.has(r.review) ? ' open' : ''}>
    <summary>
      <span class="rv-rev">${icon('chevronRight', 16)}</span>
      <span class="rv-main"><span class="rv-name mono">${esc(r.review)}</span>
        <span class="rv-target">${esc(r.target || '')}</span></span>
      <span class="rv-meta">
        <span class="chip vi-l">${esc(reviewerLabel(r.reviewer))}</span>
        ${r.phase ? `<span class="tag">${esc(phaseName(r.phase))}</span>` : ''}
        ${r.round ? `<span class="tag">${r.round}차</span>` : ''}
        ${sevChips(r.counts)}
        ${r.verdict ? `<span class="verdict">${esc(r.verdict)}</span>` : ''}
        <span class="rv-time">${esc(fmtTime(r.ts))}${r.reconstructed ? ' · 시각 재구성' : ''}</span>
      </span>
    </summary>
    <div class="rv-body">${r.artifact ? `<p class="rv-orig"><a href="#/p/${encodeURIComponent(ui.pid)}/results?doc=${encodeURIComponent(r.artifact)}" data-orig="${esc(r.artifact)}">${icon('external', 14)} GPT 리뷰 원문 보기</a></p>` : ''}${f.length ? `<div class="tbl-wrap flat"><table class="tbl"><thead><tr><th>#</th><th>등급</th><th>처리</th><th>내용</th></tr></thead><tbody>
      ${f.map((x) => {
        const d = DISPO[x.disposition] || { label: x.disposition || '—', cls: 'mute' };
        return `<tr><td class="num">${esc(x.n)}</td><td><span class="sev ${/crit/i.test(x.severity) ? 'bad' : /maj/i.test(x.severity) ? 'warn' : 'mute'}">${esc(x.severity || '')}</span></td>
          <td><span class="pill ${d.cls}">${d.label}</span></td><td class="ftext">${esc(x.text || '')}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted small">이 리뷰의 지적별 처리 기록은 없습니다.</p>'}</div>
  </details>`;
}

// ---------- 적합성 감사 ----------
const AUD = [
  { k: 'satisfied', label: '충족', desc: '구현과 시험으로 확인', color: '#17233d' },
  { k: 'satisfied_sil', label: '충족 (SIL)', desc: '시뮬레이터 시험으로 확인, 실기 확인 필요', color: '#3b6fe0' },
  { k: 'partial', label: '부분 충족', desc: '일부 범위만 충족 — 사유와 후속 조치 기록', color: '#e8833a' },
  { k: 'unsatisfied', label: '미충족', desc: '요구를 충족하지 못함', color: '#c03a2b' },
  { k: 'na', label: '해당 없음', desc: '하드웨어 확정 등 SW 범위 밖', color: '#b8c0d2' },
];
function auditTab(v) {
  const a = v.audit;
  if (!a) return emptyState('아직 적합성 감사 전입니다', '검증·감사 단계에서 원본 문서의 규범 문장을 하나씩 대조합니다.', 'audit');
  const total = num(a.clauses) || AUD.reduce((s, x) => s + num(a[x.k]), 0);
  const r = 70, C = 2 * Math.PI * r;
  let off = 0;
  const segs = AUD.map((x) => {
    const val = num(a[x.k]);
    if (!val || !total) return '';
    const len = (val / total) * C;
    const s = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${x.color}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)"><title>${x.label} ${val}</title></circle>`;
    off += len;
    return s;
  }).join('');
  return `<div class="audit card">
    <div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="적합성 감사 결과 도넛">
      <circle cx="100" cy="100" r="${r}" fill="none" stroke="#eef1f6" stroke-width="26"/>${segs}
      <text x="100" y="98" text-anchor="middle" class="dn-big">${fmtNum(total)}</text>
      <text x="100" y="120" text-anchor="middle" class="dn-sub">조항</text></svg></div>
    <div class="aud-legend">
      <h3>원본 사양 규범 문장 ${fmtNum(total)}개 조항별 판정</h3>
      <p class="muted">독립 감사 AI가 원본 문서의 규범 문장을 하나씩 구현·시험과 대조했습니다.</p>
      <ul>${AUD.map((x) => {
        const val = num(a[x.k]);
        return `<li><i style="background:${x.color}"></i><span class="al-l"><b>${x.label}</b><small>${x.desc}</small></span>
          <span class="al-v">${fmtNum(val)}<small>${total ? ` · ${((val / total) * 100).toFixed(0)}%` : ''}</small></span></li>`;
      }).join('')}</ul>
    </div>
  </div>`;
}
