import { describe, expect, it } from 'vitest'
import {
  buildPlaylist,
  commonBaseDir,
  groupByFolder,
  toFileUri,
  toRelative,
  trackTitle,
  type PlaylistTrack
} from '../src/shared/playlist'

const TRACKS: PlaylistTrack[] = [
  { path: 'C:\\Muzyka\\Rock\\01 Zażółć gęślą.mp3', name: '01 Zażółć gęślą.mp3' },
  { path: 'C:\\Muzyka\\Rock\\02 Utwor & inne.mp3', name: '02 Utwor & inne.mp3', durationSec: 214 }
]

describe('toRelative', () => {
  it('skraca sciezke lezaca w katalogu bazowym', () => {
    expect(toRelative('C:\\Muzyka\\Rock\\a.mp3', 'C:\\Muzyka')).toBe('Rock/a.mp3')
  })

  it('ignoruje wielkosc liter, bo Windows tak traktuje sciezki', () => {
    expect(toRelative('C:\\MUZYKA\\Rock\\a.mp3', 'c:\\muzyka')).toBe('Rock/a.mp3')
  })

  it('zostawia sciezke bezwzgledna, gdy plik jest poza katalogiem bazowym', () => {
    expect(toRelative('D:\\Inne\\a.mp3', 'C:\\Muzyka')).toBe('D:\\Inne\\a.mp3')
  })

  it('bez katalogu bazowego nie zmienia sciezki', () => {
    expect(toRelative('C:\\Muzyka\\a.mp3')).toBe('C:\\Muzyka\\a.mp3')
  })
})

describe('toFileUri', () => {
  it('koduje spacje i zachowuje dwukropek dysku', () => {
    expect(toFileUri('C:\\Muzyka\\Utwor z spacja.mp3')).toBe('file:///C:/Muzyka/Utwor%20z%20spacja.mp3')
  })

  it('koduje polskie znaki', () => {
    expect(toFileUri('C:\\Muzyka\\ą.mp3')).toContain('%C4%85')
  })
})

describe('trackTitle', () => {
  it('obcina rozszerzenie', () => {
    expect(trackTitle({ path: 'x', name: 'Utwor.mp3' })).toBe('Utwor')
  })

  it('zostawia kropki w srodku nazwy', () => {
    expect(trackTitle({ path: 'x', name: 'A.B.C.flac' })).toBe('A.B.C')
  })
})

describe('buildPlaylist - M3U', () => {
  const out = buildPlaylist('m3u8', TRACKS, { name: 'Moja lista', baseDir: 'C:\\Muzyka' })

  it('zaczyna sie naglowkiem i nazwa playlisty', () => {
    expect(out.startsWith('#EXTM3U')).toBe(true)
    expect(out).toContain('#PLAYLIST:Moja lista')
  })

  it('zapisuje nieznana dlugosc jako -1, a znana jako liczbe', () => {
    expect(out).toContain('#EXTINF:-1,01 Zażółć gęślą')
    expect(out).toContain('#EXTINF:214,02 Utwor & inne')
  })

  it('uzywa sciezek wzglednych', () => {
    expect(out).toContain('Rock/01 Zażółć gęślą.mp3')
    expect(out).not.toContain('C:/Muzyka/Rock')
  })

  it('konczy linie sekwencja CRLF', () => {
    expect(out.includes('\r\n')).toBe(true)
  })
})

describe('buildPlaylist - PLS', () => {
  const out = buildPlaylist('pls', TRACKS, { name: 'Lista' })

  it('numeruje wpisy od jedynki i podaje ich liczbe', () => {
    expect(out).toContain('File1=')
    expect(out).toContain('Title2=02 Utwor & inne')
    expect(out).toContain('NumberOfEntries=2')
    expect(out).toContain('Version=2')
  })
})

describe('buildPlaylist - XSPF', () => {
  const out = buildPlaylist('xspf', TRACKS, { name: 'Lista & spolka' })

  it('escapuje ampersand w tytule playlisty i utworu', () => {
    expect(out).toContain('<title>Lista &amp; spolka</title>')
    expect(out).toContain('<title>02 Utwor &amp; inne</title>')
    expect(out).not.toMatch(/<title>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/)
  })

  it('zapisuje lokalizacje jako file URI', () => {
    expect(out).toContain('<location>file:///C:/Muzyka/Rock/')
  })

  it('podaje dlugosc w milisekundach tylko dla znanych utworow', () => {
    expect(out).toContain('<duration>214000</duration>')
    expect((out.match(/<duration>/g) ?? []).length).toBe(1)
  })
})

describe('buildPlaylist - WPL', () => {
  const out = buildPlaylist('wpl', TRACKS, { name: 'Lista' })

  it('ma strukture SMIL wymagana przez Windows Media Player', () => {
    expect(out.startsWith('<?wpl version="1.0"?>')).toBe(true)
    expect(out).toContain('<smil>')
    expect(out).toContain('<seq>')
  })

  it('escapuje znaki specjalne w atrybucie src', () => {
    expect(out).toContain('02 Utwor &amp; inne.mp3')
    expect(out).not.toContain('& inne.mp3"')
  })
})

describe('buildPlaylist - przypadki brzegowe', () => {
  it('pusta lista daje poprawny naglowek bez wpisow', () => {
    expect(buildPlaylist('m3u8', [], { name: 'Pusta' })).toBe('#EXTM3U\r\n#PLAYLIST:Pusta\r\n')
    expect(buildPlaylist('pls', [], { name: 'Pusta' })).toContain('NumberOfEntries=0')
  })

  it('nieznany format konczy sie czytelnym bledem', () => {
    expect(() => buildPlaylist('mp3' as never, TRACKS, { name: 'x' })).toThrow(/Nieznany format/)
  })
})

describe('groupByFolder', () => {
  const files = [
    { path: 'C:\\Muzyka\\Rock\\b.mp3', name: 'b.mp3', size: 100 },
    { path: 'C:\\Muzyka\\Rock\\a.mp3', name: 'a.mp3', size: 200 },
    { path: 'C:\\Muzyka\\Jazz\\c.mp3', name: 'c.mp3', size: 50 }
  ]

  it('tworzy jedna grupe na katalog', () => {
    const groups = groupByFolder(files)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.label)).toEqual(['Jazz', 'Rock'])
  })

  it('sumuje rozmiar i sortuje utwory po nazwie', () => {
    const rock = groupByFolder(files).find((g) => g.label === 'Rock')!
    expect(rock.bytes).toBe(300)
    expect(rock.tracks.map((t) => t.name)).toEqual(['a.mp3', 'b.mp3'])
  })

  it('pusta lista daje pusty wynik', () => {
    expect(groupByFolder([])).toEqual([])
  })
})

describe('commonBaseDir', () => {
  it('znajduje wspolny katalog nadrzedny', () => {
    expect(commonBaseDir(['C:\\Muzyka\\Rock\\a.mp3', 'C:\\Muzyka\\Jazz\\b.mp3'])).toBe('C:/Muzyka')
  })

  it('zwraca pusty string dla roznych dyskow', () => {
    expect(commonBaseDir(['C:\\a\\x.mp3', 'D:\\b\\y.mp3'])).toBe('')
  })

  it('dla jednego pliku zwraca jego katalog', () => {
    expect(commonBaseDir(['C:\\Muzyka\\Rock\\a.mp3'])).toBe('C:/Muzyka/Rock')
  })

  it('pusta lista daje pusty string', () => {
    expect(commonBaseDir([])).toBe('')
  })
})
