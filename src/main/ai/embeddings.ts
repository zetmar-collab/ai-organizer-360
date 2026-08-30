import { getSettings } from '../settings'
import { OllamaProvider } from './ollama'
import { lexicalEmbed, normalize } from '../../shared/vector'

export type EmbedMode = 'ollama' | 'lexical'

export { cosine, fromBlob, lexicalEmbed, normalize, toBlob } from '../../shared/vector'

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
