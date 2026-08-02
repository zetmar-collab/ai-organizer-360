import React, { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatSession, ChatTurn, KbHit } from '../../../shared/types'
import { api, errMsg, fmtDateTime, newRequestId, useList } from '../lib/api'
import { Confirm, Empty, ErrorBox, ExportButtons, Markdown } from '../lib/ui'

export default function Chat(): React.JSX.Element {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [useKnowledge, setUseKnowledge] = useState(false)
  const [sources, setSources] = useState<KbHit[]>([])
  const reqRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const { items: sessions, reload: reloadSessions } = useList<ChatSession>('chat_sessions', { orderBy: 'id desc' })

  useEffect(() => api.ai.onToken(({ requestId, token }) => {
    if (requestId === reqRef.current) setStreaming((prev) => prev + token)
  }), [])

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return
    }
    void api.crud
      .list<ChatMessage>('chat_messages', { where: { sessionId }, orderBy: 'id asc' })
      .then(setMessages)
      .catch((e) => setError(errMsg(e)))
  }, [sessionId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, streaming])

  const newSession = async (): Promise<void> => {
    const s = await api.crud.create<ChatSession>('chat_sessions', { title: 'Nowa rozmowa' })
    await reloadSessions()
    setSessionId(s.id)
    setMessages([])
    setSources([])
  }

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy) return

    let sid = sessionId
    if (!sid) {
      const s = await api.crud.create<ChatSession>('chat_sessions', { title: text.slice(0, 40) })
      sid = s.id
      setSessionId(sid)
      await reloadSessions()
    }

    const history: ChatTurn[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text }
    ]
    setMessages((prev) => [
      ...prev,
      { id: -Date.now(), sessionId: sid!, role: 'user', content: text, createdAt: new Date().toISOString() }
    ])
    setInput('')
    setStreaming('')
    setSources([])
    setError('')
    setBusy(true)

    const requestId = newRequestId()
    reqRef.current = requestId
    try {
      const res = await api.ai.chat({ requestId, sessionId: sid, messages: history, useKnowledge })
      setSources(res.sources)
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now() - 1,
          sessionId: sid!,
          role: 'assistant',
          content: res.text,
          createdAt: new Date().toISOString()
        }
      ])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setStreaming('')
      setBusy(false)
      reqRef.current = ''
    }
  }

  const transcript = messages.map((m) => `**${m.role === 'user' ? 'Ja' : 'AI'}:**\n\n${m.content}`).join('\n\n---\n\n')

  return (
    <div className="cols" style={{ gridTemplateColumns: '260px minmax(0,1fr)', height: '100%' }}>
      <div>
        <button className="btn primary" style={{ width: '100%', marginBottom: 10 }} onClick={newSession}>
          + Nowa rozmowa
        </button>
        {sessions.length === 0 && <Empty text="Brak rozmow." />}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`list-item ${s.id === sessionId ? 'sel' : ''}`}
            onClick={() => setSessionId(s.id)}
          >
            <div className="row">
              <b className="grow" style={{ fontSize: 13 }}>
                {s.title}
              </b>
              <Confirm
                text="Usunac rozmowe?"
                onYes={() => {
                  void api.crud.remove('chat_sessions', s.id).then(() => {
                    if (sessionId === s.id) setSessionId(null)
                    void reloadSessions()
                  })
                }}
              />
            </div>
            <div className="muted">{fmtDateTime(s.createdAt)}</div>
          </div>
        ))}
      </div>

      <div className="chat-wrap">
        <ErrorBox error={error} />
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && !streaming && (
            <Empty text="Zadaj pytanie. Wlacz 'Baza wiedzy', zeby AI odpowiadalo na podstawie Twoich dokumentow." />
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
            </div>
          ))}
          {streaming && (
            <div className="msg assistant">
              <Markdown text={streaming} />
            </div>
          )}
        </div>

        {sources.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <h3>Zrodla z bazy wiedzy</h3>
            {sources.map((s, i) => (
              <div key={`${s.docId}-${s.ord}`} className="muted" style={{ marginBottom: 4 }}>
                [{i + 1}] <b>{s.docTitle}</b> (fragment {s.ord + 1}, trafnosc {(s.score * 100).toFixed(0)}%)
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ width: 16 }}
                checked={useKnowledge}
                onChange={(e) => setUseKnowledge(e.target.checked)}
              />
              <span className="muted">🧠 Rozmowa z moimi dokumentami (RAG)</span>
            </label>
            <span className="grow" />
            {messages.length > 0 && <ExportButtons title="rozmowa-ai" content={transcript} />}
          </div>
          <div className="row">
            <textarea
              className="grow"
              style={{ minHeight: 64 }}
              placeholder="Napisz wiadomosc... (Ctrl+Enter wysyla)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
              }}
            />
            {busy ? (
              <button className="btn" onClick={() => api.ai.abort(reqRef.current)}>
                Stop
              </button>
            ) : (
              <button className="btn primary" onClick={send}>
                Wyslij
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
