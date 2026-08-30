import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename } from 'path'
import { crud, dbFile } from './db'
import { getPublicSettings, getSettings, setSettings } from './settings'
import { provider } from './ai/provider'
import { categorizeFiles, runAiTask, type AiTaskInput } from './ai/tasks'
import { buildContext, coverage, indexFile, indexText, listDocs, removeDoc, search } from './rag'
import { openFile, revealFile, scanFolder } from './library'
import { overview } from './stats'
import { globalKnowledge, globalSearch } from './search'
import { exportDocument, openExported, type ExportRequest } from './exporter'
import { savePlaylist, type SavePlaylistRequest } from './playlist'
import type { AppSettings, ChatTurn, EngineId, KbHit, LibraryKind } from '../shared/types'

const aborts = new Map<string, AbortController>()

function fail(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e)
  throw new Error(msg)
}

function handle<T>(channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...(args as never[]))
    } catch (e) {
      return fail(e)
    }
  })
}

export function registerIpc(): void {
  /* ---------- CRUD ---------- */
  handle('crud:list', (_e, table: string, q) => crud.list(table, q))
  handle('crud:get', (_e, table: string, id: number) => crud.get(table, id))
  handle('crud:create', (_e, table: string, data) => crud.create(table, data))
  handle('crud:update', (_e, table: string, id: number, data) => crud.update(table, id, data))
  handle('crud:delete', (_e, table: string, id: number) => crud.remove(table, id))

  /* ---------- Ustawienia i silniki AI ---------- */
  handle('settings:get', () => getPublicSettings())
  handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    setSettings(patch)
    return getPublicSettings()
  })
  handle('ai:status', (_e, engine?: EngineId) => provider(engine).status())
  handle('ai:models', (_e, engine?: EngineId) => provider(engine).listModels())

  /* ---------- Czat AI (streaming) ---------- */
  handle(
    'ai:chat',
    async (
      event,
      payload: { requestId: string; sessionId: number | null; messages: ChatTurn[]; useKnowledge?: boolean }
    ) => {
      const settings = getSettings()
      const controller = new AbortController()
      aborts.set(payload.requestId, controller)

      let sources: KbHit[] = []
      const turns: ChatTurn[] = [{ role: 'system', content: settings.systemPrompt }]

      if (payload.useKnowledge) {
        const lastUser = [...payload.messages].reverse().find((m) => m.role === 'user')
        if (lastUser) {
          sources = await search(lastUser.content)
          if (sources.length) {
            turns.push({
              role: 'system',
              content:
                'Ponizej fragmenty z bazy wiedzy uzytkownika. Odpowiadaj wylacznie na ich podstawie. ' +
                'Powoluj sie na zrodla numerami [1], [2]. Jesli odpowiedzi nie ma w kontekscie, powiedz to wprost.\n\n' +
                buildContext(sources)
            })
          }
        }
      }
      turns.push(...payload.messages)

      // Pytanie zapisujemy przed wyslaniem do modelu. Inaczej nieudana albo
      // przerwana odpowiedz zostawia w historii odpowiedz bez pytania.
      const lastUser = [...payload.messages].reverse().find((m) => m.role === 'user')
      if (payload.sessionId && lastUser) {
        crud.create('chat_messages', { sessionId: payload.sessionId, role: 'user', content: lastUser.content })
      }

      try {
        const text = await provider().chat(turns, {
          signal: controller.signal,
          onToken: (token) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('ai:token', { requestId: payload.requestId, token })
            }
          }
        })

        // Nawet urwana odpowiedz warto zachowac - uzytkownik zatrzymal ja swiadomie.
        if (payload.sessionId && text.trim()) {
          crud.create('chat_messages', { sessionId: payload.sessionId, role: 'assistant', content: text })
        }
        return { text, sources }
      } finally {
        aborts.delete(payload.requestId)
      }
    }
  )

  ipcMain.on('ai:abort', (_e, requestId: string) => {
    aborts.get(requestId)?.abort()
    aborts.delete(requestId)
  })

  /* ---------- Funkcje AI ---------- */
  handle('ai:task', async (event, input: AiTaskInput & { requestId?: string }) => {
    const controller = new AbortController()
    if (input.requestId) aborts.set(input.requestId, controller)
    try {
      return await runAiTask(input, {
        signal: controller.signal,
        onToken: (token) => {
          if (input.requestId && !event.sender.isDestroyed()) {
            event.sender.send('ai:token', { requestId: input.requestId, token })
          }
        }
      })
    } finally {
      if (input.requestId) aborts.delete(input.requestId)
    }
  })
  handle('ai:categorize', (_e, kind: LibraryKind) => categorizeFiles(kind))

  /* ---------- Baza wiedzy (RAG) ---------- */
  handle('kb:list', () => listDocs())
  handle('kb:remove', (_e, id: number) => removeDoc(id))
  handle('kb:search', (_e, query: string, topK?: number) => search(query, topK))
  handle('kb:index-text', (_e, p: { title: string; source: string; kind: string; text: string }) =>
    indexText(p.title, p.source, p.kind, p.text)
  )
  handle('kb:coverage', () => coverage())
  handle('kb:index-files', async (event, payload: { paths: string[]; requestId?: string }) => {
    const paths = payload.paths ?? []
    const controller = new AbortController()
    if (payload.requestId) aborts.set(payload.requestId, controller)
    const results: { path: string; ok: boolean; message: string }[] = []
    try {
      for (let i = 0; i < paths.length; i++) {
        if (controller.signal.aborted) break
        if (!event.sender.isDestroyed()) {
          event.sender.send('kb:progress', {
            requestId: payload.requestId,
            current: i,
            total: paths.length,
            file: basename(paths[i])
          })
        }
        try {
          const r = await indexFile(paths[i])
          results.push({ path: paths[i], ok: true, message: `${r.chunks} fragmentow (tryb: ${r.mode})` })
        } catch (e) {
          results.push({ path: paths[i], ok: false, message: (e as Error).message })
        }
      }
    } finally {
      if (payload.requestId) aborts.delete(payload.requestId)
      if (!event.sender.isDestroyed()) {
        event.sender.send('kb:progress', {
          requestId: payload.requestId,
          current: paths.length,
          total: paths.length,
          file: ''
        })
      }
    }
    return results
  })

  /* ---------- Biblioteki plikow ---------- */
  handle('lib:scan', (_e, kind: LibraryKind, folder: string) => scanFolder(kind, folder))
  handle('lib:open', (_e, path: string) => openFile(path))
  handle('lib:reveal', (_e, path: string) => revealFile(path))

  /* ---------- Wyszukiwanie globalne ---------- */
  handle('search:global', (_e, term: string) => globalSearch(term))
  handle('search:knowledge', (_e, term: string) => globalKnowledge(term))

  /* ---------- Statystyki ---------- */
  handle('stats:overview', () => overview())

  /* ---------- Eksport ---------- */
  handle('export:document', (event, req: ExportRequest) =>
    exportDocument(req, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )
  handle('playlist:save', (event, req: SavePlaylistRequest) =>
    savePlaylist(req, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )

  handle('export:open', (_e, path: string) => {
    openExported(path)
    return { ok: true }
  })

  /* ---------- Dialogi systemowe ---------- */
  handle('dialog:folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('dialog:files', async (event, filters?: Electron.FileFilter[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: filters ?? [
        { name: 'Dokumenty', extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'json', 'html'] },
        { name: 'Wszystkie pliki', extensions: ['*'] }
      ]
    })
    return r.canceled ? [] : r.filePaths
  })

  /* ---------- Aplikacja ---------- */
  handle('app:info', () => ({
    db: dbFile(),
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node
  }))
  handle('app:open-data-dir', () => {
    void shell.showItemInFolder(dbFile())
    return { ok: true }
  })
}
