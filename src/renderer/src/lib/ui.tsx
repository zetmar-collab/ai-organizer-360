import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { markdownBodyHtml } from '../../../shared/markdown'
import { api, errMsg, newRequestId } from './api'
import { Icon, type IconName } from './icons'

/* ---------- powiadomienia (zastepuja window.alert) ---------- */

export interface ToastItem {
  id: number
  text: string
  kind: 'info' | 'error'
}

let toastList: ToastItem[] = []
let toastSubs: (() => void)[] = []
let toastSeq = 0

function emitToasts(): void {
  toastSubs.forEach((fn) => fn())
}

export function toast(text: string, kind: 'info' | 'error' = 'info'): void {
  const item: ToastItem = { id: ++toastSeq, text, kind }
  toastList = [...toastList, item]
  emitToasts()
  setTimeout(
    () => {
      toastList = toastList.filter((t) => t.id !== item.id)
      emitToasts()
    },
    kind === 'error' ? 8000 : 4500
  )
}

export function Toasts(): React.JSX.Element {
  const items = useSyncExternalStore(
    (cb) => {
      toastSubs.push(cb)
      return () => {
        toastSubs = toastSubs.filter((f) => f !== cb)
      }
    },
    () => toastList
  )
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          <Icon name={t.kind === 'error' ? 'close' : 'check'} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- formularze i dialogi ---------- */

export function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      // pulapka fokusu - Tab nie wychodzi poza dialog
      const items = ref.current.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      ;(returnFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  return (
    <div className="modal-bg">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
        <div className="row modal-actions">
          {footer ?? (
            <button className="btn" onClick={onClose}>
              Zamknij
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ErrorBox({ error }: { error: string }): React.JSX.Element | null {
  if (!error) return null
  return (
    <div className="error" role="alert">
      {error}
    </div>
  )
}

export function Empty({
  text,
  icon = 'note',
  action
}: {
  text: string
  icon?: IconName
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p>{text}</p>
      {action}
    </div>
  )
}

/** Szkielet o geometrii docelowej tresci - zamiast falszywego "brak danych" przy pierwszym renderze. */
export function Skeleton({ rows = 3, height = 56 }: { rows?: number; height?: number }): React.JSX.Element {
  return (
    <div className="skeleton-group" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  )
}

/** Renderuje jeden z trzech stanow: ladowanie / blad / tresc. */
export function ListState({
  loading,
  error,
  empty,
  emptyText,
  emptyIcon,
  emptyAction,
  rows,
  children
}: {
  loading: boolean
  error: string
  empty: boolean
  emptyText: string
  emptyIcon?: IconName
  emptyAction?: React.ReactNode
  rows?: number
  children: React.ReactNode
}): React.JSX.Element {
  if (loading) return <Skeleton rows={rows ?? 3} />
  if (error) return <ErrorBox error={error} />
  if (empty) return <Empty text={emptyText} icon={emptyIcon} action={emptyAction} />
  return <>{children}</>
}

export function Markdown({ text }: { text: string }): React.JSX.Element {
  return <div className="md" dangerouslySetInnerHTML={{ __html: markdownBodyHtml(text || '') }} />
}

/** Kasowanie w dwoch krokach zamiast natywnego window.confirm. */
export function Confirm({
  text,
  onYes,
  label = 'Usun'
}: {
  text: string
  onYes: () => void
  label?: string
}): React.JSX.Element {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      className={'btn sm ' + (armed ? 'danger-armed' : 'danger')}
      title={text}
      aria-label={armed ? 'Potwierdz: ' + text : label}
      onClick={(e) => {
        // bez tego klikniecie wpada w onClick wiersza i otwiera edycje usunietego rekordu
        e.stopPropagation()
        if (armed) {
          onYes()
          setArmed(false)
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? 'Na pewno?' : <Icon name="trash" />}
    </button>
  )
}

/* ---------- stan zapisu i postep ---------- */

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: 'Zapisane',
  dirty: 'Niezapisane zmiany',
  saving: 'Zapisywanie...',
  saved: 'Zapisano',
  error: 'Blad zapisu'
}

export function SaveState({ status, onSave }: { status: SaveStatus; onSave: () => void }): React.JSX.Element {
  return (
    <span className={'save-state ' + status} aria-live="polite">
      {status === 'saving' ? <span className="spinner" /> : <Icon name={status === 'error' ? 'close' : 'check'} />}
      {SAVE_LABEL[status]}
      {(status === 'dirty' || status === 'error') && (
        <button className="btn sm" onClick={onSave}>
          Zapisz teraz
        </button>
      )}
    </span>
  )
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }): React.JSX.Element {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="progress">
      <div className="row progress-head">
        <span className="grow">{label}</span>
        <span className="mono">
          {value}/{max}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <i style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}

/* ---------- panele AI ---------- */

export function AiActionPanel({
  title,
  hint,
  task,
  input,
  exportTitle,
  icon = 'sparkle'
}: {
  title: string
  hint: string
  task: 'plan-day' | 'productivity' | 'reminders' | 'summarize'
  input?: () => string
  exportTitle?: string
  icon?: IconName
}): React.JSX.Element {
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reqRef = useRef<string>('')

  useEffect(
    () =>
      api.ai.onToken(({ requestId, token }) => {
        if (requestId === reqRef.current) setOut((prev) => prev + token)
      }),
    []
  )

  const run = async (): Promise<void> => {
    setError('')
    setOut('')
    setBusy(true)
    const requestId = newRequestId()
    reqRef.current = requestId
    try {
      setOut(await api.ai.task({ task, text: input?.(), requestId }))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
      reqRef.current = ''
    }
  }

  return (
    <section className="card ai-panel">
      <h3>{title}</h3>
      <p className="muted hint">{hint}</p>
      <div className="row">
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name={icon} />} Uruchom
        </button>
        {busy && (
          <button className="btn" onClick={() => reqRef.current && api.ai.abort(reqRef.current)}>
            <Icon name="stop" /> Zatrzymaj
          </button>
        )}
        {out && !busy && <ExportButtons title={exportTitle ?? title} content={out} />}
      </div>
      <ErrorBox error={error} />
      {out && (
        <div className="ai-output">
          <Markdown text={out} />
        </div>
      )}
    </section>
  )
}

export function ExportButtons({ title, content }: { title: string; content: string }): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  const save = async (format: 'pdf' | 'docx' | 'md'): Promise<void> => {
    setBusy(true)
    try {
      const r = await api.exporter.save({ format, title, content })
      if (!r.canceled && r.path) toast('Zapisano ' + r.path)
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="export-group">
      <button className="btn sm" onClick={() => void save('pdf')} disabled={busy} title="Eksport do PDF">
        <Icon name="pdf" /> PDF
      </button>
      <button className="btn sm" onClick={() => void save('docx')} disabled={busy} title="Eksport do DOCX">
        <Icon name="docx" /> DOCX
      </button>
      <button className="btn sm" onClick={() => void save('md')} disabled={busy} title="Eksport do Markdown">
        <Icon name="markdown" /> MD
      </button>
    </span>
  )
}

/** Lapie bledy renderowania modulu - bez tego jeden wyjatek gasi cale okno na bialo. */
export class ModuleBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="card boundary">
        <h3>Modul zglosil blad</h3>
        <pre className="mono">{this.state.error.message}</pre>
        <button
          className="btn primary"
          onClick={() => {
            this.setState({ error: null })
            this.props.onReset()
          }}
        >
          Wczytaj ponownie
        </button>
      </div>
    )
  }
}
