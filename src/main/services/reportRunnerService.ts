import { join, extname, basename } from 'path'
import { promises as fs } from 'fs'
import carbone from 'carbone'
import { execa } from 'execa'
import type {
  ReportContract,
  ParameterDefinition,
  DataBinding,
  DataSource
} from '@shared/types/contract'
import type {
  ColumnListExtractionResult,
  FixedListExtractionResult,
  ListExtractionResult,
  CellPrimitive
} from '@shared/types/dataExtraction'
import type {
  ContractTestPayload,
  ReportRunLogEntry,
  ReportRunOptions,
  ReportRunResult,
  ReportRunErrorDetail,
  ReportOutputFormat
} from '@shared/types/reportRunner'
import type { RuntimeDataSourceFile, RuntimeParameterValue } from '@shared/types/contract'
import { fetchContractById } from './contractService'
import { ExcelDataExtractor, DataExtractionError } from './dataExtractionService'
import { resolveRuntimeSessionPath } from './runtimeStorageService'

class ReportRunLogger {
  private readonly entries: ReportRunLogEntry[] = []

  info(message: string, context?: Record<string, unknown>) {
    this.push('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.push('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>) {
    this.push('error', message, context)
  }

  private push(level: ReportRunLogEntry['level'], message: string, context?: Record<string, unknown>) {
    this.entries.push({
      level,
      message,
      context,
      timestamp: new Date().toISOString()
    })
  }

  getLogs(): ReportRunLogEntry[] {
    return [...this.entries]
  }
}

export class ReportRunError extends Error {
  detail: ReportRunErrorDetail

  constructor(message: string, detail: ReportRunErrorDetail) {
    super(message)
    this.name = 'ReportRunError'
    this.detail = detail
  }
}

const OUTPUT_SUB_DIR = 'outputs'
const DEFAULT_OUTPUT_FORMAT: ReportOutputFormat = 'xlsx'

type ContractExecutionContext = {
  id: string
  templatePath: string
  templateFileName: string
  dataSources: DataSource[]
  bindings: DataBinding[]
}

export async function runContractReport(options: ReportRunOptions): Promise<ReportRunResult> {
  const contract = fetchContractById(options.contractId)
  if (!contract) {
    throw new ReportRunError(`找不到契约 ${options.contractId}`, {
      code: 'CONTRACT_NOT_FOUND'
    })
  }
  return executeReport(
    mapToExecutionContext(contract),
    options
  )
}

export async function testContractDraft(payload: ContractTestPayload): Promise<ReportRunResult> {
  const context: ContractExecutionContext = {
    id: payload.contractId ?? 'draft',
    templatePath: payload.draft.templatePath,
    templateFileName: payload.draft.templateFileName,
    dataSources: payload.draft.dataSources,
    bindings: payload.draft.bindings
  }

  return executeReport(context, {
    contractId: context.id,
    runtimeSession: payload.runtimeSession,
    parameterValues: payload.parameterValues,
    dataSourceFiles: payload.dataSourceFiles,
    outputFormat: payload.outputFormat,
    detectLibreOffice: payload.detectLibreOffice
  })
}

async function executeReport(
  contract: ContractExecutionContext,
  options: ReportRunOptions
): Promise<ReportRunResult> {
  const startedAt = Date.now()
  const logger = new ReportRunLogger()

  try {
    logger.info('开始执行报表运行', {
      contractId: options.contractId,
      sessionId: options.runtimeSession.sessionId,
      sessionType: options.runtimeSession.sessionType
    })

    if (options.detectLibreOffice !== false) {
      await detectLibreOffice(logger)
    }

    await ensureTemplateExists(contract, logger)

    const dataPayload = await buildDataset(contract, options, logger)

    const sessionPath = resolveRuntimeSessionPath(options.runtimeSession)
    const outputDir = join(sessionPath, OUTPUT_SUB_DIR)
    await fs.mkdir(outputDir, { recursive: true })

    const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT
    const outputFileName = buildOutputFileName(contract.templateFileName, outputFormat)
    const outputPath = join(outputDir, outputFileName)

    logger.info('开始调用 Carbone 渲染模板', {
      templatePath: contract.templatePath,
      outputFormat
    })

    const buffer = await renderTemplate(contract.templatePath, dataPayload, outputFormat)
    await fs.writeFile(outputPath, buffer)

    logger.info('报表渲染完成', { outputPath })

    const durationMs = Date.now() - startedAt
    logger.info('报表运行结束', { durationMs })

    return {
      outputPath,
      outputFormat,
      durationMs,
      logs: logger.getLogs()
    }
  } catch (error) {
    const normalized = normalizeRunError(error)
    if (normalized.detail.code === 'DATA_EXTRACTION_FAILED') {
      logger.error(normalized.message, {
        code: normalized.detail.code,
        dataSourceId: normalized.detail.dataSourceId,
        sheetName: normalized.detail.sheetName,
        suggestion: normalized.detail.suggestion
      })
    } else {
      logger.error(normalized.message, { ...normalized.detail })
    }
    throw normalized
  }
}

function mapToExecutionContext(contract: ReportContract): ContractExecutionContext {
  return {
    id: contract.id,
    templatePath: contract.templatePath,
    templateFileName: contract.templateFileName,
    dataSources: contract.dataSources,
    bindings: contract.bindings
  }
}

async function ensureTemplateExists(
  contract: ContractExecutionContext,
  logger: ReportRunLogger
): Promise<void> {
  try {
    await fs.access(contract.templatePath)
  } catch {
    logger.error('模板文件缺失', { templatePath: contract.templatePath })
    throw new ReportRunError('模板文件不存在或已被删除', {
      code: 'TEMPLATE_MISSING',
      suggestion: '请重新上传模板或重新保存契约'
    })
  }
}

async function buildDataset(
  contract: ContractExecutionContext,
  options: ReportRunOptions,
  logger: ReportRunLogger
): Promise<{ d: Record<string, unknown>; v: Record<string, unknown> }> {
  const sessionPath = resolveRuntimeSessionPath(options.runtimeSession)
  const dataSourceFileMap = resolveDataSourceFiles(sessionPath, contract, options.dataSourceFiles)

  const extractorCache = new Map<string, ExcelDataExtractor>()
  const dataSourceNameMap = new Map(contract.dataSources.map((item) => [item.id, item.name]))

  async function getExtractor(dataSourceId: string): Promise<ExcelDataExtractor> {
    if (extractorCache.has(dataSourceId)) {
      return extractorCache.get(dataSourceId)!
    }
    const storedFilePath = dataSourceFileMap.get(dataSourceId)
    if (!storedFilePath) {
      throw new ReportRunError(`数据源 ${dataSourceId} 未上传文件`, {
        code: 'DATA_SOURCE_NOT_FOUND',
        dataSourceId,
        suggestion: '请先上传对应的数据源文件后再运行'
      })
    }
    try {
      await fs.access(storedFilePath)
    } catch {
      throw new ReportRunError(`无法访问数据源文件：${storedFilePath}`, {
        code: 'DATA_SOURCE_NOT_FOUND',
        dataSourceId,
        suggestion: '请重新上传该数据源文件'
      })
    }
    logger.info('加载数据源文件', {
      dataSourceId,
      path: storedFilePath
    })
    const extractor = await ExcelDataExtractor.fromFile({
      sourcePath: storedFilePath,
      dataSourceName: dataSourceNameMap.get(dataSourceId)
    })
    extractorCache.set(dataSourceId, extractor)
    return extractor
  }

  const datasetRoot: Record<string, unknown> = {}

  for (const binding of contract.bindings) {
    if (binding.type === 'single') {
      const extractor = await getExtractor(binding.dataSource)
      const result = extractor.extractSingleValue(binding)
      const pathSegments = resolveDataPathFromMark(binding.mark)
      if (pathSegments.length === 0) continue
      assignDeepValue(datasetRoot, pathSegments, result.value)
      logger.info('单值绑定完成', {
        mark: binding.mark,
        sheetName: binding.sheetName,
        cell: binding.cellCoordinate
      })
    } else if (binding.type === 'list') {
      const extractor = await getExtractor(binding.dataSource)
      const listResult = extractor.extractList(binding)
      const rows = transformListResult(listResult)
      const pathSegments = resolveDataPathFromMark(binding.mark)
      if (pathSegments.length === 0) continue
      assignDeepValue(datasetRoot, pathSegments, rows)
      logger.info('列表绑定完成', {
        mark: binding.mark,
        sheetName: binding.sheetName,
        rows: rows.length
      })
    }
  }

  const parameterValues = normalizeParameterValues(contract, options.parameterValues, logger)

  return { d: datasetRoot, v: parameterValues }
}

function resolveDataSourceFiles(
  sessionPath: string,
  contract: ContractExecutionContext,
  uploadedFiles: RuntimeDataSourceFile[]
): Map<string, string> {
  const map = new Map<string, string>()
  const uploadedMap = new Map(uploadedFiles.map((file) => [file.dataSourceId, file]))

  contract.dataSources.forEach((ds) => {
    const uploaded = uploadedMap.get(ds.id)
    if (uploaded?.fileName) {
      const storedPath = join(sessionPath, 'data-sources', ds.id, uploaded.fileName)
      map.set(ds.id, storedPath)
    }
  })

  return map
}

function normalizeParameterValues(
  contract: ContractExecutionContext,
  parameterValues: RuntimeParameterValue[],
  logger: ReportRunLogger
): Record<string, unknown> {
  const providedMap = new Map(parameterValues.map((param) => [param.mark, param.value]))
  const normalized: Record<string, unknown> = {}

  contract.bindings
    .filter((binding): binding is ParameterDefinition => binding.type === 'parameter')
    .forEach((parameter) => {
      const rawValue = providedMap.get(parameter.mark)
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        throw new ReportRunError(`运行参数 ${parameter.displayLabel} 未填写`, {
          code: 'PARAMETER_MISSING',
          mark: parameter.mark,
          suggestion: '请补全运行参数后再次尝试'
        })
      }

      const convertedValue = convertParameterValue(parameter, rawValue)
      const targetKey = parameter.mark.replace(/^v\./, '').replace(/\[.*?\]/g, '')
      normalized[targetKey] = convertedValue

      logger.info('参数校验通过', {
        mark: parameter.mark,
        dataType: parameter.dataType
      })
    })

  return normalized
}

function convertParameterValue(parameter: ParameterDefinition, raw: string | number): unknown {
  if (parameter.dataType === 'number') {
    const numeric = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isNaN(numeric)) {
      throw new ReportRunError(`参数 ${parameter.displayLabel} 需要数值`, {
        code: 'PARAMETER_INVALID',
        mark: parameter.mark,
        suggestion: '请填写数字，例如 123 或 45.67'
      })
    }
    return numeric
  }

  if (parameter.dataType === 'date') {
    const parsed = new Date(String(raw))
    if (Number.isNaN(parsed.getTime())) {
      throw new ReportRunError(`参数 ${parameter.displayLabel} 需要日期格式`, {
        code: 'PARAMETER_INVALID',
        mark: parameter.mark,
        suggestion: '请使用 YYYY-MM-DD 格式的日期'
      })
    }
    return parsed
  }

  return typeof raw === 'string' ? raw : String(raw)
}

function resolveDataPathFromMark(mark: string): string[] {
  if (!mark) return []
  const withoutPrefix = mark.replace(/^d\./, '')
  const sanitized = withoutPrefix.replace(/\[[^\]]*\]/g, '')
  return sanitized
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function assignDeepValue(target: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) return
  let cursor: Record<string, unknown> = target
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const existing = cursor[key]
    if (!existing || typeof existing !== 'object') {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[path[path.length - 1]] = value
}

function transformListResult(result: ListExtractionResult): Record<string, unknown>[] {
  if (result.mode === 'header') {
    return result.rows.map((row) => buildRowObjectFromFieldMap(row.values))
  }

  if (result.mode === 'fixed') {
    return result.rows.map((row) => buildRowObjectFromFixedRow(row))
  }

  return buildRowsFromColumnResult(result)
}

function buildRowObjectFromFieldMap(values: Record<string, CellPrimitive>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  Object.entries(values).forEach(([fieldName, cellValue]) => {
    if (!fieldName) return
    const path = fieldName.split('.').filter(Boolean)
    if (path.length === 0) return
    assignDeepValue(row, path, cellValue)
  })
  return row
}

function buildRowObjectFromFixedRow(row: FixedListExtractionResult['rows'][number]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  row.values.forEach((cell) => {
    const path = resolveFieldPath(cell.fieldName, cell.headerText, cell.column)
    assignDeepValue(result, path, cell.value)
  })
  return result
}

function buildRowsFromColumnResult(result: ColumnListExtractionResult): Record<string, unknown>[] {
  const rowsMap = new Map<number, Record<string, unknown>>()

  result.columns.forEach((column) => {
    const path = resolveFieldPath(column.fieldName, column.headerText, column.column)
    column.values.forEach(({ rowNumber, value }) => {
      if (!rowsMap.has(rowNumber)) {
        rowsMap.set(rowNumber, {})
      }
      const row = rowsMap.get(rowNumber)!
      assignDeepValue(row, path, value)
    })
  })

  return Array.from(rowsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
    .filter((row) => Object.values(row).some((value) => value !== null && value !== ''))
}

function resolveFieldPath(fieldName?: string, headerText?: string, fallback?: string): string[] {
  if (fieldName) {
    return fieldName.split('.').filter(Boolean)
  }
  if (headerText) {
    return [slugify(headerText)]
  }
  if (fallback) {
    return [fallback.toLowerCase()]
  }
  return ['value']
}

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
  outputFormat: string
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    carbone.render(
      templatePath,
      data,
      { convertTo: outputFormat },
      (error: Error | null, result?: Buffer) => {
        if (error) {
          reject(
            new ReportRunError(`Carbone 渲染失败：${error.message}`, {
              code: 'RENDER_FAILED',
              suggestion: '请检查模板中的标记是否有效'
            })
          )
          return
        }
        if (!result) {
          reject(
            new ReportRunError('Carbone 没有返回任何数据', {
              code: 'RENDER_FAILED'
            })
          )
          return
        }
        resolve(result)
      }
    )
  })
}

async function detectLibreOffice(logger: ReportRunLogger): Promise<void> {
  try {
    const { stdout } = await execa('soffice', ['--version'])
    logger.info('检测到 LibreOffice 环境', { version: stdout.trim() })
  } catch (error) {
    logger.warn('无法检测 LibreOffice，可忽略该警告', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

function buildOutputFileName(templateFileName: string, format: string): string {
  const baseName = basename(templateFileName, extname(templateFileName))
  return `${baseName}-output.${format}`
}

function normalizeRunError(error: unknown): ReportRunError {
  if (error instanceof ReportRunError) {
    return error
  }

  if (error instanceof DataExtractionError) {
    return new ReportRunError(error.message, {
      code: 'DATA_EXTRACTION_FAILED',
      sheetName: error.detail.sheetName,
      suggestion: error.detail.suggestion ?? error.detail.reason
    })
  }

  if (error instanceof Error) {
    return new ReportRunError(error.message, {
      code: 'RENDER_FAILED'
    })
  }

  return new ReportRunError('未知的报表运行错误', {
    code: 'RENDER_FAILED'
  })
}
