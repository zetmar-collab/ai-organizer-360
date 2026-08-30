export type PlaylistFormat = 'm3u8' | 'm3u' | 'pls' | 'xspf' | 'wpl'

export interface PlaylistTrack {
  path: string
  name: string
  /** Sekundy; -1 oznacza nieznana dlugosc - aplikacja nie czyta metadanych audio. */
  durationSec?: number
}

export interface PlaylistOptions {
  name: string
  /** Gdy podany, sciezki wewnatrz tego katalogu zapisujemy wzglednie. */
  baseDir?: string
}

export const FORMATS: { id: PlaylistFormat; label: string; ext: string; note: string }[] = [
  { id: 'm3u8', label: 'M3U8 (UTF-8)', ext: 'm3u8', note: 'Domyslny. Polskie znaki bezpieczne. VLC, foobar2000, Winamp.' },
  { id: 'm3u', label: 'M3U', ext: 'm3u', note: 'Starszy wariant tej samej struktury. Plik i tak zapisujemy w UTF-8.' },
  { id: 'pls', label: 'PLS', ext: 'pls', note: 'Format Winampa i wielu odtwarzaczy sieciowych.' },
  { id: 'xspf', label: 'XSPF', ext: 'xspf', note: 'Otwarty format XML, natywny dla VLC.' },
  { id: 'wpl', label: 'WPL', ext: 'wpl', note: 'Windows Media Player.' }
]

/** Zamienia separatory na ukosniki i ucina koncowy separator. */
function slash(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Sciezka wzgledem katalogu bazowego. Porownanie bez rozroznienia wielkosci
 * liter, bo Windows tak traktuje sciezki. Plik spoza katalogu zostaje
 * bezwzgledny - lepiej dluga sciezka niz playlista wskazujaca w prozne.
 */
export function toRelative(filePath: string, baseDir?: string): string {
  if (!baseDir) return filePath
  const base = slash(baseDir) + '/'
  const file = slash(filePath)
  return file.toLowerCase().startsWith(base.toLowerCase()) ? file.slice(base.length) : filePath
}

/** file:///C:/Muzyka/Utwor%20z%20spacja.mp3 */
export function toFileUri(filePath: string): string {
  const p = slash(filePath)
  const withRoot = /^[a-zA-Z]:/.test(p) ? '/' + p : p
  return (
    'file://' +
    withRoot
      .split('/')
      .map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ':'))
      .join('/')
  )
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Nazwa wyswietlana w playliscie: nazwa pliku bez rozszerzenia. */
export function trackTitle(track: PlaylistTrack): string {
  return track.name.replace(/\.[^.]+$/, '')
}

function buildM3u(tracks: PlaylistTrack[], opts: PlaylistOptions): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${opts.name}`]
  for (const t of tracks) {
    lines.push(`#EXTINF:${t.durationSec ?? -1},${trackTitle(t)}`)
    lines.push(toRelative(t.path, opts.baseDir))
  }
  return lines.join('\r\n') + '\r\n'
}

function buildPls(tracks: PlaylistTrack[], opts: PlaylistOptions): string {
  const lines = ['[playlist]']
  tracks.forEach((t, i) => {
    const n = i + 1
    lines.push(`File${n}=${toRelative(t.path, opts.baseDir)}`)
    lines.push(`Title${n}=${trackTitle(t)}`)
    lines.push(`Length${n}=${t.durationSec ?? -1}`)
  })
  lines.push(`NumberOfEntries=${tracks.length}`, 'Version=2')
  return lines.join('\r\n') + '\r\n'
}

function buildXspf(tracks: PlaylistTrack[], opts: PlaylistOptions): string {
  const entries = tracks
    .map((t) =>
      [
        '    <track>',
        `      <location>${escapeXml(toFileUri(t.path))}</location>`,
        `      <title>${escapeXml(trackTitle(t))}</title>`,
        t.durationSec && t.durationSec > 0 ? `      <duration>${Math.round(t.durationSec * 1000)}</duration>` : null,
        '    </track>'
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<playlist version="1" xmlns="http://xspf.org/ns/0/">',
    `  <title>${escapeXml(opts.name)}</title>`,
    '  <trackList>',
    entries,
    '  </trackList>',
    '</playlist>',
    ''
  ].join('\n')
}

function buildWpl(tracks: PlaylistTrack[], opts: PlaylistOptions): string {
  const media = tracks
    .map((t) => `      <media src="${escapeXml(toRelative(t.path, opts.baseDir))}"/>`)
    .join('\n')
  return [
    '<?wpl version="1.0"?>',
    '<smil>',
    '  <head>',
    `    <meta name="Generator" content="AI Organizer 360"/>`,
    `    <title>${escapeXml(opts.name)}</title>`,
    '  </head>',
    '  <body>',
    `    <seq>`,
    media,
    '    </seq>',
    '  </body>',
    '</smil>',
    ''
  ].join('\n')
}

export function buildPlaylist(format: PlaylistFormat, tracks: PlaylistTrack[], opts: PlaylistOptions): string {
  switch (format) {
    case 'm3u8':
    case 'm3u':
      return buildM3u(tracks, opts)
    case 'pls':
      return buildPls(tracks, opts)
    case 'xspf':
      return buildXspf(tracks, opts)
    case 'wpl':
      return buildWpl(tracks, opts)
    default:
      throw new Error(`Nieznany format playlisty: ${format}`)
  }
}

export interface FolderGroup {
  dir: string
  label: string
  tracks: PlaylistTrack[]
  bytes: number
}

/**
 * Grupuje utwory po katalogu, w ktorym leza na dysku - struktura playlisty
 * odwzorowuje wtedy to, jak uzytkownik sam poukladal muzyke.
 */
export function groupByFolder<T extends { path: string; name: string; size?: number }>(files: T[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>()
  for (const f of files) {
    const p = slash(f.path)
    const cut = p.lastIndexOf('/')
    const dir = cut > 0 ? p.slice(0, cut) : p
    let g = map.get(dir)
    if (!g) {
      g = { dir, label: dir.slice(dir.lastIndexOf('/') + 1) || dir, tracks: [], bytes: 0 }
      map.set(dir, g)
    }
    g.tracks.push({ path: f.path, name: f.name })
    g.bytes += f.size ?? 0
  }
  for (const g of map.values()) g.tracks.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  return [...map.values()].sort((a, b) => a.dir.localeCompare(b.dir, 'pl'))
}

/** Najdluzszy wspolny katalog - baza dla sciezek wzglednych. */
export function commonBaseDir(paths: string[]): string {
  if (!paths.length) return ''
  const parts = paths.map((p) => slash(p).split('/').slice(0, -1))
  let common = parts[0]
  for (const segs of parts.slice(1)) {
    let i = 0
    while (i < common.length && i < segs.length && common[i].toLowerCase() === segs[i].toLowerCase()) i++
    common = common.slice(0, i)
    if (!common.length) break
  }
  return common.join('/')
}
