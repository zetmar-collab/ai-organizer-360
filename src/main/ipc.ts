import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { crud, dbFile } from './db'
import { getPublicSettings, getSettings, setSettings } from './settings'
import { provider } from './ai/provider'
import { categorizeFiles, runAiTask, type AiTaskInput } from './ai/tasks'
import { buildContext, indexFile, indexText, listDocs, removeDoc, search } from './rag'
import { libraryStats, openFile, revealFile, scanFolder } from './library'
import { overview } from './stats'
import { exportDocument, openExported, type ExportRequest } from './exporter'
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

      try {
        const text = await provider().chat(turns, {
          signal: controller.signal,
          onToken: (token) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('ai:token', { requestId: payload.requestId, token })
            }
          }
        })

        if (payload.sessionId) {
          const last = [...payload.messages].reverse().find((m) => m.role === 'user')
          if (last) crud.create('chat_messages', { sessionId: payload.sessionId, role: 'user', content: last.content })
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
  handle('kb:index-file', (_e, path: string) => indexFile(path))
  handle('kb:index-files', async (_e, paths: string[]) => {
    const results: { path: string; ok: boolean; message: string }[] = []
    for (const path of paths) {
      try {
        const r = await indexFile(path)
        results.push({ path, ok: true, message: `${r.chunks} fragmentow (tryb: ${r.mode})` })
      } catch (e) {
        results.push({ path, ok: false, message: (e as Error).message })
      }
    }
    return results
  })

  /* ---------- Biblioteki plikow ---------- */
  handle('lib:scan', (_e, kind: LibraryKind, folder: string) => scanFolder(kind, folder))
  handle('lib:stats', (_e, kind: LibraryKind) => libraryStats(kind))
  handle('lib:open', (_e, path: string) => openFile(path))
  handle('lib:reveal', (_e, path: string) => revealFile(path))

  /* ---------- Statystyki ---------- */
  handle('stats:overview', () => overview())

  /* ---------- Eksport ---------- */
  handle('export:document', (event, req: ExportRequest) =>
    exportDocument(req, BrowserWindow.fromWebContents(event.sender) ?? undefined)
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
