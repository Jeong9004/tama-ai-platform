// 공통 조각: 이스케이프, 포맷(KST), 아이콘, 배지, 빈 상태, 서랍·모달·토스트, SVG 시간축

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const arr = (v) => (Array.isArray(v) ? v : []);
export const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

export const PHASE_NAMES = { P0: '분석·계획', Q: '질의', P1: '구현', P2: '통합·수락', P3: '검증·감사', P4: '마감' };
export const phaseName = (id) => PHASE_NAMES[id] || id || '';

export const KIND_LABELS = {
  spec: '사양서', plan: '기획서', devplan: '개발계획서', reference: '참고 자료', answer: '답변 첨부', other: '기타',
};
export const ART_KIND = {
  report: '보고서', spec: '사양', plan: '계획', doc: '문서', test: '시험', review: '리뷰', image: '그림', source: '소스',
};
export const DISPO = {
  accepted: { label: '수용', cls: 'ok' },
  partial: { label: '부분', cls: 'info' },
  deferred: { label: '보류', cls: 'warn' },
  rejected: { label: '기각', cls: 'mute' },
};

// ---------- 시간 (KST) ----------
const KST_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function kst(t) {
  const d = t instanceof Date ? t : new Date(typeof t === 'number' ? t : String(t ?? ''));
  if (isNaN(d.getTime())) return null;
  const o = {};
  for (const p of KST_FMT.formatToParts(d)) o[p.type] = p.value;
  return o;
}
export const toMs = (iso) => { const t = Date.parse(iso ?? ''); return isNaN(t) ? null : t; };
export function fmtTime(iso) { const p = kst(iso); return p ? `${p.month}-${p.day} ${p.hour}:${p.minute}` : '—'; }
export function fmtClock(t) { const p = kst(t); return p ? `${p.hour}:${p.minute}` : '—'; }
export function fmtDay(t) { const p = kst(t); return p ? `${p.month}-${p.day}` : ''; }
export function fmtDate(iso) { const p = kst(iso); return p ? `${p.year}-${p.month}-${p.day}` : '—'; }
export function fmtDateTime(iso) { const p = kst(iso); return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` : '—'; }
export function fmtDur(min) {
  if (min == null || !isFinite(min)) return '—';
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}
export function fmtDurShort(min) {
  if (min == null || !isFinite(min)) return '';
  return min < 60 ? `${Math.round(min)}분` : `${(min / 60).toFixed(1)}시간`;
}
export function relTime(iso) {
  const t = toMs(iso);
  if (t == null) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return '방금';
  if (s < 3600) return `${Math.round(s / 60)}분 전`;
  if (s < 86400) return `${Math.round(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}일 전`;
  return fmtDate(iso);
}

// ---------- 숫자 ----------
export const fmtNum = (n) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('ko-KR'));
const COMPACT = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
export const fmtCompact = (n) => (n == null || !isFinite(n) ? '—' : COMPACT.format(n));
export const fmtUsd = (n) =>
  n == null || !isFinite(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtSize(b) {
  if (b == null || !isFinite(b)) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${i > 0 && v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

// ---------- 모델·회사 ----------
const MODEL_NAMES = {
  'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-fable-5-1': 'Claude Fable 5.1',
  'claude-haiku-4-5': 'Claude Haiku 4.5', 'gpt-6-astra': 'GPT-6 astra',
};
export const modelName = (m) => MODEL_NAMES[m] || m || '';
export const isGpt = (m) => /openai/i.test(m?.vendor || '') || /gpt|codex/i.test(m?.model || '');
export const reviewerLabel = (r) => (/gpt|codex|astra|openai/i.test(r || '') ? 'GPT' : r || '리뷰어');

// ---------- 상태 ----------
export function stateClass(s) { return { done: 'ok', running: 'info', active: 'info', waiting: 'warn', pending: 'mute' }[s] || 'mute'; }
export function stateText(s) { return { done: '완료', running: '진행 중', active: '진행 중', waiting: '확인 대기', pending: '대기' }[s] || s || ''; }
export function liveTag(status) {
  return status && status.live ? `<span class="live-tag"><span class="dot live"></span>실시간</span>` : '';
}

// ---------- 아이콘 (인라인 SVG) ----------
const ICONS = {
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/>',
  overview: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.6"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.6"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.6"/>',
  progress: '<path d="M4 6.5h9"/><path d="M8 12h12"/><path d="M4 17.5h7"/><circle cx="16" cy="6.5" r="1.6"/><circle cx="14" cy="17.5" r="1.6"/>',
  team: '<circle cx="12" cy="5.5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 8v3.5M12 11.5 6.6 16M12 11.5l5.4 4.5"/>',
  method: '<rect x="3.5" y="4" width="6" height="6" rx="1.5"/><rect x="14.5" y="14" width="6" height="6" rx="1.5"/><path d="M9.5 7H13a3.5 3.5 0 0 1 3.5 3.5V14"/>',
  requests: '<path d="M3.5 13 6 5h12l2.5 8v6h-17z"/><path d="M3.5 13h5l1.5 2.5h4l1.5-2.5h5"/>',
  results: '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 12.5h6M9 16h6"/>',
  ops: '<path d="M9 3.5v4.5M15 3.5v4.5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5v4"/>',
  upload: '<path d="M12 15.5V4.5"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15.5v4h15v-4"/>',
  file: '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  download: '<path d="M12 4.5v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 14v5.5h-13v-13H10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><path d="M12 17.2v.3"/>',
  question: '<path d="M4 5h16v11H9.5L5 19.5V16H4z"/><path d="M9.8 9.2a2.3 2.3 0 1 1 3.3 2.1c-.7.3-1.1.8-1.1 1.4"/><path d="M12 14.6v.2"/>',
  clip: '<path d="m19.5 11.5-7.8 7.8a5 5 0 0 1-7-7l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/>',
  send: '<path d="M4 12 20 4l-6 16-2.6-6.4z"/><path d="M11.4 13.6 20 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  shield: '<path d="M12 3.5 19.5 6.5v5.5c0 4.4-3.2 7.8-7.5 8.8-4.3-1-7.5-4.4-7.5-8.8V6.5z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  audit: '<path d="M9 3.5h6v3H9z"/><path d="M7 5H5v15.5h14V5h-2"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
  beaker: '<path d="M9 3.5h6"/><path d="M10 3.5v6l-5 8.8a1.8 1.8 0 0 0 1.6 2.7h10.8a1.8 1.8 0 0 0 1.6-2.7L14 9.5v-6"/><path d="M7.5 15h9"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.3M19 12.5a10 10 0 0 0-3.4-2.1"/><path d="M12 20h.01"/>',
  bolt: '<path d="M13 3 5 13.5h6L10.5 21 19 10h-6z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2a4.5 4.5 0 0 1 5 4.3"/>',
  inbox: '<path d="M4 4.5h16v15H4z"/><path d="M4 13.5h4.5l1.5 2h4l1.5-2H20"/>',
  flag: '<path d="M5.5 20.5v-16"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
};
export function icon(name, size = 18, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
export function brandMark(size = 34) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true">
    <defs><linearGradient id="bmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34508f"/><stop offset="1" stop-color="#0d152b"/></linearGradient></defs>
    <rect width="36" height="36" rx="9" fill="url(#bmg)"/>
    <g stroke="#7cf0ff" stroke-width="1.3" stroke-opacity=".75" fill="none"><path d="M18 10.5 10 24.5M18 10.5l8 14M10 24.5h16"/></g>
    <circle cx="18" cy="10.5" r="3.4" fill="#7cf0ff"/><circle cx="10" cy="24.5" r="2.8" fill="#4fe3b0"/><circle cx="26" cy="24.5" r="2.8" fill="#c48bff"/>
  </svg>`;
}

// 파일 확장자 배지
const EXT_COLORS = {
  pdf: '#c0392b', doc: '#2b59c3', docx: '#2b59c3', hwp: '#138a8a', hwpx: '#138a8a', xls: '#1d7a46', xlsx: '#1d7a46', csv: '#1d7a46',
  ppt: '#c8611a', pptx: '#c8611a', png: '#7b4bd1', jpg: '#7b4bd1', jpeg: '#7b4bd1', gif: '#7b4bd1', svg: '#7b4bd1', webp: '#7b4bd1',
  zip: '#5b6478', md: '#17233d', txt: '#5b6478', json: '#5b6478',
};
export function fileExt(name) { const m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
export function fileBadge(name) {
  const ext = fileExt(name);
  const c = EXT_COLORS[ext] || '#6b7590';
  return `<span class="fbadge" style="--fc:${c}">${esc((ext || 'file').slice(0, 4).toUpperCase())}</span>`;
}

// ---------- 공통 블록 ----------
export function emptyState(title, text = '', ico = 'inbox', extra = '') {
  return `<div class="empty">${icon(ico, 26)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${extra}</div>`;
}
export function skeleton() {
  return `<div class="skel"><div class="sk sk-eyebrow"></div><div class="sk sk-title"></div><div class="sk sk-meta"></div>
    <div class="sk-row">${'<div class="sk sk-card"></div>'.repeat(4)}</div><div class="sk sk-block"></div></div>`;
}
export function pageHead({ eyebrow = '', title = '', lead = '', meta = '', right = '' }) {
  return `<header class="ph"><div class="ph-row"><div class="ph-main">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
    <h1>${title}</h1>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
    ${lead ? `<p class="lead">${lead}</p>` : ''}
  </div>${right ? `<div class="ph-right">${right}</div>` : ''}</div></header>`;
}

// ---------- 토스트 ----------
export function toast(msg, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
  const ico = { ok: 'check', bad: 'alert', warn: 'alert', info: 'spark' }[kind] || 'check';
  t.innerHTML = `${icon(ico, 18)}<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 6000 : 4200);
}

// ---------- 서랍·모달 ----------
let overlay = null;
function onKey(e) { if (e.key === 'Escape') closeOverlay(); }
export function closeOverlay() {
  if (!overlay) return;
  const o = overlay; overlay = null;
  document.removeEventListener('keydown', onKey);
  o.classList.remove('open');
  setTimeout(() => o.remove(), 250);
}
export const closeDrawer = closeOverlay;
function openOverlay(kind, { title, sub = '', html, dark = false, width }) {
  closeOverlay();
  const wrap = document.createElement('div');
  wrap.className = `ov-wrap ${kind}${dark ? ' dark' : ''}`;
  wrap.innerHTML = `<div class="ov-scrim" data-close></div>
    <div class="ov-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"${width ? ` style="--w:${width}"` : ''}>
      <header class="ov-head"><div>${sub ? `<div class="ov-sub">${sub}</div>` : ''}<h3>${esc(title)}</h3></div>
      <button type="button" class="icon-btn" data-close aria-label="닫기">${icon('x', 20)}</button></header>
      <div class="ov-body">${html}</div></div>`;
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeOverlay(); });
  document.body.appendChild(wrap);
  overlay = wrap;
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { wrap.classList.add('open'); wrap.querySelector('.ov-head .icon-btn')?.focus(); });
  return wrap;
}
export const openDrawer = (o) => openOverlay('drawer', o);
export const openModal = (o) => openOverlay('modal', o);

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 대체 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

// ---------- 끌어놓기 ----------
export function bindDrop(zone, input, onFiles) {
  if (!zone || !input) return;
  const pick = () => input.click();
  zone.addEventListener('click', (e) => { if (!e.target.closest('button, a, input')) pick(); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  input.addEventListener('change', () => { if (input.files && input.files.length) onFiles([...input.files]); input.value = ''; });
  let depth = 0;
  zone.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; zone.classList.add('over'); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) zone.classList.remove('over'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; zone.classList.remove('over');
    const files = e.dataTransfer ? [...e.dataTransfer.files] : [];
    if (files.length) onFiles(files);
  });
}

// ---------- 숫자 올라가는 연출 ----------
const counted = new Set();
const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export function runCountUps(root, scope) {
  const els = root.querySelectorAll('[data-count]');
  els.forEach((el) => {
    const key = `${scope}:${el.dataset.countKey || el.dataset.count}`;
    if (counted.has(key)) return;
    counted.add(key);
    const target = Number(el.dataset.count);
    if (!isFinite(target) || reduceMotion() || target === 0) return;
    const dec = Number(el.dataset.dec || 0);
    const fmt = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('ko-KR'));
    const t0 = performance.now(), dur = 1100;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
    };
    el.textContent = fmt(0);
    requestAnimationFrame(step);
  });
}
export function countSpan(value, key, dec = 0) {
  if (value == null || !isFinite(value)) return '—';
  const shown = dec ? Number(value).toFixed(dec) : Number(value).toLocaleString('ko-KR');
  return `<span data-count="${value}" data-count-key="${esc(key)}" data-dec="${dec}">${shown}</span>`;
}

// ---------- SVG 시간축 (KST 정시 정렬) ----------
const H = 3600e3;
const STEPS = [15 * 60e3, 30 * 60e3, H, 2 * H, 3 * H, 6 * H, 12 * H, 24 * H, 48 * H, 7 * 24 * H];
export function timeAxis(t0, t1, x0, x1, maxTicks = 12) {
  const span = Math.max(1, t1 - t0);
  const step = STEPS.find((s) => span / s <= maxTicks) || STEPS[STEPS.length - 1];
  const off = 9 * H; // KST
  const ticks = [];
  for (let t = Math.ceil((t0 + off) / step) * step - off; t <= t1; t += step) ticks.push(t);
  const x = (t) => x0 + ((t - t0) / span) * (x1 - x0);
  return { x, ticks, step };
}
export function axisSvg(ax, top, bottom, { labelY, dark = false } = {}) {
  let lastDay = '';
  return ax.ticks.map((t) => {
    const x = ax.x(t).toFixed(1);
    const day = fmtDay(t);
    const showDay = day !== lastDay;
    lastDay = day;
    return `<line class="grid" x1="${x}" x2="${x}" y1="${top}" y2="${bottom}"/>
      <text class="tick" x="${x}" y="${labelY}" text-anchor="middle">${fmtClock(t)}</text>
      ${showDay ? `<text class="tick day" x="${x}" y="${labelY - 13}" text-anchor="middle">${day}</text>` : ''}`;
  }).join('');
}
