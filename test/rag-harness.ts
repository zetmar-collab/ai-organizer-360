/**
 * Test end-to-end pipeline RAG na prawdziwych plikach, uzywajacy modulow
 * produkcyjnych z src/main (extract -> chunking -> embeddingi -> wyszukiwanie -> odpowiedz AI).
 * Uruchamiany pod Electronem z osobnym --user-data-dir, wiec nie dotyka bazy uzytkownika.
 */
import { app } from 'electron'
import { initDb } from '../src/main/db'
import { buildContext, indexFile, listDocs, search } from '../src/main/rag'
import { provider } from '../src/main/ai/provider'

const FILES = process.argv.filter((a) => a.toLowerCase().endsWith('.pdf') || a.toLowerCase().endsWith('.docx'))
const QUERY = process.env['RAG_QUERY'] ?? 'Jakie sa zalety uruchamiania modeli AI lokalnie?'

app.on('window-all-closed', () => {})

void app.whenReady().then(async () => {
  initDb()
  console.log('=== INDEKSOWANIE ===')
  for (const file of FILES) {
    const t0 = Date.now()
    try {
      const r = await indexFile(file)
      console.log(
        `OK  ${r.title}\n    ${r.chars} znakow -> ${r.chunks} fragmentow, tryb embeddingow: ${r.mode}, ${Date.now() - t0} ms`
      )
    } catch (e) {
      console.log(`BLAD ${file}\n    ${(e as Error).message}`)
    }
  }

  console.log('\n=== BAZA WIEDZY ===')
  for (const d of listDocs()) console.log(`  #${d.id} ${d.title} (${d.kind}, ${d.chunks} fragmentow)`)

  console.log('\n=== WYSZUKIWANIE SEMANTYCZNE ===')
  console.log('Pytanie:', QUERY)
  const t1 = Date.now()
  const hits = await search(QUERY, 4)
  console.log(`Znaleziono ${hits.length} fragmentow w ${Date.now() - t1} ms`)
  for (const [i, h] of hits.entries()) {
    console.log(
      `  [${i + 1}] ${(h.score * 100).toFixed(1)}%  ${h.docTitle} (fragment ${h.ord + 1})\n      "${h.text
        .replace(/\s+/g, ' ')
        .slice(0, 150)}..."`
    )
  }

  if (!hits.length) return app.exit(1)

  console.log('\n=== ODPOWIEDZ AI Z CYTOWANIEM ZRODEL ===')
  const t2 = Date.now()
  const answer = await provider().chat([
    {
      role: 'system',
      content:
        'Odpowiadasz po polsku wylacznie na podstawie ponizszych fragmentow. Powoluj sie na zrodla numerami [1], [2].\n\n' +
        buildContext(hits)
    },
    { role: 'user', content: QUERY }
  ])
  console.log(`(${Date.now() - t2} ms)\n${answer.trim()}`)

  app.exit(0)
})
