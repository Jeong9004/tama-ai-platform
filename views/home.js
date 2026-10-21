// 홈: 프로젝트 목록 + 새 프로젝트 의뢰(문서 업로드)
import {
  esc, arr, icon, fmtTime, fmtSize, fileBadge, phaseName, stateClass, stateText,
  bindDrop, openModal, closeOverlay, copyText, emptyState,
} from './ui.js';

const MAX = 200 * 1024 * 1024;
const form = { name: '', client: '', files: [], busy: false, progress: 0 };
let fid = 0;

export function render(el, ctx) {
  const projects = arr(ctx.projects);
  el.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">${icon('spark', 14)} AI 개발팀 플랫폼</div>
      <h1 class="hero-title">문서를 올리면,<br>AI 개발팀이 끝까지 만듭니다.</h1>
      <p class="hero-sub">분석과 설계부터 구현, 다른 회사 AI의 교차 검증, 원본 조항 전수 감사, 최종 보고서까지.
        모든 진행 상황과 결과물을 이 화면에서 확인하실 수 있습니다.</p>
    </div>
    <ol class="how">
      <li><span class="how-n">1</span><div><b>문서 올리기</b><p>사양서·기획서·개발계획서를 올려 주세요.</p></div></li>
      <li><span class="how-n">2</span><div><b>AI 팀 분석·질문</b><p>빈 부분은 질문으로 여쭙고, 답을 받기 전에는 적어 둔 가정으로 계속 진행합니다.</p></div></li>
      <li><span class="how-n">3</span><div><b>진행·결과 확인</b><p>단계, 시험, 리뷰, 결과물을 실시간으로 확인합니다.</p></div></li>
    </ol>
  </section>

  ${ctx.readonly
    ? `<section class="card ro-note">${icon('shield', 18)}<div><b>웹 관리자 화면은 보기 전용입니다.</b>
        <p>새 의뢰는 <a href="./">공개 홈페이지</a>에서 메일로 접수됩니다. 프로젝트 생성·답변·자료 올리기는 운영 PC의 대시보드에서 합니다.</p></div></section>`
    : `<section class="card new-proj wide" id="new-proj">${formHtml()}</section>`}

  <section class="home-projects">
    <h2 class="sec-title">진행 중 · 완료된 프로젝트 <span class="muted">${projects.length}</span></h2>
    <div class="proj-cards">
      ${projects.length ? projects.map(card).join('') : emptyState('아직 프로젝트가 없습니다', '위에서 문서를 올려 첫 프로젝트를 의뢰해 보세요.', 'results')}
    </div>
  </section>`;

  if (!ctx.readonly) bindForm(el, ctx);
  if (ctx.params && ctx.params.get('new')) {
    requestAnimationFrame(() => {
      const box = el.querySelector('#new-proj');
      box?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      box?.classList.add('flash');
      el.querySelector('#np-name')?.focus({ preventScroll: true });
    });
  }
}

function card(p) {
  const live = p.state === 'running';
  return `<a class="proj-card" href="#/p/${encodeURIComponent(p.id)}/overview">
    <div class="pc-top"><span class="pill ${stateClass(p.state)}"><span class="dot${live ? ' live' : ''}"></span>${esc(p.label || stateText(p.state))}</span>
      <span class="pc-time">${p.updated ? `${fmtTime(p.updated)} 업데이트` : ''}</span></div>
    <h3>${esc(p.name)}</h3>
    <div class="pc-meta">${esc(p.client || '고객사 미지정')}${p.current_phase ? ` · <b>${esc(phaseName(p.current_phase))}</b> 단계` : ''}</div>
    ${p.open_questions ? `<div class="pc-ask">${icon('question', 15)} 확인이 필요한 질문 <b>${p.open_questions}건</b></div>` : ''}
    <span class="pc-go">대시보드 열기 ${icon('arrowRight', 16)}</span>
  </a>`;
}

function formHtml() {
  const ready = form.files.filter((f) => !f.error);
  return `
  <div class="np-head"><span class="np-ico">${icon('plus', 22)}</span>
    <div><h2>새 프로젝트 의뢰</h2><p>사양서·기획서·개발계획서를 올리시면 AI 팀이 바로 분석을 시작합니다.</p></div></div>
  <form id="np-form" novalidate>
    <div class="np-row">
      <div class="field"><label class="lbl" for="np-name">프로젝트 이름 <em>필수</em></label>
        <input id="np-name" type="text" autocomplete="off" placeholder="예: 사내 비품 대여 관리 시스템" value="${esc(form.name)}" ${form.busy ? 'disabled' : ''}></div>
      <div class="field"><label class="lbl" for="np-client">고객사</label>
        <input id="np-client" type="text" autocomplete="organization" placeholder="예: 한빛전자" value="${esc(form.client)}" ${form.busy ? 'disabled' : ''}></div>
    </div>
    <div class="field"><span class="lbl">사양서 · 기획서 · 개발계획서 <em>필수</em></span>
      <div class="drop np-big${form.busy ? ' busy' : ''}" id="np-drop" tabindex="0" role="button" aria-label="올릴 문서 선택">
        <div class="big-ico">${icon('upload', 28)}</div>
        <h3>문서를 여기에 끌어다 놓으세요</h3>
        <p>또는 <span class="linkish">컴퓨터에서 파일 선택</span> · 여러 개를 한 번에 올릴 수 있습니다</p>
        <p class="fine">PDF · Word · 한글(HWP) · Excel · PowerPoint · 이미지 · ZIP — 파일당 최대 200MB</p>
        <input type="file" id="np-file" multiple hidden>
      </div>
      <ul class="queue" id="np-queue">${form.files.map(fileItem).join('')}</ul>
    </div>
    <div class="np-actions">
      <button class="btn lg" type="submit" id="np-submit" ${form.busy ? 'disabled' : ''}>${icon('send', 17)} ${form.busy ? '올리는 중…' : '의뢰하기'}</button>
      <span class="hint">${ready.length ? `${ready.length}개 문서 선택됨 · ` : ''}의뢰하면 AI 팀이 문서를 분석하고, 빈 부분은 질문으로 여쭙니다.</span>
    </div>
    <div class="np-progress"${form.busy ? '' : ' hidden'}><div class="bar"><i style="width:${Math.round(form.progress * 100)}%"></i></div>
      <span id="np-pct">올리는 중… ${Math.round(form.progress * 100)}%</span></div>
  </form>`;
}

function fileItem(f) {
  return `<li class="qi${f.error ? ' error' : ''}" data-fid="${f.id}">
    <span class="fi">${fileBadge(f.file.name)}</span>
    <div class="qi-main"><div class="qi-row"><span class="nm" title="${esc(f.file.name)}">${esc(f.file.name)}</span><span class="sz">${fmtSize(f.file.size)}</span></div>
      ${f.error ? `<div class="qi-st">${esc(f.error)}</div>` : ''}</div>
    <span class="qi-act">${form.busy ? '' : `<button type="button" class="icon-btn sm" data-rm="${f.id}" aria-label="${esc(f.file.name)} 빼기">${icon('x', 16)}</button>`}</span>
  </li>`;
}

function bindForm(el, ctx) {
  const root = el.querySelector('#new-proj');
  const rerender = () => { root.innerHTML = formHtml(); bindForm(el, ctx); };
  const name = root.querySelector('#np-name');
  const client = root.querySelector('#np-client');
  name.addEventListener('input', () => { form.name = name.value; });
  client.addEventListener('input', () => { form.client = client.value; });

  bindDrop(root.querySelector('#np-drop'), root.querySelector('#np-file'), (files) => {
    if (form.busy) return;
    for (const file of files) {
      form.files.push({ id: ++fid, file, error: file.size > MAX ? '200MB를 넘어 올릴 수 없습니다' : null });
    }
    rerender();
  });
  root.querySelector('#np-queue').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b || form.busy) return;
    form.files = form.files.filter((f) => String(f.id) !== b.dataset.rm);
    rerender();
  });

  root.querySelector('#np-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.busy) return;
    form.name = name.value.trim();
    form.client = client.value.trim();
    const files = form.files.filter((f) => !f.error).map((f) => f.file);
    if (!form.name) { ctx.toast('프로젝트 이름을 적어 주세요', 'warn'); name.focus(); return; }
    if (!files.length) { ctx.toast('사양서나 기획서를 하나 이상 올려 주세요', 'warn'); return; }

    form.busy = true; form.progress = 0;
    rerender();
    try {
      const res = await ctx.api.createProject({ name: form.name, client: form.client, files }, (p) => {
        form.progress = p;
        const bar = root.querySelector('.np-progress .bar > i');
        const pct = root.querySelector('#np-pct');
        if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        if (pct) pct.textContent = p >= 1 ? '프로젝트를 만드는 중…' : `올리는 중… ${Math.round(p * 100)}%`;
      });
      const pid = res && res.id;
      form.name = ''; form.client = ''; form.files = []; form.busy = false; form.progress = 0;
      await ctx.reloadProjects();
      if (ctx.audience === 'ops' && res && res.start_command) showStart(res, ctx);
      else {
        ctx.toast('접수되었습니다. AI 팀이 분석을 시작합니다.', 'ok');
        if (pid) ctx.navigate(`#/p/${encodeURIComponent(pid)}/overview`);
        else ctx.repaint();
      }
    } catch (err) {
      form.busy = false;
      ctx.toast(err.message || '의뢰를 접수하지 못했습니다', 'bad');
      rerender();
    }
  });
}

function showStart(res, ctx) {
  const cmd = res.start_command;
  const wrap = openModal({
    title: '프로젝트를 만들었습니다',
    sub: `${icon('check', 14)} 접수 완료 · ${esc(res.id)}`,
    width: '620px',
    html: `<p class="modal-lead">아래 명령을 PowerShell 에 붙여 넣으면 Claude Code 가 방법론 플레이북에 따라 분석을 시작합니다.
        진행 상황은 이 대시보드에 실시간으로 나타납니다.</p>
      <div class="cmd"><pre><code>${esc(cmd)}</code></pre>
        <button type="button" class="btn sm" id="copy-cmd">${icon('copy', 15)} 복사</button></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>나중에</button>
        <button type="button" class="btn" id="go-proj">프로젝트 개요로 ${icon('arrowRight', 16)}</button></div>`,
  });
  wrap.querySelector('#copy-cmd').addEventListener('click', async () => {
    ctx.toast((await copyText(cmd)) ? '명령을 복사했습니다' : '복사하지 못했습니다. 직접 선택해 복사해 주세요', 'ok');
  });
  wrap.querySelector('#go-proj').addEventListener('click', () => {
    closeOverlay();
    ctx.navigate(`#/p/${encodeURIComponent(res.id)}/overview`);
  });
  ctx.repaint();
}
