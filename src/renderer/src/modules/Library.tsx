import React, { useState } from 'react'
import type { LibraryFile, LibraryKind } from '../../../shared/types'
import { api, errMsg, fmtBytes, useList } from '../lib/api'
import { Confirm, Empty, ErrorBox } from '../lib/ui'

interface Config {
  kind: LibraryKind
  title: string
  hint: string
  indexable: boolean
}

const CONFIG: Record<LibraryKind, Config> = {
  document: {
    kind: 'document',
    title: 'Dokumenty',
    hint: 'PDF, DOCX, TXT, MD, CSV, XLSX, PPTX',
    indexable: true
  },
  music: { kind: 'music', title: 'Muzyka', hint: 'MP3, FLAC, WAV, M4A, OGG', indexable: false },
  ebook: { kind: 'ebook', title: 'E-booki', hint: 'EPUB, MOBI, AZW3, PDF, FB2', indexable: true },
  photo: { kind: 'photo', title: 'Zdjecia', hint: 'JPG, PNG, WEBP, TIFF, RAW', indexable: false }
}

export default function Library({ kind }: { kind: LibraryKind }): React.JSX.Element {
  const cfg = CONFIG[kind]
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const { items, reload } = useList<LibraryFile>(
    'files',
    {
      where: { kind, ...(category ? { category } : {}) },
      search: { columns: ['name', 'tags', 'category'], term: search },
      orderBy: 'id desc',
      limit: 1000
    },
    [kind, search, category]
  )

  const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean))).sort()
  const totalBytes = items.reduce((s, f) => s + (f.size || 0), 0)

  const scan = async (): Promise<void> => {
    const folder = await api.dialog.folder()
    if (!folder) return
    setBusy(true)
    setError('')
    try {
      const r = await api.lib.scan(kind, folder)
      setInfo(`Skanowanie "${r.folder}": znaleziono ${r.scanned}, nowych ${r.added}, zaktualizowanych ${r.updated}.`)
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
    setInfo('')
    try {
      const r = await api.ai.categorize(kind)
      setInfo(r.updated ? `AI przypisalo kategorie do ${r.updated} plikow.` : 'Wszystkie pliki maja juz kategorie.')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const indexSelected = async (): Promise<void> => {
    const paths = items.filter((f) => ['pdf', 'docx', 'txt', 'md', 'csv'].includes(f.ext)).map((f) => f.path)
    if (!paths.length) {
      setError('Brak plikow w formacie mozliwym do zaindeksowania (PDF, DOCX, TXT, MD, CSV).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.kb.indexFiles(paths.slice(0, 50))
      const ok = res.filter((r) => r.ok).length
      setInfo(`Zaindeksowano ${ok}/${res.length} plikow do bazy wiedzy.`)
      const failed = res.filter((r) => !r.ok)
      if (failed.length) setError(failed.map((f) => `${f.path}: ${f.message}`).join('\n'))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ErrorBox error={error} />
      {info && <div className="notice">{info}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <button className="btn primary" onClick={scan} disabled={busy}>
            📁 Skanuj folder
          </button>
          <button className="btn" onClick={categorize} disabled={busy || !items.length}>
            {busy ? <span className="spinner" /> : '✨'} Kategoryzuj AI
          </button>
          {cfg.indexable && (
            <button className="btn" onClick={indexSelected} disabled={busy || !items.length}>
              🧠 Indeksuj do bazy wiedzy
            </button>
          )}
          <span className="grow" />
          <span className="muted">
            {items.length} plikow • {fmtBytes(totalBytes)}
          </span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="grow" placeholder="Szukaj..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Wszystkie kategorie</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Obslugiwane formaty: {cfg.hint}
        </div>
      </div>

      {items.length === 0 ? (
        <Empty text={`Brak plikow. Kliknij "Skanuj folder" i wskaz katalog z plikami (${cfg.hint}).`} />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th style={{ width: 130 }}>Kategoria</th>
                <th style={{ width: 70 }}>Typ</th>
                <th style={{ width: 90 }}>Rozmiar</th>
                <th style={{ width: 150 }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 500).map((f) => (
                <tr key={f.id}>
                  <td>
                    <div>{f.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {f.path}
                    </div>
                  </td>
                  <td>{f.category ? <span className="pill">{f.category}</span> : <span className="muted">-</span>}</td>
                  <td className="muted">{f.ext}</td>
                  <td className="muted">{fmtBytes(f.size)}</td>
                  <td>
                    <div className="row">
                      <button className="btn sm" onClick={() => void api.lib.open(f.path)}>
                        Otworz
                      </button>
                      <button className="btn sm" onClick={() => void api.lib.reveal(f.path)}>
                        Folder
                      </button>
                      <Confirm
                        text={`Usunac "${f.name}" z biblioteki? Plik na dysku pozostanie nietkniety.`}
                        onYes={() => {
                          void api.crud.remove('files', f.id).then(reload)
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 500 && <div className="muted" style={{ padding: 10 }}>Pokazano pierwsze 500 pozycji.</div>}
        </div>
      )}
    </>
  )
}
