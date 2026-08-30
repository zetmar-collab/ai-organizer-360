import { describe, expect, it } from 'vitest'
import { backupFileName } from '../src/shared/backup'

describe('backupFileName', () => {
  it('zawiera wersje i date w kolejnosci sortowalnej alfabetycznie', () => {
    expect(backupFileName(new Date(2026, 7, 30, 9, 5), '1.1.0')).toBe('ai-organizer-360_1.1.0_2026-08-30_0905.db')
  })

  it('uzupelnia zerami miesiac, dzien i godzine', () => {
    expect(backupFileName(new Date(2026, 0, 2, 3, 4), '1.0.0')).toContain('2026-01-02_0304')
  })

  it('kopie z tego samego dnia sortuja sie chronologicznie', () => {
    const rano = backupFileName(new Date(2026, 7, 30, 8, 0), '1.1.0')
    const wieczor = backupFileName(new Date(2026, 7, 30, 20, 0), '1.1.0')
    expect([wieczor, rano].sort()).toEqual([rano, wieczor])
  })

  it('konczy sie rozszerzeniem .db', () => {
    expect(backupFileName(new Date(), '1.1.0').endsWith('.db')).toBe(true)
  })
})
