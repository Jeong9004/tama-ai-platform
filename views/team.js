// 3 AI 팀 (관제실형): 상단 숫자, 조직도(클릭 → 서랍), 시간 레인
import {
  esc, arr, icon, fmtNum, fmtTime, fmtDur, modelName, isGpt, liveTag, countSpan, openDrawer,
  timeAxis, axisSvg, toMs,
} from './ui.js';

const GROUP_ORDER = ['총괄', '설계', '개발', '검증', '독립 리뷰'];
const GROUP_DESC = {
  설계: '요구사항 분석 · 인터페이스 설계',
  개발: '작업 패키지별 병렬 구현 (TDD)',
  검증: '통합·수락 시험 · 수정 · 사양 감사',
  '독립 리뷰': '다른 회사 모델의 교차 검토',
};

export function render(el, ctx) {
  const v = ctx.view;
  const t = v.team || {};
  const c = t.counts || {};
  const by = c.by_vendor || {};
  const st = v.status || {};
  const groups = arr(t.groups).slice().sort((a, b) => rank(a.name) - rank(b.name));
  const members = groups.flatMap((g) => arr(g.members).map((m) => ({ ...m, group: g.name })));

  el.innerHTML = `<div class="mc-page">
  <header class="ph">
    <div class="eyebrow">AI 개발팀 ${liveTag(st)}</div>
    <h1>이 프로젝트를 만든 AI 팀</h1>
    <p class="lead">총괄 AI가 계획을 세우고 일을 나누면, 여러 개발 AI가 동시에 만들고 검증 AI가 시험합니다.
      그리고 <b class="vi-t">다른 회사의 AI(GPT)</b>가 모든 결과물을 독립적으로 검토합니다.</p>
  </header>

  <section class="mc-stats" aria-label="AI 팀 요약">
    <div class="mc-stat"><div class="v">${countSpan(c.ai_total ?? members.length, 'ai_total')}</div><div class="l">참여한 AI</div></div>
    <div class="mc-stat"><div class="v split"><span class="cy-t">${countSpan(by.Anthropic || 0, 'anth')}</span><span class="sl">/</span><span class="vi-t">${countSpan(by.OpenAI || 0, 'oai')}</span></div>
      <div class="l">Claude (Anthropic) / GPT (OpenAI)</div></div>
    <div class="mc-stat vio"><div class="v">${countSpan(c.reviews || 0, 'reviews')}<small>회</small></div><div class="l">GPT 교차 리뷰</div></div>
    <div class="mc-stat"><div class="v">${countSpan(c.max_parallel || 0, 'maxp')}<small>개</small></div><div class="l">최대 동시 작업 AI</div></div>
  </section>

  <section class="mc-card">
    <div class="mc-head"><div><h2>조직도</h2><p>상자를 누르면 그 AI의 역할, 한 일, 산출물을 볼 수 있습니다.</p></div>
      <div class="mc-legend"><span><i class="cy"></i>Claude · Anthropic</span><span><i class="vi"></i>GPT · OpenAI</span></div></div>
    ${org(groups)}
  </section>

  <section class="mc-card">
    <div class="mc-head"><div><h2>작업 시간 레인</h2><p>막대는 AI가 일한 시간, 보라 점은 GPT 교차 리뷰 1회입니다. 같은 시각에 막대가 겹친 곳이 병렬 작업입니다.</p></div></div>
    ${lanes(v.lanes, st)}
  </section>
  </div>`;

  el.querySelectorAll('[data-member]').forEach((b) => {
    b.addEventListener('click', () => {
      const m = members.find((x) => x.id === b.dataset.member);
      if (m) showMember(m);
    });
  });
}

const rank = (n) => { const i = GROUP_ORDER.indexOf(n); return i < 0 ? 50 : i; };

function node(m, root = false) {
  const vio = isGpt(m);
  return `<button type="button" class="node${vio ? ' vio' : ''}${root ? ' root' : ''}" data-member="${esc(m.id)}">
    <span class="nm">${esc(m.name)}</span>
    <span class="md">${esc(modelName(m.model))}</span>
    ${m.duration_min ? `<span class="du">${icon('clock', 12)}${esc(fmtDur(m.duration_min))}</span>` : ''}
  </button>`;
}

function org(groups) {
  if (!groups.length) return '<p class="mc-muted">아직 편성된 AI가 없습니다.</p>';
  const top = groups.find((g) => g.name === '총괄');
  const cols = groups.filter((g) => g !== top);
  return `<div class="org">
    ${top ? `<div class="org-top">${arr(top.members).map((m) => node(m, true)).join('')}</div>` : ''}
    <div class="org-cols" style="--cols:${Math.max(1, cols.reduce((n, g) => n + (arr(g.members).length > 6 ? 2 : 1), 0))}">
      ${cols.map((g) => {
        const ms = arr(g.members);
        const vio = ms.length && ms.every(isGpt);
        return `<div class="org-col${vio ? ' vio' : ''}${ms.length > 6 ? ' wide' : ''}">
          <div class="col-h"><span class="col-n">${esc(g.name)}</span><span class="col-c mono">${ms.length}</span></div>
          ${GROUP_DESC[g.name] ? `<p class="col-d">${esc(GROUP_DESC[g.name])}</p>` : ''}
          <div class="col-nodes${ms.length > 6 ? ' dense' : ''}">${ms.map((m) => node(m)).join('')}</div>
        </div>`;
      }).join('')}
    </div></div>`;
}

function showMember(m) {
  const vio = isGpt(m);
  const tasks = arr(m.tasks), arts = arr(m.artifacts);
  openDrawer({
    title: m.name,
    sub: `<span class="chip ${vio ? 'vi' : 'cy'}">${esc(m.vendor || (vio ? 'OpenAI' : 'Anthropic'))}</span> ${esc(m.group || '')}`,
    dark: true,
    html: `<dl class="dd">
        <dt>모델</dt><dd class="mono">${esc(modelName(m.model) || '—')}</dd>
        <dt>경유 도구</dt><dd>${esc(m.via || '—')}</dd>
        <dt>소속</dt><dd>${esc(m.group || '—')}</dd>
        <dt>작업 시간</dt><dd>${m.duration_min ? esc(fmtDur(m.duration_min)) : '—'}</dd>
      </dl>
      ${m.desc ? `<h4>역할</h4><p>${esc(m.desc)}</p>` : ''}
      <h4>한 일</h4>${tasks.length ? `<ul class="dd-list">${tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="mc-muted">기록된 작업이 없습니다.</p>'}
      ${arts.length ? `<h4>산출물</h4><ul class="dd-list mono-list">${arts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`,
  });
}

const LANE_CLS = { 총괄: 'l-core', 설계: 'l-dev', 개발: 'l-dev', 검증: 'l-ver', '독립 리뷰': 'l-rev' };

function lanes(L, st) {
  const rows = arr(L && L.rows);
  const reviews = arr(L && L.reviews);
  if (!rows.length && !reviews.length) return '<p class="mc-muted">아직 기록된 작업이 없습니다.</p>';
  const spanTimes = rows.flatMap((r) => arr(r.spans).flatMap((s) => [toMs(s.start), toMs(s.end)])).filter((t) => t != null);
  const now = Date.now();
  let t0 = toMs(L.start) ?? Math.min(...spanTimes);
  let t1 = toMs(L.end) ?? Math.max(...spanTimes);
  if (st.live) t1 = Math.max(t1, now);
  if (!isFinite(t0) || !isFinite(t1) || t1 <= t0) return '<p class="mc-muted">시간 정보가 없습니다.</p>';

  const W = 1000, Lw = 168, R = 18, top = 44, rowH = 30;
  const n = rows.length + (reviews.length ? 1 : 0);
  const H = top + n * rowH + 10;
  const ax = timeAxis(t0, t1, Lw, W - R, 11);
  const anyRecon = rows.some((r) => arr(r.spans).some((s) => s.reconstructed)) || reviews.some((r) => r.reconstructed);

  const body = rows.map((r, i) => {
    const y = top + i * rowH;
    const cls = LANE_CLS[r.group] || 'l-dev';
    const bars = arr(r.spans).map((s) => {
      const a = toMs(s.start);
      if (a == null) return '';
      let b = toMs(s.end);
      const open = b == null;
      if (open) b = st.live ? now : t1;
      const x1 = ax.x(a), x2 = Math.max(ax.x(b), x1 + 4);
      return `<rect class="lane-bar ${cls}${open && st.live ? ' running' : ''}${s.reconstructed ? ' recon' : ''}" x="${x1.toFixed(1)}" y="${y + 9}" width="${(x2 - x1).toFixed(1)}" height="12" rx="6">
        <title>${esc(r.label)} · ${esc(fmtTime(s.start))} ~ ${s.end ? esc(fmtTime(s.end)) : '진행 중'}${s.reconstructed ? ' (재구성)' : ''}</title></rect>`;
    }).join('');
    return `<g class="lane"><circle class="lane-dot ${cls}" cx="5" cy="${y + 15}" r="4"/><text class="lane-l" x="15" y="${y + 19}">${esc(r.label)}</text>
      <line class="lane-sep" x1="${Lw}" x2="${W - R}" y1="${y + 15}" y2="${y + 15}"/>${bars}</g>`;
  }).join('');

  let revRow = '';
  if (reviews.length) {
    const y = top + rows.length * rowH;
    revRow = `<g class="lane rev"><text class="lane-l vi-fill" x="0" y="${y + 19}">GPT 교차 리뷰 ${reviews.length}회</text>
      <line class="lane-sep" x1="${Lw}" x2="${W - R}" y1="${y + 15}" y2="${y + 15}"/>
      ${reviews.map((r, i) => {
        const t = toMs(r.ts);
        if (t == null) return '';
        const x = ax.x(t).toFixed(1);
        return `<g class="rev-dot" style="--d:${(i % 8) * 0.35}s"><title>${esc(r.review)}${r.target ? ` · ${esc(r.target)}` : ''} · ${esc(fmtTime(r.ts))}${r.reconstructed ? ' (시각 재구성)' : ''}</title>
          <circle class="halo" cx="${x}" cy="${y + 15}" r="9"/><circle class="core" cx="${x}" cy="${y + 15}" r="4.6"/></g>`;
      }).join('')}</g>`;
  }
  const nowLine = st.live && now >= t0 && now <= t1
    ? `<line class="now-line" x1="${ax.x(now).toFixed(1)}" x2="${ax.x(now).toFixed(1)}" y1="${top - 4}" y2="${H - 6}"/>`
    : '';

  return `<div class="chart-scroll dark"><svg class="lanes" viewBox="0 0 ${W} ${H}" role="img" aria-label="AI별 작업 시간 레인">
      <defs><filter id="glow" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${axisSvg(ax, top - 4, H - 6, { labelY: top - 14, dark: true })}${body}${revRow}${nowLine}</svg></div>
    <div class="lane-legend">
      <span><i class="l-core"></i>총괄</span><span><i class="l-dev"></i>설계·개발</span><span><i class="l-ver"></i>검증</span><span><i class="l-rev dot"></i>GPT 리뷰</span>
      ${anyRecon ? `<span class="recon-note">${icon('alert', 13)} 점선 막대·점은 팀 단위 기록으로 재구성한 시각입니다</span>` : ''}
    </div>`;
}
