import ExcelJS from 'exceljs'
import type { CellValue } from 'exceljs'
import type { MarkItem, MarkType } from '@shared/types/contract'
import type { TemplateParseResult } from '@shared/types/template'

interface TemplateErrorDetail {
  sheetName: string
  cellAddress: string
  expression: string
}

export class TemplateParseError extends Error {
  detail: TemplateErrorDetail

  constructor(message: string, detail: TemplateErrorDetail) {
    super(message)
    this.name = 'TemplateParseError'
    this.detail = detail
  }
}

// 匹配 Carbone 标记（兼容 `{d.xxx}`、`{c.xxx}`、`{# alias}`、`{t()}`、`{o.xxx}` 以及双花括号写法）
const MARK_PATTERN = /\{\{.*?\}\}|\{.*?\}/g
const LOOP_SAMPLE_ROW_PATTERN = /\[i\s*([+-])\s*\d+(?:[^\]]*)\]/i
const LOOP_DYNAMIC_INDEX_PATTERN = /\[i(?!\s*=)[^\]]*\]/i
const ARRAY_WILDCARD_PATTERN = /\[\s*\]/

export async function parseTemplate(templatePath: string): Promise<TemplateParseResult> {
  console.log(templatePath, 'templatePath')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const markMap = new Map<string, MarkItem>()

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const text = extractCellText(cell.value)
        if (!text) return

        for (const match of text.matchAll(MARK_PATTERN)) {
          const rawExpression = match[0] ?? ''
          const expression = rawExpression.replace(/^\{+/, '').replace(/\}+$/, '').trim()
          if (!expression) {
            raiseParseError({
              sheetName: worksheet.name,
              cellAddress: resolveCellAddress(rowNumber, columnNumber),
              expression: ''
            })
          }

          const classification = classifyMarkExpression(
            expression,
            worksheet.name,
            rowNumber,
            columnNumber
          )
          if (!classification) {
            continue
          }

          const { normalized, markType } = classification

          if (!markMap.has(normalized)) {
            markMap.set(normalized, {
              mark: normalized,
              markType,
              configured: false,
              displayText: ''
            })
          }
        }
      })
    })
  })

  return {
    markItems: Array.from(markMap.values())
  }
}

function classifyMarkExpression(
  expression: string,
  sheetName: string,
  rowNumber: number,
  columnNumber: number
): { normalized: string; markType: MarkType } | null {
  const normalized = expression.replace(/\s+/g, '')
  if (!normalized) {
    raiseParseError({
      sheetName,
      cellAddress: resolveCellAddress(rowNumber, columnNumber),
      expression
    })
  }

  if (isCarboneControlTag(expression, normalized)) {
    return null
  }

  const baseExpression = extractBaseExpression(normalized)
  if (!baseExpression) {
    raiseParseError({
      sheetName,
      cellAddress: resolveCellAddress(rowNumber, columnNumber),
      expression
    })
  }

  const loopContext = analyzeLoopContext(baseExpression)
  if (loopContext.shouldSkip) {
    return null
  }

  if (isDataMark(normalized)) {
    const markType: MarkType = loopContext.isList ? 'list' : 'single'
    return { normalized, markType }
  }

  if (isComplementMark(normalized)) {
    const markType: MarkType = loopContext.isList ? 'list' : 'single'
    return { normalized, markType }
  }

  if (isParameterMark(normalized)) {
    return { normalized, markType: 'parameter' }
  }

  raiseParseError({
    sheetName,
    cellAddress: resolveCellAddress(rowNumber, columnNumber),
    expression: normalized
  })
}

function extractBaseExpression(expression: string): string {
  const colonIndex = expression.indexOf(':')
  if (colonIndex === -1) {
    return expression
  }
  return expression.slice(0, colonIndex)
}

function analyzeLoopContext(baseExpression: string): { isList: boolean; shouldSkip: boolean } {
  if (!baseExpression) {
    return { isList: false, shouldSkip: false }
  }

  const shouldSkip = LOOP_SAMPLE_ROW_PATTERN.test(baseExpression)
  const hasArrayWildcard = ARRAY_WILDCARD_PATTERN.test(baseExpression)
  const hasDynamicIndex = LOOP_DYNAMIC_INDEX_PATTERN.test(baseExpression)

  return {
    isList: hasArrayWildcard || hasDynamicIndex,
    shouldSkip
  }
}

function isDataMark(expression: string): boolean {
  return expression.startsWith('d.') || expression.startsWith('d[')
}

function isComplementMark(expression: string): boolean {
  return expression.startsWith('c.') || expression.startsWith('c[')
}

function isParameterMark(expression: string): boolean {
  return expression.startsWith('v.') || expression.startsWith('v[')
}

function isCarboneControlTag(expression: string, normalized: string): boolean {
  if (expression.startsWith('t(')) {
    return true
  }

  if (normalized.startsWith('#') || normalized.startsWith('/')) {
    return true
  }

  if (normalized.startsWith('o.')) {
    return true
  }

  return false
}

function raiseParseError(detail: TemplateErrorDetail): never {
  const message = `模板解析失败：${detail.sheetName}!${detail.cellAddress} 中的标记 "${detail.expression || ' '}" 不符合规范，仅支持 d.*、c.* 或 v.* 表达式。`
  throw new TemplateParseError(message, detail)
}

function extractCellText(value: CellValue): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text ?? '').join('')
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text
    }
    if ('result' in value && typeof value.result === 'string') {
      return value.result
    }
  }

  return null
}

function resolveCellAddress(rowNumber: number, columnNumber: number): string {
  return `${columnNumberToName(columnNumber)}${rowNumber}`
}

function columnNumberToName(columnNumber: number): string {
  let number = columnNumber
  let columnName = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    columnName = String.fromCharCode(65 + remainder) + columnName
    number = Math.floor((number - 1) / 26)
  }
  return columnName
}
