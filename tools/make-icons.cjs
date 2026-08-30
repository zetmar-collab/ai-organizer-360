/**
 * Generator ikon aplikacji i kafelkow MSIX.
 *
 * Renderuje znak w oknie Electrona i zrzuca go do PNG w wymaganych rozmiarach,
 * a na koncu sklada wielorozmiarowy plik .ico. Dzieki temu ikona powstaje z tych
 * samych kolorow co interfejs i nie wymaga zadnej biblioteki graficznej.
 *
 * Uruchomienie: electron tools/make-icons.cjs
 */
const { app, BrowserWindow, nativeImage } = require('electron')
const { mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

const OUT_APPX = join(__dirname, '..', 'build', 'appx')
const OUT_BUILD = join(__dirname, '..', 'build')

const OCHRE = '#d99a4e'
const OCHRE_DEEP = '#b87c34'
const INK = '#131417'

/**
 * Znak: otwarty pierscien (przerwa u gory) z kropka w przerwie - odczytuje sie
 * jako obrot o pelne kolo, czyli "360", i zostaje czytelny takze przy 16 px.
 */
function mark(size, withPlate) {
  const s = size
  const r = s * 0.31
  const stroke = Math.max(s * 0.1, 1.5)
  const plate = withPlate
    ? `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${INK}"/>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden}
    svg{display:block}
  </style></head><body>
  <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${OCHRE}"/>
        <stop offset="1" stop-color="${OCHRE_DEEP}"/>
      </linearGradient>
    </defs>
    ${plate}
    <circle cx="${s / 2}" cy="${s / 2}" r="${r}"
            fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${2 * Math.PI * r * 0.82} ${2 * Math.PI * r}"
            transform="rotate(-58 ${s / 2} ${s / 2})"/>
    <circle cx="${s / 2}" cy="${s / 2 - r}" r="${stroke * 0.62}" fill="${OCHRE}"/>
  </svg></body></html>`
}

/** Kafel szeroki: znak po lewej, nazwa produktu po prawej. */
function wide(w, h) {
  const s = h * 0.62
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;overflow:hidden}
    .row{display:flex;align-items:center;gap:${h * 0.12}px;height:${h}px;padding:0 ${h * 0.16}px;
         font-family:"Segoe UI Variable Display","Segoe UI",sans-serif;color:#e9e7e2}
    .t{font-size:${h * 0.155}px;font-weight:600;letter-spacing:-0.015em;line-height:1.2;white-space:nowrap}
    .t small{display:block;margin-top:${h * 0.03}px;font-size:${h * 0.088}px;font-weight:400;
             color:#9a978f;white-space:nowrap;letter-spacing:0}
  </style></head><body>
  <div class="row">
    <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.31}" fill="none" stroke="${OCHRE}"
              stroke-width="${s * 0.1}" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * s * 0.31 * 0.82} ${2 * Math.PI * s * 0.31}"
              transform="rotate(-58 ${s / 2} ${s / 2})"/>
      <circle cx="${s / 2}" cy="${s / 2 - s * 0.31}" r="${s * 0.062}" fill="${OCHRE}"/>
    </svg>
    <div class="t">AI Organizer 360<small>organizer z AI na wlasnym komputerze</small></div>
  </div></body></html>`
}

async function shot(html, width, height) {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 120))
  let img = await win.webContents.capturePage()
  win.destroy()
  // ekran o wysokim DPI zwraca wieksza bitmape - sprowadzamy do zadanego rozmiaru
  const size = img.getSize()
  if (size.width !== width || size.height !== height) img = img.resize({ width, height, quality: 'best' })
  return img.toPNG()
}

/** Sklada plik .ico z gotowych PNG-ow (Windows obsluguje PNG wewnatrz ICO). */
function buildIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  entries.forEach(({ size, png }, i) => {
    const at = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, at)
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1)
    dir.writeUInt8(0, at + 2)
    dir.writeUInt8(0, at + 3)
    dir.writeUInt16LE(1, at + 4)
    dir.writeUInt16LE(32, at + 6)
    dir.writeUInt32LE(png.length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  mkdirSync(OUT_APPX, { recursive: true })

  // kafelki MSIX - przezroczyste tlo, kolor plytki bierze sie z manifestu
  const tiles = [
    ['Square44x44Logo.png', 44, 44],
    ['Square71x71Logo.png', 71, 71],
    ['Square150x150Logo.png', 150, 150],
    ['Square310x310Logo.png', 310, 310],
    ['StoreLogo.png', 50, 50]
  ]
  for (const [name, w, h] of tiles) {
    writeFileSync(join(OUT_APPX, name), await shot(mark(w, false), w, h))
    console.log('kafel', name, w + 'x' + h)
  }

  writeFileSync(join(OUT_APPX, 'Wide310x150Logo.png'), await shot(wide(310, 150), 310, 150))
  console.log('kafel Wide310x150Logo.png')
  writeFileSync(join(OUT_APPX, 'SplashScreen.png'), await shot(wide(620, 300), 620, 300))
  console.log('kafel SplashScreen.png')

  // ikona pulpitu - z ciemna plytka, zeby byla widoczna na jasnym tle
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const entries = []
  for (const size of icoSizes) {
    const png = await shot(mark(size, true), size, size)
    entries.push({ size, png })
    if (size === 256) writeFileSync(join(OUT_BUILD, 'icon.png'), png)
  }
  writeFileSync(join(OUT_BUILD, 'icon.ico'), buildIco(entries))
  console.log('icon.ico:', icoSizes.join(', '))

  app.exit(0)
})
