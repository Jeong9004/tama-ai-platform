// 서버 API 래퍼 — 계약은 docs/superpowers/specs/2026-10-21-tama-ai-platform-design.md §8

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const enc = encodeURIComponent;

function detailOf(data, status) {
  if (data && typeof data === 'object' && data.detail != null) {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  }
  if (status === 404) return '찾을 수 없습니다';
  if (status === 409) return '이미 처리된 항목입니다';
  if (status === 413) return '파일이 너무 큽니다 (파일당 최대 200MB)';
  return `요청을 처리하지 못했습니다 (${status})`;
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      cache: 'no-store',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다', null);
  }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) throw new ApiError(res.status, detailOf(data, res.status), data);
  return data;
}

// XMLHttpRequest 업로드 — 진행률(0~1)을 onProgress 로 알린다
function upload(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { data = xhr.responseText; }
      if (xhr.status >= 200 && xhr.status < 300) { if (onProgress) onProgress(1); resolve(data); }
      else reject(new ApiError(xhr.status, detailOf(data, xhr.status), data));
    };
    xhr.onerror = () => reject(new ApiError(0, '네트워크 오류로 올리지 못했습니다', null));
    xhr.onabort = () => reject(new ApiError(0, '올리기를 취소했습니다', null));
    xhr.send(formData);
  });
}

const server = {
  projects: () => request('GET', '/api/projects'),
  view: (id, audience) => request('GET', `/api/projects/${enc(id)}/view?audience=${enc(audience)}`),
  connections: () => request('GET', '/api/ops/connections'),
  answer: (id, qid, answer) => request('POST', `/api/projects/${enc(id)}/questions/${enc(qid)}/answer`, { answer }),

  artifactUrl: (id, aid) => `/api/projects/${enc(id)}/artifacts/${enc(aid)}`,
  inputUrl: (id, input) => `/api/projects/${enc(id)}/inputs/${enc(input)}`,

  async artifactText(id, aid) {
    let res;
    try { res = await fetch(api.artifactUrl(id, aid), { cache: 'no-store' }); }
    catch { throw new ApiError(0, '서버에 연결할 수 없습니다', null); }
    if (!res.ok) throw new ApiError(res.status, `문서를 불러오지 못했습니다 (${res.status})`, null);
    return res.text();
  },

  uploadInput(id, { file, kind, note, qid }, onProgress) {
    const fd = new FormData();
    fd.append('files', file, file.name);
    fd.append('kind', kind || 'other');
    fd.append('note', note || '');
    if (qid) fd.append('qid', qid);
    return upload(`/api/projects/${enc(id)}/inputs`, fd, onProgress);
  },

  createProject({ name, client, files }, onProgress) {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('client', client || '');
    for (const f of files) fd.append('files', f, f.name);
    return upload('/api/projects', fd, onProgress);
  },
};

// 정적 관리자 모드(GitHub Pages 의 admin.html): 암호화된 데이터 금고에서 읽기만 한다
export const READONLY = typeof window !== 'undefined' && window.STUDIO_MODE === 'static';
const READONLY_MSG = '웹 관리자 화면은 보기 전용입니다. 답변·자료 올리기·새 프로젝트는 운영 PC의 대시보드에서 할 수 있습니다.';
let vaultMod = null;
const vault = async () => (vaultMod ||= await import('./vault.js'));
const wrap = (fn) => async (...a) => {
  try { return await fn(...a); } catch (e) { throw new ApiError(e.status || 0, e.message || '불러오지 못했습니다', null); }
};
const deny = async () => { throw new ApiError(403, READONLY_MSG, null); };

const staticApi = {
  projects: wrap(async () => (await vault()).json('projects')),
  view: wrap(async (id, audience) => (await vault()).json(`view/${id}/${audience === 'ops' ? 'ops' : 'client'}`)),
  connections: wrap(async () => {
    const d = await (await vault()).json('connections');
    return (d.items || []).map((x) => ({ ...x, error: x.error || null, checked_at: d.checked_at }));
  }),
  answer: deny,
  uploadInput: deny,
  createProject: deny,
  artifactUrl: (id, aid) => `vault:art/${id}/${aid}`,
  inputUrl: (id, input) => `vault:in/${id}/${input}`,
  artifactText: wrap(async (id, aid) => (await vault()).text(`art/${id}/${aid}`)),
  artifactHref: wrap(async (id, aid) => (await vault()).blobUrl(`art/${id}/${aid}`)),
};

export const api = READONLY ? staticApi : server;

