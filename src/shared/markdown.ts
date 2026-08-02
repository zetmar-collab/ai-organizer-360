export interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'ol' | 'quote' | 'code' | 'hr'
  text: string
}

/** Minimalny parser Markdown - tyle, ile potrzeba do eksportu PDF/DOCX. */
export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let inCode = false
  let code: string[] = []
  let para: string[] = []

  const flushPara = (): void => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ').trim() })
      para = []
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: code.join('\n') })
        code = []
        inCode = false
      } else {
        flushPara()
        inCode = true
      }
      continue
    }
    if (inCode) {
      code.push(line)
      continue
    }
    const t = line.trim()
    if (!t) {
      flushPara()
      continue
    }
    if (/^#{3,}\s/.test(t)) {
      flushPara()
      blocks.push({ type: 'h3', text: t.replace(/^#+\s*/, '') })
    } else if (/^##\s/.test(t)) {
      flushPara()
      blocks.push({ type: 'h2', text: t.replace(/^#+\s*/, '') })
    } else if (/^#\s/.test(t)) {
      flushPara()
      blocks.push({ type: 'h1', text: t.replace(/^#+\s*/, '') })
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara()
      blocks.push({ type: 'hr', text: '' })
    } else if (/^[-*+]\s/.test(t)) {
      flushPara()
      blocks.push({ type: 'li', text: t.replace(/^[-*+]\s*/, '') })
    } else if (/^\d+[.)]\s/.test(t)) {
      flushPara()
      blocks.push({ type: 'ol', text: t.replace(/^\d+[.)]\s*/, '') })
    } else if (/^>\s?/.test(t)) {
      flushPara()
      blocks.push({ type: 'quote', text: t.replace(/^>\s?/, '') })
    } else {
      para.push(t)
    }
  }
  if (inCode && code.length) blocks.push({ type: 'code', text: code.join('\n') })
  flushPara()
  return blocks
}

export interface Span {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
}

/** Rozbija tekst na fragmenty z **pogrubieniem**, *kursywa* i `kodem`. */
export function parseInline(text: string): Span[] {
  const spans: Span[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) })
    const tok = m[0]
    if (tok.startsWith('**')) spans.push({ text: tok.slice(2, -2), bold: true })
    else if (tok.startsWith('`')) spans.push({ text: tok.slice(1, -1), code: true })
    else spans.push({ text: tok.slice(1, -1), italic: true })
    last = m.index + tok.length
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans.length ? spans : [{ text }]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineHtml(text: string): string {
  return parseInline(text)
    .map((s) => {
      const t = esc(s.text)
      if (s.bold) return `<strong>${t}</strong>`
      if (s.italic) return `<em>${t}</em>`
      if (s.code) return `<code>${t}</code>`
      return t
    })
    .join('')
}

/** Renderuje Markdown do HTML bez otoczki dokumentu (uzywane tez w UI). */
export function markdownBodyHtml(md: string): string {
  const blocks = parseMarkdown(md)
  const parts: string[] = []
  let listOpen: 'ul' | 'ol' | null = null

  const closeList = (): void => {
    if (listOpen) {
      parts.push(`</${listOpen}>`)
      listOpen = null
    }
  }

  for (const b of blocks) {
    if (b.type === 'li' || b.type === 'ol') {
      const want = b.type === 'li' ? 'ul' : 'ol'
      if (listOpen !== want) {
        closeList()
        parts.push(`<${want}>`)
        listOpen = want
      }
      parts.push(`<li>${inlineHtml(b.text)}</li>`)
      continue
    }
    closeList()
    switch (b.type) {
      case 'h1':
        parts.push(`<h1>${inlineHtml(b.text)}</h1>`)
        break
      case 'h2':
        parts.push(`<h2>${inlineHtml(b.text)}</h2>`)
        break
      case 'h3':
        parts.push(`<h3>${inlineHtml(b.text)}</h3>`)
        break
      case 'quote':
        parts.push(`<blockquote>${inlineHtml(b.text)}</blockquote>`)
        break
      case 'code':
        parts.push(`<pre><code>${esc(b.text)}</code></pre>`)
        break
      case 'hr':
        parts.push('<hr/>')
        break
      default:
        parts.push(`<p>${inlineHtml(b.text)}</p>`)
    }
  }
  closeList()
  return parts.join('\n')
}

export function markdownToHtml(md: string, title: string): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #16181d; }
  h1 { font-size: 22pt; margin: 0 0 12pt; }
  h2 { font-size: 15pt; margin: 18pt 0 6pt; border-bottom: 1px solid #d8dde5; padding-bottom: 3pt; }
  h3 { font-size: 12.5pt; margin: 14pt 0 4pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
  li { margin: 0 0 4pt; }
  blockquote { margin: 0 0 10pt; padding: 6pt 12pt; border-left: 3px solid #6ea8fe; background: #f2f6fc; }
  pre { background: #f4f5f7; padding: 8pt; border-radius: 4pt; overflow-wrap: anywhere; white-space: pre-wrap; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
  hr { border: none; border-top: 1px solid #d8dde5; margin: 12pt 0; }
</style></head><body>${markdownBodyHtml(md)}</body></html>`
}
