import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { dirname } from 'path'
import { buildPlaylist, commonBaseDir, FORMATS, type PlaylistFormat, type PlaylistTrack } from '../shared/playlist'

export interface SavePlaylistRequest {
  format: PlaylistFormat
  name: string
  tracks: PlaylistTrack[]
  /** Sciezki wzgledem katalogu playlisty - przenosna, gdy playlista lezy przy muzyce. */
  relative: boolean
}

export interface SavePlaylistResult {
  ok: boolean
  path?: string
  canceled?: boolean
  tracks?: number
}

function safeName(name: string): string {
  return (name || 'playlista').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
}

export async function savePlaylist(req: SavePlaylistRequest, parent?: BrowserWindow): Promise<SavePlaylistResult> {
  if (!req.tracks?.length) throw new Error('Playlista jest pusta - zaznacz katalogi albo pojedyncze utwory.')
  const fmt = FORMATS.find((f) => f.id === req.format)
  if (!fmt) throw new Error(`Nieznany format playlisty: ${req.format}`)

  const suggested = commonBaseDir(req.tracks.map((t) => t.path))
  const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
    title: 'Zapisz playliste',
    defaultPath: (suggested ? suggested + '/' : '') + `${safeName(req.name)}.${fmt.ext}`,
    filters: [{ name: fmt.label, extensions: [fmt.ext] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  // Sciezki wzgledne licza sie od katalogu, w ktorym ląduje playlista - nie od
  // katalogu muzyki. Inaczej odtwarzacz nie znajdzie ani jednego pliku.
  const baseDir = req.relative ? dirname(filePath) : undefined
  const content = buildPlaylist(req.format, req.tracks, { name: req.name, baseDir })

  await writeFile(filePath, content, 'utf8')
  return { ok: true, path: filePath, tracks: req.tracks.length }
}
