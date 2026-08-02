import React, { useEffect, useState } from 'react'
import type { KbDoc, KbHit } from '../../../shared/types'
import { api, errMsg, fmtDateTime } from '../lib/api'
import { Confirm, Empty, ErrorBox } from '../lib/ui'

export default function Knowledge(): React.JSX.Element {
  const [docs, setDocs] = useState<KbDoc[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<KbHit[]>([])

  const reload = async (): Promise<void> => {
    try {
      setDocs(await api.kb.list())
    } catch (e) {
      setError(errMsg(e))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const addFiles = async (): Promise<void> => {
    const paths = await api.dialog.files()
    if (!paths.length) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const res = await api.kb.indexFiles(paths)
      const ok = res.filter((r) => r.ok)
      setInfo(`Zaindeksowano ${ok.length}/${res.length} plikow.`)
      const failed = res.filter((r) => !r.ok)
      if (failed.length) setError(failed.map((f) => `${f.path}\n  ${f.message}`).join('\n'))
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const runSearch = async (): Promise<void> => {
    if (!query.trim()) return
    setBusy(true)
    setError('')
    try {
      setHits(await api.kb.search(query))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const totalChunks = docs.reduce((s, d) => s + d.chunks, 0)

  return (
    <>
      <ErrorBox error={error} />
      {info && <div className="notice">{info}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <button className="btn primary" onClick={addFiles} disabled={busy}>
            {busy ? <span className="spinner" /> : '📥'} Dodaj dokumenty
          </button>
          <span className="muted grow">
            {docs.length} dokumentow • {totalChunks} fragmentow. Obslugiwane: PDF, DOCX, TXT, MD, CSV, JSON, HTML.
          </span>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Embeddingi liczy lokalna Ollama (model z Ustawien). Gdy Ollama jest niedostepna, aplikacja przechodzi na
          awaryjny tryb leksykalny - wyszukiwanie dziala, ale mniej trafnie.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Wyszukiwanie semantyczne</h3>
        <div className="row">
          <input
            className="grow"
            placeholder="Czego szukasz w swoich dokumentach?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          />
          <button className="btn" onClick={runSearch} disabled={busy}>
            Szukaj
          </button>
        </div>
        {hits.map((h, i) => (
          <div key={`${h.docId}-${h.ord}`} className="list-item" style={{ marginTop: 10, cursor: 'default' }}>
            <div className="row">
              <b className="grow">
                [{i + 1}] {h.docTitle}
              </b>
              <span className="pill">{(h.score * 100).toFixed(0)}%</span>
            </div>
            <div className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {h.text.slice(0, 600)}
              {h.text.length > 600 ? '...' : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Zaindeksowane dokumenty</h3>
        {docs.length === 0 ? (
          <Empty text="Baza wiedzy jest pusta. Dodaj dokumenty, zeby rozmawiac z nimi w czacie AI." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tytul</th>
                  <th style={{ width: 80 }}>Typ</th>
                  <th style={{ width: 100 }}>Fragmenty</th>
                  <th style={{ width: 100 }}>Znaki</th>
                  <th style={{ width: 140 }}>Dodano</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div>{d.title}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {d.source}
                      </div>
                    </td>
                    <td className="muted">{d.kind}</td>
                    <td>{d.chunks}</td>
                    <td className="muted">{d.chars.toLocaleString('pl-PL')}</td>
                    <td className="muted">{fmtDateTime(d.createdAt)}</td>
                    <td>
                      <Confirm
                        text={`Usunac "${d.title}" z bazy wiedzy?`}
                        onYes={() => {
                          void api.kb.remove(d.id).then(reload)
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
