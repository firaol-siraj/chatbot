import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'chatbot.db');

let sqlite = null;
let rawDb = null;
let db = null;

function save() {
  if (rawDb) {
    const data = rawDb.export();
    writeFileSync(dbPath, Buffer.from(data));
  }
}

function wrapDb(rawDb) {
  return {
    prepare: (sql) => {
      const stmt = rawDb.prepare(sql);
      return {
        run: (...args) => {
          if (args.length > 0) {
            const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
              ? args[0]
              : args;
            stmt.bind(Array.isArray(params) ? params : Object.values(params));
          }
          stmt.step();
          stmt.free();
          const changes = rawDb.getRowsModified();
          const res = rawDb.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = res[0]?.values?.[0]?.[0] ?? 0;
          save();
          return { changes, lastInsertRowid };
        },
        get: (...args) => {
          if (args.length > 0) {
            const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
              ? args[0]
              : args;
            stmt.bind(Array.isArray(params) ? params : Object.values(params));
          }
          const hasRow = stmt.step();
          const row = hasRow ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        all: (...args) => {
          if (args.length > 0) {
            const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
              ? args[0]
              : args;
            stmt.bind(Array.isArray(params) ? params : Object.values(params));
          }
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    exec: (sql) => {
      rawDb.exec(sql);
      save();
    },
  };
}

export async function initDb() {
  if (db) return db;
  sqlite = await initSqlJs();
  let buffer = null;
  if (existsSync(dbPath)) {
    buffer = readFileSync(dbPath);
  }
  rawDb = new sqlite.Database(buffer);
  db = wrapDb(rawDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT DEFAULT 'New Chat',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      UNIQUE(provider, provider_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_id);
  `);

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

const dbProxy = new Proxy({}, {
  get(_, prop) {
    return getDb()[prop];
  },
});

export default dbProxy;
