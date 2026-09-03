import { app } from 'electron'
import { existsSync } from 'fs'
import { dirname, join, relative } from 'path'
import { dbFile } from './db'
import { packageFamilyFromExe } from '../shared/msix'

/**
 * Sciezka do katalogu z danymi w postaci, ktora rozumie Eksplorator Windows.
 *
 * W wydaniu ze Store aplikacja widzi %APPDATA%\ai-organizer-360-store\..., ale
 * Windows przekierowuje ten zapis do kontenera pakietu. Eksplorator dziala poza
 * kontenerem, wiec podana mu sciezka wirtualna nie istnieje i konczy sie
 * komunikatem "Lokalizacja jest niedostepna". Tutaj tlumaczymy ja na fizyczna.
 */
export function dataDirForExplorer(): string {
  const virtualDir = dirname(dbFile())
  if (!process.windowsStore) return virtualDir

  const local = process.env['LOCALAPPDATA']
  const pfn = packageFamilyName()
  if (local && pfn) {
    const rel = relative(app.getPath('appData'), virtualDir)
    const real = join(local, 'Packages', pfn, 'LocalCache', 'Roaming', rel)
    if (existsSync(real)) return real
  }
  return virtualDir
}

export function packageFamilyName(): string | null {
  return packageFamilyFromExe(app.getPath('exe'))
}
