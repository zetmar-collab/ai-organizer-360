/**
 * Podpisuje pakiet MSIX/APPX certyfikatem z magazynu Windows.
 *
 * electron-builder nosi wlasny, stary signtool, ktory na pakietach MSIX konczy
 * sie bledem "A required function is not present". Tutaj uzywamy signtool.exe
 * z Windows SDK, ktory ten format obsluguje.
 *
 * Uzycie: node tools/sign-msix.cjs <plik.appx> <odcisk-certyfikatu>
 */
const { execFileSync } = require('child_process')
const { existsSync, readdirSync } = require('fs')
const { join } = require('path')

const KITS = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
const TIMESTAMP = 'http://timestamp.digicert.com'

function findSignTool() {
  if (!existsSync(KITS)) throw new Error('Nie znaleziono Windows SDK w ' + KITS)
  const versions = readdirSync(KITS)
    .filter((d) => /^10\./.test(d))
    .sort()
    .reverse()
  for (const v of versions) {
    const p = join(KITS, v, 'x64', 'signtool.exe')
    if (existsSync(p)) return p
  }
  throw new Error('Nie znaleziono signtool.exe (x64) w zadnej wersji Windows SDK')
}

function main() {
  const [file, thumbprint] = process.argv.slice(2)
  if (!file || !thumbprint) {
    console.error('Uzycie: node tools/sign-msix.cjs <plik.appx> <odcisk-certyfikatu>')
    process.exit(2)
  }
  if (!existsSync(file)) throw new Error('Nie ma pliku: ' + file)

  const signtool = findSignTool()
  console.log('signtool:', signtool)

  const base = ['sign', '/fd', 'SHA256', '/sha1', thumbprint.replace(/\s/g, '')]
  try {
    execFileSync(signtool, [...base, '/tr', TIMESTAMP, '/td', 'SHA256', file], { stdio: 'inherit' })
  } catch {
    // brak sieci nie moze blokowac podpisu testowego - probujemy bez znacznika czasu
    console.log('Znacznik czasu niedostepny, podpisuje bez niego.')
    execFileSync(signtool, [...base, file], { stdio: 'inherit' })
  }

  execFileSync(signtool, ['verify', '/pa', '/v', file], { stdio: 'inherit' })
}

main()
