import { Database } from 'node-sqlite3-wasm'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { CrudQuery, TableName } from '../shared/types'
import { TABLES } from '../shared/types'

let db: Database

export function dbFile(): string {
  const dir = join(app.getPath('userData'), 'data')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'organizer.db')
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  color TEXT DEFAULT '#6ea8fe',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  allDay INTEGER DEFAULT 0,
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  projectId INTEGER,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 1,
  due TEXT,
  notes TEXT DEFAULT '',
  projectId INTEGER,
  createdAt TEXT DEFAULT (datetime('now')),
  completedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  projectId INTEGER,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ext TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  mtime TEXT DEFAULT '',
  category TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  addedAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_kind ON files(kind);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  kind TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  account TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT 'Nowa rozmowa',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON chat_messages(sessionId);

CREATE TABLE IF NOT EXISTS kb_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT DEFAULT '',
  chars INTEGER DEFAULT 0,
  chunks INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  docId INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  text TEXT NOT NULL,
  dim INTEGER NOT NULL,
  embedding BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunk_doc ON kb_chunks(docId);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

/** Kolumny dozwolone do zapisu przez generyczne CRUD (whitelist bezpieczenstwa). */
const WRITABLE: Record<TableName, string[]> = {
  projects: ['name', 'description', 'status', 'color'],
  events: ['title', 'start', 'end', 'allDay', 'location', 'notes', 'projectId'],
  tasks: ['title', 'done', 'priority', 'due', 'notes', 'projectId', 'completedAt'],
  notes: ['title', 'body', 'tags', 'projectId', 'updatedAt'],
  files: ['kind', 'path', 'name', 'ext', 'size', 'mtime', 'category', 'tags'],
  transactions: ['date', 'amount', 'kind', 'category', 'description', 'account'],
  chat_sessions: ['title'],
  chat_messages: ['sessionId', 'role', 'content']
}

export type SqlValue = string | number | null | Uint8Array

export function initDb(): Database {
  db = new Database(dbFile())
  db.exec(SCHEMA)
  return db
}

export function getDb(): Database {
  if (!db) initDb()
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = undefined as unknown as Database
  }
}

/** node-sqlite3-wasm nie przyjmuje boolean/undefined - normalizujemy. */
function norm(v: unknown): SqlValue {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Uint8Array) return v
  if (typeof v === 'number' || typeof v === 'string') return v
  return String(v)
}

function assertTable(table: string): TableName {
  if (!(TABLES as readonly string[]).includes(table)) throw new Error(`Nieznana tabela: ${table}`)
  return table as TableName
}

function pick(table: TableName, data: Record<string, unknown>): Record<string, SqlValue> {
  const allowed = WRITABLE[table]
  const out: Record<string, SqlValue> = {}
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k)) out[k] = norm(v)
  }
  return out
}

export const crud = {
  list(table: string, q: CrudQuery = {}): unknown[] {
    const t = assertTable(table)
    const clauses: string[] = []
    const params: SqlValue[] = []
    if (q.where) {
      for (const [k, v] of Object.entries(q.where)) {
        if (!WRITABLE[t].includes(k) && k !== 'id') continue
        if (v === null) clauses.push(`${k} IS NULL`)
        else {
          clauses.push(`${k} = ?`)
          params.push(norm(v))
        }
      }
    }
    if (q.search && q.search.term.trim()) {
      const cols = q.search.columns.filter((c) => WRITABLE[t].includes(c))
      if (cols.length) {
        clauses.push(`(${cols.map((c) => `${c} LIKE ?`).join(' OR ')})`)
        cols.forEach(() => params.push(`%${q.search!.term}%`))
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const order =
      q.orderBy && /^[a-zA-Z_]+ (asc|desc)$/i.test(q.orderBy) ? `ORDER BY ${q.orderBy}` : 'ORDER BY id DESC'
    const limit = q.limit && Number.isInteger(q.limit) ? `LIMIT ${q.limit}` : ''
    return getDb().all(`SELECT * FROM ${t} ${where} ${order} ${limit}`, params)
  },

  get(table: string, id: number): unknown {
    const t = assertTable(table)
    return getDb().get(`SELECT * FROM ${t} WHERE id = ?`, [id])
  },

  create(table: string, data: Record<string, unknown>): unknown {
    const t = assertTable(table)
    const clean = pick(t, data)
    const keys = Object.keys(clean)
    if (!keys.length) throw new Error('Brak danych do zapisu')
    const sql = `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`
    const info = getDb().run(
      sql,
      keys.map((k) => clean[k])
    )
    return crud.get(t, Number(info.lastInsertRowid))
  },

  update(table: string, id: number, data: Record<string, unknown>): unknown {
    const t = assertTable(table)
    const clean = pick(t, data)
    const keys = Object.keys(clean)
    if (keys.length) {
      const sql = `UPDATE ${t} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`
      getDb().run(sql, [...keys.map((k) => clean[k]), id])
    }
    return crud.get(t, id)
  },

  remove(table: string, id: number): { ok: true } {
    const t = assertTable(table)
    getDb().run(`DELETE FROM ${t} WHERE id = ?`, [id])
    if (t === 'chat_sessions') getDb().run('DELETE FROM chat_messages WHERE sessionId = ?', [id])
    return { ok: true }
  }
}
