import express from 'express';
import multer from 'multer';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { extractTextFromBuffer, processDocument } from '../services/documentProcessor.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/html'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.txt') || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, and DOCX files are allowed.'), false);
    }
  },
});

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const docs = db.prepare(
      'SELECT id, filename, original_name, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json({ documents: docs });
  } catch (err) {
    console.error('List documents error:', err);
    res.status(500).json({ error: 'Failed to list documents.' });
  }
});

router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err?.message || 'File upload failed.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let text;
    try {
      text = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
    } catch (e) {
      return res.status(400).json({ error: e?.message || 'Could not extract text from file.' });
    }

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'File has insufficient text content.' });
    }

    const result = db.prepare(
      'INSERT INTO documents (user_id, filename, original_name, content) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, req.file.filename || req.file.originalname, req.file.originalname, text.slice(0, 15000));

    const documentId = result.lastInsertRowid;

    await processDocument(text, documentId, db);

    const doc = db.prepare('SELECT id, filename, original_name, created_at FROM documents WHERE id = ?').get(documentId);
    return res.status(201).json({ message: 'Document uploaded and processed.', document: doc });
  } catch (err) {
    console.error('Upload error:', err);
    let msg = String(
      err?.message ||
      err?.error?.message ||
      err?.toString?.()?.slice(0, 200) ||
      'Failed to upload document.'
    );
    if (msg.includes('API key') || msg.includes('401') || msg.includes('API_KEY')) {
      msg = 'Gemini API key is missing or invalid. Get a free key at aistudio.google.com/apikey';
    } else if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate')) {
      msg = 'Gemini API rate limit. Try a smaller file or wait 2 minutes, then try again.';
    }
    return res.status(500).json({ error: msg });
  }
});

router.post('/text', express.json(), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Content must be at least 10 characters.' });
    }

    const filename = (title || 'Untitled') + '.txt';
    const result = db.prepare(
      'INSERT INTO documents (user_id, filename, original_name, content) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, filename, filename, content);

    const documentId = result.lastInsertRowid;
    await processDocument(content, documentId, db);

    const doc = db.prepare('SELECT id, filename, original_name, created_at FROM documents WHERE id = ?').get(documentId);
    res.status(201).json({ message: 'Content added to knowledge base.', document: doc });
  } catch (err) {
    console.error('Add text error:', err);
    let msg = String(
      err?.message ||
      err?.error?.message ||
      err?.toString?.()?.slice(0, 200) ||
      'Failed to add content.'
    );
    if (msg.includes('API key') || msg.includes('401') || msg.includes('API_KEY')) {
      msg = 'Gemini API key is missing or invalid. Get a free key at aistudio.google.com/apikey';
    } else if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate')) {
      msg = 'Gemini API rate limit. Wait 2 minutes, then try again.';
    }
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT id, user_id FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    if (doc.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

    db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(doc.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
    res.json({ message: 'Document deleted.' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

export default router;
