import React, { useMemo, useState } from 'react'
import type { Transaction } from '../../../shared/types'
import { api, errMsg, fmtDate, fmtMoney, todayISO, useDebounced, useList } from '../lib/api'
import { Icon } from '../lib/icons'
import { Confirm, Empty, ErrorBox, Field, Modal, Skeleton } from '../lib/ui'

export default function Finance(): React.JSX.Element {
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)

  const { items, loading, reload } = useList<Transaction>(
    'transactions',
    {
      search: { columns: ['description', 'category', 'account'], term: debouncedSearch },
      orderBy: 'date desc',
      limit: 1000
    },
    [debouncedSearch]
  )

  const filtered = Boolean(debouncedSearch.trim())

  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    const byCat = new Map<string, number>()
    const byMonth = new Map<string, { income: number; expense: number }>()
    for (const t of items) {
      if (t.kind === 'income') income += t.amount
      else {
        expense += t.amount
        const c = t.category || '(bez kategorii)'
        byCat.set(c, (byCat.get(c) ?? 0) + t.amount)
      }
      const m = (t.date || '').slice(0, 7)
      const cur = byMonth.get(m) ?? { income: 0, expense: 0 }
      if (t.kind === 'income') cur.income += t.amount
      else cur.expense += t.amount
      byMonth.set(m, cur)
    }
    return {
      income,
      expense,
      balance: income - expense,
      byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      byMonth: [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    }
  }, [items])

  const save = async (): Promise<void> => {
    const amount = Number(editing?.amount)
    if (!editing?.date || !Number.isFinite(amount) || amount <= 0) {
      setError('Podaj poprawna date i kwote wieksza od zera.')
      return
    }
    try {
      const data = {
        date: editing.date,
        amount,
        kind: editing.kind ?? 'expense',
        category: editing.category ?? '',
        description: editing.description ?? '',
        account: editing.account ?? ''
      }
      if (editing.id) await api.crud.update('transactions', editing.id, data)
      else await api.crud.create('transactions', data)
      setEditing(null)
      setError('')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const maxCat = summary.byCat[0]?.[1] ?? 1

  return (
    <>
      <ErrorBox error={error} />
      <div className="cols-3 stack-lg">
        <div className="kpi pos">
          <span>Przychody{filtered ? ' w filtrze' : ''}</span>
          <b>{fmtMoney(summary.income)}</b>
        </div>
        <div className="kpi neg">
          <span>Wydatki{filtered ? ' w filtrze' : ''}</span>
          <b>{fmtMoney(summary.expense)}</b>
        </div>
        <div className={'kpi ' + (summary.balance >= 0 ? 'pos' : 'neg')}>
          <span>Bilans{filtered ? ' w filtrze' : ''}</span>
          <b>{fmtMoney(summary.balance)}</b>
        </div>
      </div>

      <div className="cols stack-lg">
        <div className="card">
          <h3>Wydatki wg kategorii</h3>
          {summary.byCat.length === 0 && <span className="muted">Brak danych.</span>}
          {summary.byCat.map(([cat, val]) => (
            <div key={cat} className="stack-sm">
              <div className="row">
                <span className="grow">{cat}</span>
                <span className="muted">{fmtMoney(val)}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${(val / maxCat) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Miesiac po miesiacu</h3>
          {summary.byMonth.length === 0 && <span className="muted">Brak danych.</span>}
          <table>
            <tbody>
              {summary.byMonth.map(([m, v]) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td style={{ color: 'var(--ok)' }}>{fmtMoney(v.income)}</td>
                  <td style={{ color: 'var(--err)' }}>{fmtMoney(v.expense)}</td>
                  <td>
                    <b>{fmtMoney(v.income - v.expense)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="row stack-sm">
          <button
            className="btn primary"
            onClick={() => setEditing({ date: todayISO(), kind: 'expense', amount: 0 })}
          >
            <Icon name="plus" /> Transakcja
          </button>
          <input
            className="grow"
            placeholder="Szukaj po opisie, kategorii, koncie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <Skeleton rows={4} height={40} />
        ) : items.length === 0 ? (
          <Empty text={filtered ? 'Nic nie pasuje do wyszukiwania.' : 'Brak transakcji.'} icon="finance" />
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="col-mid">Data</th>
                  <th>Opis</th>
                  <th className="col-mid">Kategoria</th>
                  <th className="col-mid">Kwota</th>
                  <th className="col-mid">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td>
                      {t.description || <span className="muted">-</span>}
                      {t.account && <div className="muted">{t.account}</div>}
                    </td>
                    <td>{t.category ? <span className="pill">{t.category}</span> : <span className="muted">-</span>}</td>
                    <td className={'mono ' + (t.kind === 'income' ? 'amount-in' : 'amount-out')}>
                      {t.kind === 'income' ? '+' : '-'}
                      {fmtMoney(t.amount)}
                    </td>
                    <td>
                      <div className="row">
                        <button className="btn sm" onClick={() => setEditing(t)}>
                          Edytuj
                        </button>
                        <Confirm
                          text="Usunac transakcje?"
                          onYes={() => {
                            void api.crud.remove('transactions', t.id).then(reload)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edycja transakcji' : 'Nowa transakcja'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Anuluj
              </button>
              <button className="btn primary" onClick={save}>
                Zapisz
              </button>
            </>
          }
        >
          <div className="row">
            <div className="grow">
              <Field label="Data">
                <input
                  type="date"
                  value={editing.date ?? ''}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </Field>
            </div>
            <div className="grow">
              <Field label="Typ">
                <select
                  value={editing.kind ?? 'expense'}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as Transaction['kind'] })}
                >
                  <option value="expense">wydatek</option>
                  <option value="income">przychod</option>
                </select>
              </Field>
            </div>
            <div className="grow">
              <Field label="Kwota (PLN)">
                <input
                  type="number"
                  step="0.01"
                  value={editing.amount ?? 0}
                  onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>
          <Field label="Opis">
            <input
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </Field>
          <div className="row">
            <div className="grow">
              <Field label="Kategoria">
                <input
                  value={editing.category ?? ''}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
              </Field>
            </div>
            <div className="grow">
              <Field label="Konto">
                <input
                  value={editing.account ?? ''}
                  onChange={(e) => setEditing({ ...editing, account: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
