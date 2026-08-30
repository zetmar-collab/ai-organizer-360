import React, { useMemo, useState } from 'react'
import type { Note, Project, Task } from '../../../shared/types'
import { api, errMsg, fmtDate, useList } from '../lib/api'
import { Confirm, Empty, ErrorBox, Field, Modal, Skeleton } from '../lib/ui'
import { Icon } from '../lib/icons'

const STATUS: Record<string, string> = { active: 'aktywny', paused: 'wstrzymany', done: 'zakonczony' }

export default function Projects(): React.JSX.Element {
  const [editing, setEditing] = useState<Partial<Project> | null>(null)
  const [error, setError] = useState('')

  const { items: projects, loading, reload } = useList<Project>('projects', { orderBy: 'id desc' })
  const { items: tasks } = useList<Task>('tasks', { orderBy: 'id desc' })
  const { items: notes } = useList<Note>('notes', { orderBy: 'id desc' })

  const stats = useMemo(() => {
    const map = new Map<number, { open: number; done: number; notes: number }>()
    for (const p of projects) map.set(p.id, { open: 0, done: 0, notes: 0 })
    for (const t of tasks) {
      const s = t.projectId != null ? map.get(t.projectId) : undefined
      if (s) t.done ? s.done++ : s.open++
    }
    for (const n of notes) {
      const s = n.projectId != null ? map.get(n.projectId) : undefined
      if (s) s.notes++
    }
    return map
  }, [projects, tasks, notes])

  const save = async (): Promise<void> => {
    if (!editing?.name?.trim()) {
      setError('Nazwa jest wymagana.')
      return
    }
    try {
      const data = {
        name: editing.name,
        description: editing.description ?? '',
        status: editing.status ?? 'active',
        color: editing.color ?? '#6ea8fe'
      }
      if (editing.id) await api.crud.update('projects', editing.id, data)
      else await api.crud.create('projects', data)
      setEditing(null)
      setError('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <>
      <ErrorBox error={error} />
      <div className="row stack-lg">
        <button className="btn primary" onClick={() => setEditing({ name: '', status: 'active', color: '#d99a4e' })}>
          <Icon name="plus" /> Nowy projekt
        </button>
      </div>

      {loading && <Skeleton rows={3} height={120} />}
      {!loading && projects.length === 0 && (
        <Empty text="Brak projektow. Utworz pierwszy, zeby grupowac zadania i notatki." icon="folder" />
      )}

      <div className="cols-3">
        {projects.map((p) => {
          const s = stats.get(p.id) ?? { open: 0, done: 0, notes: 0 }
          const total = s.open + s.done
          const pct = total ? Math.round((s.done / total) * 100) : 0
          return (
            <div key={p.id} className="card" style={{ borderTop: `3px solid ${p.color}` }}>
              <div className="row">
                <b className="grow" style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
                  {p.name}
                </b>
                <span className="pill">{STATUS[p.status] ?? p.status}</span>
              </div>
              {p.description && <div className="muted stack-sm">{p.description}</div>}
              <div className="bar stack-sm">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="muted">
                <span className="mono">
                  {s.done}/{total}
                </span>{' '}
                zadan • <span className="mono">{s.notes}</span> notatek • od {fmtDate(p.createdAt)}
              </div>
              <div className="row stack-md">
                <button className="btn sm" onClick={() => setEditing(p)}>
                  Edytuj
                </button>
                <Confirm
                  text={`Usunac projekt "${p.name}"? Zadania i notatki pozostana, ale bez przypisania.`}
                  onYes={() => {
                    void api.crud.remove('projects', p.id).then(reload)
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edycja projektu' : 'Nowy projekt'}
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
          <Field label="Nazwa">
            <input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <Field label="Opis">
            <textarea
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </Field>
          <div className="row">
            <div className="grow">
              <Field label="Status">
                <select
                  value={editing.status ?? 'active'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as Project['status'] })}
                >
                  <option value="active">aktywny</option>
                  <option value="paused">wstrzymany</option>
                  <option value="done">zakonczony</option>
                </select>
              </Field>
            </div>
            <div style={{ width: 110 }}>
              <Field label="Kolor">
                <input
                  type="color"
                  value={editing.color ?? '#d99a4e'}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
