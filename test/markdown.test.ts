import { describe, expect, it } from 'vitest'
import { markdownBodyHtml, markdownToHtml, parseInline, parseMarkdown } from '../src/shared/markdown'

/**
 * To jest granica XSS aplikacji: tekst z modelu AI i z wyciagniętych PDF-ow
 * trafia stad prosto do dangerouslySetInnerHTML. Kazdy przypadek ponizej
 * pilnuje, ze zaden surowy HTML nie przechodzi dalej.
 */
describe('markdownBodyHtml - escapowanie', () => {
  it('escapuje znaczniki w akapicie', () => {
    const html = markdownBodyHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapuje znaczniki w naglowku', () => {
    expect(markdownBodyHtml('# <img src=x onerror=alert(1)>')).not.toContain('<img')
  })

  it('escapuje znaczniki w bloku kodu', () => {
    const html = markdownBodyHtml('```\n<iframe src="evil"></iframe>\n```')
    expect(html).not.toContain('<iframe')
    expect(html).toContain('&lt;iframe')
  })

  it('escapuje znaczniki w elemencie listy i cytacie', () => {
    expect(markdownBodyHtml('- <b>pogrubione</b>')).not.toContain('<b>pogrubione')
    expect(markdownBodyHtml('> <svg onload=alert(1)>')).not.toContain('<svg')
  })

  it('escapuje ampersand, zeby nie dalo sie zlozyc encji', () => {
    expect(markdownBodyHtml('&lt;script&gt;')).toContain('&amp;lt;')
  })

  it('nie przepuszcza HTML-a ukrytego w tekscie pogrubionym', () => {
    expect(markdownBodyHtml('**<script>x</script>**')).not.toContain('<script>')
  })

  it('escapuje tytul dokumentu w pelnym HTML-u', () => {
    expect(markdownToHtml('tresc', '</title><script>alert(1)</script>')).not.toContain('<script>alert')
  })
})

describe('markdownBodyHtml - struktura', () => {
  it('rozpoznaje trzy poziomy naglowkow', () => {
    const html = markdownBodyHtml('# jeden\n\n## dwa\n\n### trzy')
    expect(html).toContain('<h1>jeden</h1>')
    expect(html).toContain('<h2>dwa</h2>')
    expect(html).toContain('<h3>trzy</h3>')
  })

  it('zamyka liste przed kolejnym blokiem', () => {
    const html = markdownBodyHtml('- a\n- b\n\nakapit')
    expect(html).toContain('<ul>')
    expect(html.indexOf('</ul>')).toBeLessThan(html.indexOf('<p>akapit</p>'))
    expect((html.match(/<li>/g) ?? []).length).toBe(2)
  })

  it('przelacza sie z listy punktowanej na numerowana', () => {
    const html = markdownBodyHtml('- a\n\n1. b')
    expect(html).toContain('</ul>')
    expect(html).toContain('<ol>')
    expect(html).toContain('</ol>')
  })

  it('laczy kolejne linie w jeden akapit', () => {
    expect(markdownBodyHtml('pierwsza\ndruga')).toBe('<p>pierwsza druga</p>')
  })

  it('zwraca pusty string dla pustego wejscia', () => {
    expect(markdownBodyHtml('')).toBe('')
  })

  it('domyka niezamkniety blok kodu', () => {
    const html = markdownBodyHtml('```\nkod bez zamkniecia')
    expect(html).toContain('<pre><code>kod bez zamkniecia</code></pre>')
  })

  it('normalizuje CRLF', () => {
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2)
  })
})

describe('parseInline', () => {
  it('rozdziela pogrubienie, kursywe i kod', () => {
    expect(parseInline('a **b** c *d* e `f`')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c ' },
      { text: 'd', italic: true },
      { text: ' e ' },
      { text: 'f', code: true }
    ])
  })

  it('zostawia niedomkniete gwiazdki jako zwykly tekst', () => {
    expect(parseInline('**bez konca')).toEqual([{ text: '**bez konca' }])
  })

  it('zwraca caly tekst, gdy nie ma znacznikow', () => {
    expect(parseInline('zwykly tekst')).toEqual([{ text: 'zwykly tekst' }])
  })
})
