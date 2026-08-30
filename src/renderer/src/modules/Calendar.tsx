import React, { useEffect, useMemo, useState } from 'react'
import type { EventItem, Project } from '../../../shared/types'
import { api, errMsg, fmtDateTime, localDateTimeValue, useList } from '../lib/api'
import { AiActionPanel, Confirm, Empty, ErrorBox, Field, Modal, Skeleton } from '../lib/ui'
import { Icon } from '../lib/icons'

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

export default function Calendar({ focusDate }: { focusDate?: string }): React.JSX.Element {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => dayKey(new Date()))
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!focusDate) return
    setSelected(focusDate)
    setCursor(new Date(focusDate + 'T12:00'))
  }, [focusDate])

  const { items: events, loading, reload } = useList<EventItem>('events', { orderBy: 'start asc' })
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
    const startAt = new Date(editing.start ?? Date.now())
    const endAt = new Date(editing.end ?? editing.start ?? Date.now())
    if (endAt < startAt) {
      setError('Koniec wydarzenia nie moze wypadac przed jego poczatkiem.')
      return
    }
    try {
      const data = {
        title: editing.title,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
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
          <div className="row stack-sm">
            <button
              className="btn sm"
              aria-label="Poprzedni miesiac"
              onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx - 1, 1))}
            >
              &lsaquo;
            </button>
            <b className="grow center">
              {MONTHS[monthIdx]} {cursor.getFullYear()}
            </b>
            <button
              className="btn sm"
              aria-label="Nastepny miesiac"
              onClick={() => setCursor(new Date(cursor.getFullYear(), monthIdx + 1, 1))}
            >
              &rsaquo;
            </button>
            <button className="btn sm" onClick={() => setCursor(new Date())}>
              Dzis
            </button>
          </div>

          <div className="cal-grid">
            {DAYS.map((d) => (
              <div key={d} className="cal-head">
                {d}
              </div>
            ))}
            {grid.map((d) => {
              const key = dayKey(d)
              const count = (byDay.get(key) ?? []).length
              const other = d.getMonth() !== monthIdx
              const isToday = key === dayKey(new Date())
              const cls = ['cal-day', other ? 'other' : '', isToday ? 'today' : '', key === selected ? 'sel' : '']
              return (
                <button
                  key={key}
                  className={cls.join(' ')}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={key + (count ? ', wydarzenia: ' + count : ', brak wydarzen')}
                  onClick={() => setSelected(key)}
                >
                  <div>{d.getDate()}</div>
                  {count > 0 && <span className="cal-count">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="card stack-lg">
            <div className="row stack-sm">
              <h3 className="grow flush">{selected}</h3>
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
                <Icon name="plus" /> Wydarzenie
              </button>
            </div>
            {loading && <Skeleton rows={2} height={56} />}
            {!loading && dayEvents.length === 0 && <Empty text="Brak wydarzen tego dnia." icon="calendar" />}
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
