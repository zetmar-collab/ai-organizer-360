import { safeStorage } from 'electron'
import { getDb } from './db'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  engine: 'ollama',
  theme: 'dark',
  openrouterKey: '',
  openrouterModel: 'openai/gpt-4o-mini',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2:3b',
  embedModel: 'nomic-embed-text',
  temperature: 0.4,
  systemPrompt:
    'Jestes asystentem w aplikacji AI Organizer 360. Odpowiadasz po polsku, zwiezle i konkretnie. Gdy dostajesz kontekst z dokumentow uzytkownika, opierasz sie wylacznie na nim i podajesz zrodla.',
  ragTopK: 6
}

const SECRET_KEYS = new Set(['openrouterKey'])

function readRaw(key: string): string | null {
  const row = getDb().get('SELECT value FROM settings WHERE key = ?', [key]) as { value: string } | undefined
  return row ? row.value : null
}

function writeRaw(key: string, value: string): void {
  getDb().run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', [
    key,
    value,
    value
  ])
}

function decryptSecret(stored: string): string {
  if (!stored) return ''
  if (!stored.startsWith('enc:')) return stored
  try {
    return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
  } catch {
    return ''
  }
}

function encryptSecret(plain: string): string {
  if (!plain) return ''
  if (!safeStorage.isEncryptionAvailable()) return plain
  return 'enc:' + safeStorage.encryptString(plain).toString('base64')
}

export function getSettings(): AppSettings {
  const out = { ...DEFAULTS } as unknown as Record<string, unknown>
  for (const key of Object.keys(DEFAULTS)) {
    const raw = readRaw(key)
    if (raw === null) continue
    if (SECRET_KEYS.has(key)) {
      out[key] = decryptSecret(raw)
    } else if (typeof (DEFAULTS as unknown as Record<string, unknown>)[key] === 'number') {
      out[key] = Number(raw)
    } else {
      out[key] = raw
    }
  }
  return out as unknown as AppSettings
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS)) continue
    const str = SECRET_KEYS.has(key) ? encryptSecret(String(value ?? '')) : String(value ?? '')
    writeRaw(key, str)
  }
  return getSettings()
}

/** Ustawienia bez sekretow - do wyswietlania w UI. */
export function getPublicSettings(): AppSettings & { openrouterKeySet: boolean } {
  const s = getSettings()
  return { ...s, openrouterKey: '', openrouterKeySet: Boolean(s.openrouterKey) }
}
