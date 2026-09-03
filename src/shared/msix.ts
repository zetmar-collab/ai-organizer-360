const WINDOWS_APPS = '\\windowsapps\\'

/**
 * Nazwa rodziny pakietu (PFN) wyliczona ze sciezki pliku wykonywalnego.
 *
 * Windows instaluje pakiety MSIX w katalogu
 *   ...\WindowsApps\<Name>_<wersja>_<arch>__<publisherId>\app\program.exe
 * a katalog danych kontenera nazywa sie <Name>_<publisherId>. Wyliczenie tego
 * z samej sciezki oszczedza siegania po API WinRT z procesu Node.
 *
 * Czysta funkcja - testowana w test/msix.test.ts.
 */
export function packageFamilyFromExe(exePath: string): string | null {
  const normalized = exePath.replace(/\//g, '\\')
  const at = normalized.toLowerCase().indexOf(WINDOWS_APPS)
  if (at < 0) return null

  const fullName = normalized.slice(at + WINDOWS_APPS.length).split('\\')[0]
  if (!fullName) return null

  const parts = fullName.split('_')
  if (parts.length < 2) return null

  const name = parts[0]
  const publisher = parts[parts.length - 1]
  if (!name || !publisher) return null

  return name + '_' + publisher
}
