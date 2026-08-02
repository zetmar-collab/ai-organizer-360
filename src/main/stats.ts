import { getDb } from './db'

export interface Overview {
  counts: Record<string, number>
  tasks: { open: number; done: number; overdue: number; doneLast30: number }
  finance: { income: number; expense: number; balance: number; byCategory: { category: string; total: number }[] }
  tasksPerDay: { day: string; n: number }[]
  eventsPerDay: { day: string; n: number }[]
  filesByKind: { kind: string; n: number; bytes: number }[]
  topProjects: { project: string; open: number; done: number }[]
  knowledge: { docs: number; chunks: number }
}

function scalar(sql: string, params: unknown[] = []): number {
  const row = getDb().get(sql, params as never) as { n: number } | undefined
  return row ? Number(row.n ?? 0) : 0
}

export function overview(): Overview {
  const db = getDb()

  const counts = {
    events: scalar('SELECT COUNT(*) as n FROM events'),
    tasks: scalar('SELECT COUNT(*) as n FROM tasks'),
    notes: scalar('SELECT COUNT(*) as n FROM notes'),
    projects: scalar('SELECT COUNT(*) as n FROM projects'),
    files: scalar('SELECT COUNT(*) as n FROM files'),
    transactions: scalar('SELECT COUNT(*) as n FROM transactions'),
    kbDocs: scalar('SELECT COUNT(*) as n FROM kb_docs')
  }

  const tasks = {
    open: scalar('SELECT COUNT(*) as n FROM tasks WHERE done = 0'),
    done: scalar('SELECT COUNT(*) as n FROM tasks WHERE done = 1'),
    overdue: scalar("SELECT COUNT(*) as n FROM tasks WHERE done = 0 AND due IS NOT NULL AND due < date('now')"),
    doneLast30: scalar("SELECT COUNT(*) as n FROM tasks WHERE done = 1 AND completedAt >= date('now','-30 days')")
  }

  const income = Number(
    (db.get("SELECT COALESCE(SUM(amount),0) as n FROM transactions WHERE kind = 'income'") as { n: number }).n
  )
  const expense = Number(
    (db.get("SELECT COALESCE(SUM(amount),0) as n FROM transactions WHERE kind = 'expense'") as { n: number }).n
  )
  const byCategory = db.all(
    `SELECT COALESCE(NULLIF(category,''),'(bez kategorii)') as category, SUM(amount) as total
     FROM transactions WHERE kind = 'expense' GROUP BY category ORDER BY total DESC LIMIT 10`
  ) as { category: string; total: number }[]

  const tasksPerDay = db.all(
    `SELECT date(completedAt) as day, COUNT(*) as n FROM tasks
     WHERE done = 1 AND completedAt >= date('now','-30 days') GROUP BY day ORDER BY day`
  ) as { day: string; n: number }[]

  const eventsPerDay = db.all(
    `SELECT date(start) as day, COUNT(*) as n FROM events
     WHERE start >= date('now','-30 days') GROUP BY day ORDER BY day`
  ) as { day: string; n: number }[]

  const filesByKind = db.all(
    'SELECT kind, COUNT(*) as n, COALESCE(SUM(size),0) as bytes FROM files GROUP BY kind ORDER BY n DESC'
  ) as { kind: string; n: number; bytes: number }[]

  const topProjects = db.all(
    `SELECT COALESCE(p.name,'(bez projektu)') as project,
            SUM(CASE WHEN t.done = 0 THEN 1 ELSE 0 END) as open,
            SUM(CASE WHEN t.done = 1 THEN 1 ELSE 0 END) as done
     FROM tasks t LEFT JOIN projects p ON p.id = t.projectId
     GROUP BY project ORDER BY (open + done) DESC LIMIT 8`
  ) as { project: string; open: number; done: number }[]

  return {
    counts,
    tasks,
    finance: { income, expense, balance: income - expense, byCategory },
    tasksPerDay,
    eventsPerDay,
    filesByKind,
    topProjects,
    knowledge: { docs: counts.kbDocs, chunks: scalar('SELECT COUNT(*) as n FROM kb_chunks') }
  }
}
