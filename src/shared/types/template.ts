import type { MarkItem } from './contract'

export interface TemplateParseResult {
  markItems: MarkItem[]
}

export interface TemplateStoreResult {
  templateId: string
  fileName: string
  storedPath: string
  checksum: string
}
