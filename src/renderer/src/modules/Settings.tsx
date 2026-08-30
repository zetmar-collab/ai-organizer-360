import React, { useCallback, useEffect, useState } from 'react'
import type { AppSettings, EngineId, EngineStatus } from '../../../shared/types'
import { api, errMsg } from '../lib/api'
import { Icon } from '../lib/icons'
import { ErrorBox, Field, toast } from '../lib/ui'

type Public = AppSettings & { openrouterKeySet: boolean }

export default function Settings({
  onEngineChange,
  theme,
  onToggleTheme
}: {
  onEngineChange: () => void
  theme: AppSettings['theme']
  onToggleTheme: () => Promise<void>
}): React.JSX.Element {
  const [s, setS] = useState<Public | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Partial<Record<EngineId, EngineStatus>>>({})
  const [appInfo, setAppInfo] = useState<{ db: string; electron: string; node: string } | null>(null)

  useEffect(() => {
    void api.settings.get().then(setS)
    void api.app.info().then(setAppInfo)
  }, [])

  /** Listy modeli pobieramy od razu - uzytkownik nie powinien ich szukac przyciskiem. */
  const probe = useCallback(async (engine: EngineId): Promise<void> => {
    try {
      const st = await api.ai.status(engine)
      setStatus((prev) => ({ ...prev, [engine]: st }))
    } catch {
      /* brak polaczenia obsluguje sam status */
    }
  }, [])

  useEffect(() => {
    void probe('ollama')
    void probe('openrouter')
  }, [probe])

  const patch = useCallback(
    async (p: Partial<AppSettings>, note?: string): Promise<void> => {
      try {
        setS(await api.settings.set(p))
        onEngineChange()
        if (note) toast(note)
      } catch (e) {
        setError(errMsg(e))
      }
    },
    [onEngineChange]
  )

  if (!s) return <div className="muted">Wczytywanie ustawien...</div>

  const saveKey = async (): Promise<void> => {
    const key = keyInput.trim()
    if (!key) return
    try {
      const next = await api.settings.set({ openrouterKey: key })
      setS(next)
      setKeyInput('')
      onEngineChange()
      if (next.openrouterKeySet) {
        toast('Klucz OpenRouter zapisany i zaszyfrowany.')
        void probe('openrouter')
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
    await probe(engine)
    setBusy(false)
  }

  const StatusLine = ({ engine }: { engine: EngineId }): React.JSX.Element | null => {
    const st = status[engine]
    if (!st) return null
    return (
      <div className={st.ok ? 'notice stack-md' : 'error stack-md'}>
        {st.ok ? 'Dziala. ' : 'Niedostepny. '}
        {st.detail}
      </div>
    )
  }

  const ModelPicker = ({
    engine,
    value,
    onPick
  }: {
    engine: EngineId
    value: string
    onPick: (v: string) => void
  }): React.JSX.Element => {
    const models = status[engine]?.models ?? []
    if (models.length) {
      return (
        <select value={models.includes(value) ? value : ''} onChange={(e) => onPick(e.target.value)}>
          {!models.includes(value) && <option value="">{value} (niepobrany)</option>}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )
    }
    return <input value={value} onChange={(e) => onPick(e.target.value)} />
  }

  return (
    <>
      <ErrorBox error={error} />

      <div className="card stack-lg">
        <h3>Aktywny silnik AI</h3>
        <div className="row">
          <button
            className={'btn ' + (s.engine === 'ollama' ? 'primary' : '')}
            onClick={() => void patch({ engine: 'ollama' }, 'Silnik: Ollama (lokalnie)')}
          >
            <Icon name="local" /> Ollama — lokalnie
          </button>
          <button
            className={'btn ' + (s.engine === 'openrouter' ? 'primary' : '')}
            onClick={() => void patch({ engine: 'openrouter' }, 'Silnik: OpenRouter (chmura)')}
          >
            <Icon name="cloud" /> OpenRouter — chmura
          </button>
        </div>
        <p className="muted stack-md">
          Kolor akcentu w calej aplikacji zmienia sie razem z silnikiem: cieplo oznacza model lokalny (dane zostaja na
          tym komputerze), chlod — model w chmurze (tresc zapytan wychodzi na zewnatrz).
        </p>
      </div>

      <div className="cols">
        <div className="card">
          <h3>Ollama — model lokalny</h3>
          <Field label="Adres serwera">
            <input
              value={s.ollamaUrl}
              onChange={(e) => setS({ ...s, ollamaUrl: e.target.value })}
              onBlur={() => void patch({ ollamaUrl: s.ollamaUrl })}
            />
          </Field>
          <Field label="Model rozmowy">
            <ModelPicker engine="ollama" value={s.ollamaModel} onPick={(v) => void patch({ ollamaModel: v })} />
          </Field>
          <Field label="Model embeddingow (baza wiedzy)">
            <ModelPicker engine="ollama" value={s.embedModel} onPick={(v) => void patch({ embedModel: v })} />
          </Field>
          <button className="btn" onClick={() => void test('ollama')} disabled={busy}>
            <Icon name="scan" /> Testuj polaczenie
          </button>
          <StatusLine engine="ollama" />
          <p className="muted stack-md">
            Start: <code>ollama pull llama3.2:3b</code> oraz <code>ollama pull nomic-embed-text</code>
          </p>
        </div>

        <div className="card">
          <h3>OpenRouter — chmura</h3>
          <Field label={'Klucz API ' + (s.openrouterKeySet ? '(zapisany, zaszyfrowany)' : '(brak)')}>
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
          {s.openrouterKeySet && (
            <button
              className="btn sm"
              onClick={() => void patch({ openrouterKey: '' }, 'Klucz OpenRouter usuniety.')}
            >
              <Icon name="trash" /> Usun zapisany klucz
            </button>
          )}
          <Field label="Model">
            <ModelPicker
              engine="openrouter"
              value={s.openrouterModel}
              onPick={(v) => void patch({ openrouterModel: v })}
            />
          </Field>
          <button className="btn" onClick={() => void test('openrouter')} disabled={busy}>
            <Icon name="scan" /> Testuj polaczenie
          </button>
          <StatusLine engine="openrouter" />
          <p className="muted stack-md">Klucz jest szyfrowany mechanizmem Windows DPAPI i nie opuszcza tego komputera.</p>
        </div>
      </div>

      <div className="card stack-md">
        <h3>Zachowanie AI</h3>
        <Field label={'Temperatura: ' + s.temperature}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={s.temperature}
            onChange={(e) => {
              const v = Number(e.target.value)
              setS({ ...s, temperature: v })
              void patch({ temperature: v })
            }}
          />
        </Field>
        <Field label="Liczba fragmentow z bazy wiedzy (RAG top-K)">
          <input
            type="number"
            min={1}
            max={20}
            value={s.ragTopK}
            onChange={(e) => setS({ ...s, ragTopK: Number(e.target.value) })}
            onBlur={() => {
              const clamped = Math.min(20, Math.max(1, Math.round(s.ragTopK) || 6))
              setS({ ...s, ragTopK: clamped })
              void patch({ ragTopK: clamped })
            }}
          />
        </Field>
        <Field label="Prompt systemowy">
          <textarea
            value={s.systemPrompt}
            onChange={(e) => setS({ ...s, systemPrompt: e.target.value })}
            onBlur={() => void patch({ systemPrompt: s.systemPrompt }, 'Prompt systemowy zapisany.')}
          />
        </Field>
      </div>

      <div className="card stack-md">
        <h3>Wyglad</h3>
        <div className="row">
          <button className="btn" onClick={onToggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            {theme === 'dark' ? 'Przelacz na motyw jasny' : 'Przelacz na motyw ciemny'}
          </button>
        </div>
      </div>

      <div className="card stack-md">
        <h3>Dane aplikacji</h3>
        <p className="muted mono">{appInfo?.db}</p>
        <p className="muted">
          Electron {appInfo?.electron} • Node {appInfo?.node}
        </p>
        <div className="row stack-md">
          <button className="btn" onClick={() => void api.app.openDataDir()}>
            <Icon name="open" /> Pokaz folder z danymi
          </button>
        </div>
      </div>
    </>
  )
}
