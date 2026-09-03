export type ID = number

export interface Project {
  id: ID
  name: string
  description: string
  status: 'active' | 'paused' | 'done'
  color: string
  createdAt: string
}

export interface EventItem {
  id: ID
  title: string
  start: string // ISO
  end: string // ISO
  allDay: 0 | 1
  location: string
  notes: string
  projectId: ID | null
  createdAt: string
}

export interface Task {
  id: ID
  title: string
  done: 0 | 1
  priority: 0 | 1 | 2
  due: string | null
  notes: string
  projectId: ID | null
  createdAt: string
  completedAt: string | null
}

export interface Note {
  id: ID
  title: string
  body: string
  tags: string
  projectId: ID | null
  createdAt: string
  updatedAt: string
}

export type LibraryKind = 'document' | 'music' | 'ebook' | 'photo'

export interface LibraryFile {
  id: ID
  kind: LibraryKind
  path: string
  name: string
  ext: string
  size: number
  mtime: string
  category: string
  tags: string
  addedAt: string
}

export interface Transaction {
  id: ID
  date: string
  amount: number
  kind: 'income' | 'expense'
  category: string
  description: string
  account: string
  createdAt: string
}

export interface ChatSession {
  id: ID
  title: string
  createdAt: string
}

export interface ChatMessage {
  id: ID
  sessionId: ID
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface KbDoc {
  id: ID
  title: string
  source: string
  kind: string
  mode: string
  chars: number
  chunks: number
  createdAt: string
}

export interface KbHit {
  docId: ID
  docTitle: string
  source: string
  ord: number
  text: string
  score: number
}

/* ---------- AI ---------- */

export type EngineId = 'ollama' | 'openrouter'

export interface AppSettings {
  engine: EngineId
  theme: 'dark' | 'light'
  openrouterKey: string
  openrouterModel: string
  ollamaUrl: string
  ollamaModel: string
  embedModel: string
  temperature: number
  systemPrompt: string
  ragTopK: number
}

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface EngineStatus {
  engine: EngineId
  ok: boolean
  detail: string
  models: string[]
}

export type AiTaskName =
  | 'plan-day'
  | 'productivity'
  | 'summarize'
  | 'generate-text'
  | 'generate-email'
  | 'categorize-files'
  | 'reminders'
  | 'generate-document'

export interface Audiobook {
  id: ID
  title: string
  /** 'folder' - katalog z wieloma plikami; 'file' - pojedynczy plik (np. .m4b) */
  source: 'folder' | 'file'
  path: string
  author: string
  tracks: number
  bytes: number
  category: string
  notes: string
  addedAt: string
}

export interface AudiobookTrack {
  id: ID
  bookId: ID
  ord: number
  name: string
  path: string
  bytes: number
}

export type SearchModule =
  | 'tasks'
  | 'notes'
  | 'calendar'
  | 'projects'
  | 'documents'
  | 'music'
  | 'ebooks'
  | 'audiobooks'
  | 'photos'
  | 'finance'

export interface SearchHit {
  module: SearchModule
  id: ID
  title: string
  subtitle: string
  date?: string
  term: string
}

export interface CrudQuery {
  where?: Record<string, string | number | null>
  search?: { columns: string[]; term: string }
  orderBy?: string
  limit?: number
}

export const TABLES = [
  'projects',
  'events',
  'tasks',
  'notes',
  'files',
  'transactions',
  'chat_sessions',
  'chat_messages'
] as const

export type TableName = (typeof TABLES)[number]
