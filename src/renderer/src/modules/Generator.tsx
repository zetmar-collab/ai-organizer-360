import React, { useEffect, useRef, useState } from 'react'
import type { AiTaskName } from '../../../shared/types'
import { api, errMsg, newRequestId } from '../lib/api'
import { ErrorBox, ExportButtons, Field, Markdown } from '../lib/ui'

const MODES: { task: AiTaskName; label: string; placeholder: string }[] = [
  {
    task: 'generate-document',
    label: 'Dokument',
    placeholder: 'Np. "Oferta na sesje zdjeciowa dla firmy X - zakres, terminy, cennik, warunki"'
  },
  {
    task: 'generate-text',
    label: 'Tekst',
    placeholder: 'Np. "Opis produktu na strone - kurs fotografii dla poczatkujacych, 3 akapity"'
  },
  {
    task: 'generate-email',
    label: 'E-mail',
    placeholder: 'Np. "Odpowiedz do klienta, ktory pyta o termin realizacji - przesuniecie o tydzien, przeprosiny"'
  }
]

export default function Generator(): React.JSX.Element {
  const [task, setTask] = useState<AiTaskName>('generate-document')
  const [brief, setBrief] = useState('')
  const [tone, setTone] = useState('profesjonalny')
  const [language, setLanguage] = useState('polski')
  const [useKnowledge, setUseKnowledge] = useState(false)
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reqRef = useRef('')

  useEffect(() => api.ai.onToken(({ requestId, token }) => {
    if (requestId === reqRef.current) setOut((prev) => prev + token)
  }), [])

  const mode = MODES.find((m) => m.task === task)!

  const run = async (): Promise<void> => {
    if (!brief.trim()) {
      setError('Opisz, co ma powstac.')
      return
    }
    setError('')
    setOut('')
    setBusy(true)
    const requestId = newRequestId()
    reqRef.current = requestId
    try {
      setOut(await api.ai.task({ task, text: brief, tone, language, useKnowledge, requestId }))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
      reqRef.current = ''
    }
  }

  const saveAsNote = async (): Promise<void> => {
    if (!out) return
    const title = brief.slice(0, 60)
    await api.crud.create('notes', { title, body: out, tags: 'generator' })
    window.alert('Zapisano jako notatke.')
  }

  return (
    <div className="cols">
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          {MODES.map((m) => (
            <button
              key={m.task}
              className={`btn ${task === m.task ? 'primary' : ''}`}
              onClick={() => setTask(m.task)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Field label="Brief - co ma powstac">
          <textarea style={{ minHeight: 150 }} placeholder={mode.placeholder} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </Field>

        <div className="row">
          <div className="grow">
            <Field label="Ton">
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="profesjonalny">profesjonalny</option>
                <option value="przyjazny">przyjazny</option>
                <option value="formalny">formalny</option>
                <option value="bezposredni i zwiezly">bezposredni i zwiezly</option>
                <option value="perswazyjny">perswazyjny</option>
              </select>
            </Field>
          </div>
          <div className="grow">
            <Field label="Jezyk">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="polski">polski</option>
                <option value="angielski">angielski</option>
                <option value="niemiecki">niemiecki</option>
              </select>
            </Field>
          </div>
        </div>

        {task === 'generate-document' && (
          <label className="row" style={{ gap: 6, cursor: 'pointer', marginBottom: 10 }}>
            <input
              type="checkbox"
              style={{ width: 16 }}
              checked={useKnowledge}
              onChange={(e) => setUseKnowledge(e.target.checked)}
            />
            <span className="muted">🧠 Uzyj bazy wiedzy jako zrodla</span>
          </label>
        )}

        <div className="row">
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? <span className="spinner" /> : '✨'} Generuj
          </button>
          {busy && (
            <button className="btn" onClick={() => api.ai.abort(reqRef.current)}>
              Przerwij
            </button>
          )}
        </div>
        <ErrorBox error={error} />
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 className="grow" style={{ margin: 0 }}>
            Wynik
          </h3>
          {out && (
            <>
              <button className="btn sm" onClick={saveAsNote}>
                💾 Jako notatka
              </button>
              <ExportButtons title={brief.slice(0, 50) || 'dokument'} content={out} />
            </>
          )}
        </div>
        {out ? (
          <Markdown text={out} />
        ) : (
          <div className="muted">
            Wynik pojawi sie tutaj. Mozesz go wyeksportowac do PDF, DOCX lub Markdown albo zapisac jako notatke.
          </div>
        )}
      </div>
    </div>
  )
}
