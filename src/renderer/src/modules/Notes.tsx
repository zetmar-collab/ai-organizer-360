import React, { useEffect, useState } from 'react'
import type { Note, Project } from '../../../shared/types'
import { api, errMsg, fmtDateTime, newRequestId, useList } from '../lib/api'
import { Confirm, Empty, ErrorBox, ExportButtons, Markdown } from '../lib/ui'

export default function Notes(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<Note>>({})
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)

  const { items, reload } = useList<Note>(
    'notes',
    { search: { columns: ['title', 'body', 'tags'], term: search }, orderBy: 'id desc' },
    [search]
  )
  const { items: projects } = useList<Project>('projects', { orderBy: 'name asc' })

  useEffect(() => {
    const note = items.find((n) => n.id === selId)
    if (note) setDraft(note)
  }, [selId, items])

  const create = async (): Promise<void> => {
    const n = await api.crud.create<Note>('notes', { title: 'Nowa notatka', body: '' })
    await reload()
    setSelId(n.id)
    setSummary('')
  }

  const save = async (): Promise<void> => {
    if (!selId) return
    try {
      await api.crud.update('notes', selId, {
        title: draft.title ?? '',
        body: draft.body ?? '',
        tags: draft.tags ?? '',
        projectId: draft.projectId ?? null,
        updatedAt: new Date().toISOString()
      })
      setError('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const summarize = async (): Promise<void> => {
    if (!draft.body?.trim()) {
      setError('Notatka jest pusta.')
      return
    }
    setBusy(true)
    setSummary('')
    setError('')
    const requestId = newRequestId()
    const off = api.ai.onToken((e) => {
      if (e.requestId === requestId) setSummary((prev) => prev + e.token)
    })
    try {
      setSummary(await api.ai.task({ task: 'summarize', text: draft.body, requestId }))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      off()
      setBusy(false)
    }
  }

  const addToKnowledge = async (): Promise<void> => {
    if (!selId) return
    setBusy(true)
    try {
      await api.kb.indexText({
        title: draft.title || 'Notatka',
        source: `note:${selId}`,
        kind: 'note',
        text: `${draft.title ?? ''}\n\n${draft.body ?? ''}`
      })
      setError('')
      window.alert('Notatka dodana do bazy wiedzy.')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cols" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
      <div>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="grow" placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn primary" onClick={create}>
            +
          </button>
        </div>
        {items.length === 0 && <Empty text="Brak notatek." />}
        {items.map((n) => (
          <div
            key={n.id}
            className={`list-item ${n.id === selId ? 'sel' : ''}`}
            onClick={() => {
              setSelId(n.id)
              setSummary('')
            }}
          >
            <b>{n.title || '(bez tytulu)'}</b>
            <div className="muted">{fmtDateTime(n.updatedAt)}</div>
            {n.tags && <div className="muted">🏷 {n.tags}</div>}
          </div>
        ))}
      </div>

      <div>
        <ErrorBox error={error} />
        {!selId && <Empty text="Wybierz notatke z listy lub utworz nowa." />}
        {selId && (
          <>
            <div className="card">
              <input
                style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}
                value={draft.title ?? ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <div className="row" style={{ marginBottom: 8 }}>
                <input
                  className="grow"
                  placeholder="tagi, oddzielone przecinkami"
                  value={draft.tags ?? ''}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
                <select
                  style={{ width: 180 }}
                  value={draft.projectId ?? ''}
                  onChange={(e) => setDraft({ ...draft, projectId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">(bez projektu)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {preview ? (
                <div style={{ minHeight: 280, border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                  <Markdown text={draft.body ?? ''} />
                </div>
              ) : (
                <textarea
                  style={{ minHeight: 280 }}
                  value={draft.body ?? ''}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Tresc notatki (Markdown)..."
                />
              )}

              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={save}>
                  Zapisz
                </button>
                <button className="btn" onClick={() => setPreview(!preview)}>
                  {preview ? 'Edytuj' : 'Podglad'}
                </button>
                <button className="btn" onClick={summarize} disabled={busy}>
                  {busy ? <span className="spinner" /> : '✨'} Podsumuj
                </button>
                <button className="btn" onClick={addToKnowledge} disabled={busy}>
                  🧠 Do bazy wiedzy
                </button>
                <ExportButtons title={draft.title || 'notatka'} content={draft.body ?? ''} />
                <Confirm
                  text="Usunac notatke?"
                  onYes={() => {
                    void api.crud.remove('notes', selId).then(() => {
                      setSelId(null)
                      void reload()
                    })
                  }}
                />
              </div>
            </div>

            {summary && (
              <div className="card" style={{ marginTop: 14 }}>
                <h3>Podsumowanie AI</h3>
                <Markdown text={summary} />
                <div className="row" style={{ marginTop: 10 }}>
                  <ExportButtons title={`${draft.title || 'notatka'} - podsumowanie`} content={summary} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
