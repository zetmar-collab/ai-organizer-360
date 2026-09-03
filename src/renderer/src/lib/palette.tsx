import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { KbHit, SearchHit, SearchModule } from '../../../shared/types'
import { api, useDebounced } from './api'
import { Icon, type IconName } from './icons'

const MODULE_LABEL: Record<SearchModule | 'knowledge', string> = {
  tasks: 'Zadania',
  notes: 'Notatki',
  calendar: 'Kalendarz',
  projects: 'Projekty',
  documents: 'Dokumenty',
  music: 'Muzyka',
  ebooks: 'E-booki',
  audiobooks: 'Audiobooki',
  photos: 'Zdjecia',
  finance: 'Finanse',
  knowledge: 'Baza wiedzy'
}

const MODULE_ICON: Record<SearchModule | 'knowledge', IconName> = {
  tasks: 'tasks',
  notes: 'note',
  calendar: 'calendar',
  projects: 'folder',
  documents: 'library',
  music: 'music',
  ebooks: 'ebook',
  audiobooks: 'audiobook',
  photos: 'photo',
  finance: 'finance',
  knowledge: 'knowledge'
}

export interface PaletteChoice {
  module: SearchModule | 'knowledge'
  id?: number
  date?: string
  term: string
}

/**
 * Jedno pole, ktore przeszukuje wszystkie moduly naraz - zadania, notatki,
 * wydarzenia, projekty, pliki, finanse - oraz semantycznie baze wiedzy.
 * Wyniki leksykalne przychodza od razu, baza wiedzy dolacza chwile pozniej,
 * bo najpierw musi policzyc embedding zapytania.
 */
export function CommandPalette({
  onClose,
  onPick
}: {
  onClose: () => void
  onPick: (choice: PaletteChoice) => void
}): React.JSX.Element {
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [kb, setKb] = useState<KbHit[]>([])
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebounced(term, 200)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    if (debounced.trim().length < 2) {
      setHits([])
      setKb([])
      return
    }
    setBusy(true)
    void api.search
      .global(debounced)
      .then((r) => alive && setHits(r))
      .catch(() => alive && setHits([]))
      .finally(() => alive && setBusy(false))
    void api.search
      .knowledge(debounced)
      .then((r) => alive && setKb(r))
      .catch(() => alive && setKb([]))
    return () => {
      alive = false
    }
  }, [debounced])

  const rows = useMemo(() => {
    const fromModules: PaletteChoice[] = hits.map((h) => ({
      module: h.module,
      id: h.id,
      date: h.date,
      term: h.term
    }))
    const fromKb: PaletteChoice[] = kb.map(() => ({ module: 'knowledge' as const, term: debounced }))
    return { fromModules, fromKb, count: fromModules.length + (kb.length ? 1 : 0) }
  }, [hits, kb, debounced])

  useEffect(() => {
    setActive(0)
  }, [debounced])

  const choose = (index: number): void => {
    if (index < rows.fromModules.length) onPick(rows.fromModules[index])
    else if (kb.length) onPick({ module: 'knowledge', term: debounced })
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(rows.count - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('.palette-row.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div className="modal-bg palette-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Wyszukiwanie">
        <div className="palette-input">
          <Icon name="search" size={18} />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            className="grow"
            aria-label="Szukaj we wszystkich modulach"
            placeholder="Szukaj w zadaniach, notatkach, plikach, finansach i bazie wiedzy..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {busy && <span className="spinner" />}
          <kbd>Esc</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {debounced.trim().length < 2 && (
            <p className="muted palette-hint">
              Wpisz co najmniej dwa znaki. Strzalki wybieraja wynik, Enter otwiera modul.
            </p>
          )}

          {debounced.trim().length >= 2 && rows.count === 0 && !busy && (
            <p className="muted palette-hint">Brak trafien dla „{debounced}”.</p>
          )}

          {hits.map((h, i) => (
            <button
              key={h.module + '-' + h.id}
              className={'palette-row ' + (i === active ? 'active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <Icon name={MODULE_ICON[h.module]} />
              <span className="grow">
                <b>{h.title}</b>
                <span className="muted palette-sub">{h.subtitle}</span>
              </span>
              <span className="pill">{MODULE_LABEL[h.module]}</span>
            </button>
          ))}

          {kb.length > 0 && (
            <button
              className={'palette-row ' + (active === hits.length ? 'active' : '')}
              onMouseEnter={() => setActive(hits.length)}
              onClick={() => choose(hits.length)}
            >
              <Icon name="knowledge" />
              <span className="grow">
                <b>
                  {kb.length} fragmentow w bazie wiedzy — najlepszy: {kb[0].docTitle}
                </b>
                <span className="muted palette-sub">{kb[0].text.replace(/\s+/g, ' ').slice(0, 110)}</span>
              </span>
              <span className="pill mono">{(kb[0].score * 100).toFixed(0)}%</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
