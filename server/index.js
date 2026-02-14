import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import documentRoutes from './routes/documents.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
})();
