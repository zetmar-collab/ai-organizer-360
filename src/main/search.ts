import { getDb } from './db'
import { search as knowledgeSearch } from './rag'
import type { KbHit, SearchHit, SearchModule } from '../shared/types'

const PER_TABLE = 6

const KIND_TO_MODULE: Record<string, SearchModule> = {
  document: 'documents',
  music: 'music',
  ebook: 'ebooks',
  photo: 'photos'
}

/**
 * Wyszukiwanie przez wszystkie moduly naraz. Wzorzec idzie wylacznie jako
 * parametr zapytania; nazwy tabel i kolumn sa tu wpisane na sztywno, wiec
 * nic z wejscia uzytkownika nie trafia do tresci SQL.
 */
export function globalSearch(term: string): SearchHit[] {
  const q = term.trim()
  if (q.length < 2) return []
  const like = `%${q}%`
  const db = getDb()
  const out: SearchHit[] = []

  const tasks = db.all(
    `SELECT id, title, notes, done, due FROM tasks
     WHERE title LIKE ? OR notes LIKE ? ORDER BY done, id DESC LIMIT ?`,
    [like, like, PER_TABLE]
  ) as { id: number; title: string; notes: string; done: number; due: string | null }[]
  for (const t of tasks) {
    out.push({
      module: 'tasks',
      id: t.id,
      title: t.title,
      subtitle: (t.done ? 'ukonczone' : 'otwarte') + (t.due ? ' • termin ' + t.due : ''),
      term: q
    })
  }

  const notes = db.all(
    `SELECT id, title, body, updatedAt FROM notes
     WHERE title LIKE ? OR body LIKE ? OR tags LIKE ? ORDER BY id DESC LIMIT ?`,
    [like, like, like, PER_TABLE]
  ) as { id: number; title: string; body: string; updatedAt: string }[]
  for (const n of notes) {
    out.push({
      module: 'notes',
      id: n.id,
      title: n.title || '(bez tytulu)',
      subtitle: (n.body || '').replace(/\s+/g, ' ').slice(0, 90),
      term: q
    })
  }

  const events = db.all(
    `SELECT id, title, start, location FROM events
     WHERE title LIKE ? OR notes LIKE ? OR location LIKE ? ORDER BY start DESC LIMIT ?`,
    [like, like, like, PER_TABLE]
  ) as { id: number; title: string; start: string; location: string }[]
  for (const e of events) {
    out.push({
      module: 'calendar',
      id: e.id,
      title: e.title,
      subtitle: e.start.slice(0, 16).replace('T', ' ') + (e.location ? ' • ' + e.location : ''),
      date: e.start.slice(0, 10),
      term: q
    })
  }

  const projects = db.all(
    `SELECT id, name, description, status FROM projects
     WHERE name LIKE ? OR description LIKE ? ORDER BY id DESC LIMIT ?`,
    [like, like, PER_TABLE]
  ) as { id: number; name: string; description: string; status: string }[]
  for (const p of projects) {
    out.push({ module: 'projects', id: p.id, title: p.name, subtitle: p.description || p.status, term: q })
  }

  const files = db.all(
    `SELECT id, kind, name, path, category FROM files
     WHERE name LIKE ? OR category LIKE ? OR tags LIKE ? ORDER BY id DESC LIMIT ?`,
    [like, like, like, PER_TABLE * 2]
  ) as { id: number; kind: string; name: string; path: string; category: string }[]
  for (const f of files) {
    out.push({
      module: KIND_TO_MODULE[f.kind] ?? 'documents',
      id: f.id,
      title: f.name,
      subtitle: f.category ? f.category + ' • ' + f.path : f.path,
      term: q
    })
  }

  const audiobooks = db.all(
    `SELECT id, title, author, path, tracks FROM audiobooks
     WHERE title LIKE ? OR author LIKE ? OR category LIKE ? ORDER BY title COLLATE NOCASE LIMIT ?`,
    [like, like, like, PER_TABLE]
  ) as { id: number; title: string; author: string; path: string; tracks: number }[]
  for (const a of audiobooks) {
    out.push({
      module: 'audiobooks',
      id: a.id,
      title: a.title,
      subtitle: (a.author ? a.author + ' • ' : '') + (a.tracks === 1 ? '1 plik' : a.tracks + ' plikow'),
      term: q
    })
  }

  const tx = db.all(
    `SELECT id, description, category, amount, kind, date FROM transactions
     WHERE description LIKE ? OR category LIKE ? OR account LIKE ? ORDER BY date DESC LIMIT ?`,
    [like, like, like, PER_TABLE]
  ) as { id: number; description: string; category: string; amount: number; kind: string; date: string }[]
  for (const t of tx) {
    out.push({
      module: 'finance',
      id: t.id,
      title: t.description || t.category || 'transakcja',
      subtitle: (t.kind === 'income' ? '+' : '-') + t.amount.toFixed(2) + ' PLN • ' + t.date,
      term: q
    })
  }

  return out
}

/** Baza wiedzy odpowiada osobno - liczenie embeddingu trwa dluzej niz LIKE. */
export async function globalKnowledge(term: string): Promise<KbHit[]> {
  if (term.trim().length < 3) return []
  try {
    return await knowledgeSearch(term, 4)
  } catch {
    return []
  }
}
