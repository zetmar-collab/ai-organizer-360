import { describe, expect, it } from 'vitest'
import { chunkText } from '../src/shared/chunk'

describe('chunkText', () => {
  it('zwraca pusta tablice dla pustego wejscia i bialych znakow', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('krotki tekst zostaje jednym fragmentem', () => {
    expect(chunkText('krotka notatka')).toEqual(['krotka notatka'])
  })

  it('zaden fragment nie przekracza zadanego rozmiaru', () => {
    const text = 'zdanie testowe. '.repeat(500)
    for (const c of chunkText(text, 200, 40)) expect(c.length).toBeLessThanOrEqual(200)
  })

  it('kolejne fragmenty zachodza na siebie, wiec tekst na styku nie ginie', () => {
    const text = 'a'.repeat(60) + ' PUNKT_STYKU ' + 'b'.repeat(60)
    const chunks = chunkText(text, 70, 30)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toContain('PUNKT_STYKU')
  })

  it('tnie na granicy akapitu, gdy wypada w drugiej polowie okna', () => {
    const first = 'x'.repeat(60)
    const second = 'y'.repeat(60)
    const chunks = chunkText(first + '\n\n' + second, 100, 10)
    expect(chunks[0]).toBe(first)
  })

  it('radzi sobie z tekstem bez zadnych separatorow', () => {
    const chunks = chunkText('z'.repeat(1000), 100, 20)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
  })

  it('normalizuje CRLF i zwija nadmiarowe puste linie', () => {
    expect(chunkText('a\r\n\r\n\r\n\r\nb')).toEqual(['a\n\nb'])
  })

  it('konczy sie dla malego zachodzenia i duzego rozmiaru', () => {
    expect(chunkText('slowo '.repeat(2000), 300, 0).length).toBeGreaterThan(5)
  })

  it('nie gubi tresci - suma fragmentow zawiera kazde slowo zrodla', () => {
    const words = Array.from({ length: 300 }, (_, i) => 'slowo' + i)
    const joined = chunkText(words.join(' '), 250, 50).join(' ')
    for (const w of words) expect(joined).toContain(w)
  })
})
