// 공개 사이트 홈: 소개 · 새 프로젝트 의뢰(메일 접수) · 완료 프로젝트
// 의뢰는 FormSubmit 로 운영자 메일에 첨부와 함께 전달된다(서버 없음). 첨부는 합계 10MB.
import { esc, arr, icon, fmtSize, fileBadge, fmtDate, bindDrop } from './ui.js';

const MAX_TOTAL = 10 * 1024 * 1024;
const form = { files: [] };
let fid = 0;

export function render(el, ctx) {
  const site = ctx.site || {};
  const sent = ctx.sent;
  el.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">${icon('spark', 14)} AI 개발팀 플랫폼</div>
      <h1 class="hero-title">문서를 올리면,<br>AI 개발팀이 끝까지 만듭니다.</h1>
      <p class="hero-sub">분석과 설계부터 구현, 다른 회사 AI의 교차 검증, 원본 조항 전수 감사, 최종 보고서까지.
        모든 진행 상황과 결과물을 고객 전용 대시보드에서 확인하실 수 있습니다.</p>
    </div>
    <ol class="how">
      <li><span class="how-n">1</span><div><b>문서 올리기</b><p>사양서·기획서·개발계획서를 올려 주세요.</p></div></li>
      <li><span class="how-n">2</span><div><b>AI 팀 분석·질문</b><p>빈 부분은 질문으로 여쭙고, 답을 받기 전에는 적어 둔 가정으로 계속 진행합니다.</p></div></li>
      <li><span class="how-n">3</span><div><b>진행·결과 확인</b><p>단계, 시험, 리뷰, 결과물을 전용 대시보드에서 실시간으로 확인합니다.</p></div></li>
    </ol>
  </section>

  <section class="card new-proj wide" id="new-proj">
    ${sent ? sentHtml() : formHtml(site)}
  </section>

  ${projectsSection(ctx.projects)}`;

  if (!sent) bindForm(el, site, ctx);
  else el.querySelector('#again')?.addEventListener('click', () => ctx.clearSent());
}

function sentHtml() {
  return `<div class="pub-done">
    <span class="pub-done-ico">${icon('check', 26)}</span>
    <div><h2>의뢰가 접수되었습니다</h2>
      <p>보내 주신 문서를 담당자가 확인한 뒤, 적어 주신 이메일로 연락드리겠습니다. 접수 확인 메일도 함께 보내드렸습니다.</p>
      <button type="button" class="btn ghost" id="again">${icon('plus', 16)} 다른 프로젝트 의뢰하기</button></div>
  </div>`;
}

function formHtml(site) {
  const ready = !!(site.intake && site.intake.email);
  return `
  <div class="np-head"><span class="np-ico">${icon('plus', 22)}</span>
    <div><h2>새 프로젝트 의뢰</h2><p>사양서·기획서·개발계획서를 올리시면 담당자가 확인한 뒤 AI 팀 분석을 시작합니다.</p></div></div>
  <form id="np-form" novalidate>
    <div class="np-row">
      <div class="field"><label class="lbl" for="np-name">프로젝트 이름 <em>필수</em></label>
        <input id="np-name" type="text" autocomplete="off" placeholder="예: 사내 비품 대여 관리 시스템"></div>
      <div class="field"><label class="lbl" for="np-client">회사 · 기관</label>
        <input id="np-client" type="text" autocomplete="organization" placeholder="예: 한빛전자"></div>
    </div>
    <div class="np-row three">
      <div class="field"><label class="lbl" for="np-person">담당자 이름 <em>필수</em></label>
        <input id="np-person" type="text" autocomplete="name" placeholder="예: 홍길동"></div>
      <div class="field"><label class="lbl" for="np-email">이메일 <em>필수</em></label>
        <input id="np-email" type="email" autocomplete="email" placeholder="예: gildong@hanbit.co.kr"></div>
      <div class="field"><label class="lbl" for="np-phone">연락처</label>
        <input id="np-phone" type="tel" autocomplete="tel" placeholder="예: 010-1234-5678"></div>
    </div>
    <div class="field"><label class="lbl" for="np-note">요청 사항</label>
      <textarea id="np-note" rows="3" placeholder="예: 3개월 안에 1차 버전이 필요합니다. 기존 ERP 와 연동해야 합니다."></textarea></div>
    <div class="field"><span class="lbl">사양서 · 기획서 · 개발계획서 <em>필수</em></span>
      <div class="drop np-big" id="np-drop" tabindex="0" role="button" aria-label="올릴 문서 선택">
        <div class="big-ico">${icon('upload', 28)}</div>
        <h3>문서를 여기에 끌어다 놓으세요</h3>
        <p>또는 <span class="linkish">컴퓨터에서 파일 선택</span> · 여러 개를 한 번에 올릴 수 있습니다</p>
        <p class="fine">PDF · Word · 한글(HWP) · Excel · PowerPoint · 이미지 · ZIP — 합계 10MB까지</p>
        <input type="file" id="np-file" multiple hidden>
      </div>
      <ul class="queue" id="np-queue"></ul>
    </div>
    <label class="consent"><input type="checkbox" id="np-agree">
      <span>의뢰 상담을 위해 담당자 이름·이메일·연락처를 수집·이용하는 데 동의합니다. 상담 목적 외에는 쓰지 않습니다.</span></label>
    <div class="np-actions">
      <button class="btn lg" type="submit" id="np-submit"${ready ? '' : ' disabled'}>${icon('send', 17)} 의뢰 보내기</button>
      <span class="hint" id="np-sum">${ready ? '보내기를 누르면 보안 확인(로봇이 아님) 화면을 한 번 거친 뒤 접수됩니다.' : '접수 메일 주소가 설정되지 않았습니다.'}</span>
    </div>
    <div class="np-err" id="np-err" role="alert" hidden></div>
  </form>`;
}

function fileItem(f) {
  return `<li class="qi${f.error ? ' error' : ''}" data-fid="${f.id}">
    <span class="fi">${fileBadge(f.file.name)}</span>
    <div class="qi-main"><div class="qi-row"><span class="nm" title="${esc(f.file.name)}">${esc(f.file.name)}</span><span class="sz">${fmtSize(f.file.size)}</span></div>
      ${f.error ? `<div class="qi-st">${esc(f.error)}</div>` : ''}</div>
    <span class="qi-act"><button type="button" class="icon-btn sm" data-rm="${f.id}" aria-label="${esc(f.file.name)} 빼기">${icon('x', 16)}</button></span>
  </li>`;
}

function total() { return form.files.reduce((a, f) => a + f.file.size, 0); }

function bindForm(el, site, ctx) {
  const root = el.querySelector('#np-form');
  const queue = root.querySelector('#np-queue');
  const err = root.querySelector('#np-err');
  const sum = root.querySelector('#np-sum');
  const showErr = (msg) => { err.textContent = msg; err.hidden = !msg; };
  const refresh = () => {
    queue.innerHTML = form.files.map(fileItem).join('');
    if (form.files.length) sum.textContent = `${form.files.length}개 문서 · 합계 ${fmtSize(total())} / 10MB`;
  };
  refresh();

  bindDrop(root.querySelector('#np-drop'), root.querySelector('#np-file'), (files) => {
    for (const file of files) form.files.push({ id: ++fid, file });
    showErr(total() > MAX_TOTAL ? `첨부 합계가 10MB를 넘습니다 (${fmtSize(total())}). 일부를 빼거나 압축해 주세요.` : '');
    refresh();
  });
  queue.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    form.files = form.files.filter((f) => String(f.id) !== b.dataset.rm);
    showErr(total() > MAX_TOTAL ? `첨부 합계가 10MB를 넘습니다 (${fmtSize(total())}).` : '');
    refresh();
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id) => root.querySelector(id).value.trim();
    const name = val('#np-name'), client = val('#np-client'), person = val('#np-person');
    const email = val('#np-email'), phone = val('#np-phone'), note = val('#np-note');
    if (!name) return fail('#np-name', '프로젝트 이름을 적어 주세요.');
    if (!person) return fail('#np-person', '담당자 이름을 적어 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('#np-email', '연락받으실 이메일 주소를 확인해 주세요.');
    if (!form.files.length) return fail('#np-drop', '사양서나 기획서를 하나 이상 올려 주세요.');
    if (total() > MAX_TOTAL) return fail('#np-drop', `첨부 합계가 10MB를 넘습니다 (${fmtSize(total())}). 일부를 빼거나 압축해 주세요.`);
    if (!root.querySelector('#np-agree').checked) return fail('#np-agree', '개인정보 수집·이용에 동의해 주세요.');
    showErr('');
    submitByMail(site, { name, client, person, email, phone, note, files: form.files.map((f) => f.file) });
    root.querySelector('#np-submit').disabled = true;
    sum.textContent = '보내는 중… 보안 확인 화면으로 이동합니다.';
  });

  function fail(sel, msg) {
    showErr(msg);
    root.querySelector(sel)?.focus();
  }
}

// FormSubmit 은 일반 form POST(multipart)로 받아 첨부와 함께 메일로 보낸다.
// 끌어놓은 파일을 파일마다 별도 file input 에 담아 숨은 form 으로 제출한다.
function submitByMail(site, d) {
  const back = (site.base_url || location.href.split('#')[0].split('?')[0]) + '?sent=1';
  const f = document.createElement('form');
  f.method = 'POST';
  f.enctype = 'multipart/form-data';
  f.action = 'https://formsubmit.co/' + site.intake.email.trim();
  f.hidden = true;
  const add = (name, value) => {
    const i = document.createElement('input');
    i.type = 'hidden'; i.name = name; i.value = value;
    f.appendChild(i);
  };
  add('_subject', `[TAMA 의뢰] ${d.name}${d.client ? ' — ' + d.client : ''}`);
  add('_template', 'table');
  add('_next', back);
  add('_autoresponse', 'TAMA AI Platform 에 프로젝트 의뢰가 접수되었습니다. 담당자가 보내 주신 문서를 확인한 뒤 연락드리겠습니다.');
  add('_honey', '');
  add('프로젝트', d.name);
  add('회사', d.client || '-');
  add('담당자', d.person);
  add('email', d.email);
  add('연락처', d.phone || '-');
  add('요청사항', d.note || '-');
  add('첨부목록', d.files.map((x) => `${x.name} (${fmtSize(x.size)})`).join(', '));
  d.files.forEach((file, n) => {
    const i = document.createElement('input');
    i.type = 'file'; i.name = 'attachment' + (n + 1);
    const dt = new DataTransfer();
    dt.items.add(file);
    i.files = dt.files;
    f.appendChild(i);
  });
  document.body.appendChild(f);
  f.submit();
}

export function projectsSection(projects, { full = false } = {}) {
  const list = arr(projects);
  return `<section class="home-projects" id="done">
    <h2 class="sec-title">${full ? '' : '완료 프로젝트 '}<span class="muted">${list.length}</span></h2>
    <div class="proj-cards">${list.length ? list.map(card).join('') : '<p class="muted">공개된 프로젝트가 아직 없습니다.</p>'}</div>
  </section>`;
}

function card(p) {
  const s = p.stats || {};
  return `<div class="proj-card static" aria-label="${esc(p.name)}">
    <div class="pc-top"><span class="pill ok"><span class="dot"></span>${esc(p.label || '완료')}</span>
      <span class="pc-time">${p.ended ? `${fmtDate(p.ended)} 완료` : ''}</span></div>
    <h3>${esc(p.name)}</h3>
    <div class="pc-meta">${esc(p.client || '')}${p.elapsed_h ? ` · 착수부터 보고서까지 <b>${esc(p.elapsed_h)}시간</b>` : ''}</div>
    <dl class="pc-stats">
      ${s.req ? `<div><dt>요구사항 충족</dt><dd>${esc(s.req)}</dd></div>` : ''}
      ${s.tests ? `<div><dt>자동 시험 통과</dt><dd>${esc(s.tests)}</dd></div>` : ''}
      ${s.ai ? `<div><dt>참여 AI</dt><dd>${esc(s.ai)}</dd></div>` : ''}
      ${s.reviews ? `<div><dt>교차 리뷰</dt><dd>${esc(s.reviews)}</dd></div>` : ''}
    </dl>
    <span class="pc-lock">${icon('shield', 15)} 진행 대시보드는 해당 고객만 열람할 수 있습니다</span>
  </div>`;
}
