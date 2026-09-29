// Small fetch wrapper: adds the JWT, parses JSON, and turns API errors into thrown Errors.
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'placemate_token';

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Is the API running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t) {
      token.clear();
      window.dispatchEvent(new Event('placemate:logout'));
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
