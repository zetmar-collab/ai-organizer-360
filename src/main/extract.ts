import { readFile } from 'fs/promises'
import { extname, basename } from 'path'

const PLAIN = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.log', '.html', '.htm', '.xml', '.yml', '.yaml'])

export interface Extracted {
  title: string
  text: string
  kind: string
}

/** Interop CJS/ESM - w zbudowanym pakiecie modul moze trafic pod .default. */
function unwrap<T>(mod: T): T {
  const m = mod as unknown as { default?: T }
  return m.default && typeof m.default === 'object' ? (m.default as T) : mod
}

async function extractPdf(path: string): Promise<string> {
  const pdfjs = unwrap(await import('pdfjs-dist/legacy/build/pdf.mjs'))
  const data = new Uint8Array(await readFile(path))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(line)
  }
  await doc.destroy()
  return parts.join('\n\n')
}

async function extractDocx(path: string): Promise<string> {
  const mammoth = unwrap(await import('mammoth'))
  const result = await mammoth.extractRawText({ path })
  return result.value
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Wyciaga tekst z pliku. Rzuca czytelny blad dla nieobslugiwanych formatow. */
export async function extractFile(path: string): Promise<Extracted> {
  const ext = extname(path).toLowerCase()
  const title = basename(path)

  if (ext === '.pdf') return { title, text: await extractPdf(path), kind: 'pdf' }
  if (ext === '.docx') return { title, text: await extractDocx(path), kind: 'docx' }
  if (PLAIN.has(ext)) {
    const raw = await readFile(path, 'utf8')
    const text = ext === '.html' || ext === '.htm' ? stripHtml(raw) : raw
    return { title, text, kind: ext.slice(1) }
  }
  throw new Error(
    `Nieobslugiwany format do indeksowania: ${ext || 'brak rozszerzenia'}. Obslugiwane: PDF, DOCX, TXT, MD, CSV, JSON, HTML.`
  )
}
