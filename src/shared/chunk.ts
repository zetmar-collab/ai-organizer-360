export const CHUNK_SIZE = 1200
export const CHUNK_OVERLAP = 200

/**
 * Dzieli tekst na fragmenty do indeksowania. Ciecie idzie po granicy akapitu
 * albo zdania, zeby nie rozrywac kontekstu w polowie mysli; kolejny fragment
 * zachodzi na poprzedni o CHUNK_OVERLAP znakow, zeby zdanie na styku nie
 * wypadlo z obu.
 *
 * Czysta funkcja bez zaleznosci - testowana w test/chunk.test.ts.
 */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []

  const chunks: string[] = []
  let i = 0
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length)
    if (end < clean.length) {
      const window = clean.slice(i, end)
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'))
      if (cut > size * 0.5) end = i + cut + 1
    }
    const piece = clean.slice(i, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    i = Math.max(end - overlap, i + 1)
  }
  return chunks
}
