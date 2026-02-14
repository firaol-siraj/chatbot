import pdfParse from 'pdf-parse';
import { getEmbeddingsBatch } from './embeddings.js';

const CHUNK_SIZE = 800;
const BATCH_SIZE = 5;
const CHUNK_OVERLAP = 50;
const MAX_CHUNKS = 15;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let chunk = text.slice(start, end);
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > CHUNK_SIZE / 2) {
        chunk = chunk.slice(0, lastSpace + 1);
        start += lastSpace + 1 - CHUNK_OVERLAP;
      } else {
        start = end - CHUNK_OVERLAP;
      }
    } else {
      start = text.length;
    }
    if (chunk.trim().length > 20) chunks.push(chunk.trim());
  }
  return chunks;
}

export async function extractTextFromBuffer(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      const data = await Promise.race([
        pdfParse(buffer),
        new Promise((_, rej) => setTimeout(() => rej(new Error('PDF parsing timed out')), 30000)),
      ]);
      const text = data?.text?.trim() || '';
      if (text.length < 10) throw new Error('PDF has no extractable text (may be scanned/image)');
      return text;
    } catch (e) {
      throw new Error(e?.message || 'Could not read PDF');
    }
  }
  return buffer.toString('utf-8');
}

export async function processDocument(text, documentId, db) {
  const allChunks = chunkText(text);
  const chunks = allChunks.slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return 0;

  const insertSql = 'INSERT INTO document_chunks (document_id, content, embedding) VALUES (?, ?, ?)';

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await getEmbeddingsBatch(batch);
    for (let j = 0; j < batch.length; j++) {
      db.prepare(insertSql).run(documentId, batch[j], JSON.stringify(embeddings[j]));
    }
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return chunks.length;
}
