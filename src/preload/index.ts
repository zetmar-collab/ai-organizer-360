import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiTaskName,
  AppSettings,
  ChatTurn,
  CrudQuery,
  EngineId,
  EngineStatus,
  KbDoc,
  KbHit,
  LibraryKind,
  SearchHit
} from '../shared/types'
import type { PlaylistFormat, PlaylistTrack } from '../shared/playlist'
import type { Audiobook, AudiobookTrack } from '../shared/types'

export interface TokenEvent {
  requestId: string
  token: string
}

export interface ProgressEvent {
  requestId?: string
  current: number
  total: number
  file: string
}

const api = {
  crud: {
    list: <T>(table: string, q?: CrudQuery): Promise<T[]> => ipcRenderer.invoke('crud:list', table, q ?? {}),
    get: <T>(table: string, id: number): Promise<T> => ipcRenderer.invoke('crud:get', table, id),
    create: <T>(table: string, data: Record<string, unknown>): Promise<T> =>
      ipcRenderer.invoke('crud:create', table, data),
    update: <T>(table: string, id: number, data: Record<string, unknown>): Promise<T> =>
      ipcRenderer.invoke('crud:update', table, id, data),
    remove: (table: string, id: number): Promise<{ ok: true }> => ipcRenderer.invoke('crud:delete', table, id)
  },

  settings: {
    get: (): Promise<AppSettings & { openrouterKeySet: boolean }> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings & { openrouterKeySet: boolean }> =>
      ipcRenderer.invoke('settings:set', patch)
  },

  ai: {
    status: (engine?: EngineId): Promise<EngineStatus> => ipcRenderer.invoke('ai:status', engine),
    models: (engine?: EngineId): Promise<string[]> => ipcRenderer.invoke('ai:models', engine),
    chat: (payload: {
      requestId: string
      sessionId: number | null
      messages: ChatTurn[]
      useKnowledge?: boolean
    }): Promise<{ text: string; sources: KbHit[] }> => ipcRenderer.invoke('ai:chat', payload),
    task: (input: {
      task: AiTaskName
      text?: string
      tone?: string
      language?: string
      useKnowledge?: boolean
      requestId?: string
    }): Promise<string> => ipcRenderer.invoke('ai:task', input),
    categorize: (kind: LibraryKind): Promise<{ updated: number; assignments: { id: number; name: string; category: string }[] }> =>
      ipcRenderer.invoke('ai:categorize', kind),
    abort: (requestId: string): void => ipcRenderer.send('ai:abort', requestId),
    onToken: (cb: (e: TokenEvent) => void): (() => void) => {
      const listener = (_: unknown, data: TokenEvent): void => cb(data)
      ipcRenderer.on('ai:token', listener)
      return () => ipcRenderer.removeListener('ai:token', listener)
    }
  },

  kb: {
    list: (): Promise<KbDoc[]> => ipcRenderer.invoke('kb:list'),
    remove: (id: number): Promise<{ ok: true }> => ipcRenderer.invoke('kb:remove', id),
    search: (query: string, topK?: number): Promise<KbHit[]> => ipcRenderer.invoke('kb:search', query, topK),
    indexText: (p: { title: string; source: string; kind: string; text: string }): Promise<unknown> =>
      ipcRenderer.invoke('kb:index-text', p),
    indexFiles: (payload: {
      paths: string[]
      requestId?: string
    }): Promise<{ path: string; ok: boolean; message: string }[]> => ipcRenderer.invoke('kb:index-files', payload),
    coverage: (): Promise<{ total: number; searchable: number; stale: KbDoc[] }> => ipcRenderer.invoke('kb:coverage'),
    onProgress: (cb: (e: ProgressEvent) => void): (() => void) => {
      const listener = (_: unknown, data: ProgressEvent): void => cb(data)
      ipcRenderer.on('kb:progress', listener)
      return () => ipcRenderer.removeListener('kb:progress', listener)
    }
  },

  lib: {
    scan: (kind: LibraryKind, folder: string): Promise<{ scanned: number; added: number; updated: number; folder: string }> =>
      ipcRenderer.invoke('lib:scan', kind, folder),
    open: (path: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('lib:open', path),
    reveal: (path: string): Promise<{ ok: true }> => ipcRenderer.invoke('lib:reveal', path)
  },

  search: {
    global: (term: string): Promise<SearchHit[]> => ipcRenderer.invoke('search:global', term),
    knowledge: (term: string): Promise<KbHit[]> => ipcRenderer.invoke('search:knowledge', term)
  },

  stats: {
    overview: <T>(): Promise<T> => ipcRenderer.invoke('stats:overview')
  },

  exporter: {
    save: (req: { format: 'pdf' | 'docx' | 'md'; title: string; content: string }): Promise<{
      ok: boolean
      path?: string
      canceled?: boolean
    }> => ipcRenderer.invoke('export:document', req),
    open: (path: string): Promise<{ ok: true }> => ipcRenderer.invoke('export:open', path)
  },

  audiobooks: {
    list: (search?: string): Promise<Audiobook[]> => ipcRenderer.invoke('audiobook:list', search),
    tracks: (bookId: number): Promise<AudiobookTrack[]> => ipcRenderer.invoke('audiobook:tracks', bookId),
    addParent: (dir: string): Promise<{ added: number; skipped: number; titles: string[] }> =>
      ipcRenderer.invoke('audiobook:add-parent', dir),
    addFolder: (dir: string): Promise<{ added: number; skipped: number; titles: string[] }> =>
      ipcRenderer.invoke('audiobook:add-folder', dir),
    addFiles: (paths: string[]): Promise<{ added: number; skipped: number; titles: string[] }> =>
      ipcRenderer.invoke('audiobook:add-files', paths),
    remove: (id: number): Promise<{ ok: true }> => ipcRenderer.invoke('audiobook:remove', id),
    update: (id: number, patch: { title?: string; author?: string; category?: string }): Promise<Audiobook> =>
      ipcRenderer.invoke('audiobook:update', id, patch),
    play: (id: number): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('audiobook:play', id),
    openTrack: (path: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('audiobook:open-track', path),
    reveal: (id: number): Promise<{ ok: true }> => ipcRenderer.invoke('audiobook:reveal', id)
  },

  playlist: {
    save: (req: {
      format: PlaylistFormat
      name: string
      tracks: PlaylistTrack[]
      relative: boolean
    }): Promise<{ ok: boolean; path?: string; canceled?: boolean; tracks?: number }> =>
      ipcRenderer.invoke('playlist:save', req)
  },

  dialog: {
    folder: (): Promise<string | null> => ipcRenderer.invoke('dialog:folder'),
    files: (filters?: Electron.FileFilter[]): Promise<string[]> => ipcRenderer.invoke('dialog:files', filters)
  },

  app: {
    info: (): Promise<{
      db: string
      dbDir: string
      dbBytes: number
      version: string
      store: boolean
      platform: string
      electron: string
      node: string
    }> => ipcRenderer.invoke('app:info'),
    openDataDir: (): Promise<{ ok: true; path: string }> => ipcRenderer.invoke('app:open-data-dir')
  },

  backup: {
    create: (): Promise<{ ok: boolean; path?: string; canceled?: boolean; bytes?: number }> =>
      ipcRenderer.invoke('backup:create'),
    restore: (): Promise<{ ok: boolean; canceled?: boolean; path?: string; safetyCopy?: string; tables?: number }> =>
      ipcRenderer.invoke('backup:restore')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
