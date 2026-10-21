// 7 운영자 · AI 연결: Claude Code·Codex 상태, 토큰·비용, 기록 진단
import { esc, arr, num, icon, fmtNum, fmtCompact, fmtUsd, modelName, pageHead, emptyState } from './ui.js';
import { api } from '../api.js';

const conn = { data: null, at: 0, loading: false, error: null };
const ROLE = {
  claude: '총괄 · 설계 · 개발 · 검증 에이전트 실행 (Claude Code + 방법론 플레이북)',
  codex: 'GPT 교차 리뷰 실행 (studio review → Codex CLI)',
};

export function render(el, ctx) {
  if (ctx.audience !== 'ops') {
    el.innerHTML = emptyState('운영자 모드에서만 볼 수 있습니다', '좌측 아래의 운영자 모드 스위치를 켜 주세요.', 'ops');
    return;
  }
  const v = ctx.view;
  const u = v.usage;
  const d = v.diagnostics;
  el.innerHTML = `
  ${pageHead({
    eyebrow: `운영자 · AI 연결 <span class="pill mute sm">고객 보기에서 숨김</span>`,
    title: '연결된 AI와 사용량',
    lead: '이 PC에서 개발을 수행하는 AI 도구의 연결 상태와, 이 프로젝트에 쓰인 토큰과 비용입니다.',
  })}
  <section class="sec">
    <div class="sec-head"><h2>${icon('ops', 20)} AI 연결 상태</h2>
      <button type="button" class="btn ghost sm" id="conn-refresh">${icon('refresh', 14)} 다시 점검</button></div>
    <div class="conn-grid" id="conn">${connCards()}</div>
  </section>
  ${u ? usageHtml(u) : `<section class="sec">${emptyState('사용량 기록이 없습니다', '에이전트가 studio usage 로 기록하면 표시됩니다.', 'bolt')}</section>`}
  ${d ? `<section class="sec"><h2 class="sec-title">기록 진단</h2><div class="diag">
      <div><b>${fmtNum(d.events)}</b><span>이벤트</span></div>
      <div class="${num(d.skipped_lines) ? 'warn-c' : ''}"><b>${fmtNum(num(d.skipped_lines))}</b><span>건너뛴 줄 (깨진 기록)</span></div>
      <div class="${num(d.unknown_types) ? 'warn-c' : ''}"><b>${fmtNum(num(d.unknown_types))}</b><span>모르는 이벤트 종류</span></div>
    </div></section>` : ''}
  <section class="card ops-new">
    <div><h2>새 프로젝트 만들기</h2><p>고객 문서를 받아 새 프로젝트를 만들면 Claude Code 시작 명령을 알려 드립니다.</p></div>
    <a class="btn" href="#/?new=1">${icon('plus', 16)} 새 프로젝트 의뢰</a>
  </section>`;

  el.querySelector('#conn-refresh').addEventListener('click', () => loadConn(el, true));
  if ((!conn.data && !conn.loading) || Date.now() - conn.at > 60000) loadConn(el, false);
}

async function loadConn(el, force) {
  if (conn.loading) return;
  conn.loading = true;
  const box = el.querySelector('#conn');
  if (box && (force || !conn.data)) box.innerHTML = connCards();
  try {
    conn.data = arr(await api.connections());
    conn.error = null;
  } catch (e) {
    conn.error = e.message || '점검하지 못했습니다';
  }
  conn.at = Date.now();
  conn.loading = false;
  const b = document.getElementById('conn');
  if (b) b.innerHTML = connCards();
}

function connCards() {
  if (conn.loading && !conn.data) return `<div class="conn-card loading"><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>`.repeat(2);
  if (conn.error && !conn.data) return `<div class="conn-card bad"><p>${icon('alert', 16)} ${esc(conn.error)}</p></div>`;
  return arr(conn.data).map((c) => {
    const key = /codex|gpt/i.test(`${c.cmd} ${c.name}`) ? 'codex' : 'claude';
    const ok = !!c.installed && !c.error;
    return `<article class="conn-card ${ok ? 'ok' : 'bad'}">
      <div class="cc-head"><span class="cc-logo ${key === 'codex' ? 'vi' : 'cy'}">${key === 'codex' ? 'G' : 'C'}</span>
        <div class="cc-t"><h3>${esc(c.name)}</h3><span class="mono">${esc(c.cmd || '')}</span></div>
        <span class="pill ${ok ? 'ok' : 'bad'}"><span class="dot${ok ? ' live' : ''}"></span>${ok ? '연결됨' : '연결 안 됨'}</span></div>
      <dl class="cc-dl"><dt>버전</dt><dd class="mono">${esc(c.version || '—')}</dd>
        <dt>경로</dt><dd class="mono path">${esc(c.path || '—')}</dd>
        ${c.error ? `<dt>오류</dt><dd class="err">${esc(c.error)}</dd>` : ''}</dl>
      <p class="cc-role">${esc(ROLE[key])}</p>
    </article>`;
  }).join('') + (conn.loading ? '<p class="muted small">다시 점검하는 중…</p>' : '');
}

function usageHtml(u) {
  const vend = arr(u.by_vendor);
  const models = arr(u.by_model);
  const groups = arr(u.by_group).slice().sort((a, b) => num(b.cost_usd) - num(a.cost_usd));
  const gmax = Math.max(1, ...groups.map((g) => num(g.cost_usd)));
  return `<section class="sec">
    <h2 class="sec-title">토큰 · 비용</h2>
    <div class="cost-top">
      <div class="card cost-total"><div class="ct-l">총 비용 (API 정가 환산)</div><div class="ct-v">${esc(fmtUsd(u.total_cost_usd))}</div>
        ${u.note ? `<p class="muted small">${esc(u.note)}</p>` : ''}</div>
      ${vend.map((x) => `<div class="card cost-v ${/openai/i.test(x.vendor) ? 'vi' : 'cy'}">
        <div class="ct-l">${esc(x.vendor)}</div><div class="ct-v">${esc(fmtUsd(x.cost_usd))}</div>
        <div class="muted small">토큰 ${esc(fmtCompact(x.tokens))}</div></div>`).join('')}
    </div>
    ${groups.length ? `<div class="card"><h3 class="card-t">작업 묶음별 비용</h3><ul class="hbars">${groups.map((g) => `
      <li><span class="hb-l">${esc(g.label)}</span><span class="hb-b"><i style="width:${((num(g.cost_usd) / gmax) * 100).toFixed(1)}%"></i></span><span class="hb-v mono">${esc(fmtUsd(g.cost_usd))}</span></li>`).join('')}</ul></div>` : ''}
    ${models.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>모델</th><th>회사</th><th class="num">입력</th><th class="num">출력</th><th class="num">캐시 읽기</th><th class="num">캐시 쓰기</th><th class="num">비용</th></tr></thead>
      <tbody>${models.map((m) => `<tr><td>${esc(modelName(m.model))}</td><td>${esc(m.vendor || '')}</td>
        <td class="num mono">${fmtCompact(m.input)}</td><td class="num mono">${fmtCompact(m.output)}</td>
        <td class="num mono">${fmtCompact(m.cache_read)}</td><td class="num mono">${fmtCompact(m.cache_write)}</td>
        <td class="num mono">${esc(fmtUsd(m.cost_usd))}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`;
}
