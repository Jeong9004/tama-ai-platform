// 4 방법론: 단계 흐름 + 게이트, 질의 고리, 교차 리뷰 고리, "왜 믿을 수 있나" — 이 프로젝트의 실제 숫자를 겹쳐 표시
import { esc, arr, num, icon, fmtNum, fmtDurShort, phaseName, DISPO, pageHead, countSpan } from './ui.js';

const STEPS = {
  P0: ['원본 문서를 텍스트로 추출하고 규범 문장에 번호를 붙입니다', '설계사양서: 요구사항(REQ) ID · 구조 · 설계 결정', '개발계획서: 작업 패키지 · 인터페이스 계약 · REQ별 시험', 'GPT 교차 리뷰 → 개정 → 계약 동결'],
  P1: ['작업 패키지별로 여러 AI가 동시에 개발', '시험을 먼저 쓰고 구현하는 TDD', '모듈마다 GPT 리뷰 2회와 처리 기록'],
  P2: ['프로젝트에 맞는 통합 하네스 (시뮬레이터 · E2E · API)', '수락 시험 — 건너뛴 시험은 실패로 판정', '성능 조정 · 운용 문서'],
  P3: ['영역별 GPT 최종 리뷰 → 수정 → 재확인', '독립 감사 AI가 원본 조항을 하나씩 전부 대조'],
  P4: ['전체 시험 재실행 · 추적성 매트릭스', '시간 · 토큰 · 비용 집계와 최종 보고서'],
};
const GATE_TEXT = {
  P0: '계약 시험 녹색 · CRITICAL 0 · 막는 질문 해소',
  P1: '작업 패키지별 완료 기준 · 전체 시험 녹색',
  P2: '수락 시험 녹색 (건너뜀 0)',
  P3: 'CRITICAL·MAJOR 0 · 미충족 조항 0',
  P4: '전체 재실행 녹색 · 보고서 완료',
};

export function render(el, ctx) {
  const v = ctx.view;
  const m = v.methodology || {};
  const phases = arr(v.phases);
  const main = phases.filter((p) => !p.track);
  const reviews = arr(v.reviews);
  const qs = arr(v.questions);
  const inputs = arr(v.inputs);
  const k = v.kpis || {};
  const audit = v.audit || null;
  const fbd = m.findings_by_disposition || {};
  const ftotal = num(m.findings_total, Object.values(fbd).reduce((a, b) => a + num(b), 0));

  el.innerHTML = `
  ${pageHead({
    eyebrow: '방법론',
    title: '검증된 절차로, 모든 단계를 증거로 남깁니다',
    lead: '실제 산업용 제어 시스템 개발에서 쓴 절차를 그대로 따릅니다. 아래 숫자는 이 프로젝트에서 실제로 기록된 값입니다.',
  })}

  <section class="card">
    <div class="card-head"><h2 class="sec-title">단계 흐름 <span class="muted">— 마름모는 통과해야 넘어가는 게이트</span></h2></div>
    <div class="flow">${main.map((p, i) => phaseCard(p, reviews) + (i < main.length - 1 ? gateDia(p) : '')).join('')}</div>
  </section>

  <div class="loops">
    ${qLoop(qs, inputs)}
    ${rLoop(m, reviews, fbd, ftotal)}
  </div>

  <section class="sec">
    <h2 class="sec-title">왜 믿을 수 있나</h2>
    <div class="trust">
      ${trust('shield', countSpan(m.reviews ?? reviews.length, 'm-rev'), '회', '다른 회사 AI의 교차 검증',
        `Claude가 만든 결과물을 OpenAI GPT가 독립적으로 검토했습니다. 지적 ${fmtNum(ftotal)}건을 하나씩 근거와 대조해 처리했습니다.`)}
      ${trust('link', `${countSpan(k.req?.verified, 'm-req')}<small>/${fmtNum(k.req?.total)}</small>`, '', '요구사항 추적성',
        '모든 요구사항(REQ)이 시험과 연결되어 판정됩니다. 어떤 요구사항이 어떤 시험으로 확인됐는지 결과물에서 바로 찾을 수 있습니다.')}
      ${trust('audit', countSpan(audit ? audit.clauses : m.clauses, 'm-cl'), '조항', '원본 조항 전수 감사',
        audit ? `원본 문서의 규범 문장 ${fmtNum(audit.clauses)}개를 독립 감사 AI가 하나씩 대조했습니다. 미충족 ${fmtNum(audit.unsatisfied)}건.` : '원본 문서의 규범 문장을 독립 감사 AI가 하나씩 대조합니다.')}
      ${trust('beaker', countSpan(k.tests?.passed, 'm-tests'), '개', '건너뜀 없는 수락 시험',
        `건너뛴 시험은 실패로 칩니다. 자동 시험 ${fmtNum(k.tests?.passed)}개 통과, 실패 ${fmtNum(num(k.tests?.failed))}, 건너뜀 ${fmtNum(num(k.tests?.skipped))}.`)}
    </div>
  </section>`;
}

function phaseCard(p, reviews) {
  const steps = STEPS[p.id] || (p.desc ? [p.desc] : []);
  const rv = reviews.filter((r) => r.phase === p.id).length;
  const g = p.gate;
  const facts = [];
  if (p.duration_min) facts.push(`<span>${icon('clock', 13)}${esc(fmtDurShort(p.duration_min))}</span>`);
  if (rv) facts.push(`<span class="vi-c">${icon('shield', 13)}GPT 리뷰 ${rv}회</span>`);
  if (g) facts.push(`<span class="${g.passed ? 'ok-c' : ''}">${icon(g.passed ? 'check' : 'clock', 13)}${esc(g.name || '게이트')} ${g.passed ? '통과' : '대기'}</span>`);
  return `<article class="fl-ph ${esc(p.state || 'pending')}">
    <div class="fl-id">${esc(p.id)}</div>
    <h3>${esc(p.name || phaseName(p.id))}</h3>
    <ul>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    ${facts.length ? `<div class="fl-facts"><div class="fl-k">이 프로젝트에서</div>${facts.join('')}</div>` : ''}
  </article>`;
}

function gateDia(p) {
  const passed = p.gate && p.gate.passed;
  return `<div class="fl-gate${passed ? ' ok' : ''}" title="${esc(GATE_TEXT[p.id] || '')}"><i class="dia"></i><span>${esc(p.gate?.name || '')}</span></div>`;
}

function qLoop(qs, inputs) {
  const open = qs.filter((q) => q.state === 'open').length;
  const answered = qs.filter((q) => q.state === 'answered').length;
  const resolved = qs.filter((q) => q.state === 'resolved').length;
  return `<section class="loop q">
    <div class="loop-head"><span class="loop-ico">${icon('question', 20)}</span><div><h3>질의 고리</h3><p>빈칸은 추측하지 않고 고객님께 여쭙니다</p></div></div>
    <ol class="chain">
      <li>빈칸 · 모호한 조항 · "추후 확정" 발견</li>
      <li class="hl">질문 + <b>답이 없을 때의 가정</b></li>
      <li>고객님 답변 · 추가 자료</li>
      <li>사양에 반영 · 반영 위치 기록</li>
    </ol>
    <p class="loop-note">작업을 막는 질문만 다음 단계를 멈춥니다. 나머지는 적어 둔 가정으로 계속 진행하고, 답이 가정과 다르면 계약을 개정해 반영합니다.</p>
    <div class="loop-nums">
      <div><b>${fmtNum(qs.length)}</b><span>질문</span></div>
      <div class="warn-c"><b>${fmtNum(open)}</b><span>답변 대기</span></div>
      <div><b>${fmtNum(answered)}</b><span>답변됨</span></div>
      <div class="ok-c"><b>${fmtNum(resolved)}</b><span>반영됨</span></div>
      <div><b>${fmtNum(inputs.length)}</b><span>받은 자료</span></div>
    </div>
  </section>`;
}

function rLoop(m, reviews, fbd, ftotal) {
  const keys = ['accepted', 'partial', 'deferred', 'rejected'];
  const total = keys.reduce((a, k) => a + num(fbd[k]), 0);
  const bar = total
    ? `<div class="dispo-bar" role="img" aria-label="지적 처리 분포">${keys.map((k) => num(fbd[k]) ? `<i class="d-${k}" style="flex:${num(fbd[k])}" title="${DISPO[k].label} ${fbd[k]}건"></i>` : '').join('')}</div>
       <div class="dispo-legend">${keys.map((k) => `<span><i class="d-${k}"></i>${DISPO[k].label} <b>${fmtNum(num(fbd[k]))}</b></span>`).join('')}</div>`
    : '';
  return `<section class="loop r">
    <div class="loop-head"><span class="loop-ico">${icon('shield', 20)}</span><div><h3>교차 리뷰 고리</h3><p>만든 AI와 다른 회사의 AI가 검토합니다</p></div></div>
    <ol class="chain">
      <li>Claude 작성</li>
      <li class="hl vio">GPT 독립 리뷰</li>
      <li>지적마다 코드·사양과 대조해 검증</li>
      <li>수용 · 부분 · 보류 · 기각</li>
      <li>결함을 잡는 시험 먼저 → 수정</li>
      <li>GPT 재리뷰</li>
    </ol>
    <p class="loop-note">지적을 그대로 받아들이지 않고 근거를 검증합니다. 수용한 건은 고치기 전에 그 결함을 잡는 시험을 먼저 쓰고, 고친 것을 되돌리면 시험이 실패하는지 확인합니다.</p>
    <div class="loop-nums">
      <div class="vi-c"><b>${fmtNum(m.reviews ?? reviews.length)}</b><span>리뷰</span></div>
      <div><b>${fmtNum(ftotal)}</b><span>처리한 지적</span></div>
    </div>
    ${bar}
  </section>`;
}

function trust(ico, big, unit, title, text) {
  return `<article class="trust-card"><span class="tc-ico">${icon(ico, 22)}</span>
    <div class="tc-big">${big}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    <h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;
}
