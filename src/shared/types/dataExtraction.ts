import type { ListBinding } from './contract'

export type CellPrimitive = string | number | boolean | Date | null

export interface SingleValueExtractionResult {
  type: 'single'
  mark: string
  sheetName: string
  cellCoordinate: string
  value: CellPrimitive
}

export interface HeaderListRow {
  rowNumber: number
  values: Record<string, CellPrimitive>
}

export interface HeaderListExtractionResult {
  type: 'list'
  mode: 'header'
  mark: string
  sheetName: string
  rows: HeaderListRow[]
  fieldMappings: NonNullable<ListBinding['fieldMappings']>
}

export interface FixedListCellValue {
  column: string
  fieldName?: string
  headerText?: string
  value: CellPrimitive
}

export interface FixedListRow {
  rowNumber: number
  values: FixedListCellValue[]
}

export interface FixedListExtractionResult {
  type: 'list'
  mode: 'fixed'
  mark: string
  sheetName: string
  range: string
  rows: FixedListRow[]
}

export interface ColumnExtractionValues {
  rowNumber: number
  value: CellPrimitive
}

export interface ColumnExtraction {
  column: string
  fieldName?: string
  headerText?: string
  values: ColumnExtractionValues[]
}

export interface ColumnListExtractionResult {
  type: 'list'
  mode: 'column'
  mark: string
  sheetName: string
  columns: ColumnExtraction[]
}

export type ListExtractionResult =
  | HeaderListExtractionResult
  | FixedListExtractionResult
  | ColumnListExtractionResult
