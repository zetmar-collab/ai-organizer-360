import { getSettings } from '../settings'
import { OllamaProvider } from './ollama'

export type EmbedMode = 'ollama' | 'lexical'

const LEX_DIM = 512

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    // po NFD znaki diakrytyczne sa osobnymi znakami laczacymi i wypada je ponizszy filtr
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * Awaryjny embedding leksykalny (hashing trick na slowach i 4-gramach).
 * Uzywany, gdy Ollama nie jest dostepna - wyszukiwanie dziala wtedy
 * slabiej niz semantyczne, ale aplikacja nie przestaje dzialac.
 */
export function lexicalEmbed(text: string): number[] {
  const vec = new Array<number>(LEX_DIM).fill(0)
  const tokens = tokenize(text)
  for (const t of tokens) {
    vec[hash(t) % LEX_DIM] += 1
    for (let i = 0; i + 4 <= t.length; i++) {
      vec[hash(t.slice(i, i + 4)) % LEX_DIM] += 0.5
    }
  }
  return normalize(vec)
}

export function normalize(v: number[]): number[] {
  let sum = 0
  for (const x of v) sum += x * x
  const n = Math.sqrt(sum)
  return n > 0 ? v.map((x) => x / n) : v
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

/** Zwraca wektory i informacje, ktory tryb faktycznie zadzialal. */
export async function embedTexts(texts: string[]): Promise<{ vectors: number[][]; mode: EmbedMode }> {
  const settings = getSettings()

  // 1. dedykowany model embeddingow, 2. model czatu (Ollama embeduje dowolnym),
  // 3. tryb leksykalny offline - zeby baza wiedzy nigdy nie przestala dzialac
  const candidates = [settings.embedModel, settings.ollamaModel].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  )

  for (const model of candidates) {
    try {
      const ollama = new OllamaProvider({ ...settings, embedModel: model })
      const vectors = await ollama.embed(texts)
      if (vectors.length === texts.length && vectors[0]?.length) {
        return { vectors: vectors.map(normalize), mode: 'ollama' }
      }
    } catch {
      /* probujemy kolejnego kandydata */
    }
  }
  return { vectors: texts.map(lexicalEmbed), mode: 'lexical' }
}
