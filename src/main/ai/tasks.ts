import { getDb } from '../db'
import { provider, type ChatOptions } from './provider'
import { buildContext, search } from '../rag'
import type { AiTaskName, ChatTurn } from '../../shared/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function ask(system: string, user: string, opts: ChatOptions = {}): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
  return provider().chat(messages, opts)
}

/* ---------- zbieranie kontekstu z bazy ---------- */

function todayAgenda(): string {
  const db = getDb()
  const d = today()
  const events = db.all(
    "SELECT title, start, end, location FROM events WHERE date(start) = date(?) ORDER BY start",
    [d]
  ) as { title: string; start: string; end: string; location: string }[]
  const tasks = db.all(
    "SELECT title, priority, due FROM tasks WHERE done = 0 ORDER BY (due IS NULL), due, priority DESC LIMIT 30"
  ) as { title: string; priority: number; due: string | null }[]

  const prio = ['niski', 'normalny', 'wysoki']
  return [
    `Data: ${d}`,
    'WYDARZENIA W KALENDARZU:',
    events.length
      ? events.map((e) => `- ${e.start} - ${e.end}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')
      : '- brak',
    '',
    'OTWARTE ZADANIA:',
    tasks.length
      ? tasks.map((t) => `- ${t.title} [priorytet: ${prio[t.priority] ?? 'normalny'}${t.due ? `, termin: ${t.due}` : ''}]`).join('\n')
      : '- brak'
  ].join('\n')
}

function productivityData(): string {
  const db = getDb()
  const done = db.get(
    "SELECT COUNT(*) as n FROM tasks WHERE done = 1 AND completedAt >= date('now','-30 days')"
  ) as { n: number }
  const open = db.get('SELECT COUNT(*) as n FROM tasks WHERE done = 0') as { n: number }
  const overdue = db.get("SELECT COUNT(*) as n FROM tasks WHERE done = 0 AND due IS NOT NULL AND due < date('now')") as {
    n: number
  }
  const byProject = db.all(
    `SELECT COALESCE(p.name,'(bez projektu)') as project,
            SUM(CASE WHEN t.done = 1 THEN 1 ELSE 0 END) as done,
            SUM(CASE WHEN t.done = 0 THEN 1 ELSE 0 END) as open
     FROM tasks t LEFT JOIN projects p ON p.id = t.projectId
     GROUP BY project ORDER BY done DESC LIMIT 15`
  ) as { project: string; done: number; open: number }[]
  const events30 = db.get("SELECT COUNT(*) as n FROM events WHERE start >= date('now','-30 days')") as { n: number }
  const notes30 = db.get("SELECT COUNT(*) as n FROM notes WHERE createdAt >= date('now','-30 days')") as { n: number }

  return [
    `Zadania ukonczone w ostatnich 30 dniach: ${done.n}`,
    `Zadania otwarte: ${open.n}`,
    `Zadania po terminie: ${overdue.n}`,
    `Wydarzenia w kalendarzu (30 dni): ${events30.n}`,
    `Nowe notatki (30 dni): ${notes30.n}`,
    '',
    'PODZIAL NA PROJEKTY (ukonczone / otwarte):',
    byProject.map((r) => `- ${r.project}: ${r.done} / ${r.open}`).join('\n') || '- brak danych'
  ].join('\n')
}

function upcoming(): string {
  const db = getDb()
  const tasks = db.all(
    "SELECT title, due, priority FROM tasks WHERE done = 0 AND due IS NOT NULL AND due <= date('now','+14 days') ORDER BY due"
  ) as { title: string; due: string; priority: number }[]
  const events = db.all(
    "SELECT title, start FROM events WHERE date(start) BETWEEN date('now') AND date('now','+14 days') ORDER BY start"
  ) as { title: string; start: string }[]
  return [
    `Dzisiaj: ${today()}`,
    'ZADANIA Z TERMINEM (14 dni):',
    tasks.map((t) => `- ${t.due}: ${t.title} (priorytet ${t.priority})`).join('\n') || '- brak',
    '',
    'WYDARZENIA (14 dni):',
    events.map((e) => `- ${e.start}: ${e.title}`).join('\n') || '- brak'
  ].join('\n')
}

/* ---------- publiczne zadania AI ---------- */

export interface AiTaskInput {
  task: AiTaskName
  text?: string
  tone?: string
  language?: string
  useKnowledge?: boolean
  kind?: string
}

const SYS_PL =
  'Jestes asystentem produktywnosci w aplikacji AI Organizer 360. Odpowiadasz po polsku, w formacie Markdown, zwiezle i konkretnie, bez lania wody.'

export async function runAiTask(input: AiTaskInput, opts: ChatOptions = {}): Promise<string> {
  switch (input.task) {
    case 'plan-day':
      return ask(
        SYS_PL,
        `Na podstawie ponizszych danych zaplanuj moj dzien. Zaproponuj bloki godzinowe, uwzglednij przerwy, ` +
          `ustaw kolejnosc zadan wedlug priorytetu i terminow, oznacz maksymalnie 3 rzeczy jako "must do". ` +
          `Na koncu dodaj jedno zdanie o ryzyku (co najprawdopodobniej sie nie uda).\n\n${todayAgenda()}`,
        opts
      )

    case 'productivity':
      return ask(
        SYS_PL,
        `Przeanalizuj moja produktywnosc na podstawie danych. Podaj: 1) 3 konkretne obserwacje, ` +
          `2) 2 problemy z uzasadnieniem liczbowym, 3) 3 rekomendacje do wdrozenia w tym tygodniu.\n\n${productivityData()}`,
        opts
      )

    case 'reminders':
      return ask(
        SYS_PL,
        `Przygotuj inteligentne przypomnienia. Pogrupuj wedlug pilnosci (PILNE / W TYM TYGODNIU / DO ZAPLANOWANIA), ` +
          `wskaz co jest zagrozone i zaproponuj konkretny moment przypomnienia.\n\n${upcoming()}`,
        opts
      )

    case 'summarize': {
      const text = (input.text ?? '').trim()
      if (!text) throw new Error('Brak tekstu do podsumowania.')
      return ask(
        SYS_PL,
        `Podsumuj ponizszy tekst (notatka / zapis spotkania). Zwroc: **Podsumowanie** (3-5 zdan), ` +
          `**Kluczowe ustalenia** (lista), **Zadania** (lista z odpowiedzialnym i terminem, jesli sa w tekscie), ` +
          `**Pytania otwarte**.\n\n---\n${text}`,
        opts
      )
    }

    case 'generate-text': {
      const brief = (input.text ?? '').trim()
      if (!brief) throw new Error('Brak opisu tekstu do wygenerowania.')
      return ask(
        SYS_PL,
        `Napisz tekst wedlug briefu. Ton: ${input.tone || 'profesjonalny'}. Jezyk: ${input.language || 'polski'}.\n\nBRIEF:\n${brief}`,
        opts
      )
    }

    case 'generate-email': {
      const brief = (input.text ?? '').trim()
      if (!brief) throw new Error('Brak opisu e-maila.')
      return ask(
        SYS_PL,
        `Napisz e-mail wedlug opisu. Ton: ${input.tone || 'uprzejmy, profesjonalny'}. Jezyk: ${input.language || 'polski'}. ` +
          `Zwroc: linie "Temat:", a pod nia tresc gotowa do wyslania. Bez komentarzy od siebie.\n\nOPIS:\n${brief}`,
        opts
      )
    }

    case 'generate-document': {
      const brief = (input.text ?? '').trim()
      if (!brief) throw new Error('Brak tematu dokumentu.')
      let context = ''
      if (input.useKnowledge) {
        const hits = await search(brief)
        if (hits.length) context = `\n\nKONTEKST Z BAZY WIEDZY:\n${buildContext(hits)}`
      }
      return ask(
        SYS_PL,
        `Napisz kompletny dokument w Markdown na podstawie tematu. Struktura: tytul (# ), wstep, sekcje z naglowkami (## ), ` +
          `podsumowanie. Jezyk: ${input.language || 'polski'}. Ton: ${input.tone || 'profesjonalny'}.` +
          `${context ? ' Wykorzystaj kontekst z bazy wiedzy i powolaj sie na zrodla.' : ''}\n\nTEMAT:\n${brief}${context}`,
        opts
      )
    }

    default:
      throw new Error(`Nieznane zadanie AI: ${input.task}`)
  }
}

/* ---------- automatyczna kategoryzacja plikow ---------- */

export interface CategorizeResult {
  updated: number
  assignments: { id: number; name: string; category: string }[]
}

export async function categorizeFiles(kind: string, limit = 40): Promise<CategorizeResult> {
  const db = getDb()
  const files = db.all(
    "SELECT id, name, ext FROM files WHERE kind = ? AND (category IS NULL OR category = '') ORDER BY id DESC LIMIT ?",
    [kind, limit]
  ) as { id: number; name: string; ext: string }[]
  if (!files.length) return { updated: 0, assignments: [] }

  const list = files.map((f) => `${f.id}\t${f.name}`).join('\n')
  const answer = await provider().chat([
    {
      role: 'system',
      content:
        'Kategoryzujesz pliki. Odpowiadasz WYLACZNIE tablica JSON, bez komentarzy i bez bloku kodu. ' +
        'Format: [{"id": <liczba>, "category": "<krotka kategoria po polsku>"}]'
    },
    {
      role: 'user',
      content: `Przypisz kategorie do plikow typu "${kind}". Uzywaj krotkich, powtarzalnych kategorii (1-2 slowa).\n\nID\tNAZWA\n${list}`
    }
  ])

  const json = answer.slice(answer.indexOf('['), answer.lastIndexOf(']') + 1)
  let parsed: { id: number; category: string }[]
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Model nie zwrocil poprawnego JSON-a z kategoriami. Sprobuj innego modelu.')
  }

  const byId = new Map(files.map((f) => [f.id, f.name]))
  const assignments: CategorizeResult['assignments'] = []
  for (const row of parsed) {
    const name = byId.get(Number(row.id))
    if (!name || !row.category) continue
    const category = String(row.category).slice(0, 40)
    db.run('UPDATE files SET category = ? WHERE id = ?', [category, Number(row.id)])
    assignments.push({ id: Number(row.id), name, category })
  }
  return { updated: assignments.length, assignments }
}
