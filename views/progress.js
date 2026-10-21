// 2 진행: 단계 일정표(SVG), 게이트 카드, 활동 기록
import {
  esc, arr, icon, fmtTime, fmtDate, fmtDur, fmtDurShort, phaseName, stateClass, stateText, liveTag,
  timeAxis, axisSvg, toMs, pageHead,
} from './ui.js';
import { feed } from './overview.js';

let filter = 'all';
let lastPid = null;

export function render(el, ctx) {
  const v = ctx.view;
  if (lastPid !== ctx.id) { filter = 'all'; lastPid = ctx.id; }
  const phases = arr(v.phases);
  const st = v.status || {};
  const gates = phases.filter((p) => p.gate);
  const items = arr(v.feed);
  const teamNames = {};
  for (const g of arr(v.team?.groups)) for (const m of arr(g.members)) teamNames[m.id] = m.name;

  el.innerHTML = `
  ${pageHead({
    eyebrow: `진행 ${liveTag(st)}`,
    title: '단계별 진행 기록',
    lead: '각 단계가 실제로 언제 시작해 언제 끝났는지, 다음 단계로 넘어가기 위해 어떤 조건을 통과했는지 보여드립니다.',
  })}
  <section class="card">
    <div class="card-head"><h2 class="sec-title">단계 일정표</h2>
      <div class="legend"><span><i class="lgd done"></i>완료</span><span><i class="lgd active"></i>진행 중</span><span><i class="lgd waiting"></i>확인 대기</span><span><i class="lgd gate"></i>게이트 통과</span></div></div>
    ${gantt(phases, st)}
  </section>

  <section class="sec">
    <h2 class="sec-title">게이트 — 통과해야 다음 단계로 넘어갑니다</h2>
    ${gates.length ? `<div class="gates">${gates.map(gateCard).join('')}</div>` : '<p class="muted">아직 판정된 게이트가 없습니다.</p>'}
  </section>

  <section class="card">
    <div class="card-head"><h2 class="sec-title">활동 기록 <span class="muted">${items.length}</span></h2></div>
    <div class="chips" role="group" aria-label="단계별 거르기">
      <button type="button" class="chip-btn${filter === 'all' ? ' on' : ''}" data-f="all" aria-pressed="${filter === 'all'}">전체</button>
      ${phases.map((p) => {
        const n = items.filter((f) => f.phase === p.id).length;
        return n ? `<button type="button" class="chip-btn${filter === p.id ? ' on' : ''}" data-f="${esc(p.id)}" aria-pressed="${filter === p.id}">${esc(p.name || phaseName(p.id))} <span>${n}</span></button>` : '';
      }).join('')}
    </div>
    <div id="feed-box">${groupedFeed(items, teamNames)}</div>
  </section>`;

  el.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    el.querySelectorAll('.chip-btn').forEach((x) => {
      const on = x.dataset.f === filter;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    el.querySelector('#feed-box').innerHTML = groupedFeed(items, teamNames);
  });
}

function groupedFeed(items, teamNames) {
  const list = filter === 'all' ? items : items.filter((f) => f.phase === filter);
  if (!list.length) return '<p class="muted small">해당 단계의 기록이 없습니다.</p>';
  const days = [];
  for (const f of list) {
    const d = fmtDate(f.ts);
    if (!days.length || days[days.length - 1].d !== d) days.push({ d, items: [] });
    days[days.length - 1].items.push(f);
  }
  return days.map((g) => `<div class="day"><div class="day-h">${esc(g.d)}</div>${feed(g.items, { showActor: true, team: teamNames })}</div>`).join('');
}

function gantt(phases, st) {
  const withTime = phases.filter((p) => p.start);
  const times = withTime.flatMap((p) => [toMs(p.start), toMs(p.end)]).filter((t) => t != null);
  const now = Date.now();
  let t0 = toMs(st.started) ?? Math.min(...times);
  let t1 = toMs(st.ended) ?? (st.live ? now : Math.max(...times));
  if (times.length) { t0 = Math.min(t0, ...times); t1 = Math.max(t1, ...times); }
  if (st.live) t1 = Math.max(t1, now);
  if (!isFinite(t0) || !isFinite(t1) || t1 <= t0) return '<p class="muted">아직 시작한 단계가 없습니다.</p>';

  const W = 1000, L = 132, R = 24, top = 46, rowH = 40;
  const H = top + phases.length * rowH + 8;
  const ax = timeAxis(t0, t1, L, W - R, 11);
  const rows = phases.map((p, i) => {
    const y = top + i * rowH;
    const label = `<text class="row-l" x="0" y="${y + 24}">${esc(p.name || phaseName(p.id))}</text>
      <line class="row-sep" x1="0" x2="${W - R}" y1="${y + rowH}" y2="${y + rowH}"/>`;
    const s = toMs(p.start);
    if (s == null) return `${label}<text class="row-pend" x="${L + 6}" y="${y + 24}">${esc(stateText(p.state))}</text>`;
    let e = toMs(p.end);
    const open = e == null;
    if (open) e = p.state === 'active' || p.state === 'waiting' ? Math.max(s, st.live ? Math.min(now, t1) : t1) : s;
    const x1 = ax.x(s), x2 = Math.max(ax.x(e), x1 + 5);
    const cls = p.state === 'waiting' ? 'waiting' : p.state === 'active' ? 'active' : 'done';
    const dur = p.duration_min ?? (open ? null : (e - s) / 60000);
    const durTxt = dur != null ? fmtDurShort(dur) : stateText(p.state);
    const inside = x2 - x1 > 70;
    const room = W - R - x2 > 60;
    const g = p.gate && p.gate.passed && p.gate.at ? ax.x(toMs(p.gate.at)) : null;
    return `${label}
      <g class="bar ${cls}${p.track ? ' track' : ''}"><title>${esc(p.name)} · ${esc(fmtTime(p.start))} ~ ${p.end ? esc(fmtTime(p.end)) : '진행 중'}${dur != null ? ` (${esc(fmtDur(dur))})` : ''}</title>
        <rect x="${x1.toFixed(1)}" y="${y + 10}" width="${(x2 - x1).toFixed(1)}" height="20" rx="5"/>
        <text class="bar-t${inside ? ' in' : ''}" x="${(inside ? x1 + 8 : room ? x2 + 6 : x1 - 6).toFixed(1)}" y="${y + 24}"${!inside && !room ? ' text-anchor="end"' : ''}>${esc(durTxt)}</text></g>
      ${g != null ? `<g class="gate-d"><title>${esc(p.gate.name || '게이트')} 통과 · ${esc(fmtTime(p.gate.at))}</title><rect x="${(g - 6).toFixed(1)}" y="${y + 14}" width="12" height="12" transform="rotate(45 ${g.toFixed(1)} ${y + 20})"/></g>` : ''}`;
  }).join('');
  const nowLine = st.live && now >= t0 && now <= t1
    ? `<line class="now-line" x1="${ax.x(now).toFixed(1)}" x2="${ax.x(now).toFixed(1)}" y1="${top - 6}" y2="${H - 4}"/><text class="now-t" x="${ax.x(now).toFixed(1)}" y="${H}" text-anchor="middle">지금</text>`
    : '';
  return `<div class="chart-scroll"><svg class="gantt" viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="단계별 일정표">
    ${axisSvg(ax, top - 6, H - 4, { labelY: top - 14 })}${rows}${nowLine}</svg></div>`;
}

function gateCard(p) {
  const g = p.gate;
  const crit = arr(g.criteria);
  const okN = crit.filter((c) => c.ok).length;
  return `<article class="gate-card ${g.passed ? 'passed' : 'open'}">
    <div class="gc-top"><span class="gc-dia${g.passed ? ' ok' : ''}"></span>
      <div><div class="gc-name">${esc(g.name || '게이트')} · ${esc(p.name || phaseName(p.id))}</div>
        <div class="gc-at">${g.passed ? `${esc(fmtTime(g.at))} 통과` : `${okN}/${crit.length} 충족 · 판정 대기`}</div></div>
      <span class="pill ${g.passed ? 'ok' : stateClass(p.state)}">${g.passed ? '통과' : '대기'}</span></div>
    ${crit.length ? `<ul class="crit">${crit.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? icon('check', 15) : icon('clock', 15)}<span>${esc(c.text)}</span></li>`).join('')}</ul>` : ''}
  </article>`;
}
