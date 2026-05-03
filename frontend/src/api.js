const BASE = import.meta.env.VITE_API_BASE || '/api';

let token = localStorage.getItem('mp_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('mp_token', t);
  else localStorage.removeItem('mp_token');
}

export function getToken() {
  return token;
}

async function request(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return {
    ok: res.ok,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body
  };
}

export const api = {
  root: () => request('/'),
  health: () => request('/health'),
  reconPortal: () => request('/recon/portal'),
  reconSecret: (tag) => request('/recon/portal/secret', {
    headers: { 'X-Operative-Tag': tag }
  }),
  register: (payload) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  login: (payload) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  me: () => request('/auth/me'),
  stage2: () => request('/stages/2', { method: 'POST' }),
  elevate: (challenge_token) => request('/auth/elevate', {
    method: 'POST',
    body: JSON.stringify({ challenge_token })
  }),
  stage3: () => request('/stages/3'),
  stage3Submit: (plaintext) => request('/stages/3/submit', {
    method: 'POST',
    body: JSON.stringify({ plaintext })
  }),
  stage4Window: () => request('/stages/4/window'),
  stage4Attempt: (fragments) => request('/stages/4/attempt', {
    method: 'POST',
    body: JSON.stringify({ fragments })
  }),
  vaultUnlock: (master_key) => request('/vault/unlock', {
    method: 'POST',
    body: JSON.stringify({ master_key })
  }),
  vaultStatus: () => request('/vault/status')
};
