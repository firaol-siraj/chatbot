import express from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getEmbedding, cosineSimilarity } from '../services/embeddings.js';
import { isOllamaAvailable, ollamaChat, ollamaChatStream } from '../services/ollama.js';
import { withRetry } from '../utils/retry.js';
import { DEFAULT_WEBSITE_CONTEXT } from '../config/websiteContent.js';

const router = express.Router();

// Require auth so req.user is always set (fixes "Cannot read properties of undefined (reading 'id')")
router.use(authenticateToken);

const useOllama = process.env.USE_OLLAMA === 'true' || process.env.USE_OLLAMA === '1';
let ollamaChecked = false;
let ollamaAvailable = false;

function resetOllamaCheck() {
  ollamaChecked = false;
  ollamaAvailable = false;
}

async function useOllamaForChat() {
  if (!useOllama) return false;
  if (!ollamaChecked) {
    ollamaChecked = true;
    ollamaAvailable = await isOllamaAvailable();
  }
  return ollamaAvailable;
}

function isGeminiRateLimit(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || err?.status === 429;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'; // gemini-1.5-flash is deprecated (404)

const SIMILARITY_THRESHOLD = 0.15;
const TOP_K = 10;

async function getRelevantChunks(query, userId, topK = TOP_K) {
  const chunks = db.prepare(`
    SELECT dc.id, dc.content, dc.embedding, dc.document_id
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE d.user_id = ?
  `).all(userId);

  if (!chunks || chunks.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);
  const scored = chunks
    .filter((c) => c != null)
    .map((c) => {
      const content = c.content;
      const emb = c.embedding;
      let vec = [];
      try {
        vec = typeof emb === 'string' ? JSON.parse(emb || '[]') : (Array.isArray(emb) ? emb : []);
      } catch {
        vec = [];
      }
      return { content, score: cosineSimilarity(queryEmbedding, vec) };
    })
    .filter((c) => c.content && c.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((c) => c.content);
}

function toGeminiContents(messages) {
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: m.content }] });
  }
  return contents;
}

function toOllamaMessages(messages) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

router.post('/message', express.json(), async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    let sessionIdNum = sessionId ? parseInt(sessionId, 10) : null;
    if (sessionId && (!sessionIdNum || isNaN(sessionIdNum))) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }

    let session;
    if (sessionIdNum) {
      session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').get(sessionIdNum, req.user.id);
    }
    if (!session) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      const r = db.prepare('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)').run(req.user.id, title);
      sessionIdNum = r.lastInsertRowid;
      session = { id: sessionIdNum, user_id: req.user.id };
    }

    let contextChunks = [];
    try {
      contextChunks = await getRelevantChunks(message, req.user.id);
    } catch (embErr) {
      console.error('Embedding/retrieval error (continuing with empty context):', embErr);
    }
    const docContext = contextChunks.length > 0
      ? contextChunks.join('\n\n---\n\n')
      : '';
    const hasDocContext = docContext.length > 0;
    const context = hasDocContext
      ? `Content from the user's uploaded documents (PDF/text):\n\n${docContext}`
      : `No relevant content from uploaded documents. Use only this fallback:${DEFAULT_WEBSITE_CONTEXT}`;

    const systemInstruction = hasDocContext
      ? `You are a RAG assistant. Answer ONLY from the context below (the user's uploaded PDF/documents). Do NOT use external knowledge.

STRICT RULES:
1. Answer ONLY using the provided context. Every fact in your response must come from the context.
2. If the context does NOT contain the answer, respond: "I don't have that information in your uploaded documents."
3. Be concise and accurate. Quote or paraphrase from the context when possible.
4. Do not make up information or use general knowledge.

Context:
${context}`
      : `You are a RAG assistant. No relevant document content was found. Use only the fallback below for site/service questions. Otherwise say: "I couldn't find relevant information in your documents. Please upload a PDF or rephrase your question."

Context:
${context}`;

    const messages = [];
    const history = db.prepare(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20'
    ).all(session.id);
    for (const m of history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: 'user', content: message });

    db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(session.id, 'user', message);

    let assistantContent;
    try {
      if (await useOllamaForChat()) {
        const r = await ollamaChat(toOllamaMessages(messages), systemInstruction, false);
        const data = await r.json();
        assistantContent = data.message?.content || 'Sorry, I could not generate a response.';
      } else {
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: CHAT_MODEL,
            contents: toGeminiContents(messages),
            config: { systemInstruction },
          })
        );
        assistantContent = response?.text || 'Sorry, I could not generate a response.';
      }
    } catch (genErr) {
      if (isGeminiRateLimit(genErr)) {
        resetOllamaCheck();
        const ollamaOk = await isOllamaAvailable();
        if (ollamaOk) {
          const r = await ollamaChat(toOllamaMessages(messages), systemInstruction, false);
          const data = await r.json();
          assistantContent = data.message?.content || 'Sorry, I could not generate a response.';
        } else {
          throw genErr;
        }
      } else {
        throw genErr;
      }
    }

    db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(session.id, 'assistant', assistantContent);

    res.json({
      response: assistantContent,
      sessionId: session.id,
    });
  } catch (err) {
    console.error('Chat error:', err);
    const raw = err?.error?.message || err?.message || (typeof err?.toString === 'function' ? err.toString() : '') || '';
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
    let msg = 'Failed to get response.';
    if (rawStr.includes('API key') || rawStr.includes('401') || rawStr.includes('API_KEY') || rawStr.includes('invalid')) {
      msg = 'Gemini API key is missing or invalid. Get a free key at aistudio.google.com/apikey';
    } else if (rawStr.includes('quota') || rawStr.includes('429') || rawStr.includes('RESOURCE_EXHAUSTED') || rawStr.includes('rate limit')) {
      msg = useOllama
        ? 'Gemini rate limit and Ollama is not running. Start Ollama: run "ollama serve" then "ollama pull llama3.2" and "ollama pull nomic-embed-text".'
        : 'Gemini rate limit or quota exceeded. Try again later, or set USE_OLLAMA=true and run Ollama locally.';
    } else if (rawStr.length > 0) {
      msg = rawStr.length > 300 ? rawStr.slice(0, 300) + '...' : rawStr;
    }
    res.status(500).json({ error: msg });
  }
});

router.post('/stream', express.json(), async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    let sessionIdNum = sessionId ? parseInt(sessionId, 10) : null;
    if (sessionId && (!sessionIdNum || isNaN(sessionIdNum))) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }

    let session;
    if (sessionIdNum) {
      session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').get(sessionIdNum, req.user.id);
    }
    if (!session) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      const r = db.prepare('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)').run(req.user.id, title);
      sessionIdNum = r.lastInsertRowid;
      session = { id: sessionIdNum, user_id: req.user.id };
    }

    db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(session.id, 'user', message);

    let contextChunks = [];
    try {
      contextChunks = await getRelevantChunks(message, req.user.id);
    } catch (embErr) {
      console.error('Embedding/retrieval error (continuing with empty context):', embErr);
    }
    const docContext = contextChunks.length > 0
      ? contextChunks.join('\n\n---\n\n')
      : '';
    const hasDocContext = docContext.length > 0;
    const context = hasDocContext
      ? `Content from the user's uploaded documents (PDF/text):\n\n${docContext}`
      : `No relevant content from uploaded documents. Use only this fallback:${DEFAULT_WEBSITE_CONTEXT}`;

    const systemInstruction = hasDocContext
      ? `You are a RAG assistant. Answer ONLY from the context below (the user's uploaded PDF/documents). Do NOT use external knowledge.

STRICT RULES:
1. Answer ONLY using the provided context. Every fact in your response must come from the context.
2. If the context does NOT contain the answer, respond: "I don't have that information in your uploaded documents."
3. Be concise and accurate. Quote or paraphrase from the context when possible.
4. Do not make up information or use general knowledge.

Context:
${context}`
      : `You are a RAG assistant. No relevant document content was found. Use only the fallback below for site/service questions. Otherwise say: "I couldn't find relevant information in your documents. Please upload a PDF or rephrase your question."

Context:
${context}`;

    const messages = [];
    const history = db.prepare(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20'
    ).all(session.id);
    for (const m of history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: 'user', content: message });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullContent = '';
    let streamDone = false;

    async function runStream() {
      if (await useOllamaForChat()) {
        for await (const delta of ollamaChatStream(toOllamaMessages(messages), systemInstruction)) {
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        }
      } else {
        const stream = await withRetry(() =>
          ai.models.generateContentStream({
            model: CHAT_MODEL,
            contents: toGeminiContents(messages),
            config: { systemInstruction },
          })
        );
        for await (const chunk of stream) {
          const delta = chunk?.text || '';
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        }
      }
      streamDone = true;
    }

    try {
      await runStream();
    } catch (streamErr) {
      if (!streamDone && isGeminiRateLimit(streamErr)) {
        resetOllamaCheck();
        const ollamaOk = await isOllamaAvailable();
        if (ollamaOk) {
          for await (const delta of ollamaChatStream(toOllamaMessages(messages), systemInstruction)) {
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            }
          }
        } else {
          throw streamErr;
        }
      } else {
        throw streamErr;
      }
    }

    db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(session.id, 'assistant', fullContent);

    res.write(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Stream chat error:', err);
    const raw = err?.error?.message || err?.message || (typeof err?.toString === 'function' ? err.toString() : '') || '';
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
    let msg = 'Failed to get response.';
    if (rawStr.includes('API key') || rawStr.includes('401') || rawStr.includes('API_KEY') || rawStr.includes('invalid')) {
      msg = 'Gemini API key is missing or invalid. Get a free key at aistudio.google.com/apikey';
    } else if (rawStr.includes('quota') || rawStr.includes('429') || rawStr.includes('RESOURCE_EXHAUSTED') || rawStr.includes('rate limit')) {
      msg = useOllama
        ? 'Gemini rate limit and Ollama is not running. Start Ollama: run "ollama serve" then "ollama pull llama3.2" and "ollama pull nomic-embed-text".'
        : 'Gemini rate limit or quota exceeded. Try again later, or set USE_OLLAMA=true and run Ollama locally.';
    } else if (rawStr.length > 0) {
      msg = rawStr.length > 300 ? rawStr.slice(0, 300) + '...' : rawStr;
    }
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

router.get('/sessions', (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ sessions: [] });
  const rows = db.prepare(
    'SELECT id, title, created_at FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
  const sessions = (rows || []).map((r) => (r && { id: r.id, title: r.title || 'Chat', created_at: r.created_at })).filter(Boolean);
  res.json({ sessions });
});

router.get('/sessions/:id/messages', (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  const messages = db.prepare(
    'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(session.id);
  res.json({ messages });
});

export default router;
