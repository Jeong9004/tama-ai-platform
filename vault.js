// 관리자 데이터 금고 — 아이디·비밀번호에서 PBKDF2(SHA-256)로 만든 키로 data/admin/*.bin(AES-GCM)을 푼다.
// 키는 탭이 열려 있는 동안만 sessionStorage 에 둔다(로그아웃·탭 닫기 시 사라짐).
const SS = 'tama.admin.key';
const BASE = './data/admin/';
let key = null;
let index = null;
let meta = null;
const blobUrls = new Map();

const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u8) => btoa(String.fromCharCode(...u8));

async function loadMeta() {
  if (meta) return meta;
  const res = await fetch(BASE + 'meta.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('관리자 데이터가 없습니다');
  meta = await res.json();
  return meta;
}

async function open(bytes) {
  key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
  const plain = await decrypt(b64d(meta.index));
  index = JSON.parse(new TextDecoder().decode(plain));
}

async function decrypt(buf) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)));
}

export async function login(id, password) {
  await loadMeta();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${id}\n${password}`), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64d(meta.salt), iterations: meta.iterations }, base, 256));
  try {
    await open(bits);
  } catch {
    key = null; index = null;
    return false;
  }
  try { sessionStorage.setItem(SS, b64e(bits)); } catch { /* 저장 불가: 이 화면에서만 로그인 유지 */ }
  return true;
}

export async function resume() {
  let saved = null;
  try { saved = sessionStorage.getItem(SS); } catch { return false; }
  if (!saved) return false;
  try {
    await loadMeta();
    await open(b64d(saved));
    return true;
  } catch {
    logout();
    return false;
  }
}

export function logout() {
  try { sessionStorage.removeItem(SS); } catch { /* 무시 */ }
  key = null; index = null;
  for (const u of blobUrls.values()) URL.revokeObjectURL(u);
  blobUrls.clear();
}

export function entry(logical) { return index ? index[logical] || null : null; }

export async function bytes(logical) {
  const e = entry(logical);
  if (!e) { const err = new Error('찾을 수 없습니다'); err.status = 404; throw err; }
  const res = await fetch(BASE + e.file + '.bin', { cache: 'no-cache' });
  if (!res.ok) { const err = new Error(`불러오지 못했습니다 (${res.status})`); err.status = res.status; throw err; }
  return decrypt(new Uint8Array(await res.arrayBuffer()));
}

export async function text(logical) { return new TextDecoder().decode(await bytes(logical)); }
export async function json(logical) { return JSON.parse(await text(logical)); }

export async function blobUrl(logical) {
  if (blobUrls.has(logical)) return blobUrls.get(logical);
  const e = entry(logical);
  const url = URL.createObjectURL(new Blob([await bytes(logical)], { type: (e && e.mime) || 'application/octet-stream' }));
  blobUrls.set(logical, url);
  return url;
}
