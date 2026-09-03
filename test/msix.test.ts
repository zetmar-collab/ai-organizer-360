import { describe, expect, it } from 'vitest'
import { packageFamilyFromExe } from '../src/shared/msix'

const WINDOWS_APPS = 'C:\\Program Files\\WindowsApps\\'

describe('packageFamilyFromExe', () => {
  it('sklada PFN z nazwy pakietu i identyfikatora wydawcy', () => {
    const exe = WINDOWS_APPS + 'MarekZettel-zetmar.AIOrganizer360_1.1.0.0_x64__411qrz2m02jw4\\app\\AI Organizer 360.exe'
    expect(packageFamilyFromExe(exe)).toBe('MarekZettel-zetmar.AIOrganizer360_411qrz2m02jw4')
  })

  it('nie zwraca nic dla instalacji spoza sklepu', () => {
    expect(packageFamilyFromExe('C:\\Program Files\\AI Organizer 360\\AI Organizer 360.exe')).toBeNull()
  })

  it('ignoruje wielkosc liter w nazwie katalogu WindowsApps', () => {
    const exe = 'C:\\Program Files\\windowsapps\\Foo.Bar_1.0.0.0_x64__abc123\\app\\x.exe'
    expect(packageFamilyFromExe(exe)).toBe('Foo.Bar_abc123')
  })

  it('radzi sobie z ukosnikami w druga strone', () => {
    expect(packageFamilyFromExe('C:/Program Files/WindowsApps/Foo_1.0_x64__pub/app/x.exe')).toBe('Foo_pub')
  })

  it('odrzuca sciezke bez identyfikatora wydawcy', () => {
    expect(packageFamilyFromExe(WINDOWS_APPS + 'Foo\\app\\x.exe')).toBeNull()
  })
})
