import React, { useEffect, useRef, useState } from 'react'
import { markdownBodyHtml } from '../../../shared/markdown'
import { api, errMsg, newRequestId } from './api'

export function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{title}</h2>
        {children}
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
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
  return <div className="error">{error}</div>
}

export function Empty({ text }: { text: string }): React.JSX.Element {
  return <div className="empty">{text}</div>
}

export function Markdown({ text }: { text: string }): React.JSX.Element {
  return <div className="md" dangerouslySetInnerHTML={{ __html: markdownBodyHtml(text || '') }} />
}

/**
 * Panel uruchamiajacy zadanie AI ze streamingiem i eksportem wyniku.
 * Uzywany w kilku modulach (plan dnia, produktywnosc, przypomnienia, podsumowania).
 */
export function AiActionPanel({
  title,
  hint,
  task,
  input,
  exportTitle
}: {
  title: string
  hint: string
  task: 'plan-day' | 'productivity' | 'reminders' | 'summarize'
  input?: () => string
  exportTitle?: string
}): React.JSX.Element {
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reqRef = useRef<string>('')

  useEffect(() => api.ai.onToken(({ requestId, token }) => {
    if (requestId === reqRef.current) setOut((prev) => prev + token)
  }), [])

  const run = async (): Promise<void> => {
    setError('')
    setOut('')
    setBusy(true)
    const requestId = newRequestId()
    reqRef.current = requestId
    try {
      const text = await api.ai.task({ task, text: input?.(), requestId })
      setOut(text)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
      reqRef.current = ''
    }
  }

  const stop = (): void => {
    if (reqRef.current) api.ai.abort(reqRef.current)
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted" style={{ marginTop: -4 }}>
        {hint}
      </p>
      <div className="row">
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? <span className="spinner" /> : '✨'} Uruchom
        </button>
        {busy && (
          <button className="btn" onClick={stop}>
            Przerwij
          </button>
        )}
        {out && !busy && <ExportButtons title={exportTitle ?? title} content={out} />}
      </div>
      <ErrorBox error={error} />
      {out && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <Markdown text={out} />
        </div>
      )}
    </div>
  )
}

export function ExportButtons({ title, content }: { title: string; content: string }): React.JSX.Element {
  const [msg, setMsg] = useState('')

  const save = async (format: 'pdf' | 'docx' | 'md'): Promise<void> => {
    try {
      const r = await api.exporter.save({ format, title, content })
      if (r.canceled) return
      setMsg(`Zapisano: ${r.path}`)
      setTimeout(() => setMsg(''), 5000)
    } catch (e) {
      setMsg(errMsg(e))
    }
  }

  return (
    <>
      <button className="btn sm" onClick={() => save('pdf')} title="Eksport do PDF">
        📄 PDF
      </button>
      <button className="btn sm" onClick={() => save('docx')} title="Eksport do DOCX">
        📝 DOCX
      </button>
      <button className="btn sm" onClick={() => save('md')} title="Eksport do Markdown">
        ⬇ MD
      </button>
      {msg && <span className="muted">{msg}</span>}
    </>
  )
}

export function Confirm({
  text,
  onYes
}: {
  text: string
  onYes: () => void
}): React.JSX.Element {
  return (
    <button
      className="btn sm danger"
      onClick={() => {
        if (window.confirm(text)) onYes()
      }}
    >
      Usun
    </button>
  )
}
