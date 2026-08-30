import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { closeDb, initDb } from './db'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged

/**
 * Wersja z Microsoft Store dostaje wlasny katalog danych. Pakiet MSIX dziala
 * w trybie runFullTrust, wiec bez tego pisalby do tego samego %APPDATA%, co
 * instalator NSIS - dwie instalacje wchodzilyby sobie w jedna baze.
 */
if (process.windowsStore) {
  app.setPath('userData', join(app.getPath('appData'), 'ai-organizer-360-store'))
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0f1116',
    autoHideMenuBar: true,
    title: 'AI Organizer 360',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // linki zewnetrzne otwieramy w przegladarce systemowej, nigdy w oknie aplikacji
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

// jedna instancja - inaczej dwa procesy pisza do tej samej bazy
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  void app.whenReady().then(() => {
    initDb()
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => closeDb())
}
