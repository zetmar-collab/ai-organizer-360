import { readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { shell } from 'electron'
import { getDb } from './db'
import type { Audiobook, AudiobookTrack } from '../shared/types'

/** m4b to natywny format audiobooka, reszta to zwykle pliki audio. */
const AUDIO_EXT = ['.mp3', '.m4b', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wav', '.wma']

const MAX_DEPTH = 4

export interface AddResult {
  added: number
  skipped: number
  titles: string[]
}

function isAudio(name: string): boolean {
  return AUDIO_EXT.includes(extname(name).toLowerCase())
}

/** Zbiera pliki audio z katalogu i jego podkatalogow, posortowane naturalnie. */
async function collectTracks(dir: string, depth = 0): Promise<{ path: string; name: string; bytes: number }[]> {
  if (depth > MAX_DEPTH) return []
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const out: { path: string; name: string; bytes: number }[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue
      out.push(...(await collectTracks(full, depth + 1)))
    } else if (isAudio(entry.name)) {
      const info = await stat(full).catch(() => null)
      out.push({ path: full, name: entry.name, bytes: info?.size ?? 0 })
    }
  }
  // "02" przed "10" - zwykle sortowanie tekstowe ustawiloby odwrotnie
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }))
}

function insertBook(
  title: string,
  source: 'folder' | 'file',
  path: string,
  tracks: { path: string; name: string; bytes: number }[]
): number | null {
  const db = getDb()
  const exists = db.get('SELECT id FROM audiobooks WHERE path = ?', [path]) as { id: number } | undefined
  if (exists) return null

  const bytes = tracks.reduce((sum, t) => sum + t.bytes, 0)
  db.run('BEGIN')
  try {
    const info = db.run('INSERT INTO audiobooks (title, source, path, tracks, bytes) VALUES (?,?,?,?,?)', [
      title,
      source,
      path,
      tracks.length,
      bytes
    ])
    const bookId = Number(info.lastInsertRowid)
    tracks.forEach((t, i) => {
      db.run('INSERT INTO audiobook_tracks (bookId, ord, name, path, bytes) VALUES (?,?,?,?,?)', [
        bookId,
        i,
        t.name,
        t.path,
        t.bytes
      ])
    })
    db.run('COMMIT')
    return bookId
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
}

/**
 * Kazdy podkatalog wskazanego katalogu to JEDEN audiobook, nawet jesli zawiera
 * kilkadziesiat plikow mp3. Pliki lezace luzem w katalogu nadrzednym sa
 * pomijane - do nich sluzy dodawanie pojedynczych plikow.
 */
export async function addFromParent(parent: string): Promise<AddResult> {
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(parent, { withFileTypes: true })
  } catch (e) {
    throw new Error(`Nie udalo sie odczytac katalogu: ${(e as Error).message}`)
  }

  const result: AddResult = { added: 0, skipped: 0, titles: [] }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = join(parent, entry.name)
    const tracks = await collectTracks(dir)
    if (!tracks.length) continue

    const id = insertBook(entry.name, 'folder', dir, tracks)
    if (id) {
      result.added++
      result.titles.push(entry.name)
    } else {
      result.skipped++
    }
  }
  return result
}

/** Wskazany katalog jako jeden audiobook. */
export async function addFolder(dir: string): Promise<AddResult> {
  const tracks = await collectTracks(dir)
  if (!tracks.length) throw new Error(`W katalogu "${basename(dir)}" nie ma plikow audio.`)

  const id = insertBook(basename(dir), 'folder', dir, tracks)
  return id
    ? { added: 1, skipped: 0, titles: [basename(dir)] }
    : { added: 0, skipped: 1, titles: [] }
}

/** Kazdy wskazany plik to osobny audiobook (typowo jeden plik .m4b). */
export async function addFiles(paths: string[]): Promise<AddResult> {
  const result: AddResult = { added: 0, skipped: 0, titles: [] }
  for (const path of paths) {
    if (!isAudio(path)) {
      result.skipped++
      continue
    }
    const info = await stat(path).catch(() => null)
    const name = basename(path)
    const title = name.replace(/\.[^.]+$/, '')
    const id = insertBook(title, 'file', path, [{ path, name, bytes: info?.size ?? 0 }])
    if (id) {
      result.added++
      result.titles.push(title)
    } else {
      result.skipped++
    }
  }
  return result
}

export function listBooks(search = ''): Audiobook[] {
  const term = search.trim()
  if (!term) {
    return getDb().all('SELECT * FROM audiobooks ORDER BY title COLLATE NOCASE') as unknown as Audiobook[]
  }
  return getDb().all(
    'SELECT * FROM audiobooks WHERE title LIKE ? OR author LIKE ? OR path LIKE ? ORDER BY title COLLATE NOCASE',
    [`%${term}%`, `%${term}%`, `%${term}%`]
  ) as unknown as Audiobook[]
}

export function listTracks(bookId: number): AudiobookTrack[] {
  return getDb().all('SELECT * FROM audiobook_tracks WHERE bookId = ? ORDER BY ord', [
    bookId
  ]) as unknown as AudiobookTrack[]
}

export function removeBook(id: number): { ok: true } {
  const db = getDb()
  db.run('DELETE FROM audiobook_tracks WHERE bookId = ?', [id])
  db.run('DELETE FROM audiobooks WHERE id = ?', [id])
  return { ok: true }
}

export function updateBook(id: number, patch: { title?: string; author?: string; category?: string }): Audiobook {
  const db = getDb()
  const fields = ['title', 'author', 'category'] as const
  for (const f of fields) {
    if (patch[f] !== undefined) db.run(`UPDATE audiobooks SET ${f} = ? WHERE id = ?`, [String(patch[f]), id])
  }
  return db.get('SELECT * FROM audiobooks WHERE id = ?', [id]) as unknown as Audiobook
}

/** Otwiera pierwszy utwor audiobooka w domyslnym odtwarzaczu. */
export async function playBook(id: number): Promise<{ ok: boolean; error?: string }> {
  const first = getDb().get('SELECT path FROM audiobook_tracks WHERE bookId = ? ORDER BY ord LIMIT 1', [id]) as
    | { path: string }
    | undefined
  if (!first) return { ok: false, error: 'Ten audiobook nie ma zadnych plikow.' }
  const error = await shell.openPath(first.path)
  return error ? { ok: false, error } : { ok: true }
}

export async function openTrack(path: string): Promise<{ ok: boolean; error?: string }> {
  const error = await shell.openPath(path)
  return error ? { ok: false, error } : { ok: true }
}

export function revealBook(id: number): { ok: true } {
  const book = getDb().get('SELECT path, source FROM audiobooks WHERE id = ?', [id]) as
    | { path: string; source: string }
    | undefined
  if (book) {
    if (book.source === 'file') shell.showItemInFolder(book.path)
    else void shell.openPath(book.path)
  }
  return { ok: true }
}
