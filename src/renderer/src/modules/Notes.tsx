import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Note, Project } from '../../../shared/types'
import { api, errMsg, fmtDateTime, newRequestId, useDebounced, useList } from '../lib/api'
import { Confirm, Empty, ErrorBox, ExportButtons, Markdown, SaveState, Skeleton, toast, type SaveStatus } from '../lib/ui'
import { Icon } from '../lib/icons'

const AUTOSAVE_MS = 800

export default function Notes({ focusId }: { focusId?: number }): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<Note>>({})
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const debouncedSearch = useDebounced(search)

  useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])

  // Refs, zeby autozapis i przelaczanie notatek widzialy zawsze aktualny stan,
  // nie ten zamrozony w domknieciu przy tworzeniu timera.
  const dirtyRef = useRef(false)
  const draftRef = useRef<Partial<Note>>({})
  const selIdRef = useRef<number | null>(null)

  const { items, loading, reload } = useList<Note>(
    'notes',
    { search: { columns: ['title', 'body', 'tags'], term: debouncedSearch }, orderBy: 'id desc' },
    [debouncedSearch]
  )
  const { items: projects } = useList<Project>('projects', { orderBy: 'name asc' })

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    selIdRef.current = selId
  }, [selId])

  const persist = useCallback(
    async (id: number, data: Partial<Note>): Promise<void> => {
      setStatus('saving')
      try {
        await api.crud.update('notes', id, {
          title: data.title ?? '',
          body: data.body ?? '',
          tags: data.tags ?? '',
          projectId: data.projectId ?? null,
          updatedAt: new Date().toISOString()
        })
        dirtyRef.current = false
        setStatus('saved')
        setError('')
        await reload()
      } catch (e) {
        setStatus('error')
        setError(errMsg(e))
      }
    },
    [reload]
  )

  /** Wczytuje notatke z bazy tylko przy zmianie wyboru - nigdy w trakcie pisania. */
  useEffect(() => {
    if (!selId) {
      setDraft({})
      dirtyRef.current = false
      setStatus('idle')
      return
    }
    void api.crud
      .get<Note>('notes', selId)
      .then((n) => {
        setDraft(n)
        dirtyRef.current = false
        setStatus('idle')
      })
      .catch((e) => setError(errMsg(e)))
  }, [selId])

  /** Autozapis po AUTOSAVE_MS bez pisania. */
  useEffect(() => {
    if (!selId || !dirtyRef.current) return
    const t = setTimeout(() => void persist(selId, draftRef.current), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [draft, selId, persist])

  /** Zapisuje zaległe zmiany przy zamykaniu okna albo odmontowaniu modulu. */
  useEffect(() => {
    const flush = (): void => {
      if (selIdRef.current && dirtyRef.current) void persist(selIdRef.current, draftRef.current)
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [persist])

  const edit = (patch: Partial<Note>): void => {
    dirtyRef.current = true
    setStatus('dirty')
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  /** Przed zmiana notatki dopisuje to, co jeszcze nie trafilo do bazy. */
  const selectNote = async (id: number | null): Promise<void> => {
    if (selId && dirtyRef.current) await persist(selId, draftRef.current)
    setSelId(id)
    setSummary('')
  }

  const create = async (): Promise<void> => {
    if (selId && dirtyRef.current) await persist(selId, draftRef.current)
    const n = await api.crud.create<Note>('notes', { title: 'Nowa notatka', body: '' })
    await reload()
    setSelId(n.id)
    setSummary('')
  }

  const saveNow = async (): Promise<void> => {
    if (selId) await persist(selId, draftRef.current)
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
      toast(`Notatka "${draft.title || 'bez tytulu'}" trafila do bazy wiedzy.`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cols master-detail">
      <div>
        <div className="row stack-sm">
          <input className="grow" placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn primary" onClick={create} aria-label="Nowa notatka">
            <Icon name="plus" />
          </button>
        </div>
        {loading ? (
          <Skeleton rows={4} height={64} />
        ) : (
          items.length === 0 && <Empty text="Brak notatek. Utworz pierwsza, zeby zaczac pisac." icon="note" />
        )}
        {items.map((n) => (
          <div
            key={n.id}
            className={`list-item ${n.id === selId ? 'sel' : ''}`}
            onClick={() => void selectNote(n.id)}
          >
            <b>{n.title || '(bez tytulu)'}</b>
            <div className="muted">{fmtDateTime(n.updatedAt)}</div>
            {n.tags && (
              <div className="muted">
                <Icon name="tag" /> {n.tags}
              </div>
            )}
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
                className="title-input"
                aria-label="Tytul notatki"
                value={draft.title ?? ''}
                onChange={(e) => edit({ title: e.target.value })}
              />
              <div className="row stack-sm">
                <input
                  className="grow"
                  aria-label="Tagi notatki"
                  placeholder="tagi, oddzielone przecinkami"
                  value={draft.tags ?? ''}
                  onChange={(e) => edit({ tags: e.target.value })}
                />
                <select
                  className="w-project"
                  aria-label="Projekt notatki"
                  value={draft.projectId ?? ''}
                  onChange={(e) => edit({ projectId: e.target.value ? Number(e.target.value) : null })}
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
                <div className="note-surface">
                  <Markdown text={draft.body ?? ''} />
                </div>
              ) : (
                <textarea
                  className="note-surface"
                  aria-label="Tresc notatki"
                  value={draft.body ?? ''}
                  onChange={(e) => edit({ body: e.target.value })}
                  onBlur={() => void saveNow()}
                  placeholder="Tresc notatki (Markdown)..."
                />
              )}

              <div className="row stack-md">
                <SaveState status={status} onSave={() => void saveNow()} />
                <button className="btn" onClick={() => setPreview(!preview)}>
                  {preview ? 'Edytuj' : 'Podglad'}
                </button>
                <button className="btn" onClick={summarize} disabled={busy}>
                  {busy ? <span className="spinner" /> : <Icon name="sparkle" />} Podsumuj
                </button>
                <button className="btn" onClick={addToKnowledge} disabled={busy}>
                  <Icon name="knowledge" /> Do bazy wiedzy
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
              <div className="card stack-md">
                <h3>Podsumowanie AI</h3>
                <div className="ai-output"><Markdown text={summary} /></div>
                <div className="row stack-md">
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
