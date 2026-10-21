// 관리자 페이지 진입: 로그인 → 데이터 금고 열기 → 대시보드(app.js)를 읽기 전용으로 띄운다.
import * as vault from './vault.js';
import { icon, brandMark } from './views/ui.js';

async function startApp() {
  document.title = 'TAMA AI Platform — 관리자';
  await import('./app.js');
}

function showLogin(msg = '') {
  document.body.dataset.tab = 'login';
  document.getElementById('app').innerHTML = `
  <main class="login-wrap">
    <form class="login-card" id="login-form" novalidate>
      <a class="brand dark-text" href="./">${brandMark(38)}<span class="brand-txt"><span class="brand-name">TAMA AI Platform</span><span class="brand-sub">관리자</span></span></a>
      <h1>관리자 로그인</h1>
      <p class="login-lead">프로젝트별 진행 대시보드·문서·비용은 관리자만 볼 수 있습니다.</p>
      <div class="field"><label class="lbl" for="lg-id">아이디</label>
        <input id="lg-id" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
      <div class="field"><label class="lbl" for="lg-pw">비밀번호</label>
        <input id="lg-pw" type="password" autocomplete="current-password" required></div>
      <div class="login-err" id="lg-err" role="alert"${msg ? '' : ' hidden'}>${msg}</div>
      <button class="btn lg full" type="submit" id="lg-go">${icon('shield', 17)} 로그인</button>
      <a class="side-link center" href="./">${icon('home', 16)}<span>공개 홈페이지로</span></a>
    </form>
  </main>`;
  const form = document.getElementById('login-form');
  const err = document.getElementById('lg-err');
  const go = document.getElementById('lg-go');
  document.getElementById('lg-id').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('lg-id').value.trim();
    const pw = document.getElementById('lg-pw').value;
    if (!id || !pw) { err.textContent = '아이디와 비밀번호를 입력해 주세요.'; err.hidden = false; return; }
    go.disabled = true;
    go.innerHTML = `${icon('refresh', 17)} 확인 중…`;
    let ok = false;
    try { ok = await vault.login(id, pw); } catch (x) { err.textContent = x.message || '로그인하지 못했습니다.'; err.hidden = false; }
    if (ok) { await startApp(); return; }
    await new Promise((r) => setTimeout(r, 600));
    if (err.hidden || !err.textContent) err.textContent = '아이디 또는 비밀번호가 맞지 않습니다.';
    err.hidden = false;
    go.disabled = false;
    go.innerHTML = `${icon('shield', 17)} 로그인`;
    document.getElementById('lg-pw').select();
  });
}

// vault: 링크(결과물·업로드 원본)는 클릭 때 풀어서 연다/내려받는다
document.addEventListener('click', async (e) => {
  const a = e.target.closest && e.target.closest('a[href^="vault:"]');
  if (!a) return;
  e.preventDefault();
  try {
    const url = await vault.blobUrl(a.getAttribute('href').slice(6));
    const t = document.createElement('a');
    t.href = url;
    if (a.hasAttribute('download')) t.download = a.getAttribute('download') || '';
    else { t.target = '_blank'; t.rel = 'noopener'; }
    document.body.appendChild(t);
    t.click();
    t.remove();
  } catch (x) {
    console.error(x);
  }
}, true);

if (await vault.resume()) await startApp();
else showLogin();
