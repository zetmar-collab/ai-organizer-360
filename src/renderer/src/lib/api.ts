import { useCallback, useEffect, useState } from 'react'
import type { Api } from '../../../preload'

declare global {
  interface Window {
    api: Api
  }
}

export const api = window.api

export function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // Electron opakowuje bledy z IPC - obcinamy prefiks
  return raw.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^Error:\s*/, '')
}

/** Lista rekordow z tabeli + odswiezanie. */
export function useList<T>(
  table: string,
  query: Record<string, unknown> = {},
  deps: unknown[] = []
): { items: T[]; loading: boolean; error: string; reload: () => Promise<void>; setItems: (v: T[]) => void } {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = JSON.stringify(query)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await api.crud.list<T>(table, JSON.parse(key)))
      setError('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [table, key])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps])

  return { items, loading, error, reload, setItems }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtMoney(v: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v || 0)
}

export function fmtBytes(v: number): string {
  if (!v) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1)
  return `${(v / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function localDateTimeValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function newRequestId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
