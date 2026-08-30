/** Nazwa pliku kopii zapasowej - data w nazwie, zeby kopie ukladaly sie chronologicznie. */
export function backupFileName(date: Date, version: string): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    '-',
    p(date.getMonth() + 1),
    '-',
    p(date.getDate()),
    '_',
    p(date.getHours()),
    p(date.getMinutes())
  ].join('')
  return `ai-organizer-360_${version}_${stamp}.db`
}
