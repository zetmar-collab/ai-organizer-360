import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings, EngineStatus } from '../../shared/types'
import { api } from './lib/api'
import { Icon, type IconName } from './lib/icons'
import { ModuleBoundary, Toasts } from './lib/ui'
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
  icon: IconName
  label: string
  group: string
}

const NAV: NavItem[] = [
  { id: 'calendar', icon: 'calendar', label: 'Kalendarz', group: 'Organizacja' },
  { id: 'tasks', icon: 'tasks', label: 'Zadania', group: 'Organizacja' },
  { id: 'notes', icon: 'note', label: 'Notatki', group: 'Organizacja' },
  { id: 'projects', icon: 'folder', label: 'Projekty', group: 'Organizacja' },
  { id: 'documents', icon: 'library', label: 'Dokumenty', group: 'Biblioteki' },
  { id: 'music', icon: 'music', label: 'Muzyka', group: 'Biblioteki' },
  { id: 'ebooks', icon: 'ebook', label: 'E-booki', group: 'Biblioteki' },
  { id: 'photos', icon: 'photo', label: 'Zdjecia', group: 'Biblioteki' },
  { id: 'finance', icon: 'finance', label: 'Finanse', group: 'Analiza' },
  { id: 'stats', icon: 'stats', label: 'Statystyki', group: 'Analiza' },
  { id: 'chat', icon: 'chat', label: 'Czat AI', group: 'AI' },
  { id: 'knowledge', icon: 'knowledge', label: 'Baza wiedzy', group: 'AI' },
  { id: 'generator', icon: 'generator', label: 'Generator', group: 'AI' },
  { id: 'settings', icon: 'settings', label: 'Ustawienia', group: 'AI' }
]

/** Ctrl+1..9 przeskakuje do modulu o tym numerze na liscie. */
const SHORTCUTS = NAV.slice(0, 9)

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('calendar')
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [theme, setTheme] = useState<AppSettings['theme']>('dark')
  const [reloadKey, setReloadKey] = useState(0)

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

  useEffect(() => {
    void api.settings.get().then((s) => setTheme(s.theme === 'light' ? 'light' : 'dark'))
  }, [])

  /* Sygnatura produktu: akcent calego interfejsu zmienia sie razem z silnikiem,
     zeby na kazdym ekranie bylo widac, czy dane opuszczaja ten komputer. */
  useEffect(() => {
    const root = document.documentElement
    root.dataset.engine = !engine || !engine.ok ? 'off' : engine.engine === 'ollama' ? 'local' : 'cloud'
    root.dataset.theme = theme
  }, [engine, theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey || e.shiftKey) return
      const idx = Number(e.key)
      if (idx >= 1 && idx <= SHORTCUTS.length) {
        e.preventDefault()
        setView(SHORTCUTS[idx - 1].id)
      } else if (e.key === ',') {
        e.preventDefault()
        setView('settings')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleTheme = async (): Promise<void> => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await api.settings.set({ theme: next })
  }

  const groups = useMemo(() => {
    const out: { group: string; items: NavItem[] }[] = []
    for (const item of NAV) {
      const last = out[out.length - 1]
      if (last && last.group === item.group) last.items.push(item)
      else out.push({ group: item.group, items: [item] })
    }
    return out
  }, [])

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
        return <SettingsView onEngineChange={refreshEngine} theme={theme} onToggleTheme={toggleTheme} />
    }
  }

  const engineLabel = !engine
    ? 'Sprawdzanie silnika'
    : engine.engine === 'ollama'
      ? 'Lokalnie'
      : 'Chmura (OpenRouter)'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          AI Organizer 360
          <small>organizer z AI na wlasnym komputerze</small>
        </div>

        <nav className="nav" aria-label="Moduly">
          {groups.map(({ group, items }) => (
            <React.Fragment key={group}>
              <div className="nav-group">{group}</div>
              {items.map((item) => {
                const idx = SHORTCUTS.findIndex((s) => s.id === item.id)
                return (
                  <button
                    key={item.id}
                    className={view === item.id ? 'active' : ''}
                    aria-current={view === item.id ? 'page' : undefined}
                    onClick={() => setView(item.id)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                    {idx >= 0 && <kbd>Ctrl+{idx + 1}</kbd>}
                  </button>
                )
              })}
            </React.Fragment>
          ))}
        </nav>

        <button
          className="engine-badge"
          onClick={() => setView('settings')}
          title={engine?.detail ?? 'Sprawdzanie silnika AI...'}
        >
          <span className={'dot ' + (engine ? (engine.ok ? 'ok' : 'err') : '')} />
          <span className="grow">
            <span className="engine-mode">{engineLabel}</span>
            <span className="engine-model">{engine?.ok ? engine.models.length + ' modeli' : 'niedostepny'}</span>
          </span>
          <Icon name={engine?.engine === 'openrouter' ? 'cloud' : 'local'} />
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{current.label}</h1>
          <span className="grow" />
          {engine && !engine.ok && (
            <span className="pill late">Silnik AI niedostepny — funkcje AI zglosza blad</span>
          )}
          <button
            className="btn ghost"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Wlacz motyw jasny' : 'Wlacz motyw ciemny'}
            title={theme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </header>

        <div className="content">
          <ModuleBoundary key={view + ':' + reloadKey} onReset={() => setReloadKey((k) => k + 1)}>
            {render()}
          </ModuleBoundary>
        </div>
      </main>

      <Toasts />
    </div>
  )
}
