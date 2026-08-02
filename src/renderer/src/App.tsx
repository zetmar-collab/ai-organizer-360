import React, { useCallback, useEffect, useState } from 'react'
import type { EngineStatus } from '../../shared/types'
import { api } from './lib/api'
import Calendar from './modules/Calendar'
import Tasks from './modules/Tasks'
import Notes from './modules/Notes'
import Projects from './modules/Projects'
import Library from './modules/Library'
import Finance from './modules/Finance'
import Stats from './modules/Stats'
import Chat from './modules/Chat'
import Knowledge from './modules/Knowledge'
import Generator from './modules/Generator'
import SettingsView from './modules/Settings'

type ViewId =
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'projects'
  | 'documents'
  | 'music'
  | 'ebooks'
  | 'photos'
  | 'finance'
  | 'stats'
  | 'chat'
  | 'knowledge'
  | 'generator'
  | 'settings'

interface NavItem {
  id: ViewId
  icon: string
  label: string
  group: string
}

const NAV: NavItem[] = [
  { id: 'calendar', icon: '📅', label: 'Kalendarz', group: 'Organizacja' },
  { id: 'tasks', icon: '✅', label: 'Zadania', group: 'Organizacja' },
  { id: 'notes', icon: '📝', label: 'Notatki', group: 'Organizacja' },
  { id: 'projects', icon: '📂', label: 'Projekty', group: 'Organizacja' },
  { id: 'documents', icon: '📚', label: 'Dokumenty', group: 'Biblioteki' },
  { id: 'music', icon: '🎵', label: 'Muzyka', group: 'Biblioteki' },
  { id: 'ebooks', icon: '📖', label: 'E-booki', group: 'Biblioteki' },
  { id: 'photos', icon: '📸', label: 'Zdjecia', group: 'Biblioteki' },
  { id: 'finance', icon: '💰', label: 'Finanse', group: 'Analiza' },
  { id: 'stats', icon: '📊', label: 'Statystyki', group: 'Analiza' },
  { id: 'chat', icon: '🤖', label: 'Czat AI', group: 'AI' },
  { id: 'knowledge', icon: '🧠', label: 'Baza wiedzy', group: 'AI' },
  { id: 'generator', icon: '📄', label: 'Generator', group: 'AI' },
  { id: 'settings', icon: '⚙', label: 'Ustawienia', group: 'AI' }
]

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('calendar')
  const [engine, setEngine] = useState<EngineStatus | null>(null)

  const refreshEngine = useCallback(() => {
    api.ai
      .status()
      .then(setEngine)
      .catch(() => setEngine(null))
  }, [])

  useEffect(() => {
    refreshEngine()
    const t = setInterval(refreshEngine, 60000)
    return () => clearInterval(t)
  }, [refreshEngine])

  const current = NAV.find((n) => n.id === view)!

  const render = (): React.JSX.Element => {
    switch (view) {
      case 'calendar':
        return <Calendar />
      case 'tasks':
        return <Tasks />
      case 'notes':
        return <Notes />
      case 'projects':
        return <Projects />
      case 'documents':
        return <Library kind="document" key="document" />
      case 'music':
        return <Library kind="music" key="music" />
      case 'ebooks':
        return <Library kind="ebook" key="ebook" />
      case 'photos':
        return <Library kind="photo" key="photo" />
      case 'finance':
        return <Finance />
      case 'stats':
        return <Stats />
      case 'chat':
        return <Chat />
      case 'knowledge':
        return <Knowledge />
      case 'generator':
        return <Generator />
      case 'settings':
        return <SettingsView onEngineChange={refreshEngine} />
    }
  }

  let lastGroup = ''

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          AI Organizer 360
          <small>lokalny organizer z AI</small>
        </div>
        <nav className="nav">
          {NAV.map((item) => {
            const header = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            return (
              <React.Fragment key={item.id}>
                {header && <div className="nav-group">{header}</div>}
                <button className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            )
          })}
        </nav>
        <div className="engine-badge" onClick={() => setView('settings')} title={engine?.detail ?? 'Sprawdzanie...'}>
          <span className={`dot ${engine ? (engine.ok ? 'ok' : 'err') : ''}`} />
          <span className="grow">
            {engine ? (engine.engine === 'ollama' ? 'Ollama (lokalnie)' : 'OpenRouter') : 'Sprawdzanie silnika...'}
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>
            {current.icon} {current.label}
          </h1>
          {engine && !engine.ok && (
            <span className="muted" style={{ color: 'var(--warn)' }}>
              Silnik AI niedostepny - funkcje AI beda zglaszac blad
            </span>
          )}
        </header>
        <div className="content">{render()}</div>
      </main>
    </div>
  )
}
