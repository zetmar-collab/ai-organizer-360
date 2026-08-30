import { app, BrowserWindow, dialog } from 'electron'
import { copyFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, join } from 'path'
import { Database } from 'node-sqlite3-wasm'
import { closeDb, dbFile, getDb, initDb } from './db'
import { backupFileName } from '../shared/backup'

export { backupFileName }

export interface BackupResult {
  ok: boolean
  path?: string
  canceled?: boolean
  bytes?: number
}

/**
 * VACUUM INTO robi spojna kopie bez zamykania bazy - w odroznieniu od zwyklego
 * skopiowania pliku nie da sie w ten sposob zlapac zapisu w polowie transakcji.
 */
export async function createBackup(parent?: BrowserWindow): Promise<BackupResult> {
  const suggested = backupFileName(new Date(), app.getVersion())
  const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
    title: 'Zapisz kopie zapasowa',
    defaultPath: join(app.getPath('documents'), suggested),
    filters: [{ name: 'Kopia bazy AI Organizer 360', extensions: ['db'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  if (existsSync(filePath)) {
    // VACUUM INTO odmawia nadpisania - kasujemy dopiero po potwierdzeniu w oknie zapisu
    const { rmSync } = await import('fs')
    rmSync(filePath)
  }

  getDb().run('VACUUM INTO ?', [filePath])
  const info = await stat(filePath)
  return { ok: true, path: filePath, bytes: info.size }
}

export interface RestoreResult {
  ok: boolean
  canceled?: boolean
  path?: string
  safetyCopy?: string
  tables?: number
}

const REQUIRED_TABLES = ['notes', 'tasks', 'events', 'settings']

/** Sprawdza, czy wskazany plik to naprawde baza tej aplikacji. */
function inspect(path: string): { tables: number; error?: string } {
  let probe: Database | undefined
  try {
    probe = new Database(path, { fileMustExist: true })
    const rows = probe.all(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => '?').join(',')})`,
      REQUIRED_TABLES
    ) as { name: string }[]
    return { tables: rows.length }
  } catch (e) {
    return { tables: 0, error: (e as Error).message }
  } finally {
    probe?.close()
  }
}

/**
 * Odtworzenie nadpisuje biezaca baze, wiec najpierw odklada ja obok jako
 * kopie bezpieczenstwa. Po podmianie aplikacja uruchamia sie ponownie -
 * inaczej w pamieci zostalby stan sprzed odtworzenia.
 */
export async function restoreBackup(parent?: BrowserWindow): Promise<RestoreResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog(parent!, {
    title: 'Wybierz kopie zapasowa do odtworzenia',
    properties: ['openFile'],
    filters: [{ name: 'Baza AI Organizer 360', extensions: ['db'] }]
  })
  if (canceled || !filePaths.length) return { ok: false, canceled: true }

  const source = filePaths[0]
  const check = inspect(source)
  if (check.tables < REQUIRED_TABLES.length) {
    throw new Error(
      `Plik "${basename(source)}" nie wyglada na baze AI Organizer 360 ` +
        `(znaleziono ${check.tables} z ${REQUIRED_TABLES.length} wymaganych tabel).` +
        (check.error ? ` Szczegoly: ${check.error}` : '')
    )
  }

  const target = dbFile()
  const safety = target + '.przed-odtworzeniem-' + Date.now() + '.db'

  closeDb()
  try {
    await copyFile(target, safety)
    await copyFile(source, target)
  } catch (e) {
    initDb()
    throw e
  }

  const confirmation = { ok: true as const, path: source, safetyCopy: safety, tables: check.tables }

  // restart po oddaniu odpowiedzi do interfejsu
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 400)

  return confirmation
}
