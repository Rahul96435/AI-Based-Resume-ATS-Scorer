const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed.');
  }
  return response.status === 204 ? null : response;
}

export async function authenticate(mode, email, password) {
  const response = await request(`/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return response.json();
}
export async function analyze(token, resume, jobDescription) {
  const body = new FormData(); body.append('resume', resume); body.append('job_description', jobDescription);
  return (await request('/analyze-resume', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })).json();
}
export async function getHistory(token) { return (await request('/history', { headers: { Authorization: `Bearer ${token}` } })).json(); }
export async function removeHistory(token, id) { return request(`/history/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); }
export async function report(token, result) { return (await request('/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(result) })).blob(); }
