// 1 개요
import {
  esc, arr, num, icon, fmtTime, fmtDateTime, fmtDurShort, fmtNum, phaseName, stateClass, stateText,
  liveTag, countSpan, ART_KIND, isGpt, fileBadge,
} from './ui.js';

export function render(el, ctx) {
  const v = ctx.view;
  const p = v.project || {};
  const st = v.status || {};
  const pid = encodeURIComponent(ctx.id);
  const qs = arr(v.questions);
  const openQ = qs.filter((q) => q.state === 'open');

  el.innerHTML = `
  <header class="ph">
    <div class="eyebrow">프로젝트 개요${p.client ? ` · ${esc(p.client)}` : ''} ${liveTag(st)}</div>
    <h1>${esc(p.name)}</h1>
    <div class="meta">
      ${p.spec_title ? `<span>${icon('file', 15)}${esc(p.spec_title)}</span>` : ''}
      <span>${icon('clock', 15)}${st.started ? esc(fmtDateTime(st.started)) : '착수 전'} ~ ${st.ended ? esc(fmtTime(st.ended)) : '진행 중'}</span>
      <span class="pill ${stateClass(st.state)}"><span class="dot${st.live ? ' live' : ''}"></span>${esc(st.label || stateText(st.state))}</span>
    </div>
  </header>

  ${stageBar(arr(v.phases), openQ.length)}
  ${kpis(v.kpis || {}, st)}

  <div class="grid-2">
    <div class="col">
      ${nowCard(v, st)}
      <section class="card">
        <div class="card-head"><h2 class="sec-title">최근 활동</h2><a class="more" href="#/p/${pid}/progress">전체 기록 ${icon('chevronRight', 14)}</a></div>
        ${feed(arr(v.feed).slice(0, 5))}
      </section>
    </div>
    <div class="col">
      ${attention(openQ, pid)}
      ${teamTeaser(v, pid)}
      ${mainArtifacts(arr(v.artifacts), pid)}
    </div>
  </div>`;
}

function stageBar(phases, openCount) {
  if (!phases.length) return '';
  return `<ol class="stages" aria-label="단계 진행">${phases.map((ph) => {
    let sub;
    if (ph.state === 'done') sub = `${icon('check', 14)}<span>${esc(fmtDurShort(ph.duration_min) || '완료')}</span>`;
    else if (ph.state === 'active') sub = `<span class="dot live"></span><span>진행 중</span>`;
    else if (ph.state === 'waiting') sub = `<span class="dot"></span><span>${esc(ph.note || (ph.track && openCount ? `확인 대기 ${openCount}건` : '확인 대기'))}</span>`;
    else sub = `<span>대기</span>`;
    return `<li class="stage ${esc(ph.state || 'pending')}${ph.track ? ' track' : ''}" title="${esc(ph.desc || '')}">
      <span class="st-id">${esc(ph.id)}</span><span class="nm">${esc(ph.name || phaseName(ph.id))}</span><span class="st">${sub}</span></li>`;
  }).join('')}</ol>`;
}

function kpis(k, st) {
  const req = k.req || {};
  const tests = k.tests || {};
  const audit = k.audit;
  const suites = arr(tests.suites).map((s) => `${esc(suiteName(s.suite))} ${fmtNum(s.passed)}`).join(' · ');
  return `<section class="kpis" aria-label="핵심 지표">
    <div class="kpi"><div class="v">${countSpan(req.verified, 'req')}<small>/ ${fmtNum(req.total)}</small></div>
      <div class="l">요구사항 충족</div><div class="s">요구사항(REQ)마다 시험으로 판정</div></div>
    <div class="kpi"><div class="v">${countSpan(tests.passed, 'tests')}</div>
      <div class="l">자동 시험 통과</div><div class="s">${suites || '시험 결과 대기'}${num(tests.failed) ? ` · <b class="bad-t">실패 ${fmtNum(tests.failed)}</b>` : ''}</div></div>
    <div class="kpi"><div class="v">${audit ? countSpan(audit.unsatisfied, 'unsat') : '—'}${audit ? '<small>건</small>' : ''}</div>
      <div class="l">원본 조항 미충족</div><div class="s">${audit ? `원본 사양 ${fmtNum(audit.clauses)}개 조항 전수 감사` : '감사 전'}</div></div>
    <div class="kpi"><div class="v">${countSpan(k.elapsed_h, 'hours', 1)}<small>시간</small></div>
      <div class="l">${st.state === 'done' ? '착수부터 완료까지' : '착수 후 경과'}</div><div class="s">${st.state === 'done' ? '분석·구현·검증·보고서 전 과정' : '현재 진행 중'}</div></div>
  </section>`;
}

export function suiteName(s) {
  const k = String(s || '');
  if (/pytest|python/i.test(k)) return 'Python';
  if (/펌웨어|firmware|^c$/i.test(k)) return '펌웨어 C';
  return k;
}

function nowCard(v, st) {
  const now = v.now || {};
  const agents = arr(now.active_agents);
  const done = st.state === 'done';
  return `<section class="card now${st.live ? ' is-live' : ''}">
    <div class="now-ico">${done ? icon('check', 22) : icon('bolt', 22)}</div>
    <div class="now-main">
      <h2 class="sec-title">${done ? '진행 상태' : '지금 하는 일'}</h2>
      <p class="now-text">${esc(now.summary || (done ? '모든 단계를 마쳤습니다.' : '다음 작업을 준비하고 있습니다.'))}</p>
      ${agents.length ? `<div class="agent-chips">${agents.map((a) => `<span class="achip"><span class="dot live"></span>${esc(a.name || a.id)}</span>`).join('')}</div>` : ''}
    </div>
  </section>`;
}

export function feed(items, { showActor = false, team = null } = {}) {
  if (!items.length) return `<p class="muted small">아직 기록된 활동이 없습니다.</p>`;
  return `<ul class="feed">${items.map((f) => `<li>
    <time datetime="${esc(f.ts)}">${esc(fmtTime(f.ts))}</time>
    <div><span class="ftxt">${esc(f.summary)}</span>
      ${f.phase ? `<span class="tag">${esc(phaseName(f.phase))}</span>` : ''}
      ${showActor && f.actor ? `<span class="tag actor">${esc((team && team[f.actor]) || f.actor)}</span>` : ''}</div>
  </li>`).join('')}</ul>`;
}

function attention(openQ, pid) {
  if (!openQ.length) {
    return `<section class="card attn">
      <h2 class="sec-title">고객님 확인</h2>
      <p class="attn-none">${icon('check', 18)} 지금은 확인이 필요한 질문이 없습니다.</p>
      <a class="btn ghost full" href="#/p/${pid}/requests?focus=upload">${icon('upload', 16)} 추가 자료 올리기</a>
    </section>`;
  }
  const blocking = openQ.filter((q) => q.blocking).length;
  return `<section class="card attn has">
    <div class="attn-top"><span class="attn-n">${openQ.length}</span>
      <div><h2>고객님 확인이 필요한 질문</h2>
        <p>${blocking ? `<b>${blocking}건은 답을 받아야 다음 단계로 넘어갑니다.</b> ` : ''}답을 주시기 전까지는 질문에 적힌 가정으로 작업을 계속합니다.</p></div></div>
    <ul class="attn-list">${openQ.slice(0, 3).map((q) => `<li><a href="#/p/${pid}/requests?q=${encodeURIComponent(q.qid)}">
      ${q.blocking ? '<span class="pill bad sm">막는 질문</span>' : ''}<span>${esc(q.title)}</span>${icon('chevronRight', 15)}</a></li>`).join('')}</ul>
    <div class="attn-actions"><a class="btn full" href="#/p/${pid}/requests">${icon('question', 16)} 답변하러 가기</a>
      <a class="btn ghost full" href="#/p/${pid}/requests?focus=upload">${icon('upload', 16)} 자료 올리기</a></div>
  </section>`;
}

function teamTeaser(v, pid) {
  const t = v.team || {};
  const c = t.counts || {};
  const by = c.by_vendor || {};
  const members = arr(t.groups).flatMap((g) => arr(g.members));
  if (!members.length) return '';
  const dots = members.slice(0, 24).map((m, i) => {
    const a = (i / Math.min(members.length, 24)) * Math.PI * 2;
    const r = 34 + (i % 2) * 10;
    return `<circle cx="${(70 + Math.cos(a) * r).toFixed(1)}" cy="${(52 + Math.sin(a) * r * 0.62).toFixed(1)}" r="3.2" class="${isGpt(m) ? 'vi' : 'cy'}"/>`;
  }).join('');
  return `<a class="card team-teaser" href="#/p/${pid}/team">
    <svg viewBox="0 0 140 104" aria-hidden="true"><g class="tt-lines">${members.slice(0, 24).map((m, i) => {
      const a = (i / Math.min(members.length, 24)) * Math.PI * 2;
      const r = 34 + (i % 2) * 10;
      return `<line x1="70" y1="52" x2="${(70 + Math.cos(a) * r).toFixed(1)}" y2="${(52 + Math.sin(a) * r * 0.62).toFixed(1)}"/>`;
    }).join('')}</g>${dots}<circle cx="70" cy="52" r="8" class="core"/></svg>
    <div class="tt-txt">
      <div class="tt-eyebrow">AI 개발팀</div>
      <div class="tt-big"><span class="mono">${fmtNum(c.ai_total ?? members.length)}</span> AI 참여</div>
      <div class="tt-sub">Claude ${fmtNum(by.Anthropic || 0)} · GPT ${fmtNum(by.OpenAI || 0)} · 교차 리뷰 ${fmtNum(c.reviews || 0)}회</div>
      <span class="tt-go">팀 구성 보기 ${icon('arrowRight', 15)}</span>
    </div>
  </a>`;
}

const KIND_ORDER = ['report', 'spec', 'plan', 'doc', 'test', 'review', 'image', 'source'];
function mainArtifacts(arts, pid) {
  if (!arts.length) return '';
  const top = arts.slice().sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a.kind), kb = KIND_ORDER.indexOf(b.kind);
    return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb) || String(b.ts || '').localeCompare(String(a.ts || ''));
  }).slice(0, 3);
  return `<section class="card">
    <div class="card-head"><h2 class="sec-title">주요 결과물</h2><a class="more" href="#/p/${pid}/results">전체 ${arts.length}개 ${icon('chevronRight', 14)}</a></div>
    <ul class="art-mini">${top.map((a) => `<li><a href="#/p/${pid}/results?doc=${encodeURIComponent(a.id)}">
      ${fileBadge(a.file || a.title)}<span class="am-t"><span>${esc(a.title)}</span><small>${esc(ART_KIND[a.kind] || a.kind || '')}${a.rev ? ` · ${esc(a.rev)}` : ''} · ${esc(fmtTime(a.ts))}</small></span>${icon('chevronRight', 15)}</a></li>`).join('')}</ul>
  </section>`;
}
