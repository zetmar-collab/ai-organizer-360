import React, { useEffect, useState } from 'react'
import type { AppSettings, EngineId, EngineStatus } from '../../../shared/types'
import { api, errMsg } from '../lib/api'
import { ErrorBox, Field } from '../lib/ui'

type Public = AppSettings & { openrouterKeySet: boolean }

export default function Settings({ onEngineChange }: { onEngineChange: () => void }): React.JSX.Element {
  const [s, setS] = useState<Public | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Record<string, EngineStatus | undefined>>({})
  const [models, setModels] = useState<Record<string, string[]>>({})
  const [appInfo, setAppInfo] = useState<{ db: string; electron: string; node: string } | null>(null)

  useEffect(() => {
    void api.settings.get().then(setS)
    void api.app.info().then(setAppInfo)
  }, [])

  const patch = async (p: Partial<AppSettings>): Promise<void> => {
    try {
      const next = await api.settings.set(p)
      setS(next)
      setInfo('Zapisano.')
      setTimeout(() => setInfo(''), 2000)
      onEngineChange()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const saveKey = async (): Promise<void> => {
    const key = keyInput.trim()
    if (!key) return
    try {
      const next = await api.settings.set({ openrouterKey: key })
      setS(next)
      setKeyInput('')
      onEngineChange()
      if (next.openrouterKeySet) {
        setInfo('Klucz OpenRouter zapisany i zaszyfrowany. Kliknij "Testuj polaczenie".')
        setTimeout(() => setInfo(''), 6000)
      } else {
        setError('Zapis klucza nie powiodl sie - sprobuj ponownie.')
      }
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const test = async (engine: EngineId): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const st = await api.ai.status(engine)
      setStatus((prev) => ({ ...prev, [engine]: st }))
      if (st.ok) setModels((prev) => ({ ...prev, [engine]: st.models }))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!s) return <div className="muted">Wczytywanie ustawien...</div>

  const StatusLine = ({ engine }: { engine: EngineId }): React.JSX.Element | null => {
    const st = status[engine]
    if (!st) return null
    return (
      <div className={st.ok ? 'notice' : 'error'} style={{ marginTop: 8 }}>
        {st.ok ? '✅ ' : '❌ '}
        {st.detail}
      </div>
    )
  }

  return (
    <>
      <ErrorBox error={error} />
      {info && <div className="notice">{info}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Aktywny silnik AI</h3>
        <div className="row">
          <button
            className={`btn ${s.engine === 'ollama' ? 'primary' : ''}`}
            onClick={() => void patch({ engine: 'ollama' })}
          >
            🖥 Ollama (lokalnie)
          </button>
          <button
            className={`btn ${s.engine === 'openrouter' ? 'primary' : ''}`}
            onClick={() => void patch({ engine: 'openrouter' })}
          >
            ☁ OpenRouter (chmura)
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Tryb lokalny: zadne dane nie opuszczaja komputera. Tryb OpenRouter: tresc zapytan i fragmenty dokumentow sa
          wysylane do zewnetrznego API.
        </div>
      </div>

      <div className="cols">
        <div className="card">
          <h3>Ollama (lokalny model)</h3>
          <Field label="Adres serwera">
            <input value={s.ollamaUrl} onChange={(e) => setS({ ...s, ollamaUrl: e.target.value })} onBlur={() => void patch({ ollamaUrl: s.ollamaUrl })} />
          </Field>
          <Field label="Model rozmowy">
            {models.ollama?.length ? (
              <select value={s.ollamaModel} onChange={(e) => void patch({ ollamaModel: e.target.value })}>
                {models.ollama.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={s.ollamaModel}
                onChange={(e) => setS({ ...s, ollamaModel: e.target.value })}
                onBlur={() => void patch({ ollamaModel: s.ollamaModel })}
              />
            )}
          </Field>
          <Field label="Model embeddingow (baza wiedzy)">
            <input
              value={s.embedModel}
              onChange={(e) => setS({ ...s, embedModel: e.target.value })}
              onBlur={() => void patch({ embedModel: s.embedModel })}
            />
          </Field>
          <button className="btn" onClick={() => void test('ollama')} disabled={busy}>
            Testuj polaczenie
          </button>
          <StatusLine engine="ollama" />
          <div className="muted" style={{ marginTop: 8 }}>
            Przyklad startu: <code>ollama pull llama3.1:8b</code> oraz <code>ollama pull nomic-embed-text</code>
          </div>
        </div>

        <div className="card">
          <h3>OpenRouter (chmura)</h3>
          <Field label={`Klucz API ${s.openrouterKeySet ? '✅ (zapisany, zaszyfrowany)' : '❌ (brak)'}`}>
            <div className="row">
              <input
                className="grow"
                type="password"
                placeholder="sk-or-v1-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
              />
              <button className="btn primary" onClick={saveKey} disabled={!keyInput.trim()}>
                Zapisz klucz
              </button>
            </div>
          </Field>
          <Field label="Model">
            {models.openrouter?.length ? (
              <select value={s.openrouterModel} onChange={(e) => void patch({ openrouterModel: e.target.value })}>
                {models.openrouter.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={s.openrouterModel}
                onChange={(e) => setS({ ...s, openrouterModel: e.target.value })}
                onBlur={() => void patch({ openrouterModel: s.openrouterModel })}
              />
            )}
          </Field>
          <button className="btn" onClick={() => void test('openrouter')} disabled={busy}>
            Testuj polaczenie
          </button>
          <StatusLine engine="openrouter" />
          <div className="muted" style={{ marginTop: 8 }}>
            Klucz jest szyfrowany mechanizmem Windows DPAPI i przechowywany lokalnie.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Zachowanie AI</h3>
        <Field label={`Temperatura: ${s.temperature}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={s.temperature}
            onChange={(e) => setS({ ...s, temperature: Number(e.target.value) })}
            onMouseUp={() => void patch({ temperature: s.temperature })}
          />
        </Field>
        <Field label="Liczba fragmentow z bazy wiedzy (RAG top-K)">
          <input
            type="number"
            min={1}
            max={20}
            value={s.ragTopK}
            onChange={(e) => setS({ ...s, ragTopK: Number(e.target.value) })}
            onBlur={() => void patch({ ragTopK: s.ragTopK })}
          />
        </Field>
        <Field label="Prompt systemowy">
          <textarea
            value={s.systemPrompt}
            onChange={(e) => setS({ ...s, systemPrompt: e.target.value })}
            onBlur={() => void patch({ systemPrompt: s.systemPrompt })}
          />
        </Field>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Dane aplikacji</h3>
        <div className="muted">Baza danych: {appInfo?.db}</div>
        <div className="muted">
          Electron {appInfo?.electron} • Node {appInfo?.node}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => void api.app.openDataDir()}>
            Pokaz folder z danymi
          </button>
        </div>
      </div>
    </>
  )
}
