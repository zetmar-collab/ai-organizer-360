import { BrowserWindow, dialog, shell } from 'electron'
import { writeFile } from 'fs/promises'
import { markdownToHtml, parseInline, parseMarkdown } from '../shared/markdown'

export type ExportFormat = 'pdf' | 'docx' | 'md'

export interface ExportRequest {
  format: ExportFormat
  title: string
  content: string // Markdown
}

export interface ExportResult {
  ok: boolean
  path?: string
  canceled?: boolean
}

function safeName(title: string): string {
  return (title || 'dokument').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
}

const FILTERS: Record<ExportFormat, Electron.FileFilter[]> = {
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  docx: [{ name: 'Word', extensions: ['docx'] }],
  md: [{ name: 'Markdown', extensions: ['md'] }]
}

async function toPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false, sandbox: true }
  })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    })
  } finally {
    win.destroy()
  }
}

async function toDocx(title: string, md: string): Promise<Buffer> {
  const docxMod = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
    'Document' in docxMod ? docxMod : ((docxMod as { default: typeof docxMod }).default ?? docxMod)
  const blocks = parseMarkdown(md)

  const runs = (text: string): InstanceType<typeof TextRun>[] =>
    parseInline(text).map(
      (s) =>
        new TextRun({
          text: s.text,
          bold: s.bold,
          italics: s.italic,
          font: s.code ? 'Consolas' : undefined
        })
    )

  const children = blocks.map((b) => {
    switch (b.type) {
      case 'h1':
        return new Paragraph({ children: runs(b.text), heading: HeadingLevel.HEADING_1, spacing: { after: 200 } })
      case 'h2':
        return new Paragraph({ children: runs(b.text), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })
      case 'h3':
        return new Paragraph({ children: runs(b.text), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } })
      case 'li':
        return new Paragraph({ children: runs(b.text), bullet: { level: 0 } })
      case 'ol':
        return new Paragraph({ children: runs(b.text), bullet: { level: 0 } })
      case 'quote':
        return new Paragraph({ children: runs(b.text), indent: { left: 480 }, spacing: { after: 120 } })
      case 'code':
        return new Paragraph({
          children: [new TextRun({ text: b.text, font: 'Consolas', size: 20 })],
          spacing: { after: 120 }
        })
      case 'hr':
        return new Paragraph({ text: '', border: { bottom: { style: 'single', size: 6, color: 'CCCCCC', space: 1 } } })
      default:
        return new Paragraph({ children: runs(b.text), spacing: { after: 120 }, alignment: AlignmentType.LEFT })
    }
  })

  const doc = new Document({
    creator: 'AI Organizer 360',
    title,
    sections: [{ properties: {}, children }]
  })
  return Packer.toBuffer(doc)
}

export async function exportDocument(req: ExportRequest, parent?: BrowserWindow): Promise<ExportResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
    title: 'Zapisz dokument',
    defaultPath: `${safeName(req.title)}.${req.format}`,
    filters: FILTERS[req.format]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  if (req.format === 'md') {
    await writeFile(filePath, req.content, 'utf8')
  } else if (req.format === 'pdf') {
    await writeFile(filePath, await toPdf(markdownToHtml(req.content, req.title)))
  } else {
    await writeFile(filePath, await toDocx(req.title, req.content))
  }
  return { ok: true, path: filePath }
}

export function openExported(path: string): void {
  void shell.openPath(path)
}
