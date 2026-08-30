import { describe, expect, it } from 'vitest'
import { buildListQuery, norm } from '../src/main/query'

const WRITABLE = {
  tasks: ['title', 'done', 'priority', 'due', 'notes', 'projectId', 'completedAt'],
  notes: ['title', 'body', 'tags', 'projectId', 'updatedAt']
} as Record<string, string[]>

const build = (q: Parameters<typeof buildListQuery>[1]): { sql: string; params: unknown[] } =>
  buildListQuery('tasks' as never, q, WRITABLE)

describe('buildListQuery - whitelista kolumn', () => {
  it('przepuszcza kolumne z whitelisty jako parametr', () => {
    const { sql, params } = build({ where: { done: 1 } })
    expect(sql).toBe('SELECT * FROM tasks WHERE done = ? ORDER BY id DESC')
    expect(params).toEqual([1])
  })

  it('pomija kolumne spoza whitelisty', () => {
    const { sql, params } = build({ where: { haslo: 'x', done: 0 } })
    expect(sql).not.toContain('haslo')
    expect(params).toEqual([0])
  })

  it('dopuszcza id mimo braku w whitelscie zapisu', () => {
    expect(build({ where: { id: 7 } }).sql).toContain('id = ?')
  })

  it('null zamienia na IS NULL bez parametru', () => {
    const { sql, params } = build({ where: { projectId: null } })
    expect(sql).toContain('projectId IS NULL')
    expect(params).toEqual([])
  })

  it('nie wstawia klauzuli WHERE, gdy nie ma warunkow', () => {
    expect(build({}).sql).toBe('SELECT * FROM tasks ORDER BY id DESC')
  })
})

describe('buildListQuery - wyszukiwanie', () => {
  it('buduje OR po dozwolonych kolumnach i opakowuje wzorzec', () => {
    const { sql, params } = build({ search: { columns: ['title', 'notes'], term: 'raport' } })
    expect(sql).toContain('(title LIKE ? OR notes LIKE ?)')
    expect(params).toEqual(['%raport%', '%raport%'])
  })

  it('odrzuca kolumny spoza whitelisty', () => {
    const { sql } = build({ search: { columns: ['title', 'sekret'], term: 'x' } })
    expect(sql).toContain('title LIKE ?')
    expect(sql).not.toContain('sekret')
  })

  it('ignoruje puste zapytanie', () => {
    expect(build({ search: { columns: ['title'], term: '   ' } }).sql).not.toContain('LIKE')
  })

  it('nie interpoluje tresci zapytania do SQL', () => {
    const { sql, params } = build({ search: { columns: ['title'], term: "'; DROP TABLE tasks; --" } })
    expect(sql).not.toContain('DROP')
    expect(params[0]).toBe("%'; DROP TABLE tasks; --%")
  })
})

describe('buildListQuery - sortowanie i limit', () => {
  it('przyjmuje poprawne sortowanie', () => {
    expect(build({ orderBy: 'due asc' }).sql).toContain('ORDER BY due asc')
  })

  it('odrzuca sortowanie z wstrzyknieciem', () => {
    expect(build({ orderBy: 'id desc; DROP TABLE tasks' }).sql).toContain('ORDER BY id DESC')
  })

  it('odrzuca sortowanie po wyrazeniu', () => {
    expect(build({ orderBy: '(SELECT 1) asc' }).sql).toBe('SELECT * FROM tasks ORDER BY id DESC')
  })

  it('przyjmuje limit calkowity', () => {
    expect(build({ limit: 50 }).sql).toContain('LIMIT 50')
  })

  it('odrzuca limit niecalkowity, ujemny i tekstowy', () => {
    expect(build({ limit: 1.5 }).sql).not.toContain('LIMIT')
    expect(build({ limit: -10 }).sql).not.toContain('LIMIT')
    expect(build({ limit: '5 UNION SELECT' as unknown as number }).sql).not.toContain('LIMIT')
  })
})

describe('norm', () => {
  it('zamienia boolean na 0/1, bo sterownik nie przyjmuje boolean', () => {
    expect(norm(true)).toBe(1)
    expect(norm(false)).toBe(0)
  })

  it('undefined traktuje jak null', () => {
    expect(norm(undefined)).toBeNull()
  })

  it('przepuszcza liczby, teksty i bufory', () => {
    expect(norm(42)).toBe(42)
    expect(norm('a')).toBe('a')
    const buf = new Uint8Array([1])
    expect(norm(buf)).toBe(buf)
  })

  it('obiekty sprowadza do tekstu zamiast wpuszczac do sterownika', () => {
    expect(norm({ a: 1 })).toBe('[object Object]')
  })
})
