import type { RuntimeSessionIdentifier } from './runtime'
import type {
  RuntimeParameterValue,
  RuntimeDataSourceFile,
  ContractDraftPayload
} from './contract'

export type ReportOutputFormat = 'xlsx' | 'pdf' | 'ods'

export interface ReportRunOptions {
  contractId: string
  runtimeSession: RuntimeSessionIdentifier
  parameterValues: RuntimeParameterValue[]
  dataSourceFiles: RuntimeDataSourceFile[]
  outputFormat?: ReportOutputFormat
  detectLibreOffice?: boolean
}

export interface ContractTestPayload {
  draft: ContractDraftPayload
  contractId?: string
  runtimeSession: RuntimeSessionIdentifier
  parameterValues: RuntimeParameterValue[]
  dataSourceFiles: RuntimeDataSourceFile[]
  outputFormat?: ReportOutputFormat
  detectLibreOffice?: boolean
}

export interface ReportRunLogEntry {
  level: 'info' | 'warn' | 'error'
  timestamp: string
  message: string
  context?: Record<string, unknown>
}

export interface ReportRunResult {
  outputPath: string
  outputFormat: ReportOutputFormat
  logs: ReportRunLogEntry[]
  durationMs: number
}

export type ReportRunErrorCode =
  | 'CONTRACT_NOT_FOUND'
  | 'TEMPLATE_MISSING'
  | 'PARAMETER_MISSING'
  | 'PARAMETER_INVALID'
  | 'DATA_SOURCE_NOT_FOUND'
  | 'DATA_EXTRACTION_FAILED'
  | 'RENDER_FAILED'
  | 'CONVERT_FAILED'

export interface ReportRunErrorDetail {
  code: ReportRunErrorCode
  mark?: string
  dataSourceId?: string
  sheetName?: string
  cellAddress?: string
  suggestion?: string
}
