import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { KbDoc, KbHit } from '../../../shared/types'
import { api, errMsg, fmtDateTime, newRequestId } from '../lib/api'
import { Icon } from '../lib/icons'
import { Confirm, Empty, ErrorBox, Progress, Skeleton, toast } from '../lib/ui'

interface Coverage {
  total: number
  searchable: number
  stale: KbDoc[]
}

export default function Knowledge({ initialQuery }: { initialQuery?: string }): React.JSX.Element {
  const [docs, setDocs] = useState<KbDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState(initialQuery ?? '')
  const [hits, setHits] = useState<KbHit[]>([])
  const [searched, setSearched] = useState(false)
  const [cover, setCover] = useState<Coverage | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const reqRef = useRef('')

  const reload = useCallback(async (): Promise<void> => {
    try {
      const [list, cov] = await Promise.all([api.kb.list(), api.kb.coverage()])
      setDocs(list)
      setCover(cov)
      // po odswiezeniu zostawiamy w zaznaczeniu tylko to, co nadal istnieje
      setSelected((prev) => new Set(list.filter((d) => prev.has(d.id)).map((d) => d.id)))
      setError('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(
    () =>
      api.kb.onProgress((e) => {
        if (e.requestId && e.requestId !== reqRef.current) return
        setProgress(e.current >= e.total ? null : { current: e.current, total: e.total, file: e.file })
      }),
    []
  )

  const indexPaths = async (paths: string[]): Promise<void> => {
    if (!paths.length) return
    setBusy(true)
    setError('')
    const requestId = newRequestId()
    reqRef.current = requestId
    setProgress({ current: 0, total: paths.length, file: '' })
    try {
      const res = await api.kb.indexFiles({ paths, requestId })
      const ok = res.filter((r) => r.ok)
      toast('Zaindeksowano ' + ok.length + ' z ' + res.length + ' plikow.')
      const failed = res.filter((r) => !r.ok)
      if (failed.length) setError(failed.map((f) => f.path + '\n  ' + f.message).join('\n'))
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setProgress(null)
      setBusy(false)
      reqRef.current = ''
    }
  }

  const addFiles = async (): Promise<void> => {
    const paths = await api.dialog.files()
    await indexPaths(paths)
  }

  /** Dokumenty z innego trybu embeddingow sa niewidoczne dla wyszukiwania - tu je naprawiamy. */
  const reindexStale = async (): Promise<void> => {
    const paths = (cover?.stale ?? []).map((d) => d.source).filter((s) => !s.startsWith('note:'))
    if (!paths.length) {
      toast('Brak plikow do przeindeksowania (notatki dodaj ponownie z modulu Notatki).', 'error')
      return
    }
    await indexPaths(paths)
  }

  const runSearch = async (): Promise<void> => {
    if (!query.trim()) return
    setBusy(true)
    setError('')
    try {
      setHits(await api.kb.search(query))
      setSearched(true)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: number): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const removeSelected = async (): Promise<void> => {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true)
    try {
      for (const id of ids) await api.kb.remove(id)
      toast('Usunieto ' + ids.length + ' dokumentow z bazy wiedzy.')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const allSelected = docs.length > 0 && selected.size === docs.length

  const totalChunks = docs.reduce((s, d) => s + d.chunks, 0)
  const mixed = cover ? cover.total - cover.searchable : 0

  return (
    <>
      <ErrorBox error={error} />

      <div className="card stack-lg">
        <div className="row">
          <button className="btn primary" onClick={addFiles} disabled={busy}>
            {busy && !progress ? <span className="spinner" /> : <Icon name="download" />} Dodaj dokumenty
          </button>
          <span className="muted grow">
            <span className="mono">{docs.length}</span> dokumentow, <span className="mono">{totalChunks}</span>{' '}
            fragmentow. Obslugiwane: PDF, DOCX, TXT, MD, CSV, JSON, HTML.
          </span>
        </div>

        {progress && (
          <Progress
            value={progress.current}
            max={progress.total}
            label={progress.file ? 'Indeksowanie: ' + progress.file : 'Przygotowanie...'}
          />
        )}

        <p className="muted hint stack-md">
          Baza wiedzy powstaje wylacznie z plikow dodanych tutaj i z notatek wyslanych przyciskiem „Do bazy wiedzy".
          Zawartosc jest zapisana na stale w bazie aplikacji - skanowanie bibliotek jej nie zmienia.
          Embeddingi liczy lokalna Ollama. Gdy jest niedostepna, aplikacja przechodzi na awaryjny tryb leksykalny —
          wyszukiwanie dziala offline, ale mniej trafnie.
        </p>
      </div>

      {mixed > 0 && (
        <div className="notice stack-lg">
          <b>{mixed}</b> z {cover?.total} dokumentow nie bierze udzialu w wyszukiwaniu. Zostaly zaindeksowane innym
          trybem embeddingow niz aktualnie aktywny, wiec ich wektory sa nieporownywalne.
          <div className="row stack-md">
            <button className="btn" onClick={reindexStale} disabled={busy}>
              <Icon name="scan" /> Przeindeksuj je teraz
            </button>
          </div>
        </div>
      )}

      <div className="card stack-lg">
        <h3>Wyszukiwanie semantyczne</h3>
        <div className="row">
          <input
            className="grow"
            aria-label="Zapytanie do bazy wiedzy"
            placeholder="Czego szukasz w swoich dokumentach?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          />
          <button className="btn" onClick={runSearch} disabled={busy || !query.trim()}>
            <Icon name="search" /> Szukaj
          </button>
        </div>

        {searched && hits.length === 0 && !busy && (
          <p className="muted stack-md">Brak trafien. Sprobuj innych slow albo dodaj wiecej dokumentow.</p>
        )}

        {hits.map((h, i) => (
          <div key={h.docId + '-' + h.ord} className="list-item hit">
            <div className="row">
              <b className="grow">
                [{i + 1}] {h.docTitle}
              </b>
              <span className="pill mono">{(h.score * 100).toFixed(0)}%</span>
            </div>
            <p className="muted excerpt">
              {h.text.slice(0, 600)}
              {h.text.length > 600 ? '...' : ''}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row stack-sm">
          <h3 className="grow flush">Zaindeksowane dokumenty</h3>
          {selected.size > 0 && (
            <Confirm
              text={'Usunac ' + selected.size + ' dokumentow z bazy wiedzy?'}
              label={'Usun zaznaczone (' + selected.size + ')'}
              onYes={() => void removeSelected()}
            />
          )}
        </div>
        {loading ? (
          <Skeleton rows={3} height={44} />
        ) : docs.length === 0 ? (
          <Empty
            text="Baza wiedzy jest pusta. Dodaj dokumenty, zeby rozmawiac z nimi w czacie AI."
            icon="knowledge"
            action={
              <button className="btn primary" onClick={addFiles}>
                <Icon name="download" /> Dodaj dokumenty
              </button>
            }
          />
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      aria-label="Zaznacz wszystkie dokumenty"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && !allSelected
                      }}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)))
                      }
                    />
                  </th>
                  <th>Tytul</th>
                  <th className="col-narrow">Typ</th>
                  <th className="col-narrow">Tryb</th>
                  <th className="col-narrow">Fragmenty</th>
                  <th className="col-mid">Dodano</th>
                  <th className="col-narrow" />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'Zaznacz ' + d.title}
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </td>
                    <td>
                      <div>{d.title}</div>
                      <div className="muted mono">{d.source}</div>
                    </td>
                    <td className="muted">{d.kind}</td>
                    <td>
                      <span className={'pill ' + (d.mode === 'lexical' ? 'mode-lexical' : '')}>
                        {d.mode || 'nieznany'}
                      </span>
                    </td>
                    <td className="mono">{d.chunks}</td>
                    <td className="muted">{fmtDateTime(d.createdAt)}</td>
                    <td>
                      <Confirm
                        text={'Usunac "' + d.title + '" z bazy wiedzy?'}
                        onYes={() => void api.kb.remove(d.id).then(reload)}
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
