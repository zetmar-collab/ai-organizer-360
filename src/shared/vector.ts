export const LEX_DIM = 512

/**
 * Tokenizacja pod tryb leksykalny. Kolejnosc krokow jest istotna: po NFD znaki
 * diakrytyczne sa osobnymi znakami laczacymi i trzeba je USUNAC, zanim filtr
 * zamieni reszte na spacje. Inaczej "zazolc" rozpada sie na kawalki i polskie
 * slowa nigdy nie trafiaja do indeksu.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // litery przekreslone (l z kreska, o z kreska) nie rozkladaja sie pod NFD
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function normalize(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const n = Math.sqrt(sum)
  return n > 0 ? v.map((x) => x / n) : v
}

/**
 * Awaryjny embedding leksykalny (hashing trick na slowach i 4-gramach).
 * Uzywany, gdy Ollama nie jest dostepna - wyszukiwanie dziala wtedy slabiej
 * niz semantyczne, ale aplikacja nie przestaje dzialac.
 */
export function lexicalEmbed(text: string): number[] {
  const vec = new Array<number>(LEX_DIM).fill(0)
  for (const t of tokenize(text)) {
    vec[hash(t) % LEX_DIM] += 1
    for (let i = 0; i + 4 <= t.length; i++) {
      vec[hash(t.slice(i, i + 4)) % LEX_DIM] += 0.5
    }
  }
  return normalize(vec)
}

export function cosine(a: Float32Array, b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < len; i++) dot += a[i] * b[i]
  return dot
}

export function toBlob(vec: number[]): Uint8Array {
  const f = new Float32Array(vec)
  return new Uint8Array(f.buffer, f.byteOffset, f.byteLength)
}

export function fromBlob(blob: Uint8Array): Float32Array {
  const copy = new Uint8Array(blob.byteLength)
  copy.set(blob)
  return new Float32Array(copy.buffer)
}
