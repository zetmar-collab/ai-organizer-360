import type { AppSettings, ChatTurn, EngineId, EngineStatus } from '../../shared/types'
import { getSettings } from '../settings'
import { OllamaProvider } from './ollama'
import { OpenRouterProvider } from './openrouter'

export interface ChatOptions {
  temperature?: number
  signal?: AbortSignal
  onToken?: (token: string) => void
}

/**
 * Wspolny kontrakt dla obu silnikow. Zaden modul aplikacji nie wola
 * OpenRoutera ani Ollamy bezposrednio - wszystko idzie przez ten interfejs.
 */
export interface LLMProvider {
  readonly id: EngineId
  readonly model: string
  chat(messages: ChatTurn[], opts?: ChatOptions): Promise<string>
  embed(texts: string[]): Promise<number[][]>
  listModels(): Promise<string[]>
  status(): Promise<EngineStatus>
}

export function makeProvider(settings: AppSettings, engine?: EngineId): LLMProvider {
  const id = engine ?? settings.engine
  return id === 'openrouter' ? new OpenRouterProvider(settings) : new OllamaProvider(settings)
}

export function provider(engine?: EngineId): LLMProvider {
  return makeProvider(getSettings(), engine)
}

/** Czyta strumien linia po linii (NDJSON z Ollamy albo SSE z OpenRoutera). */
export async function readLines(res: Response, onLine: (line: string) => void): Promise<void> {
  if (!res.body) throw new Error('Brak odpowiedzi strumieniowej z silnika AI')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (line) onLine(line)
    }
  }
  const rest = buffer.trim()
  if (rest) onLine(rest)
}

export async function httpError(res: Response, prefix: string): Promise<Error> {
  let detail = ''
  try {
    detail = (await res.text()).slice(0, 400)
  } catch {
    /* ignore */
  }
  return new Error(`${prefix}: HTTP ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`)
}
