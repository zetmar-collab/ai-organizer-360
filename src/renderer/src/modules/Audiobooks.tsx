import React, { useCallback, useEffect, useState } from 'react'
import type { Audiobook, AudiobookTrack } from '../../../shared/types'
import { api, errMsg, fmtBytes, fmtDate, useDebounced } from '../lib/api'
import { Icon } from '../lib/icons'
import { Confirm, Empty, ErrorBox, Field, Modal, Skeleton, toast } from '../lib/ui'

/**
 * Audiobook to jedna pozycja, nie zbior plikow mp3. Katalog z trzydziestoma
 * rozdzialami liczy sie jako jedna ksiazka; pojedynczy plik (typowo .m4b) tez.
 */
export default function Audiobooks({ initialSearch }: { initialSearch?: string }): React.JSX.Element {
  const [books, setBooks] = useState<Audiobook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState(initialSearch ?? '')
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [tracks, setTracks] = useState<Record<number, AudiobookTrack[]>>({})
  const [editing, setEditing] = useState<Audiobook | null>(null)

  const debouncedSearch = useDebounced(search)

  const reload = useCallback(async (): Promise<void> => {
    try {
      setBooks(await api.audiobooks.list(debouncedSearch))
      setError('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggle = async (book: Audiobook): Promise<void> => {
    // stan liczymy funkcyjnie - dwa szybkie klikniecia na roznych pozycjach
    // nie moga sie nadpisac stanem zamrozonym w domknieciu
    const willOpen = !open.has(book.id)
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(book.id) ? next.delete(book.id) : next.add(book.id)
      return next
    })
    if (willOpen && !tracks[book.id]) {
      const list = await api.audiobooks.tracks(book.id)
      setTracks((prev) => ({ ...prev, [book.id]: list }))
    }
  }

  const report = (r: { added: number; skipped: number; titles: string[] }): void => {
    if (r.added) {
      const sample = r.titles.slice(0, 3).join(', ')
      toast(`Dodano ${r.added} audiobookow${sample ? ': ' + sample : ''}${r.added > 3 ? '...' : ''}`)
    }
    if (!r.added && r.skipped) toast('Nic nie dodano - te pozycje sa juz w bibliotece.', 'error')
    if (!r.added && !r.skipped) toast('Nie znaleziono plikow audio we wskazanym miejscu.', 'error')
  }

  const run = async (fn: () => Promise<{ added: number; skipped: number; titles: string[] }>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      report(await fn())
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  /** Katalog nadrzedny: kazdy podkatalog to osobna ksiazka. */
  const addParent = async (): Promise<void> => {
    const dir = await api.dialog.folder()
    if (dir) await run(() => api.audiobooks.addParent(dir))
  }

  /** Jeden wskazany katalog to jedna ksiazka. */
  const addFolder = async (): Promise<void> => {
    const dir = await api.dialog.folder()
    if (dir) await run(() => api.audiobooks.addFolder(dir))
  }

  const addFiles = async (): Promise<void> => {
    const paths = await api.dialog.files([
      { name: 'Audiobooki', extensions: ['m4b', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav', 'wma'] }
    ])
    if (paths.length) await run(() => api.audiobooks.addFiles(paths))
  }

  const saveEdit = async (): Promise<void> => {
    if (!editing) return
    try {
      await api.audiobooks.update(editing.id, {
        title: editing.title,
        author: editing.author,
        category: editing.category
      })
      setEditing(null)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const totalBytes = books.reduce((s, b) => s + b.bytes, 0)
  const totalTracks = books.reduce((s, b) => s + b.tracks, 0)

  return (
    <>
      <ErrorBox error={error} />

      <div className="card stack-lg">
        <div className="row">
          <button className="btn primary" onClick={addParent} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="folder" />} Katalog z audiobookami
          </button>
          <button className="btn" onClick={addFolder} disabled={busy}>
            <Icon name="ebook" /> Jeden katalog = jeden audiobook
          </button>
          <button className="btn" onClick={addFiles} disabled={busy}>
            <Icon name="download" /> Dodaj pliki
          </button>
          <span className="grow" />
          <span className="muted">
            <span className="mono">{books.length}</span> audiobookow, <span className="mono">{totalTracks}</span>{' '}
            plikow, <span className="mono">{fmtBytes(totalBytes)}</span>
          </span>
        </div>

        <p className="muted hint stack-md">
          <b>Katalog z audiobookami</b> — wskaz katalog nadrzedny, a kazdy jego podkatalog stanie sie osobna ksiazka
          (nawet jesli zawiera kilkadziesiat plikow mp3). <b>Jeden katalog</b> — dodaje wskazany katalog jako jedna
          pozycje. <b>Dodaj pliki</b> — kazdy zaznaczony plik (np. .m4b) to osobna ksiazka.
        </p>

        <div className="row stack-md">
          <input
            className="grow"
            aria-label="Szukaj audiobooka"
            placeholder="Szukaj po tytule, autorze lub sciezce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Skeleton rows={4} height={56} />
      ) : books.length === 0 ? (
        <Empty
          text={
            debouncedSearch.trim()
              ? 'Nic nie pasuje do wyszukiwania.'
              : 'Brak audiobookow. Wskaz katalog, w ktorym kazdy podkatalog to jedna ksiazka, albo dodaj pojedyncze pliki.'
          }
          icon="ebook"
          action={
            debouncedSearch.trim() ? undefined : (
              <button className="btn primary" onClick={addParent}>
                <Icon name="folder" /> Katalog z audiobookami
              </button>
            )
          }
        />
      ) : (
        <div className="card no-pad">
          {books.map((b) => {
            const expanded = open.has(b.id)
            const list = tracks[b.id] ?? []
            return (
              <div key={b.id} className="folder">
                <div className="folder-head">
                  <button className="btn ghost folder-toggle" aria-expanded={expanded} onClick={() => void toggle(b)}>
                    <Icon name={expanded ? 'chevronDown' : 'chevronRight'} />
                    <Icon name={b.source === 'file' ? 'ebook' : 'folder'} />
                    <span className="grow">
                      <b>{b.title}</b>
                      <span className="muted mono folder-path">{b.path}</span>
                    </span>
                  </button>
                  {b.author && <span className="pill">{b.author}</span>}
                  {b.category && <span className="pill">{b.category}</span>}
                  <span className="muted mono">
                    {b.tracks === 1 ? '1 plik' : b.tracks + ' plikow'} • {fmtBytes(b.bytes)}
                  </span>
                  <button className="btn sm" onClick={() => void api.audiobooks.play(b.id)} title="Odtworz od poczatku">
                    <Icon name="open" /> Sluchaj
                  </button>
                  <button className="btn sm" onClick={() => setEditing(b)} title="Edytuj opis">
                    Edytuj
                  </button>
                  <button className="btn sm" onClick={() => void api.audiobooks.reveal(b.id)} title="Pokaz w folderze">
                    <Icon name="folder" />
                  </button>
                  <Confirm
                    text={'Usunac "' + b.title + '" z biblioteki? Pliki na dysku zostana nietkniete.'}
                    onYes={() => void api.audiobooks.remove(b.id).then(reload)}
                  />
                </div>

                {expanded && (
                  <div className="folder-tracks">
                    {list.length === 0 && <p className="muted">Wczytywanie...</p>}
                    {list.map((t) => (
                      <div key={t.id} className="track">
                        <span className="muted mono">{String(t.ord + 1).padStart(2, '0')}</span>
                        <span className="grow">{t.name}</span>
                        <span className="muted mono">{fmtBytes(t.bytes)}</span>
                        <button
                          className="btn sm ghost"
                          aria-label={'Odtworz ' + t.name}
                          onClick={() => void api.audiobooks.openTrack(t.path)}
                        >
                          <Icon name="open" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          title="Opis audiobooka"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Anuluj
              </button>
              <button className="btn primary" onClick={saveEdit}>
                Zapisz
              </button>
            </>
          }
        >
          <Field label="Tytul">
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </Field>
          <Field label="Autor">
            <input value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} />
          </Field>
          <Field label="Kategoria">
            <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
          </Field>
          <p className="muted">
            Dodano {fmtDate(editing.addedAt)} • {editing.source === 'file' ? 'pojedynczy plik' : 'katalog'} •{' '}
            <span className="mono">{editing.path}</span>
          </p>
        </Modal>
      )}
    </>
  )
}
