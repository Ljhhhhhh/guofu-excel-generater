import ExcelJS from 'exceljs'
import type { CellValue, Worksheet, Row } from 'exceljs'
import type { ListBinding, SingleValueBinding } from '@shared/types/contract'
import type {
  CellPrimitive,
  ColumnExtraction,
  ColumnListExtractionResult,
  FixedListExtractionResult,
  FixedListRow,
  HeaderListExtractionResult,
  HeaderListRow,
  ListExtractionResult,
  SingleValueExtractionResult
} from '@shared/types/dataExtraction'

interface RangeLocation {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
  normalizedRange: string
}

interface ExtractionContext {
  sourcePath: string
  dataSourceName?: string
}

export interface ExtractorFactoryOptions extends ExtractionContext {
  workbook?: ExcelJS.Workbook
}

interface DataExtractionErrorDetail {
  sheetName: string
  reason: string
  suggestion?: string
}

export class DataExtractionError extends Error {
  detail: DataExtractionErrorDetail

  constructor(message: string, detail: DataExtractionErrorDetail) {
    super(message)
    this.name = 'DataExtractionError'
    this.detail = detail
  }
}

/**
 * Excel 数据抽取工具，支持单值、列表（表头/固定范围）与整列模式。
 */
export class ExcelDataExtractor {
  private workbook: ExcelJS.Workbook
  private readonly context: ExtractionContext

  private constructor(workbook: ExcelJS.Workbook, context: ExtractionContext) {
    this.workbook = workbook
    this.context = context
  }

  static async fromFile(options: ExtractionContext): Promise<ExcelDataExtractor> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(options.sourcePath)
    return new ExcelDataExtractor(workbook, options)
  }

  static fromWorkbook(options: ExtractorFactoryOptions): ExcelDataExtractor {
    if (!options.workbook) {
      throw new Error('缺少 workbook 实例')
    }
    return new ExcelDataExtractor(options.workbook, options)
  }

  extractSingleValue(binding: SingleValueBinding): SingleValueExtractionResult {
    const worksheet = this.resolveWorksheet(binding.sheetName)
    const address = binding.cellCoordinate?.trim()
    if (!address) {
      throw new DataExtractionError('单值绑定缺少单元格坐标', {
        sheetName: worksheet.name,
        reason: 'cellCoordinate 不能为空'
      })
    }

    let location
    try {
      location = parseCellAddress(address)
    } catch (error) {
      throw new DataExtractionError(`单元格坐标 "${address}" 无法解析`, {
        sheetName: worksheet.name,
        reason: (error as Error).message,
        suggestion: '请确认坐标格式类似 A1、C5 或 $B$12'
      })
    }
    const { column, row } = location
    const cell = worksheet.getCell(row, column)
    const rawValue = extractRawCellValue(cell.value)
    const value = coerceCellValue(rawValue, binding.dataType ?? 'auto', {
      sheetName: worksheet.name,
      cellAddress: address,
      mark: binding.mark
    })

    return {
      type: 'single',
      mark: binding.mark,
      sheetName: worksheet.name,
      cellCoordinate: address,
      value
    }
  }

  extractList(binding: ListBinding): ListExtractionResult {
    const worksheet = this.resolveWorksheet(binding.sheetName)
    switch (binding.rangeMethod) {
      case 'header':
        return this.extractHeaderList(binding, worksheet)
      case 'fixed':
        return this.extractFixedRangeList(binding, worksheet)
      case 'column':
        return this.extractColumnList(binding, worksheet)
      default:
        throw new DataExtractionError(`暂不支持的 rangeMethod：${binding.rangeMethod as string}`, {
          sheetName: worksheet.name,
          reason: 'rangeMethod 必须是 header/fixed/column'
        })
    }
  }

  private resolveWorksheet(sheetName: string): Worksheet {
    const worksheet = this.workbook.getWorksheet(sheetName)
    if (!worksheet) {
      throw new DataExtractionError(`工作表 "${sheetName}" 不存在`, {
        sheetName,
        reason: `在文件 ${this.context.dataSourceName ?? this.context.sourcePath} 中找不到该工作表`,
        suggestion: '请确认 Excel 中的实际工作表名称，并与契约配置保持一致'
      })
    }
    return worksheet
  }

  private extractHeaderList(binding: ListBinding, worksheet: Worksheet): HeaderListExtractionResult {
    if (!binding.fieldMappings || binding.fieldMappings.length === 0) {
      throw new DataExtractionError('表头模式缺少字段映射', {
        sheetName: worksheet.name,
        reason: 'fieldMappings 不能为空',
        suggestion: '请在契约配置中填写要绑定的字段与表头文本'
      })
    }
    const headerRowIndex = Math.max(1, binding.headerRow ?? 1)
    const dataStartRow = Math.max(headerRowIndex + 1, binding.dataStartRow ?? headerRowIndex + 1)
    const headerRow = worksheet.getRow(headerRowIndex)
    if (!headerRow || !headerRow.hasValues) {
      throw new DataExtractionError(`第 ${headerRowIndex} 行未检测到表头`, {
        sheetName: worksheet.name,
        reason: `headerRow=${headerRowIndex} 不存在有效值`,
        suggestion: '请检查契约中的表头行号是否与 Excel 中一致'
      })
    }

    const headerMap = buildHeaderMap(headerRow)
    const columnMap = new Map<string, number>()
    binding.fieldMappings.forEach((mapping) => {
      const normalizedHeader = normalizeHeaderText(mapping.headerText)
      if (!normalizedHeader) {
        throw new DataExtractionError('字段映射缺少表头文本', {
          sheetName: worksheet.name,
          reason: `字段 ${mapping.fieldName} 未填写表头名`
        })
      }
      const columnIndex = headerMap.get(normalizedHeader)
      if (!columnIndex) {
        throw new DataExtractionError(`找不到表头 "${mapping.headerText}"`, {
          sheetName: worksheet.name,
          reason: `headerRow=${headerRowIndex} 中不存在该文本`,
          suggestion: '请检查 Excel 中的表头拼写，或更新契约配置'
        })
      }
      columnMap.set(mapping.fieldName, columnIndex)
    })

    const rows: HeaderListRow[] = []
    const maxRow = worksheet.rowCount
    for (let rowIndex = dataStartRow; rowIndex <= maxRow; rowIndex++) {
      const row = worksheet.getRow(rowIndex)
      if (!row?.hasValues) continue
      const values: Record<string, CellPrimitive> = {}
      let hasValue = false
      columnMap.forEach((columnIndex, fieldName) => {
        const cell = row.getCell(columnIndex)
        const normalized = extractRawCellValue(cell.value)
        values[fieldName] = normalized
        if (normalized !== null && normalized !== '') {
          hasValue = true
        }
      })

      if (hasValue) {
        rows.push({
          rowNumber: rowIndex,
          values
        })
      }
    }

    if (rows.length === 0) {
      throw new DataExtractionError('未能从数据区读取任何记录', {
        sheetName: worksheet.name,
        reason: `dataStartRow=${dataStartRow} 之后缺少有效数据`,
        suggestion: '请确认 Excel 中对应区域存在数据，并与配置的起始行一致'
      })
    }

    return {
      type: 'list',
      mode: 'header',
      mark: binding.mark,
      sheetName: worksheet.name,
      rows,
      fieldMappings: binding.fieldMappings
    }
  }

  private extractFixedRangeList(binding: ListBinding, worksheet: Worksheet): FixedListExtractionResult {
    const rangeText = binding.fixedRange?.trim()
    if (!rangeText) {
      throw new DataExtractionError('固定范围模式缺少 range', {
        sheetName: worksheet.name,
        reason: 'fixedRange 不能为空，例如 A2:C50'
      })
    }
    let range: RangeLocation
    try {
      range = parseRange(rangeText)
    } catch (error) {
      throw new DataExtractionError(`固定范围 "${rangeText}" 无法解析`, {
        sheetName: worksheet.name,
        reason: (error as Error).message,
        suggestion: '请使用 A2:C50 或 Sheet1!A2:C50 的格式'
      })
    }
    const rows: FixedListRow[] = []
    const columnCount = range.endColumn - range.startColumn + 1

    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex++) {
      const row = worksheet.getRow(rowIndex)
      if (!row?.hasValues) continue
      const values = new Array(columnCount).fill(null).map((_v, idx) => {
        const columnIndex = range.startColumn + idx
        const cell = row.getCell(columnIndex)
        return {
          column: columnNumberToLetter(columnIndex),
          value: extractRawCellValue(cell.value),
          fieldName: binding.fieldMappings?.[idx]?.fieldName,
          headerText: binding.fieldMappings?.[idx]?.headerText
        }
      })
      const hasValue = values.some((value) => value.value !== null && value.value !== '')
      if (hasValue) {
        rows.push({
          rowNumber: rowIndex,
          values
        })
      }
    }

    if (rows.length === 0) {
      throw new DataExtractionError('固定范围内未检测到任何有效数据', {
        sheetName: worksheet.name,
        reason: `range=${range.normalizedRange} 为空`,
        suggestion: '请确认 Excel 中该范围存在数据，或调整 range 设置'
      })
    }

    return {
      type: 'list',
      mode: 'fixed',
      mark: binding.mark,
      sheetName: worksheet.name,
      range: range.normalizedRange,
      rows
    }
  }

  private extractColumnList(binding: ListBinding, worksheet: Worksheet): ColumnListExtractionResult {
    if (!binding.columns || binding.columns.length === 0) {
      throw new DataExtractionError('整列模式缺少 columns 配置', {
        sheetName: worksheet.name,
        reason: 'columns 数组不能为空'
      })
    }

    const startRow = Math.max(1, binding.dataStartRow ?? 1)
    const columns: ColumnExtraction[] = binding.columns.map((columnReference, index) => {
      const columnLetter = normalizeColumnReference(columnReference)
      if (!columnLetter) {
        throw new DataExtractionError('列配置格式不正确', {
          sheetName: worksheet.name,
          reason: `列 "${columnReference}" 无法解析`,
          suggestion: '请使用 A、C 或 A:A 这样的格式'
        })
      }
      const columnIndex = columnLetterToNumber(columnLetter)
      const values: ColumnExtraction['values'] = []
      const maxRow = worksheet.rowCount
      for (let rowIndex = startRow; rowIndex <= maxRow; rowIndex++) {
        const cell = worksheet.getRow(rowIndex)?.getCell(columnIndex)
        if (!cell) continue
        const value = extractRawCellValue(cell.value)
        if (value === null || value === '') continue
        values.push({
          rowNumber: rowIndex,
          value
        })
      }
      if (values.length === 0) {
        throw new DataExtractionError(`列 ${columnLetter} 未读取到数据`, {
          sheetName: worksheet.name,
          reason: `column=${columnLetter} 起始行 ${startRow} 之后为空`,
          suggestion: '请确认列中存在数据，或调整起始行'
        })
      }
      const mapping = binding.fieldMappings?.[index]
      return {
        column: columnLetter,
        values,
        fieldName: mapping?.fieldName,
        headerText: mapping?.headerText
      }
    })

    return {
      type: 'list',
      mode: 'column',
      mark: binding.mark,
      sheetName: worksheet.name,
      columns
    }
  }
}

function buildHeaderMap(row: Row): Map<string, number> {
  const map = new Map<string, number>()
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = normalizeHeaderText(cell.value)
    if (normalized) {
      if (!map.has(normalized)) {
        map.set(normalized, colNumber)
      }
    }
  })
  return map
}

function normalizeHeaderText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim().toLowerCase()
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text.trim().toLowerCase()
  }
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    const text = value.richText.map((item) => item.text ?? '').join('')
    return text.trim().toLowerCase()
  }
  if (typeof value === 'object' && 'formula' in value && value.result !== undefined) {
    return normalizeHeaderText(value.result)
  }
  return ''
}

function parseCellAddress(address: string): { row: number; column: number } {
  const match = address.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)
  if (!match) {
    throw new Error(`非法的单元格坐标：${address}`)
  }
  const columnLetters = match[1]
  const row = Number(match[2])
  if (!row || row < 1) {
    throw new Error(`非法的行号：${address}`)
  }
  return {
    row,
    column: columnLetterToNumber(columnLetters)
  }
}

function parseRange(rangeText: string): RangeLocation {
  const normalized = rangeText.replace(/\$/g, '').trim()
  const match = normalized.match(/^(?:[^!]+!)?([A-Z]+\d+):([A-Z]+\d+)$/i)
  if (!match) {
    throw new Error(`非法的范围表达式：${rangeText}`)
  }
  const start = parseCellAddress(match[1])
  const end = parseCellAddress(match[2])
  const startColumn = Math.min(start.column, end.column)
  const endColumn = Math.max(start.column, end.column)
  const startRow = Math.min(start.row, end.row)
  const endRow = Math.max(start.row, end.row)
  return {
    startRow,
    endRow,
    startColumn,
    endColumn,
    normalizedRange: `${columnNumberToLetter(startColumn)}${startRow}:${columnNumberToLetter(endColumn)}${endRow}`
  }
}

function normalizeColumnReference(reference: string): string {
  if (!reference) return ''
  const normalized = reference.replace(/\$/g, '').trim()
  if (!normalized) return ''
  if (normalized.includes('!')) {
    const [, colPart] = normalized.split('!')
    if (colPart) {
      return normalizeColumnReference(colPart)
    }
  }
  if (normalized.includes(':')) {
    const [start] = normalized.split(':')
    return normalizeColumnReference(start)
  }
  const match = normalized.match(/^[A-Z]+$/i)
  return match ? match[0].toUpperCase() : ''
}

function columnLetterToNumber(letters: string): number {
  const normalized = letters.toUpperCase()
  let result = 0
  for (let i = 0; i < normalized.length; i++) {
    result = result * 26 + (normalized.charCodeAt(i) - 64)
  }
  return result
}

function columnNumberToLetter(column: number): string {
  let temp = column
  let letters = ''
  while (temp > 0) {
    const remainder = (temp - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    temp = Math.floor((temp - 1) / 26)
  }
  return letters
}

function extractRawCellValue(value: CellValue): CellPrimitive {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text ?? '').join('')
    }
    if ('formula' in value) {
      if (value.result !== undefined && value.result !== null) {
        return extractRawCellValue(value.result)
      }
      return null
    }
    if ('hyperlink' in value && typeof value.text === 'string') {
      return value.text
    }
    if ('result' in value) {
      return extractRawCellValue(value.result as CellValue)
    }
  }
  return null
}

function coerceCellValue(
  value: CellPrimitive,
  dataType: NonNullable<SingleValueBinding['dataType']>,
  context: { sheetName: string; cellAddress: string; mark: string }
): CellPrimitive {
  if (value === null) return null
  switch (dataType) {
    case 'text':
      return typeof value === 'string' ? value : String(value)
    case 'number': {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(numeric)) {
        throw new DataExtractionError('无法将单元格值转换为数字', {
          sheetName: context.sheetName,
          reason: `${context.cellAddress} 中的值 "${value}" 无法解析为数字`,
          suggestion: '请确认该单元格为数值格式，或在契约中选择文本类型'
        })
      }
      return numeric
    }
    case 'date': {
      if (value instanceof Date) return value
      const parsed = new Date(String(value))
      if (Number.isNaN(parsed.getTime())) {
        throw new DataExtractionError('无法将单元格值转换为日期', {
          sheetName: context.sheetName,
          reason: `${context.cellAddress} 中的值 "${value}" 无法解析为日期`,
          suggestion: '请在 Excel 中使用日期格式，或在契约中改为文本类型'
        })
      }
      return parsed
    }
    case 'auto':
    default:
      return value
  }
}
