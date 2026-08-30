import type { AppSettings, ChatTurn, EngineId, EngineStatus } from '../../shared/types'
import { httpError, readLines, type ChatOptions, type LLMProvider } from './provider'

const BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements LLMProvider {
  readonly id: EngineId = 'openrouter'
  readonly model: string
  private key: string
  private temp: number

  constructor(s: AppSettings) {
    this.key = s.openrouterKey
    this.model = s.openrouterModel || 'openai/gpt-4o-mini'
    this.temp = s.temperature
  }

  private headers(): Record<string, string> {
    if (!this.key) throw new Error('Brak klucza API OpenRouter. Dodaj go w Ustawieniach.')
    return {
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://local.aiorganizer360',
      'X-Title': 'AI Organizer 360'
    }
  }

  async chat(messages: ChatTurn[], opts: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      signal: opts.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: opts.temperature ?? this.temp
      })
    })
    if (!res.ok) throw await httpError(res, 'OpenRouter /chat/completions')

    let full = ''
    const onLine = (line: string): void => {
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') return
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[]; error?: { message: string } }
        if (json.error) throw new Error(json.error.message)
        const token = json.choices?.[0]?.delta?.content
        if (token) {
          full += token
          opts.onToken?.(token)
        }
      } catch {
        /* pomijamy komentarze i niepelne ramki SSE */
      }
    }
    try {
      await readLines(res, onLine)
    } catch (e) {
      // Zatrzymanie przez uzytkownika nie jest bledem - oddajemy to, co juz doszlo.
      if ((e as Error).name !== 'AbortError') throw e
    }
    return full
  }

  async embed(_texts: string[]): Promise<number[][]> {
    void _texts
    throw new Error(
      'OpenRouter nie udostepnia embeddingow. Indeksowanie bazy wiedzy uzywa Ollamy (lub trybu leksykalnego offline).'
    )
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${BASE}/models`)
    if (!res.ok) throw await httpError(res, 'OpenRouter /models')
    const json = (await res.json()) as { data?: { id: string }[] }
    return (json.data ?? []).map((m) => m.id).sort()
  }

  async status(): Promise<EngineStatus> {
    if (!this.key) {
      return { engine: this.id, ok: false, detail: 'Brak klucza API. Ustawienia -> OpenRouter.', models: [] }
    }
    try {
      const res = await fetch(`${BASE}/key`, { headers: this.headers() })
      if (!res.ok) throw await httpError(res, 'OpenRouter /key')
      const models = await this.listModels()
      return {
        engine: this.id,
        ok: true,
        detail: `Klucz aktywny, dostepnych modeli: ${models.length}, wybrany: ${this.model}`,
        models
      }
    } catch (e) {
      return { engine: this.id, ok: false, detail: (e as Error).message, models: [] }
    }
  }
}
