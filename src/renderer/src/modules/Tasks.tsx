import React, { useState } from 'react'
import type { Project, Task } from '../../../shared/types'
import { api, errMsg, fmtDate, useList } from '../lib/api'
import { AiActionPanel, Confirm, Empty, ErrorBox, Field, Modal } from '../lib/ui'

const PRIO = ['niski', 'normalny', 'wysoki']

export default function Tasks(): React.JSX.Element {
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState('')
  const [editing, setEditing] = useState<Partial<Task> | null>(null)
  const [error, setError] = useState('')

  const query = {
    ...(filter === 'all' ? {} : { where: { done: filter === 'done' ? 1 : 0 } }),
    search: { columns: ['title', 'notes'], term: search },
    orderBy: 'id desc'
  }
  const { items, reload } = useList<Task>('tasks', query, [filter, search])
  const { items: projects } = useList<Project>('projects', { orderBy: 'name asc' })

  const projectName = (id: number | null): string => projects.find((p) => p.id === id)?.name ?? ''

  const toggle = async (t: Task): Promise<void> => {
    await api.crud.update('tasks', t.id, {
      done: t.done ? 0 : 1,
      completedAt: t.done ? null : new Date().toISOString()
    })
    await reload()
  }

  const addQuick = async (): Promise<void> => {
    if (!quick.trim()) return
    try {
      await api.crud.create('tasks', { title: quick.trim(), priority: 1 })
      setQuick('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const save = async (): Promise<void> => {
    if (!editing?.title?.trim()) {
      setError('Tytul jest wymagany.')
      return
    }
    try {
      const data = {
        title: editing.title,
        priority: editing.priority ?? 1,
        due: editing.due || null,
        notes: editing.notes ?? '',
        projectId: editing.projectId ?? null,
        done: editing.done ?? 0
      }
      if (editing.id) await api.crud.update('tasks', editing.id, data)
      else await api.crud.create('tasks', data)
      setEditing(null)
      setError('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const overdue = (t: Task): boolean => !t.done && !!t.due && t.due < new Date().toISOString().slice(0, 10)

  return (
    <>
      <ErrorBox error={error} />
      <div className="cols">
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <input
                className="grow"
                placeholder="Nowe zadanie i Enter..."
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addQuick()}
              />
              <button className="btn primary" onClick={addQuick}>
                Dodaj
              </button>
            </div>
            <div className="row">
              <select style={{ width: 140 }} value={filter} onChange={(e) => setFilter(e.target.value as 'open')}>
                <option value="open">Otwarte</option>
                <option value="done">Ukonczone</option>
                <option value="all">Wszystkie</option>
              </select>
              <input
                className="grow"
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn sm" onClick={() => setEditing({ title: '', priority: 1 })}>
                + Szczegolowe
              </button>
            </div>
          </div>

          {items.length === 0 && <Empty text="Brak zadan." />}
          {items.map((t) => (
            <div key={t.id} className="list-item">
              <div className="row">
                <input
                  type="checkbox"
                  style={{ width: 16 }}
                  checked={!!t.done}
                  onChange={() => void toggle(t)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  className="grow"
                  style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}
                  onClick={() => setEditing(t)}
                >
                  {t.title}
                </span>
                <span className={`pill p${t.priority}`}>{PRIO[t.priority]}</span>
                {t.due && (
                  <span className="pill" style={overdue(t) ? { borderColor: 'var(--err)', color: 'var(--err)' } : {}}>
                    {fmtDate(t.due)}
                  </span>
                )}
                <Confirm
                  text={`Usunac "${t.title}"?`}
                  onYes={() => {
                    void api.crud.remove('tasks', t.id).then(reload)
                  }}
                />
              </div>
              {(t.notes || t.projectId) && (
                <div className="muted" style={{ marginTop: 4 }}>
                  {projectName(t.projectId) && `📂 ${projectName(t.projectId)}  `}
                  {t.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <AiActionPanel
          title="Inteligentne przypomnienia"
          hint="AI grupuje terminy wedlug pilnosci i wskazuje, co jest zagrozone."
          task="reminders"
          exportTitle="Przypomnienia"
        />
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edycja zadania' : 'Nowe zadanie'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Anuluj
              </button>
              <button className="btn primary" onClick={save}>
                Zapisz
              </button>
            </>
          }
        >
          <Field label="Tytul">
            <input value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </Field>
          <div className="row">
            <div className="grow">
              <Field label="Priorytet">
                <select
                  value={editing.priority ?? 1}
                  onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) as 0 })}
                >
                  <option value={0}>niski</option>
                  <option value={1}>normalny</option>
                  <option value={2}>wysoki</option>
                </select>
              </Field>
            </div>
            <div className="grow">
              <Field label="Termin">
                <input
                  type="date"
                  value={editing.due ?? ''}
                  onChange={(e) => setEditing({ ...editing, due: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <Field label="Projekt">
            <select
              value={editing.projectId ?? ''}
              onChange={(e) => setEditing({ ...editing, projectId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">(brak)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notatki">
            <textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
        </Modal>
      )}
    </>
  )
}
