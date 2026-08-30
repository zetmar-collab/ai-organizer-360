import React, { useMemo, useState } from 'react'
import type { LibraryFile } from '../../../shared/types'
import { FORMATS, groupByFolder, type PlaylistFormat } from '../../../shared/playlist'
import { api, errMsg, fmtBytes } from '../lib/api'
import { Icon } from '../lib/icons'
import { Empty, ErrorBox, toast } from '../lib/ui'

/**
 * Widok muzyki pogrupowanej tak, jak lezy na dysku: jeden katalog = jedna
 * grupa. Zaznaczone katalogi i pojedyncze utwory skladaja sie na playliste,
 * ktora zapisujemy w formacie wybranym przez uzytkownika.
 */
export default function MusicFolders({ files }: { files: LibraryFile[] }): React.JSX.Element {
  const groups = useMemo(() => groupByFolder(files), [files])

  const [open, setOpen] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<PlaylistFormat>('m3u8')
  const [relative, setRelative] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggleOpen = (dir: string): void =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(dir) ? next.delete(dir) : next.add(dir)
      return next
    })

  const toggleTrack = (path: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const toggleFolder = (dir: string): void => {
    const group = groups.find((g) => g.dir === dir)
    if (!group) return
    const paths = group.tracks.map((t) => t.path)
    const allIn = paths.every((p) => selected.has(p))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of paths) allIn ? next.delete(p) : next.add(p)
      return next
    })
  }

  const selectAll = (): void => setSelected(new Set(files.map((f) => f.path)))
  const clearAll = (): void => setSelected(new Set())

  /** Kolejnosc utworow idzie za kolejnoscia katalogow i nazw plikow. */
  const tracks = useMemo(
    () =>
      groups.flatMap((g) => g.tracks.filter((t) => selected.has(t.path)).map((t) => ({ path: t.path, name: t.name }))),
    [groups, selected]
  )

  const defaultName = (): string => {
    const dirs = groups.filter((g) => g.tracks.some((t) => selected.has(t.path)))
    if (dirs.length === 1) return dirs[0].label
    return dirs.length ? `Playlista (${dirs.length} katalogi)` : 'Playlista'
  }

  const save = async (): Promise<void> => {
    if (!tracks.length) {
      setError('Nie zaznaczono zadnego utworu.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await api.playlist.save({ format, name: name.trim() || defaultName(), tracks, relative })
      if (r.canceled) return
      toast(`Zapisano playliste (${r.tracks} utworow): ${r.path}`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!groups.length) {
    return <Empty text="Brak plikow muzycznych. Przeskanuj folder z muzyka, a katalogi pojawia sie tutaj." icon="music" />
  }

  const activeFormat = FORMATS.find((f) => f.id === format)!

  return (
    <>
      <ErrorBox error={error} />

      <div className="card stack-lg">
        <h3>Playlista z zaznaczonych katalogow</h3>
        <div className="row">
          <label className="field playlist-field">
            <span>Nazwa</span>
            <input
              placeholder={defaultName()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nazwa playlisty"
            />
          </label>
          <label className="field playlist-field">
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as PlaylistFormat)}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary playlist-save" onClick={save} disabled={busy || !tracks.length}>
            {busy ? <span className="spinner" /> : <Icon name="playlist" />} Zapisz {tracks.length} utworow
          </button>
        </div>

        <div className="row">
          <label className="row check">
            <input type="checkbox" checked={relative} onChange={(e) => setRelative(e.target.checked)} />
            <span className="muted">Sciezki wzgledem pliku playlisty (przenosne razem z muzyka)</span>
          </label>
          <span className="grow" />
          <button className="btn sm" onClick={selectAll}>
            Zaznacz wszystko
          </button>
          <button className="btn sm" onClick={clearAll} disabled={!selected.size}>
            Wyczysc
          </button>
        </div>

        <p className="muted hint stack-md">{activeFormat.note}</p>
      </div>

      <div className="card no-pad">
        {groups.map((g) => {
          const paths = g.tracks.map((t) => t.path)
          const chosen = paths.filter((p) => selected.has(p)).length
          const expanded = open.has(g.dir)
          return (
            <div key={g.dir} className="folder">
              <div className="folder-head">
                <input
                  type="checkbox"
                  aria-label={'Zaznacz katalog ' + g.label}
                  checked={chosen === paths.length}
                  ref={(el) => {
                    if (el) el.indeterminate = chosen > 0 && chosen < paths.length
                  }}
                  onChange={() => toggleFolder(g.dir)}
                />
                <button
                  className="btn ghost folder-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleOpen(g.dir)}
                >
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} />
                  <Icon name="folder" />
                  <span className="grow">
                    <b>{g.label}</b>
                    <span className="muted mono folder-path">{g.dir}</span>
                  </span>
                </button>
                <span className="muted mono">
                  {chosen ? chosen + '/' : ''}
                  {g.tracks.length} • {fmtBytes(g.bytes)}
                </span>
              </div>

              {expanded && (
                <div className="folder-tracks">
                  {g.tracks.map((t) => (
                    <div key={t.path} className="track">
                      <input
                        type="checkbox"
                        aria-label={'Zaznacz utwor ' + t.name}
                        checked={selected.has(t.path)}
                        onChange={() => toggleTrack(t.path)}
                      />
                      <span className="grow">{t.name}</span>
                      <button
                        className="btn sm ghost"
                        aria-label={'Odtworz ' + t.name}
                        onClick={() => void api.lib.open(t.path)}
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
    </>
  )
}
