import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatSession, ChatTurn, KbHit } from '../../../shared/types'
import { api, errMsg, fmtDateTime, newRequestId, useList } from '../lib/api'
import { Icon } from '../lib/icons'
import { Confirm, Empty, ErrorBox, ExportButtons, Markdown, Skeleton, toast } from '../lib/ui'

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

  const { items: sessions, loading, reload: reloadSessions } = useList<ChatSession>('chat_sessions', {
    orderBy: 'id desc'
  })

  useEffect(
    () =>
      api.ai.onToken(({ requestId, token }) => {
        if (requestId === reqRef.current) setStreaming((prev) => prev + token)
      }),
    []
  )

  /** Historia zawsze pochodzi z bazy - stan lokalny nie jest zrodlem prawdy. */
  const loadMessages = useCallback(async (id: number | null): Promise<void> => {
    if (!id) {
      setMessages([])
      return
    }
    try {
      setMessages(await api.crud.list<ChatMessage>('chat_messages', { where: { sessionId: id }, orderBy: 'id asc' }))
    } catch (e) {
      setError(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void loadMessages(sessionId)
  }, [sessionId, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, streaming])

  const newSession = async (): Promise<void> => {
    const s = await api.crud.create<ChatSession>('chat_sessions', { title: 'Nowa rozmowa' })
    await reloadSessions()
    setSessionId(s.id)
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
    } catch (e) {
      setError(errMsg(e))
    } finally {
      // Pytanie i odpowiedz zapisuje proces glowny - odczytujemy stan faktyczny.
      await loadMessages(sid)
      setStreaming('')
      setBusy(false)
      reqRef.current = ''
    }
  }

  const stop = (): void => {
    if (reqRef.current) {
      api.ai.abort(reqRef.current)
      toast('Zatrzymano. Fragment odpowiedzi zostal zapisany w rozmowie.')
    }
  }

  const removeSession = async (id: number): Promise<void> => {
    await api.crud.remove('chat_sessions', id)
    setSessionId((cur) => (cur === id ? null : cur))
    await reloadSessions()
  }

  const transcript = messages.map((m) => `**${m.role === 'user' ? 'Ja' : 'AI'}:**\n\n${m.content}`).join('\n\n---\n\n')

  return (
    <div className="cols chat-layout">
      <div>
        <button className="btn primary full" onClick={newSession}>
          <Icon name="plus" /> Nowa rozmowa
        </button>
        {loading ? (
          <Skeleton rows={4} height={52} />
        ) : sessions.length === 0 ? (
          <Empty text="Brak rozmow. Zacznij nowa, zeby zapytac o cokolwiek." icon="chat" />
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={'list-item ' + (s.id === sessionId ? 'sel' : '')}
              onClick={() => setSessionId(s.id)}
            >
              <div className="row">
                <b className="grow">{s.title}</b>
                <Confirm text={'Usunac rozmowe "' + s.title + '"?'} onYes={() => void removeSession(s.id)} />
              </div>
              <div className="muted">{fmtDateTime(s.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      <div className="chat-wrap">
        <ErrorBox error={error} />
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && !streaming && (
            <Empty
              text="Zadaj pytanie. Wlacz 'Baza wiedzy', zeby odpowiedzi powstawaly wylacznie na podstawie Twoich dokumentow."
              icon="chat"
            />
          )}
          {messages.map((m) => (
            <div key={m.id} className={'msg ' + m.role}>
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
          <div className="card stack-md">
            <h3>Zrodla z bazy wiedzy</h3>
            {sources.map((s, i) => (
              <div key={s.docId + '-' + s.ord} className="muted">
                [{i + 1}] <b>{s.docTitle}</b> <span className="mono">fragment {s.ord + 1}</span> — trafnosc{' '}
                <span className="mono">{(s.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        <div className="card stack-md">
          <div className="row stack-sm">
            <label className="row check">
              <input type="checkbox" checked={useKnowledge} onChange={(e) => setUseKnowledge(e.target.checked)} />
              <span className="muted">
                <Icon name="knowledge" /> Odpowiadaj na podstawie moich dokumentow
              </span>
            </label>
            <span className="grow" />
            {messages.length > 0 && <ExportButtons title="rozmowa-ai" content={transcript} />}
          </div>
          <div className="row">
            <textarea
              className="grow chat-input"
              aria-label="Tresc wiadomosci"
              placeholder="Napisz wiadomosc... (Ctrl+Enter wysyla)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
              }}
            />
            {busy ? (
              <button className="btn" onClick={stop}>
                <Icon name="stop" /> Zatrzymaj
              </button>
            ) : (
              <button className="btn primary" onClick={send} disabled={!input.trim()}>
                <Icon name="send" /> Wyslij
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
