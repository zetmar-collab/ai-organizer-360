import { readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import { shell } from 'electron'
import { getDb } from './db'
import type { LibraryKind } from '../shared/types'

const EXTENSIONS: Record<LibraryKind, string[]> = {
  document: ['.pdf', '.docx', '.doc', '.odt', '.rtf', '.txt', '.md', '.csv', '.xlsx', '.pptx'],
  music: ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.opus'],
  ebook: ['.epub', '.mobi', '.azw', '.azw3', '.fb2', '.djvu', '.pdf'],
  photo: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic', '.cr2', '.nef', '.dng']
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'AppData', 'Windows', '$RECYCLE.BIN', 'System Volume Information'])
const MAX_DEPTH = 6

export interface ScanResult {
  scanned: number
  added: number
  updated: number
  folder: string
}

async function walk(dir: string, exts: string[], depth: number, out: string[]): Promise<void> {
  if (depth > MAX_DEPTH) return
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return // brak uprawnien - pomijamy katalog
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
      await walk(full, exts, depth + 1, out)
    } else if (exts.includes(extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
}

export async function scanFolder(kind: LibraryKind, folder: string): Promise<ScanResult> {
  const exts = EXTENSIONS[kind]
  if (!exts) throw new Error(`Nieznany typ biblioteki: ${kind}`)
  const paths: string[] = []
  await walk(folder, exts, 0, paths)

  const db = getDb()
  let added = 0
  let updated = 0
  db.run('BEGIN')
  try {
    for (const path of paths) {
      const st = await stat(path)
      const existing = db.get('SELECT id FROM files WHERE path = ?', [path]) as { id: number } | undefined
      const row = [
        kind,
        path,
        basename(path),
        extname(path).toLowerCase().slice(1),
        st.size,
        new Date(st.mtimeMs).toISOString()
      ]
      if (existing) {
        db.run('UPDATE files SET kind=?, path=?, name=?, ext=?, size=?, mtime=? WHERE id=?', [...row, existing.id])
        updated++
      } else {
        db.run('INSERT INTO files (kind, path, name, ext, size, mtime) VALUES (?,?,?,?,?,?)', row)
        added++
      }
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }

  return { scanned: paths.length, added, updated, folder }
}

export async function openFile(path: string): Promise<{ ok: boolean; error?: string }> {
  const error = await shell.openPath(path)
  return error ? { ok: false, error } : { ok: true }
}

export function revealFile(path: string): { ok: true } {
  shell.showItemInFolder(path)
  return { ok: true }
}

export function libraryStats(kind: LibraryKind): { count: number; bytes: number; categories: { category: string; n: number }[] } {
  const db = getDb()
  const agg = db.get('SELECT COUNT(*) as count, COALESCE(SUM(size),0) as bytes FROM files WHERE kind = ?', [kind]) as {
    count: number
    bytes: number
  }
  const categories = db.all(
    "SELECT COALESCE(NULLIF(category,''),'(bez kategorii)') as category, COUNT(*) as n FROM files WHERE kind = ? GROUP BY category ORDER BY n DESC",
    [kind]
  ) as { category: string; n: number }[]
  return { ...agg, categories }
}
