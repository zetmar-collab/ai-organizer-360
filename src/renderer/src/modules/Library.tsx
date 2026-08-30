import React, { useEffect, useRef, useState } from 'react'
import type { LibraryFile, LibraryKind } from '../../../shared/types'
import { api, errMsg, fmtBytes, newRequestId, useDebounced, useList } from '../lib/api'
import { Icon, type IconName } from '../lib/icons'
import { Confirm, Empty, ErrorBox, Progress, Skeleton, toast } from '../lib/ui'
import MusicFolders from './MusicFolders'

interface Config {
  title: string
  hint: string
  icon: IconName
  indexable: boolean
}

const INDEXABLE_EXT = ['pdf', 'docx', 'txt', 'md', 'csv']
const INDEX_LIMIT = 50

const CONFIG: Record<LibraryKind, Config> = {
  document: { title: 'Dokumenty', hint: 'PDF, DOCX, TXT, MD, CSV, XLSX, PPTX', icon: 'library', indexable: true },
  music: { title: 'Muzyka', hint: 'MP3, FLAC, WAV, M4A, OGG', icon: 'music', indexable: false },
  ebook: { title: 'E-booki', hint: 'EPUB, MOBI, AZW3, PDF, FB2', icon: 'ebook', indexable: true },
  photo: { title: 'Zdjecia', hint: 'JPG, PNG, WEBP, TIFF, RAW', icon: 'photo', indexable: false }
}

export default function Library({
  kind,
  initialSearch
}: {
  kind: LibraryKind
  initialSearch?: string
}): React.JSX.Element {
  const cfg = CONFIG[kind]
  const [search, setSearch] = useState(initialSearch ?? '')
  const [category, setCategory] = useState('')
  // muzyke domyslnie pokazujemy w ukladzie katalogow - stad powstaja playlisty
  const [view, setView] = useState<'list' | 'folders'>(kind === 'music' ? 'folders' : 'list')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null)
  const reqRef = useRef('')

  const debouncedSearch = useDebounced(search)

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  const { items, loading, error: listError, reload } = useList<LibraryFile>(
    'files',
    {
      where: { kind, ...(category ? { category } : {}) },
      search: { columns: ['name', 'tags', 'category'], term: debouncedSearch },
      orderBy: 'id desc',
      limit: 1000
    },
    [kind, debouncedSearch, category]
  )

  useEffect(
    () =>
      api.kb.onProgress((e) => {
        if (e.requestId && e.requestId !== reqRef.current) return
        setProgress(e.current >= e.total ? null : { current: e.current, total: e.total, file: e.file })
      }),
    []
  )

  const filtered = Boolean(debouncedSearch.trim() || category)
  const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean))).sort()
  const totalBytes = items.reduce((s, f) => s + (f.size || 0), 0)
  const indexable = items.filter((f) => INDEXABLE_EXT.includes(f.ext))

  const scan = async (): Promise<void> => {
    const folder = await api.dialog.folder()
    if (!folder) return
    setBusy(true)
    setError('')
    try {
      const r = await api.lib.scan(kind, folder)
      toast('Przeskanowano ' + r.folder + ': ' + r.added + ' nowych, ' + r.updated + ' zaktualizowanych.')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const categorize = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const r = await api.ai.categorize(kind)
      toast(r.updated ? 'AI przypisalo kategorie do ' + r.updated + ' plikow.' : 'Wszystkie pliki maja juz kategorie.')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  /** Indeksuje dokladnie to, co widac na liscie - zakres jest wypisany na przycisku. */
  const indexVisible = async (): Promise<void> => {
    const paths = indexable.slice(0, INDEX_LIMIT).map((f) => f.path)
    if (!paths.length) {
      setError('Na liscie nie ma plikow w formacie mozliwym do zaindeksowania (' + INDEXABLE_EXT.join(', ') + ').')
      return
    }
    setBusy(true)
    setError('')
    const requestId = newRequestId()
    reqRef.current = requestId
    setProgress({ current: 0, total: paths.length, file: '' })
    try {
      const res = await api.kb.indexFiles({ paths, requestId })
      const ok = res.filter((r) => r.ok).length
      toast('Zaindeksowano ' + ok + ' z ' + res.length + ' plikow do bazy wiedzy.')
      const failed = res.filter((r) => !r.ok)
      if (failed.length) setError(failed.map((f) => f.path + ': ' + f.message).join('\n'))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setProgress(null)
      setBusy(false)
      reqRef.current = ''
    }
  }

  return (
    <>
      <ErrorBox error={error || listError} />

      <div className="card stack-lg">
        <div className="row">
          <button className="btn primary" onClick={scan} disabled={busy}>
            <Icon name="folder" /> Skanuj folder
          </button>
          <button className="btn" onClick={categorize} disabled={busy || !items.length}>
            {busy && !progress ? <span className="spinner" /> : <Icon name="sparkle" />} Kategoryzuj AI
          </button>
          {cfg.indexable && (
            <button
              className="btn"
              onClick={indexVisible}
              disabled={busy || !indexable.length}
              title={'Do bazy wiedzy trafia pliki widoczne na liscie, maksymalnie ' + INDEX_LIMIT}
            >
              <Icon name="knowledge" /> Indeksuj {Math.min(indexable.length, INDEX_LIMIT)} plikow
            </button>
          )}
          {kind === 'music' && (
            <span className="view-switch">
              <button
                className={'btn sm ' + (view === 'folders' ? 'primary' : '')}
                onClick={() => setView('folders')}
              >
                <Icon name="folder" /> Katalogi
              </button>
              <button className={'btn sm ' + (view === 'list' ? 'primary' : '')} onClick={() => setView('list')}>
                <Icon name="list" /> Lista
              </button>
            </span>
          )}
          <span className="grow" />
          <span className="muted">
            {filtered ? 'w filtrze: ' : ''}
            <span className="mono">{items.length}</span> plikow, <span className="mono">{fmtBytes(totalBytes)}</span>
          </span>
        </div>

        {progress && (
          <Progress
            value={progress.current}
            max={progress.total}
            label={progress.file ? 'Indeksowanie: ' + progress.file : 'Przygotowanie...'}
          />
        )}

        <div className="row stack-md">
          <input
            className="grow"
            aria-label="Szukaj w bibliotece"
            placeholder="Szukaj po nazwie, kategorii, tagach..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="w-project"
            aria-label="Filtr kategorii"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="muted hint stack-md">Obslugiwane formaty: {cfg.hint}</p>
      </div>

      {loading ? (
        <Skeleton rows={5} height={44} />
      ) : view === 'folders' ? (
        <MusicFolders files={items} />
      ) : items.length === 0 ? (
        <Empty
          text={
            filtered
              ? 'Nic nie pasuje do filtra.'
              : 'Biblioteka jest pusta. Wskaz folder z plikami (' + cfg.hint + '), a aplikacja zbuduje indeks.'
          }
          icon={cfg.icon}
          action={
            filtered ? undefined : (
              <button className="btn primary" onClick={scan}>
                <Icon name="folder" /> Skanuj folder
              </button>
            )
          }
        />
      ) : (
        <div className="card no-pad">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th className="col-mid">Kategoria</th>
                  <th className="col-narrow">Typ</th>
                  <th className="col-narrow">Rozmiar</th>
                  <th className="col-mid" />
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 500).map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div>{f.name}</div>
                      <div className="muted mono">{f.path}</div>
                    </td>
                    <td>{f.category ? <span className="pill">{f.category}</span> : <span className="muted">—</span>}</td>
                    <td className="muted mono">{f.ext}</td>
                    <td className="muted mono">{fmtBytes(f.size)}</td>
                    <td>
                      <div className="row">
                        <button className="btn sm" onClick={() => void api.lib.open(f.path)}>
                          <Icon name="open" /> Otworz
                        </button>
                        <button className="btn sm" onClick={() => void api.lib.reveal(f.path)}>
                          <Icon name="folder" />
                        </button>
                        <Confirm
                          text={'Usunac "' + f.name + '" z biblioteki? Plik na dysku zostanie nietkniety.'}
                          onYes={() => void api.crud.remove('files', f.id).then(reload)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 500 && (
            <p className="muted pad">Pokazano pierwsze 500 z {items.length} pozycji — zaweź filtr, zeby zobaczyc reszte.</p>
          )}
        </div>
      )}
    </>
  )
}
