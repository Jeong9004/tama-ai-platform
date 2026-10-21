// 5 요청·자료: 질문 답변, 자료 올리기(파일별 진행률), 처리 이력
import {
  esc, arr, icon, fmtTime, fmtSize, fileBadge, KIND_LABELS, bindDrop, emptyState, pageHead,
} from './ui.js';

const MAX = 200 * 1024 * 1024;
const KINDS = [
  { id: 'spec', label: '사양서' }, { id: 'plan', label: '기획서' }, { id: 'devplan', label: '개발계획서' },
  { id: 'reference', label: '참고 자료' }, { id: 'other', label: '기타' },
];
const STATE = {
  open: { cls: 'warn', label: '답변 대기' },
  answered: { cls: 'info', label: '답변됨 · 반영 대기' },
  resolved: { cls: 'ok', label: '반영됨' },
};

const drafts = new Map(); // `${pid}:${qid}` → { option, text, editing }
const up = { pid: null, kind: 'reference', note: '', qid: '', queue: [], busy: false };
let seq = 0;
let handledParams = '';

export function render(el, ctx) {
  const v = ctx.view;
  const pid = ctx.id;
  if (up.pid !== pid && !up.busy) Object.assign(up, { pid, kind: 'reference', note: '', qid: '', queue: [] });

  const qs = arr(v.questions).slice().sort(qOrder);
  const nOpen = qs.filter((q) => q.state === 'open').length;
  const nAns = qs.filter((q) => q.state === 'answered').length;
  const nRes = qs.filter((q) => q.state === 'resolved').length;

  el.innerHTML = `
  ${pageHead({
    eyebrow: '요청·자료',
    title: '확인이 필요한 질문과 자료',
    lead: 'AI 팀이 문서에서 빈 부분이나 모호한 부분을 찾으면 여기에서 여쭙니다. 답을 주시기 전까지는 각 질문에 적힌 가정으로 작업을 계속하고, 답을 받으면 사양에 반영한 뒤 반영 위치를 알려 드립니다.',
  })}
  ${ctx.readonly ? `<div class="card ro-note">${icon('shield', 18)}<div><b>웹 관리자 화면은 보기 전용입니다.</b>
    <p>질문 답변과 자료 올리기는 운영 PC의 대시보드에서 할 수 있습니다. 여기서는 현재 상태만 확인합니다.</p></div></div>` : ''}

  <section class="req-sec">
    <div class="sec-head">
      <h2>${icon('question', 20)} 고객님 확인이 필요한 질문</h2>
      ${qs.length ? `<div class="sum-chips"><span class="pill warn">대기 ${nOpen}</span><span class="pill info">답변됨 ${nAns}</span><span class="pill ok">반영됨 ${nRes}</span></div>` : ''}
    </div>
    ${qs.length ? `<div class="qlist">${qs.map((q) => qCard(q, pid)).join('')}</div>`
      : emptyState('지금은 여쭐 질문이 없습니다', 'AI 팀이 문서를 분석하다 확인이 필요한 부분을 찾으면 이곳에 질문이 올라옵니다.', 'question')}
  </section>

  <section class="req-sec" id="upload">
    <div class="sec-head"><h2>${icon('upload', 20)} 자료 올리기</h2></div>
    <p class="sec-lead">사양서 수정본, 기획서, 화면 설계, 참고 자료 등 무엇이든 올려 주세요. AI 팀이 다음 점검 때 읽고 반영하며, 반영 결과는 아래 처리 이력에 표시됩니다.</p>
    ${ctx.readonly ? '' : `<div id="uploader">${uploader(qs)}</div>`}
  </section>

  <section class="req-sec">
    <div class="sec-head"><h2>${icon('inbox', 20)} 처리 이력</h2><span class="muted">${arr(v.inputs).length}건</span></div>
    ${history(arr(v.inputs), qs, pid, ctx)}
  </section>`;

  bindQuestions(el, ctx, qs);
  if (!ctx.readonly) bindUploader(el, ctx, qs);
  handleParams(el, ctx);
}

const qOrder = (a, b) => {
  const r = { open: 0, answered: 1, resolved: 2 };
  return (r[a.state] ?? 3) - (r[b.state] ?? 3) || (b.blocking ? 1 : 0) - (a.blocking ? 1 : 0)
    || String(b.asked_at || '').localeCompare(String(a.asked_at || ''));
};

// ---------- 질문 ----------
function qCard(q, pid) {
  const key = `${pid}:${q.qid}`;
  const d = drafts.get(key) || {};
  const editing = q.state === 'open' || (q.state === 'answered' && d.editing);
  const s = STATE[q.state] || STATE.open;
  const refs = arr(q.refs);
  const opts = arr(q.options);
  return `<article class="qcard ${esc(q.state)}${q.blocking && q.state !== 'resolved' ? ' blocking' : ''}" id="q-${esc(q.qid)}" data-qid="${esc(q.qid)}">
    <div class="q-top">
      <span class="pill ${s.cls}"><span class="dot"></span>${s.label}</span>
      ${q.state !== 'resolved' ? (q.blocking
        ? `<span class="pill bad">${icon('alert', 13)}답을 받아야 다음 단계로 진행</span>`
        : `<span class="pill mute">가정으로 작업 계속 중</span>`) : ''}
      <span class="q-meta"><span class="mono">${esc(q.qid)}</span> · ${esc(fmtTime(q.asked_at))} 질문</span>
    </div>
    <h3>${esc(q.title)}</h3>
    ${q.body ? `<div class="qbody">${esc(q.body)}</div>` : ''}
    ${refs.length ? `<div class="refs"><span class="refs-l">근거</span>${refs.map((r) => `<span class="ref">${esc(r)}</span>`).join('')}</div>` : ''}
    ${q.assume ? `<div class="assume"><div class="as-h">${icon('flag', 15)} 답이 없으면 이렇게 진행합니다</div><div class="as-t">${esc(q.assume)}</div></div>` : ''}
    ${q.answer && !editing ? `<div class="answer"><div class="an-h">${icon('send', 14)} 보내신 답변 · ${esc(fmtTime(q.answered_at))}</div><div class="an-t">${esc(q.answer)}</div></div>` : ''}
    ${q.state === 'resolved' ? `<div class="res-note">${icon('check', 16)}<span>사양에 반영되었습니다${q.applied_to ? ` — 반영 위치 <b>${esc(q.applied_to)}</b>` : ''}</span></div>` : ''}
    ${editing ? qForm(q, d) : ''}
    ${!editing && q.state !== 'resolved' ? `<div class="q-actions">
      ${q.state === 'answered' ? `<button type="button" class="btn ghost sm" data-act="edit">${icon('send', 14)} 답변 수정</button>` : ''}
      <button type="button" class="btn ghost sm" data-act="attach">${icon('clip', 14)} 관련 자료 첨부</button></div>` : ''}
  </article>`;
}

function qForm(q, d) {
  const opts = arr(q.options);
  const pre = d.text ?? (q.state === 'answered' ? q.answer || '' : '');
  return `<form class="qform" novalidate>
    ${opts.length ? `<fieldset class="opts"><legend>선택해 주세요</legend>${opts.map((o) => `
      <label class="opt"><input type="radio" name="opt-${esc(q.qid)}" value="${esc(o)}"${d.option === o ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}</fieldset>` : ''}
    <label class="lbl" for="ans-${esc(q.qid)}">${opts.length ? '덧붙일 설명 (선택)' : '답변'}</label>
    <textarea id="ans-${esc(q.qid)}" rows="3" placeholder="${opts.length ? '선택하신 내용에 덧붙일 설명이 있으면 적어 주세요.' : '답변을 적어 주세요. 정하기 어려우면 아래 \'가정대로 진행\' 버튼을 누르셔도 됩니다.'}">${esc(pre)}</textarea>
    <div class="qf-actions">
      <button type="submit" class="btn">${icon('send', 15)} ${q.state === 'answered' ? '수정한 답변 보내기' : '답변 보내기'}</button>
      ${q.assume ? `<button type="button" class="btn ghost" data-act="assume">가정대로 진행해 주세요</button>` : ''}
      <button type="button" class="btn ghost" data-act="attach">${icon('clip', 15)} 관련 자료 첨부</button>
      ${q.state === 'answered' ? `<button type="button" class="btn text" data-act="cancel">취소</button>` : ''}
    </div>
  </form>`;
}

function bindQuestions(el, ctx, qs) {
  const pid = ctx.id;
  el.querySelectorAll('.qcard').forEach((card) => {
    const q = qs.find((x) => x.qid === card.dataset.qid);
    if (!q) return;
    const key = `${pid}:${q.qid}`;
    const form = card.querySelector('.qform');
    if (form) {
      const ta = form.querySelector('textarea');
      ta.addEventListener('input', () => drafts.set(key, { ...(drafts.get(key) || {}), text: ta.value }));
      form.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => {
        drafts.set(key, { ...(drafts.get(key) || {}), option: r.value });
      }));
      form.addEventListener('submit', (e) => { e.preventDefault(); submitAnswer(ctx, q, form); });
    }
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'edit') { drafts.set(key, { ...(drafts.get(key) || {}), editing: true }); ctx.repaint(); focusAnswer(q.qid); }
      else if (act === 'cancel') { drafts.delete(key); ctx.repaint(); }
      else if (act === 'attach') attachTo(el, q.qid, qs);
      else if (act === 'assume') send(ctx, q, '제시하신 가정대로 진행해 주세요.', b);
    });
  });
}

function focusAnswer(qid) {
  requestAnimationFrame(() => document.getElementById(`ans-${qid}`)?.focus());
}

async function submitAnswer(ctx, q, form) {
  const opt = form.querySelector('input[type=radio]:checked')?.value || '';
  const text = form.querySelector('textarea').value.trim();
  const answer = opt && text ? `${opt}\n${text}` : opt || text;
  if (!answer) { ctx.toast('답변을 적거나 선택지를 골라 주세요', 'warn'); form.querySelector('textarea').focus(); return; }
  await send(ctx, q, answer, form.querySelector('button[type=submit]'));
}

async function send(ctx, q, answer, btn) {
  const key = `${ctx.id}:${q.qid}`;
  const card = btn?.closest('.qcard');
  card?.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    await ctx.api.answer(ctx.id, q.qid, answer);
    drafts.delete(key);
    ctx.toast('답변을 보냈습니다. AI 팀이 다음 점검 때 사양에 반영합니다.', 'ok');
    document.activeElement?.blur?.();
    await ctx.refresh({ force: true });
  } catch (e) {
    card?.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    if (e.status === 409) {
      ctx.toast('이미 사양에 반영된 질문이라 답변을 바꿀 수 없습니다.', 'warn');
      drafts.delete(key);
      await ctx.refresh({ force: true });
    } else ctx.toast(e.message || '답변을 보내지 못했습니다', 'bad');
  }
}

function attachTo(el, qid, qs) {
  up.qid = qid;
  const sel = el.querySelector('#up-q');
  if (sel) sel.value = qid;
  const q = qs.find((x) => x.qid === qid);
  const box = el.querySelector('#upload');
  box?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  box?.classList.remove('flash'); void box?.offsetWidth; box?.classList.add('flash');
  const hint = el.querySelector('#up-qhint');
  if (hint) hint.innerHTML = q ? `${icon('clip', 14)} 질문 <b>${esc(q.title)}</b>에 연결해 올립니다` : '';
}

// ---------- 업로드 ----------
const pending = () => up.queue.filter((i) => i.status === 'ready' || i.status === 'error' && !i.fatal).length;

function uploader(qs) {
  const openQs = qs.filter((q) => q.state !== 'resolved');
  const linked = openQs.find((q) => q.qid === up.qid);
  const n = pending();
  return `<div class="card up-card">
    <div class="drop${up.busy ? ' busy' : ''}" id="drop" tabindex="0" role="button" aria-label="올릴 파일 선택">
      <div class="big-ico">${icon('upload', 28)}</div>
      <h3>파일을 여기에 끌어다 놓으세요</h3>
      <p>또는 <span class="linkish">컴퓨터에서 파일 선택</span> · 여러 개를 한 번에 올릴 수 있습니다</p>
      <p class="fine">PDF · Word · 한글(HWP) · Excel · PowerPoint · 이미지 · ZIP — 파일당 최대 200MB</p>
      <input type="file" id="file-input" multiple hidden>
    </div>
    <ul class="queue" id="queue">${up.queue.map(queueItem).join('')}</ul>
    <div class="up-fields">
      <div class="field"><span class="lbl" id="kind-l">자료 종류</span>
        <div class="seg" role="radiogroup" aria-labelledby="kind-l">${KINDS.map((k) => `
          <button type="button" role="radio" aria-checked="${up.kind === k.id}" class="${up.kind === k.id ? 'on' : ''}" data-kind="${k.id}">${k.label}</button>`).join('')}</div></div>
      <div class="field"><label class="lbl" for="up-q">관련 질문 (선택)</label>
        <div class="select-wrap light"><select id="up-q"><option value="">관련 질문 없음</option>
          ${openQs.map((q) => `<option value="${esc(q.qid)}"${up.qid === q.qid ? ' selected' : ''}>${esc(q.qid)} · ${esc(q.title)}</option>`).join('')}
        </select>${icon('chevronDown', 16)}</div>
        <div class="up-qhint" id="up-qhint">${linked ? `${icon('clip', 14)} 질문 <b>${esc(linked.title)}</b>에 연결해 올립니다` : ''}</div></div>
      <div class="field full"><label class="lbl" for="up-note">메모 (선택)</label>
        <textarea id="up-note" rows="2" placeholder="예: 3장 통신 사양 수정본입니다. 이전 판과 바뀐 부분은 노란색으로 표시했습니다.">${esc(up.note)}</textarea></div>
    </div>
    <div class="up-actions">
      <span class="up-sum" id="up-sum">${sumText()}</span>
      <button type="button" class="btn lg" id="up-go"${!n || up.busy ? ' disabled' : ''}>${icon('upload', 17)} ${up.busy ? '올리는 중…' : n ? `${n}개 올리기` : '올리기'}</button>
    </div>
  </div>`;
}

function sumText() {
  const q = up.queue;
  if (!q.length) return '아직 고른 파일이 없습니다';
  const size = q.filter((i) => !i.fatal).reduce((a, i) => a + i.file.size, 0);
  const done = q.filter((i) => i.status === 'done').length;
  return up.busy ? `${done}/${q.length}개 완료 · 총 ${fmtSize(size)}` : `${q.length}개 · 총 ${fmtSize(size)}`;
}

function queueItem(it) {
  const pct = Math.round((it.progress || 0) * 100);
  const st = { ready: '올릴 준비 됨', uploading: `올리는 중 ${pct}%`, done: '받았습니다', error: it.error || '실패' }[it.status];
  return `<li class="qi ${it.status}" data-id="${it.id}">
    <span class="fi">${fileBadge(it.file.name)}</span>
    <div class="qi-main">
      <div class="qi-row"><span class="nm" title="${esc(it.file.name)}">${esc(it.file.name)}</span><span class="sz">${fmtSize(it.file.size)}</span></div>
      ${it.fatal ? '' : `<div class="bar"><i style="width:${it.status === 'done' ? 100 : pct}%"></i></div>`}
      <div class="qi-st">${esc(st)}</div>
    </div>
    <span class="qi-act">
      ${it.status === 'error' && !it.fatal && !up.busy ? `<button type="button" class="btn ghost sm" data-retry="${it.id}">${icon('refresh', 14)} 다시</button>` : ''}
      ${(it.status === 'ready' || it.status === 'error') && !up.busy ? `<button type="button" class="icon-btn sm" data-remove="${it.id}" aria-label="${esc(it.file.name)} 빼기">${icon('x', 16)}</button>` : ''}
      ${it.status === 'done' ? `<span class="ok-ico">${icon('check', 18)}</span>` : ''}
    </span>
  </li>`;
}

function updateItem(it) {
  const li = document.querySelector(`#queue li[data-id="${it.id}"]`);
  if (li) li.outerHTML = queueItem(it);
  const sum = document.getElementById('up-sum');
  if (sum) sum.textContent = sumText();
}
function updateControls() {
  const btn = document.getElementById('up-go');
  const n = pending();
  if (btn) {
    btn.disabled = !n || up.busy;
    btn.innerHTML = `${icon('upload', 17)} ${up.busy ? '올리는 중…' : n ? `${n}개 올리기` : '올리기'}`;
  }
  const drop = document.getElementById('drop');
  drop?.classList.toggle('busy', up.busy);
  const sum = document.getElementById('up-sum');
  if (sum) sum.textContent = sumText();
}
function redrawQueue() {
  const ul = document.getElementById('queue');
  if (ul) ul.innerHTML = up.queue.map(queueItem).join('');
  updateControls();
}

function bindUploader(el, ctx, qs) {
  bindDrop(el.querySelector('#drop'), el.querySelector('#file-input'), (files) => {
    for (const file of files) {
      const big = file.size > MAX;
      up.queue.push({ id: ++seq, file, status: big ? 'error' : 'ready', progress: 0, error: big ? '200MB를 넘어 올릴 수 없습니다' : null, fatal: big });
    }
    redrawQueue();
  });
  el.querySelector('#queue').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    const rt = e.target.closest('[data-retry]');
    if (rm && !up.busy) { up.queue = up.queue.filter((i) => String(i.id) !== rm.dataset.remove); redrawQueue(); }
    if (rt && !up.busy) {
      const it = up.queue.find((i) => String(i.id) === rt.dataset.retry);
      if (it) { it.status = 'ready'; it.error = null; it.progress = 0; startUpload(ctx); }
    }
  });
  el.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    up.kind = b.dataset.kind;
    el.querySelectorAll('.seg [data-kind]').forEach((x) => {
      const on = x.dataset.kind === up.kind;
      x.classList.toggle('on', on);
      x.setAttribute('aria-checked', String(on));
    });
  });
  const sel = el.querySelector('#up-q');
  sel.addEventListener('change', () => {
    up.qid = sel.value;
    const q = qs.find((x) => x.qid === up.qid);
    el.querySelector('#up-qhint').innerHTML = q ? `${icon('clip', 14)} 질문 <b>${esc(q.title)}</b>에 연결해 올립니다` : '';
  });
  const note = el.querySelector('#up-note');
  note.addEventListener('input', () => { up.note = note.value; });
  el.querySelector('#up-go').addEventListener('click', () => startUpload(ctx));
}

async function startUpload(ctx) {
  if (up.busy) return;
  const items = up.queue.filter((i) => i.status === 'ready' || (i.status === 'error' && !i.fatal));
  if (!items.length) return;
  for (const i of items) { i.status = 'ready'; i.error = null; i.progress = 0; }
  const pid = ctx.id;
  const meta = { kind: up.kind, note: up.note.trim(), qid: up.qid };
  up.busy = true;
  redrawQueue();
  let ok = 0;
  for (const it of items) {
    it.status = 'uploading'; it.progress = 0; updateItem(it);
    try {
      await ctx.api.uploadInput(pid, { file: it.file, ...meta }, (p) => {
        it.progress = p;
        const li = document.querySelector(`#queue li[data-id="${it.id}"]`);
        const bar = li?.querySelector('.bar > i');
        const stx = li?.querySelector('.qi-st');
        if (bar) bar.style.width = `${Math.round(p * 100)}%`;
        if (stx) stx.textContent = p >= 1 ? '서버에 저장하는 중…' : `올리는 중 ${Math.round(p * 100)}%`;
      });
      it.status = 'done'; it.progress = 1; ok++;
    } catch (e) {
      it.status = 'error'; it.error = e.message || '올리지 못했습니다';
      if (e.status === 413) it.fatal = true;
    }
    updateItem(it);
  }
  up.busy = false;
  updateControls();
  const failed = items.length - ok;
  if (ok) {
    ctx.toast(`${ok}개 자료를 받았습니다. AI 팀이 다음 점검 때 읽고 반영합니다.`, 'ok');
    up.note = '';
  }
  if (failed) ctx.toast(`${failed}개는 올리지 못했습니다. 목록에서 '다시'를 눌러 주세요.`, 'bad');
  setTimeout(async () => {
    up.queue = up.queue.filter((i) => i.status !== 'done');
    if (ok) up.qid = '';
    await ctx.refresh({ force: true });
  }, ok ? 1100 : 0);
}

// ---------- 처리 이력 ----------
function history(inputs, qs, pid, ctx) {
  const rows = inputs.slice().sort((a, b) => String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || '')));
  if (!rows.length) return emptyState('아직 올린 자료가 없습니다', '위에서 파일을 올리시면 접수 내역과 반영 상태가 여기에 표시됩니다.', 'inbox');
  return `<div class="tbl-wrap"><table class="tbl hist">
    <thead><tr><th>파일</th><th>종류</th><th>크기</th><th>올린 시각</th><th>메모</th><th>상태</th></tr></thead>
    <tbody>${rows.map((r) => {
      const q = r.qid ? qs.find((x) => x.qid === r.qid) : null;
      return `<tr>
        <td data-l="파일"><div class="cv"><a class="file-link" href="${ctx.api.inputUrl(pid, r.input)}" download="${esc(r.file)}">${fileBadge(r.file)}<span>${esc(r.file)}</span></a></div></td>
        <td data-l="종류"><div class="cv">${esc(KIND_LABELS[r.kind] || r.kind || '기타')}</div></td>
        <td data-l="크기" class="num"><div class="cv">${fmtSize(r.size)}</div></td>
        <td data-l="올린 시각" class="num"><div class="cv">${esc(fmtTime(r.uploaded_at))}</div></td>
        <td data-l="메모"><div class="cv">${r.note ? esc(r.note) : '<span class="muted">—</span>'}${r.qid ? `<div class="sub">${icon('clip', 12)} 질문 ${esc(r.qid)}${q ? ` · ${esc(q.title)}` : ''}</div>` : ''}</div></td>
        <td data-l="상태"><div class="cv">${r.state === 'processed'
          ? `<span class="pill ok">${icon('check', 13)}반영됨</span>${r.processed_note ? `<div class="sub">${esc(r.processed_note)}</div>` : ''}`
          : `<span class="pill warn"><span class="dot"></span>접수됨</span><div class="sub">AI 팀 확인 대기</div>`}</div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// ---------- 주소 매개변수: ?q=<qid>, ?focus=upload ----------
function handleParams(el, ctx) {
  const p = ctx.params;
  const sig = `${ctx.id}|${p ? p.toString() : ''}`;
  if (!p || sig === handledParams) return;
  handledParams = sig;
  const qid = p.get('q');
  const focus = p.get('focus');
  requestAnimationFrame(() => {
    if (qid) {
      const card = el.querySelector(`#q-${CSS.escape(qid)}`);
      if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); card.classList.add('flash'); }
    } else if (focus === 'upload') {
      const box = el.querySelector('#upload');
      if (box) { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); box.classList.add('flash'); }
    }
  });
}
