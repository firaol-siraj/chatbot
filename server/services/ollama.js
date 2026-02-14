const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.2';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

export async function isOllamaAvailable() {
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function ollamaEmbed(input) {
  const body = Array.isArray(input) ? { model: OLLAMA_EMBED_MODEL, input } : { model: OLLAMA_EMBED_MODEL, input: [input] };
  const r = await fetch(`${OLLAMA_HOST}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Ollama embed failed: ${r.status}`);
  }
  const data = await r.json();
  const embeddings = data.embeddings ?? (data.embedding ? [data.embedding] : []);
  return Array.isArray(input) ? embeddings : embeddings[0];
}

export async function ollamaChat(messages, systemPrompt, stream = false) {
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_CHAT_MODEL, messages: msgs, stream }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Ollama chat failed: ${r.status}`);
  }
  return r;
}

export async function* ollamaChatStream(messages, systemPrompt) {
  const msgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_CHAT_MODEL, messages: msgs, stream: true }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Ollama chat failed: ${r.status}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const piece = obj.message?.content;
        if (piece) yield piece;
      } catch (_) {}
    }
  }
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer);
      if (obj.message?.content) yield obj.message.content;
    } catch (_) {}
  }
}
