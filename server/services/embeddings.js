import { GoogleGenAI } from '@google/genai';
import { withRetry } from '../utils/retry.js';
import { isOllamaAvailable, ollamaEmbed } from './ollama.js';

const useOllama = process.env.USE_OLLAMA === 'true' || process.env.USE_OLLAMA === '1';
let ollamaChecked = false;
let ollamaAvailable = false;

async function checkOllama() {
  if (!ollamaChecked) {
    ollamaChecked = true;
    ollamaAvailable = useOllama && (await isOllamaAvailable());
  }
  return ollamaAvailable;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getEmbedding(text) {
  const input = text.replace(/\n/g, ' ').slice(0, 8000);
  if (await checkOllama()) {
    return ollamaEmbed(input);
  }
  const response = await withRetry(() =>
    ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: input,
    })
  );
  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) throw new Error('No embedding returned from Gemini');
  return embedding;
}

export async function getEmbeddingsBatch(texts) {
  if (texts.length === 0) return [];
  const inputs = texts.map((t) => t.replace(/\n/g, ' ').slice(0, 8000));
  if (await checkOllama()) {
    return ollamaEmbed(inputs);
  }
  const response = await withRetry(() =>
    ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: inputs,
    })
  );
  const embeddings = (response.embeddings || []).map((e) => e?.values).filter(Boolean);
  if (embeddings.length !== texts.length) throw new Error('Embedding count mismatch');
  return embeddings;
}

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
