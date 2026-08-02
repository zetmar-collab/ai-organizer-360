import type { AppSettings, ChatTurn, EngineId, EngineStatus } from '../../shared/types'
import { httpError, readLines, type ChatOptions, type LLMProvider } from './provider'

export class OllamaProvider implements LLMProvider {
  readonly id: EngineId = 'ollama'
  readonly model: string
  private base: string
  private embedModel: string
  private temp: number

  constructor(s: AppSettings) {
    this.base = (s.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '')
    this.model = s.ollamaModel || 'llama3.1:8b'
    this.embedModel = s.embedModel || 'nomic-embed-text'
    this.temp = s.temperature
  }

  async chat(messages: ChatTurn[], opts: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${this.base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: { temperature: opts.temperature ?? this.temp }
      })
    })
    if (!res.ok) throw await httpError(res, 'Ollama /api/chat')

    let full = ''
    await readLines(res, (line) => {
      try {
        const json = JSON.parse(line) as { message?: { content?: string }; error?: string }
        if (json.error) throw new Error(json.error)
        const token = json.message?.content
        if (token) {
          full += token
          opts.onToken?.(token)
        }
      } catch {
        /* pomijamy niekompletne linie */
      }
    })
    return full
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Nowe API /api/embed przyjmuje tablice; starsze serwery maja tylko /api/embeddings.
    const res = await fetch(`${this.base}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embedModel, input: texts })
    })
    if (res.ok) {
      const json = (await res.json()) as { embeddings?: number[][] }
      if (json.embeddings?.length) return json.embeddings
    }
    const out: number[][] = []
    for (const text of texts) {
      const r = await fetch(`${this.base}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel, prompt: text })
      })
      if (!r.ok) throw await httpError(r, 'Ollama /api/embeddings')
      const j = (await r.json()) as { embedding: number[] }
      out.push(j.embedding)
    }
    return out
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.base}/api/tags`)
    if (!res.ok) throw await httpError(res, 'Ollama /api/tags')
    const json = (await res.json()) as { models?: { name: string }[] }
    return (json.models ?? []).map((m) => m.name).sort()
  }

  async status(): Promise<EngineStatus> {
    try {
      const models = await this.listModels()
      const has = models.includes(this.model)
      return {
        engine: this.id,
        ok: true,
        detail: has
          ? `Ollama dziala (${models.length} modeli), aktywny: ${this.model}`
          : `Ollama dziala, ale model "${this.model}" nie jest pobrany. Uruchom: ollama pull ${this.model}`,
        models
      }
    } catch (e) {
      return {
        engine: this.id,
        ok: false,
        detail: `Brak polaczenia z Ollama pod ${this.base}. Uruchom Ollama i sprawdz adres. (${(e as Error).message})`,
        models: []
      }
    }
  }
}
