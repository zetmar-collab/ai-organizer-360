import { describe, expect, it } from 'vitest'
import { cosine, fromBlob, LEX_DIM, lexicalEmbed, normalize, toBlob, tokenize } from '../src/shared/vector'

describe('tokenize', () => {
  it('pomija slowa krotsze niz trzy znaki', () => {
    expect(tokenize('to je bardzo dlugie slowo')).toEqual(['bardzo', 'dlugie', 'slowo'])
  })

  it('sprowadza polskie znaki do postaci bez diakrytykow', () => {
    expect(tokenize('zazolc')).toEqual(tokenize('zażółć'))
  })

  it('usuwa interpunkcje', () => {
    expect(tokenize('raport, wersja: druga!')).toEqual(['raport', 'wersja', 'druga'])
  })
})

describe('lexicalEmbed', () => {
  it('zwraca wektor o stalej dlugosci', () => {
    expect(lexicalEmbed('cokolwiek')).toHaveLength(LEX_DIM)
  })

  it('jest deterministyczny', () => {
    expect(lexicalEmbed('faktura za marzec')).toEqual(lexicalEmbed('faktura za marzec'))
  })

  it('zwraca wektor jednostkowy', () => {
    const v = lexicalEmbed('umowa najmu lokalu')
    const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    expect(len).toBeCloseTo(1, 6)
  })

  it('teksty o wspolnym slownictwie sa blizsze niz niezwiazane', () => {
    const q = lexicalEmbed('faktura za energie elektryczna')
    const bliski = cosine(fromBlob(toBlob(lexicalEmbed('faktura za energie za marzec'))), q)
    const daleki = cosine(fromBlob(toBlob(lexicalEmbed('przepis na ciasto drozdzowe'))), q)
    expect(bliski).toBeGreaterThan(daleki)
  })

  it('pusty tekst daje wektor zerowy zamiast NaN', () => {
    const v = lexicalEmbed('')
    expect(v.every((x) => x === 0)).toBe(true)
  })
})

describe('normalize', () => {
  it('skaluje do dlugosci jeden', () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8])
  })

  it('nie dzieli przez zero', () => {
    expect(normalize([0, 0])).toEqual([0, 0])
  })
})

describe('serializacja wektorow', () => {
  it('przechodzi przez BLOB bez straty', () => {
    const v = normalize([0.25, -0.5, 0.75, 1])
    const back = Array.from(fromBlob(toBlob(v)))
    back.forEach((x, i) => expect(x).toBeCloseTo(v[i], 6))
  })

  it('kopiuje bufor, wiec pozniejsza zmiana zrodla nie psuje odczytu', () => {
    const blob = toBlob([1, 0, 0])
    const vec = fromBlob(blob)
    blob.fill(0)
    expect(vec[0]).toBe(1)
  })
})

describe('cosine', () => {
  it('identyczne wektory daja jeden', () => {
    const v = normalize([1, 2, 3])
    expect(cosine(fromBlob(toBlob(v)), v)).toBeCloseTo(1, 6)
  })

  it('prostopadle wektory daja zero', () => {
    expect(cosine(fromBlob(toBlob([1, 0])), [0, 1])).toBeCloseTo(0, 6)
  })

  it('porownuje po krotszym wektorze zamiast wychodzic poza zakres', () => {
    expect(() => cosine(fromBlob(toBlob([1, 0, 0])), [1, 0])).not.toThrow()
  })
})
