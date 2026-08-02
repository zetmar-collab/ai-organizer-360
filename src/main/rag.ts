import { getDb } from './db'
import { cosine, embedTexts, fromBlob, toBlob } from './ai/embeddings'
import { extractFile } from './extract'
import { getSettings } from './settings'
import type { KbDoc, KbHit } from '../shared/types'

const CHUNK = 1200
const OVERLAP = 200

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  const chunks: string[] = []
  let i = 0
  while (i < clean.length) {
    let end = Math.min(i + CHUNK, clean.length)
    if (end < clean.length) {
      // tniemy na granicy akapitu/zdania, zeby nie rozrywac kontekstu
      const window = clean.slice(i, end)
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'))
      if (cut > CHUNK * 0.5) end = i + cut + 1
    }
    const piece = clean.slice(i, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    i = Math.max(end - OVERLAP, i + 1)
  }
  return chunks
}

export interface IndexResult {
  docId: number
  title: string
  chunks: number
  chars: number
  mode: string
}

export async function indexText(title: string, source: string, kind: string, text: string): Promise<IndexResult> {
  const db = getDb()
  const chunks = chunkText(text)
  if (!chunks.length) throw new Error(`Dokument "${title}" nie zawiera tekstu do zaindeksowania.`)

  // ponowne indeksowanie tego samego zrodla nadpisuje poprzednia wersje
  const existing = db.get('SELECT id FROM kb_docs WHERE source = ?', [source]) as { id: number } | undefined
  if (existing) removeDoc(existing.id)

  const { vectors, mode } = await embedTexts(chunks)
  const info = db.run('INSERT INTO kb_docs (title, source, kind, chars, chunks) VALUES (?,?,?,?,?)', [
    title,
    source,
    kind,
    text.length,
    chunks.length
  ])
  const docId = Number(info.lastInsertRowid)

  db.run('BEGIN')
  try {
    for (let i = 0; i < chunks.length; i++) {
      db.run('INSERT INTO kb_chunks (docId, ord, text, dim, embedding) VALUES (?,?,?,?,?)', [
        docId,
        i,
        chunks[i],
        vectors[i].length,
        toBlob(vectors[i])
      ])
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }

  return { docId, title, chunks: chunks.length, chars: text.length, mode }
}

export async function indexFile(path: string): Promise<IndexResult> {
  const { title, text, kind } = await extractFile(path)
  return indexText(title, path, kind, text)
}

export async function search(query: string, topK?: number): Promise<KbHit[]> {
  const k = topK ?? getSettings().ragTopK
  const { vectors } = await embedTexts([query])
  const qv = vectors[0]
  const rows = getDb().all(
    `SELECT c.docId, c.ord, c.text, c.dim, c.embedding, d.title, d.source
     FROM kb_chunks c JOIN kb_docs d ON d.id = c.docId
     WHERE c.dim = ?`,
    [qv.length]
  ) as { docId: number; ord: number; text: string; dim: number; embedding: Uint8Array; title: string; source: string }[]

  const scored = rows.map((r) => ({
    docId: r.docId,
    docTitle: r.title,
    source: r.source,
    ord: r.ord,
    text: r.text,
    score: cosine(fromBlob(r.embedding), qv)
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

export function listDocs(): KbDoc[] {
  return getDb().all('SELECT * FROM kb_docs ORDER BY id DESC') as unknown as KbDoc[]
}

export function removeDoc(docId: number): { ok: true } {
  const db = getDb()
  db.run('DELETE FROM kb_chunks WHERE docId = ?', [docId])
  db.run('DELETE FROM kb_docs WHERE id = ?', [docId])
  return { ok: true }
}

export function buildContext(hits: KbHit[]): string {
  return hits
    .map((h, i) => `[${i + 1}] Zrodlo: ${h.docTitle} (fragment ${h.ord + 1})\n${h.text}`)
    .join('\n\n---\n\n')
}
