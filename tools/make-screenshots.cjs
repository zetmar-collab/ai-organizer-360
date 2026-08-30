/**
 * Generator zrzutow ekranu do Microsoft Store.
 *
 * Uruchamia aplikacje na osobnej, tymczasowej bazie, wypelnia ja neutralnymi
 * danymi pokazowymi (zadne prawdziwe dane uzytkownika nie trafiaja do sklepu),
 * ustawia okno na 1366x768 i zrzuca kolejne moduly do PNG.
 *
 * Uruchomienie: electron tools/make-screenshots.cjs --user-data-dir=<tymczasowy>
 */
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

const OUT = join(__dirname, '..', 'store', 'screenshots')
const W = 1366
const H = 768
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const SEED = `(async () => {
  const c = window.api.crud.create
  const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString() }
  const day = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

  const p1 = await c('projects', { name: 'Sesja dla Bistro Nadmorskie', description: 'Zdjecia menu i wnetrza, 3 terminy', status: 'active', color: '#d99a4e' })
  const p2 = await c('projects', { name: 'Kurs fotografii - modul 2', description: 'Nagrania i materialy do lekcji', status: 'active', color: '#6e8aa8' })
  await c('projects', { name: 'Portfolio 2026', description: 'Przeglad i selekcja zdjec', status: 'paused', color: '#8a9a5b' })

  await c('events', { title: 'Sesja zdjeciowa w Bistro', start: iso(0, 10, 0), end: iso(0, 13, 0), location: 'ul. Portowa 4', projectId: p1.id })
  await c('events', { title: 'Montaz lekcji 4', start: iso(0, 14, 30), end: iso(0, 16, 0), projectId: p2.id })
  await c('events', { title: 'Rozmowa z klientem', start: iso(0, 17, 0), end: iso(0, 17, 30), location: 'online' })
  await c('events', { title: 'Oddanie materialu', start: iso(2, 12, 0), end: iso(2, 13, 0), projectId: p1.id })
  await c('events', { title: 'Warsztaty - swiatlo zastane', start: iso(5, 9, 0), end: iso(5, 15, 0) })

  await c('tasks', { title: 'Wybrac 30 ujec do korekty', priority: 2, due: day(1), projectId: p1.id })
  await c('tasks', { title: 'Wyslac fakture za wrzesien', priority: 2, due: day(-1) })
  await c('tasks', { title: 'Nagrac lektora do lekcji 4', priority: 1, due: day(3), projectId: p2.id })
  await c('tasks', { title: 'Zamowic tlo 2,7 m', priority: 0, projectId: p1.id })
  await c('tasks', { title: 'Uporzadkowac archiwum RAW', priority: 1 })
  const done1 = await c('tasks', { title: 'Przygotowac umowe dla klienta', priority: 1, projectId: p1.id })
  await window.api.crud.update('tasks', done1.id, { done: 1, completedAt: iso(-1, 15, 0) })
  const done2 = await c('tasks', { title: 'Backup kart pamieci', priority: 1 })
  await window.api.crud.update('tasks', done2.id, { done: 1, completedAt: iso(-2, 11, 0) })

  await c('notes', { title: 'Ustalenia z klientem - Bistro', tags: 'klient, sesja', projectId: p1.id, body: '## Zakres\\n\\n- 3 dni zdjeciowe, po 4 godziny\\n- menu (24 pozycje), wnetrze, zespol\\n- obrobka: 60 ujec w cenie\\n\\n## Terminy\\n\\n1. Poniedzialek - dania glowne\\n2. Sroda - desery i napoje\\n3. Piatek - wnetrze i zespol\\n\\n## Do potwierdzenia\\n\\n- czy potrzebne zdjecia pionowe pod social media\\n- kto przygotowuje talerze' })
  await c('notes', { title: 'Pomysly na modul 3 kursu', tags: 'kurs', projectId: p2.id, body: 'Swiatlo zastane w plenerze, praca z odbijaczem, cwiczenie z jednym obiektywem.' })
  await c('notes', { title: 'Cennik 2026 - szkic', tags: 'finanse', body: 'Sesja produktowa od 1200 zl, reportaz od 2400 zl, licencja rozszerzona +40%.' })

  const tx = [
    ['income', 4200, 'Sesja produktowa - Bistro', 'zlecenia', -12],
    ['income', 1800, 'Kurs fotografii - sprzedaz', 'kursy', -8],
    ['income', 2400, 'Reportaz z konferencji', 'zlecenia', -3],
    ['expense', 890, 'Obiektyw 35 mm - rata', 'sprzet', -20],
    ['expense', 260, 'Abonament chmury', 'oprogramowanie', -15],
    ['expense', 140, 'Wynajem studia', 'studio', -10],
    ['expense', 320, 'Paliwo - dojazdy', 'transport', -6],
    ['expense', 190, 'Materialy do tla', 'sprzet', -2]
  ]
  for (const [kind, amount, description, category, d] of tx) {
    await c('transactions', { date: day(d), amount, kind, description, category, account: 'firmowe' })
  }
  return true
})()`

app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  require(join(__dirname, '..', 'out', 'main', 'index.js'))
  await wait(3500)

  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return app.exit(1)
  win.setContentSize(W, H)
  win.center()
  await wait(400)

  await win.webContents.executeJavaScript(SEED)
  await wait(800)

  const shot = async (name) => {
    await wait(900)
    let img = await win.webContents.capturePage()
    const s = img.getSize()
    if (s.width !== W || s.height !== H) img = img.resize({ width: W, height: H, quality: 'best' })
    writeFileSync(join(OUT, name), img.toPNG())
    console.log('zrzut', name)
  }

  const goto = async (nr) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: String(nr), modifiers: ['control'] })
    await wait(900)
  }

  // kalendarz byl zamontowany przed zasianiem danych - wymuszamy ponowne wczytanie
  await goto(2)
  await goto(1)

  // realny wynik planowania dnia z lokalnego modelu, nie atrapa
  await win.webContents.executeJavaScript(`(() => {
    const b = [...document.querySelectorAll('.ai-panel .btn.primary')][0]
    b?.click()
    return true
  })()`)
  for (let i = 0; i < 60; i++) {
    const done = await win.webContents.executeJavaScript(
      "Boolean(document.querySelector('.ai-output')) && !document.querySelector('.ai-panel .spinner')"
    )
    if (done) break
    await wait(2000)
  }
  await wait(600)
  await shot('01-kalendarz.png')

  await goto(2)
  await shot('02-zadania.png')

  await goto(3)
  await win.webContents.executeJavaScript("document.querySelectorAll('.list-item')[0]?.click()")
  await wait(700)
  await shot('03-notatki.png')

  await goto(9)
  await shot('04-finanse.png')

  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: '0', modifiers: ['control'] })
  await win.webContents.executeJavaScript(`(() => {
    const b = [...document.querySelectorAll('.nav button')].find((x) => x.textContent.includes('Statystyki'))
    b?.click()
    return true
  })()`)
  await shot('05-statystyki.png')

  // paleta wyszukiwania z wynikami z kilku modulow
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: ['control'] })
  await wait(600)
  await win.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.palette-input input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'bistro')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await wait(1200)
  await shot('06-wyszukiwanie.png')

  app.exit(0)
})
