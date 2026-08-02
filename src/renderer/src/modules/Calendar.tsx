import React, { useMemo, useState } from 'react'
import type { EventItem, Project } from '../../../shared/types'
import { api, errMsg, fmtDateTime, localDateTimeValue, useList } from '../lib/api'
import { AiActionPanel, Confirm, Empty, ErrorBox, Field, Modal } from '../lib/ui'

const DAYS = ['Pn', 'Wt', 'Sr', 'Cz', 'Pt', 'So', 'Nd']
const MONTHS = [
  'Styczen',
  'Luty',
  'Marzec',
  'Kwiecien',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpien',
  'Wrzesien',
  'Pazdziernik',
  'Listopad',
  'Grudzien'
]

function dayKey(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Calendar(): React.JSX.Element {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => dayKey(new Date()))
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null)
  const [error, setError] = useState('')

  const { items: events, reload } = useList<EventItem>('events', { orderBy: 'start asc' })
  const { items: projects } = useList<Project>('projects', { orderBy: 'name asc' })

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const e of events) {
      const key = e.start.slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [events])

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7 // poniedzialek pierwszy
    const start = new Date(first)
    start.setDate(first.getDate() - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const save = async (): Promise<void> => {
    if (!editing?.title?.trim()) {
      setError('Tytul jest wymagany.')
      return
    }
    try {
      const data = {
        title: editing.title,
        start: new Date(editing.start ?? Date.now()).toISOString(),
        end: new Date(editing.end ?? editing.start ?? Date.now()).toISOString(),
        allDay: editing.allDay ?? 0,
        location: editing.location ?? '',
        notes: editing.notes ?? '',
        projectId: editing.projectId ?? null
      }
      if (editing.id) await api.crud.update('events', editing.id, data)
      else await api.crud.create('events', data)
      setEditing(null)
      setError('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const remove = async (id: number): Promise<void> => {
    await api.crud.remove('events', id)
    await reload()
  }

  const dayEvents = byDay.get(selected) ?? []
  const monthIdx = cursor.getMonth()

  return (
    <>
      <ErrorBox error={error} />
      <div className="cols">
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx - 1, 1))}>
              ‹
            </button>
            <b className="grow" style={{ textAlign: 'center' }}>
              {MONTHS[monthIdx]} {cursor.getFullYear()}
            </b>
            <button className="btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx + 1, 1))}>
              ›
            </button>
            <button className="btn sm" onClick={() => setCursor(new Date())}>
              Dzis
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {DAYS.map((d) => (
              <div key={d} className="muted" style={{ textAlign: 'center', fontSize: 11 }}>
                {d}
              </div>
            ))}
            {grid.map((d) => {
              const key = dayKey(d)
              const count = (byDay.get(key) ?? []).length
              const other = d.getMonth() !== monthIdx
              const isToday = key === dayKey(new Date())
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  style={{
                    background: key === selected ? 'var(--bg-3)' : 'transparent',
                    border: `1px solid ${isToday ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 8,
                    padding: '6px 2px',
                    cursor: 'pointer',
                    opacity: other ? 0.35 : 1,
                    minHeight: 46
                  }}
                >
                  <div>{d.getDate()}</div>
                  {count > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>{'•'.repeat(Math.min(count, 3))}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <h3 className="grow" style={{ margin: 0 }}>
                {selected}
              </h3>
              <button
                className="btn primary sm"
                onClick={() =>
                  setEditing({
                    title: '',
                    start: `${selected}T09:00`,
                    end: `${selected}T10:00`,
                    allDay: 0,
                    location: '',
                    notes: '',
                    projectId: null
                  })
                }
              >
                + Wydarzenie
              </button>
            </div>
            {dayEvents.length === 0 && <Empty text="Brak wydarzen tego dnia." />}
            {dayEvents.map((e) => (
              <div key={e.id} className="list-item" onClick={() => setEditing({ ...e, start: localDateTimeValue(e.start), end: localDateTimeValue(e.end) })}>
                <div className="row">
                  <b className="grow">{e.title}</b>
                  <Confirm
                    text={`Usunac "${e.title}"?`}
                    onYes={() => {
                      void remove(e.id)
                    }}
                  />
                </div>
                <div className="muted">
                  {fmtDateTime(e.start)} - {fmtDateTime(e.end)}
                  {e.location ? ` • ${e.location}` : ''}
                </div>
                {e.notes && <div className="muted">{e.notes}</div>}
              </div>
            ))}
          </div>

          <AiActionPanel
            title="Automatyczne planowanie dnia"
            hint="AI uklada plan na dzis z Twoich wydarzen i otwartych zadan."
            task="plan-day"
            exportTitle="Plan dnia"
          />
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edycja wydarzenia' : 'Nowe wydarzenie'}
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
              <Field label="Poczatek">
                <input
                  type="datetime-local"
                  value={editing.start ?? ''}
                  onChange={(e) => setEditing({ ...editing, start: e.target.value })}
                />
              </Field>
            </div>
            <div className="grow">
              <Field label="Koniec">
                <input
                  type="datetime-local"
                  value={editing.end ?? ''}
                  onChange={(e) => setEditing({ ...editing, end: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <Field label="Miejsce">
            <input
              value={editing.location ?? ''}
              onChange={(e) => setEditing({ ...editing, location: e.target.value })}
            />
          </Field>
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
