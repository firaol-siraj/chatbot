function getHeaders() {
  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function parseJson(res) {
  const text = await res.text();
  if (!text || text.trim() === '') {
    throw new Error('Server returned empty response. Try again in a moment.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server returned invalid response. Try again.');
  }
}

function apiFetch(url, opts) {
  return fetch(url, opts).catch((err) => {
    if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
      throw new Error('Cannot reach server. Is it running? Start with: npm run dev');
    }
    throw err;
  });
}

export const api = {
  auth: {
    login: (email, password) =>
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json()),
    signup: (email, username, password) =>
      fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      }).then((r) => r.json()),
    me: () =>
      fetch('/api/auth/me', { headers: getHeaders() }).then((r) => r.json()),
  },
  documents: {
    list: () =>
      apiFetch('/api/documents', { method: 'GET', headers: getHeaders() }).then(async (r) => {
        const data = await parseJson(r);
        if (!r.ok) throw new Error(data.error || 'Failed to list documents');
        return data;
      }),
    upload: (formData) =>
      apiFetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      }).then(async (r) => {
        const data = await parseJson(r);
        if (!r.ok) throw new Error(data.error || 'Failed to upload');
        return data;
      }),
    addText: (title, content) =>
      apiFetch('/api/documents/text', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title, content }),
      }).then(async (r) => {
        const data = await parseJson(r);
        if (!r.ok) throw new Error(data.error || 'Failed to add content');
        return data;
      }),
    delete: (id) =>
      apiFetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      }).then((r) => parseJson(r)),
  },
  chat: {
    message: (message, sessionId) =>
      fetch('/api/chat/message', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, sessionId }),
      }).then((r) => r.json()),
    stream: (message, sessionId, onChunk, onDone) => {
      return fetch('/api/chat/stream', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, sessionId }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await parseJson(res).catch(() => ({}));
          onDone?.({ error: err?.error || 'Failed to get response.' });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.error) onDone?.({ error: data.error });
                else if (data.done) onDone?.({ sessionId: data.sessionId });
                else if (data.text) onChunk?.(data.text);
              } catch (_) {}
            }
          }
        }
        if (buffer.trim() && buffer.startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.slice(6));
            if (data.done) onDone?.({ sessionId: data.sessionId });
          } catch (_) {}
        }
      });
    },
    sessions: () =>
      apiFetch('/api/chat/sessions', { headers: getHeaders() }).then(async (r) => {
        const data = await parseJson(r);
        return r.ok ? data : { sessions: [] };
      }),
    sessionMessages: (id) =>
      apiFetch(`/api/chat/sessions/${id}/messages`, { headers: getHeaders() }).then(async (r) => {
        const data = await parseJson(r);
        if (!r.ok) throw new Error(data.error || 'Failed to load messages');
        return data;
      }),
  },
};
