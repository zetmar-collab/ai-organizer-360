import React, { useEffect, useState } from 'react'
import { api, errMsg, fmtBytes, fmtMoney } from '../lib/api'
import { AiActionPanel, Empty, ErrorBox } from '../lib/ui'

interface Overview {
  counts: Record<string, number>
  tasks: { open: number; done: number; overdue: number; doneLast30: number }
  finance: { income: number; expense: number; balance: number; byCategory: { category: string; total: number }[] }
  tasksPerDay: { day: string; n: number }[]
  eventsPerDay: { day: string; n: number }[]
  filesByKind: { kind: string; n: number; bytes: number }[]
  topProjects: { project: string; open: number; done: number }[]
  knowledge: { docs: number; chunks: number }
}

const KIND_LABEL: Record<string, string> = {
  document: 'Dokumenty',
  music: 'Muzyka',
  ebook: 'E-booki',
  photo: 'Zdjecia'
}

function Spark({ data }: { data: { day: string; n: number }[] }): React.JSX.Element {
  if (!data.length) return <span className="muted">Brak danych z ostatnich 30 dni.</span>
  const max = Math.max(...data.map((d) => d.n), 1)
  return (
    <div className="spark" title={data.map((d) => `${d.day}: ${d.n}`).join('\n')}>
      {data.map((d) => (
        <i key={d.day} style={{ height: `${(d.n / max) * 100}%` }} />
      ))}
    </div>
  )
}

export default function Stats(): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.stats
      .overview<Overview>()
      .then(setData)
      .catch((e) => setError(errMsg(e)))
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!data) return <Empty text="Wczytywanie statystyk..." />

  const doneRate = data.tasks.done + data.tasks.open ? Math.round((data.tasks.done / (data.tasks.done + data.tasks.open)) * 100) : 0

  return (
    <>
      <div className="cols-3" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <span>Zadania ukonczone (30 dni)</span>
          <b>{data.tasks.doneLast30}</b>
        </div>
        <div className="kpi">
          <span>Otwarte zadania</span>
          <b>{data.tasks.open}</b>
        </div>
        <div className="kpi">
          <span>Po terminie</span>
          <b style={{ color: data.tasks.overdue ? 'var(--err)' : 'var(--ok)' }}>{data.tasks.overdue}</b>
        </div>
        <div className="kpi">
          <span>Skutecznosc</span>
          <b>{doneRate}%</b>
        </div>
        <div className="kpi">
          <span>Bilans finansowy</span>
          <b style={{ color: data.finance.balance >= 0 ? 'var(--ok)' : 'var(--err)' }}>
            {fmtMoney(data.finance.balance)}
          </b>
        </div>
        <div className="kpi">
          <span>Baza wiedzy</span>
          <b>{data.knowledge.docs}</b>
          <span>{data.knowledge.chunks} fragmentow</span>
        </div>
      </div>

      <div className="cols" style={{ marginBottom: 14 }}>
        <div className="card">
          <h3>Ukonczone zadania (30 dni)</h3>
          <Spark data={data.tasksPerDay} />
        </div>
        <div className="card">
          <h3>Wydarzenia w kalendarzu (30 dni)</h3>
          <Spark data={data.eventsPerDay} />
        </div>
      </div>

      <div className="cols" style={{ marginBottom: 14 }}>
        <div className="card">
          <h3>Projekty</h3>
          {data.topProjects.length === 0 && <span className="muted">Brak danych.</span>}
          <table>
            <tbody>
              {data.topProjects.map((p) => {
                const total = p.open + p.done
                const pct = total ? Math.round((p.done / total) * 100) : 0
                return (
                  <tr key={p.project}>
                    <td style={{ width: '45%' }}>{p.project}</td>
                    <td>
                      <div className="bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="muted" style={{ width: 90 }}>
                      {p.done}/{total}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Zasoby</h3>
          <table>
            <tbody>
              {Object.entries(data.counts).map(([k, v]) => (
                <tr key={k}>
                  <td className="muted">{k}</td>
                  <td>
                    <b>{v}</b>
                  </td>
                </tr>
              ))}
              {data.filesByKind.map((f) => (
                <tr key={f.kind}>
                  <td className="muted">{KIND_LABEL[f.kind] ?? f.kind}</td>
                  <td>
                    <b>{f.n}</b> <span className="muted">({fmtBytes(f.bytes)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AiActionPanel
        title="Analiza produktywnosci"
        hint="AI analizuje Twoje dane z ostatnich 30 dni i podaje konkretne rekomendacje."
        task="productivity"
        exportTitle="Analiza produktywnosci"
      />
    </>
  )
}
