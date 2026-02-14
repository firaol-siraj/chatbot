import crypto from 'crypto';
import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db.js';

const router = express.Router();
const JWT_SECRET = (process.env.JWT_SECRET || 'default-dev-secret').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
const API_URL = (process.env.API_URL || `http://localhost:${process.env.PORT || 5050}`).trim().replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

function makeUsername(email, displayName, provider) {
  const base = displayName || email?.split('@')[0] || provider;
  const safe = String(base).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'user';
  let username = safe;
  let n = 0;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${safe}${++n}`;
  }
  return username;
}

async function findOrCreateOAuthUser(provider, providerId, email, displayName) {
  const oauth = db.prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_id = ?').get(provider, providerId);
  if (oauth) {
    return db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(oauth.user_id);
  }
  const existingByEmail = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : null;
  if (existingByEmail) {
    db.prepare('INSERT OR IGNORE INTO oauth_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)').run(existingByEmail.id, provider, providerId);
    return db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(existingByEmail.id);
  }
  const username = makeUsername(email, displayName, provider);
  const finalEmail = email || `${providerId}@${provider}.oauth.local`;
  const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const r = db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').run(finalEmail, username, password_hash);
  const newUser = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(r.lastInsertRowid);
  db.prepare('INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)').run(newUser.id, provider, providerId);
  return newUser;
}

function oauthCallback(provider) {
  return (req, res) => {
    const user = req.user;
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  };
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  const callbackURL = `${API_URL}/api/auth/google/callback`;
  console.log('Google OAuth: configured. Redirect URI must be:', callbackURL);
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile?.emails?.[0]?.value || null;
          const displayName = profile?.displayName || null;
          const user = await findOrCreateOAuthUser('google', profile.id, email, displayName);
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }), oauthCallback('google'));
}

export default router;
