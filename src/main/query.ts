import type { CrudQuery, TableName } from '../shared/types'

export type SqlValue = string | number | null | Uint8Array

/** node-sqlite3-wasm nie przyjmuje boolean/undefined - normalizujemy. */
export function norm(v: unknown): SqlValue {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Uint8Array) return v
  if (typeof v === 'number' || typeof v === 'string') return v
  return String(v)
}

/**
 * Buduje SELECT dla generycznego CRUD. Nazwy kolumn nigdy nie pochodza wprost
 * od wolajacego - kazda przechodzi przez whiteliste, sortowanie przez wzorzec,
 * a limit musi byc liczba calkowita. Wartosci ida wylacznie jako parametry.
 *
 * Czysta funkcja bez dostepu do bazy - testowana w test/query.test.ts.
 */
export function buildListQuery(
  table: TableName,
  q: CrudQuery,
  writable: Record<string, string[]>
): { sql: string; params: SqlValue[] } {
  const allowed = writable[table] ?? []
  const clauses: string[] = []
  const params: SqlValue[] = []

  if (q.where) {
    for (const [k, v] of Object.entries(q.where)) {
      if (!allowed.includes(k) && k !== 'id') continue
      if (v === null) {
        clauses.push(`${k} IS NULL`)
      } else {
        clauses.push(`${k} = ?`)
        params.push(norm(v))
      }
    }
  }

  if (q.search && q.search.term.trim()) {
    const cols = q.search.columns.filter((c) => allowed.includes(c))
    if (cols.length) {
      clauses.push(`(${cols.map((c) => `${c} LIKE ?`).join(' OR ')})`)
      cols.forEach(() => params.push(`%${q.search!.term}%`))
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const order = q.orderBy && /^[a-zA-Z_]+ (asc|desc)$/i.test(q.orderBy) ? `ORDER BY ${q.orderBy}` : 'ORDER BY id DESC'
  const limit = q.limit && Number.isInteger(q.limit) && q.limit > 0 ? `LIMIT ${q.limit}` : ''

  return { sql: `SELECT * FROM ${table} ${where} ${order} ${limit}`.replace(/\s+/g, ' ').trim(), params }
}
