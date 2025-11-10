import { randomUUID } from 'crypto'
import type {
  ReportContract,
  DataSource,
  SingleValueBinding,
  ListBinding,
  ParameterDefinition,
  FieldMapping,
  CreateContractPayload,
  UpdateContractPayload,
  DataBinding,
  MarkType
} from '@shared/types/contract'
import { getDatabase } from '../database'
import { deleteTemplateFile } from './templateStorageService'
import { cleanupContractRuntimeFiles } from './runtimeStorageService'

type ReportContractRow = {
  id: string
  name: string
  description: string | null
  template_path: string
  template_file_name: string
  template_checksum: string
  created_at: string
  updated_at: string
}

type DataSourceRow = {
  id: string
  contract_id: string
  name: string
  sort_order: number
}

type SingleValueBindingRow = {
  id: string
  contract_id: string
  mark: string
  data_source_id: string
  sheet_name: string
  cell_coordinate: string
  data_type: string | null
}

type ListBindingRow = {
  id: string
  contract_id: string
  mark: string
  data_source_id: string
  sheet_name: string
  range_method: string
  header_row: number | null
  data_start_row: number | null
  fixed_range: string | null
  columns_json: string | null
}

type ListFieldMappingRow = {
  id: number
  list_binding_id: string
  field_name: string
  header_text: string
  sort_order: number
}

type ParameterDefinitionRow = {
  id: string
  contract_id: string
  mark: string
  display_label: string
  data_type: 'text' | 'number' | 'date'
  default_value: string | null
}

type MarkBindingOverrideRow = {
  id: string
  contract_id: string
  mark: string
  mark_kind: string
  mode: string
  reason: string | null
}

export function fetchAllContracts(): ReportContract[] {
  const db = getDatabase()
  const contractRows = db
    .prepare<
      unknown[],
      ReportContractRow
    >('SELECT * FROM report_contracts ORDER BY created_at DESC')
    .all()

  return contractRows.map((row) => hydrateContract(row))
}

export function fetchContractById(id: string): ReportContract | null {
  const db = getDatabase()
  const row = db
    .prepare<[string], ReportContractRow>('SELECT * FROM report_contracts WHERE id = ?')
    .get(id)

  if (!row) return null
  return hydrateContract(row)
}

function hydrateContract(row: ReportContractRow): ReportContract {
  const dataSources = loadDataSources(row.id)

  const singleBindings = loadSingleValueBindings(row.id)
  const listBindings = loadListBindings(row.id)
  const parameterBindings = loadParameterDefinitions(row.id)
  const skipBindings = loadMarkBindingOverrides(row.id)

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    templatePath: row.template_path,
    templateFileName: row.template_file_name,
    templateChecksum: row.template_checksum,
    dataSources: dataSources.map(({ id, name }) => ({ id, name })),
    bindings: [...singleBindings, ...listBindings, ...parameterBindings, ...skipBindings],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function loadDataSources(contractId: string): DataSource[] {
  const db = getDatabase()
  const rows = db
    .prepare<
      [string],
      DataSourceRow
    >('SELECT id, name, sort_order FROM data_sources WHERE contract_id = ? ORDER BY sort_order ASC, name ASC')
    .all(contractId)

  return rows.map((row) => ({
    id: row.id,
    name: row.name
  }))
}

function loadSingleValueBindings(contractId: string): SingleValueBinding[] {
  const db = getDatabase()
  const rows = db
    .prepare<[string], SingleValueBindingRow>(
      `SELECT id, contract_id, mark, data_source_id, sheet_name, cell_coordinate, data_type
       FROM single_value_bindings
       WHERE contract_id = ?
       ORDER BY mark ASC`
    )
    .all(contractId)

  return rows.map((row) => ({
    type: 'single',
    mark: row.mark,
    dataSource: row.data_source_id,
    sheetName: row.sheet_name,
    cellCoordinate: row.cell_coordinate,
    dataType: (row.data_type as SingleValueBinding['dataType']) ?? undefined
  }))
}

function loadListBindings(contractId: string): ListBinding[] {
  const db = getDatabase()
  const listRows = db
    .prepare<[string], ListBindingRow>(
      `SELECT id, contract_id, mark, data_source_id, sheet_name, range_method,
              header_row, data_start_row, fixed_range, columns_json
       FROM list_bindings
       WHERE contract_id = ?
       ORDER BY mark ASC`
    )
    .all(contractId)

  const fieldMappingStmt = db.prepare<[string], ListFieldMappingRow>(
    `SELECT id, list_binding_id, field_name, header_text, sort_order
     FROM list_field_mappings
     WHERE list_binding_id = ?
     ORDER BY sort_order ASC, id ASC`
  )

  return listRows.map((row) => {
    const mappings = fieldMappingStmt.all(row.id).map<FieldMapping>((mapping) => ({
      fieldName: mapping.field_name,
      headerText: mapping.header_text
    }))

    return {
      type: 'list',
      mark: row.mark,
      dataSource: row.data_source_id,
      sheetName: row.sheet_name,
      rangeMethod: row.range_method as ListBinding['rangeMethod'],
      headerRow: row.header_row ?? undefined,
      dataStartRow: row.data_start_row ?? undefined,
      fixedRange: row.fixed_range ?? undefined,
      columns: row.columns_json ? parseColumns(row.columns_json) : undefined,
      fieldMappings: mappings.length > 0 ? mappings : undefined
    }
  })
}

function loadParameterDefinitions(contractId: string): ParameterDefinition[] {
  const db = getDatabase()
  const rows = db
    .prepare<[string], ParameterDefinitionRow>(
      `SELECT id, contract_id, mark, display_label, data_type, default_value
       FROM parameter_definitions
       WHERE contract_id = ?
       ORDER BY mark ASC`
    )
    .all(contractId)

  return rows.map((row) => ({
    type: 'parameter',
    mark: row.mark,
    displayLabel: row.display_label,
    dataType: row.data_type,
    defaultValue: row.default_value ?? undefined
  }))
}

function loadMarkBindingOverrides(contractId: string): DataBinding[] {
  const db = getDatabase()
  const rows = db
    .prepare<[string], MarkBindingOverrideRow>(
      `SELECT id, contract_id, mark, mark_kind, mode, reason
       FROM mark_binding_overrides
       WHERE contract_id = ?
       ORDER BY mark ASC`
    )
    .all(contractId)

  return rows
    .filter((row) => row.mode === 'skip')
    .map((row) => ({
      type: 'skip',
      mark: row.mark,
      markKind: normalizeMarkKind(row.mark_kind),
      reason: row.reason ?? undefined
    }))
}

function normalizeMarkKind(kind: string): MarkType {
  if (kind === 'single' || kind === 'list' || kind === 'parameter') {
    return kind
  }
  return 'single'
}

export function createContract(payload: CreateContractPayload): ReportContract {
  const db = getDatabase()
  const contractId = payload.id ?? randomUUID()
  const timestamp = new Date().toISOString()

  const insertContractStmt = db.prepare(
    `INSERT INTO report_contracts
      (id, name, description, template_path, template_file_name, template_checksum, created_at, updated_at)
     VALUES (@id, @name, @description, @templatePath, @templateFileName, @templateChecksum, @createdAt, @updatedAt)`
  )

  const transaction = db.transaction(() => {
    insertContractStmt.run({
      id: contractId,
      name: payload.name,
      description: payload.description ?? null,
      templatePath: payload.templatePath,
      templateFileName: payload.templateFileName,
      templateChecksum: payload.templateChecksum,
      createdAt: timestamp,
      updatedAt: timestamp
    })

    insertRelatedEntities(db, contractId, payload.dataSources, payload.bindings)
  })

  transaction()

  const created = fetchContractById(contractId)
  if (!created) {
    throw new Error('创建契约后无法读取结果')
  }
  return created
}

export function updateContract(payload: UpdateContractPayload): ReportContract {
  const db = getDatabase()
  const timestamp = new Date().toISOString()
  const previousTemplatePath = getContractTemplatePath(payload.id)

  const updateContractStmt = db.prepare(
    `UPDATE report_contracts
     SET name = @name,
         description = @description,
         template_path = @templatePath,
         template_file_name = @templateFileName,
         template_checksum = @templateChecksum,
         updated_at = @updatedAt
     WHERE id = @id`
  )

  const deleteSingleStmt = db.prepare('DELETE FROM single_value_bindings WHERE contract_id = ?')
  const deleteListStmt = db.prepare('DELETE FROM list_bindings WHERE contract_id = ?')
  const deleteParameterStmt = db.prepare('DELETE FROM parameter_definitions WHERE contract_id = ?')
  const deleteFieldMappingsStmt = db.prepare(
    `DELETE FROM list_field_mappings
     WHERE list_binding_id IN (
       SELECT id FROM list_bindings WHERE contract_id = ?
     )`
  )
  const deleteDataSourcesStmt = db.prepare('DELETE FROM data_sources WHERE contract_id = ?')
  const deleteOverridesStmt = db.prepare('DELETE FROM mark_binding_overrides WHERE contract_id = ?')

  const transaction = db.transaction(() => {
    updateContractStmt.run({
      id: payload.id,
      name: payload.name,
      description: payload.description ?? null,
      templatePath: payload.templatePath,
      templateFileName: payload.templateFileName,
      templateChecksum: payload.templateChecksum,
      updatedAt: timestamp
    })

    deleteFieldMappingsStmt.run(payload.id)
    deleteSingleStmt.run(payload.id)
    deleteListStmt.run(payload.id)
    deleteParameterStmt.run(payload.id)
    deleteOverridesStmt.run(payload.id)
    deleteDataSourcesStmt.run(payload.id)

    insertRelatedEntities(db, payload.id, payload.dataSources, payload.bindings)
  })

  transaction()

  const updated = fetchContractById(payload.id)
  if (!updated) {
    throw new Error('更新契约后无法读取结果')
  }
  if (previousTemplatePath && previousTemplatePath !== payload.templatePath) {
    queueTemplateDeletion(previousTemplatePath)
    queueRuntimeCleanup(payload.id)
  }
  return updated
}

export function deleteContract(id: string): void {
  const previousTemplatePath = getContractTemplatePath(id)
  const db = getDatabase()
  db.prepare('DELETE FROM report_contracts WHERE id = ?').run(id)
  if (previousTemplatePath) {
    queueTemplateDeletion(previousTemplatePath)
  }
  queueRuntimeCleanup(id)
}

function insertRelatedEntities(
  db: ReturnType<typeof getDatabase>,
  contractId: string,
  dataSources: DataSource[],
  bindings: DataBinding[]
): void {
  const insertDataSourceStmt = db.prepare<{
    id: string
    contractId: string
    name: string
    sortOrder: number
  }>(
    `INSERT INTO data_sources (id, contract_id, name, sort_order)
     VALUES (@id, @contractId, @name, @sortOrder)`
  )

  const insertSingleBindingStmt = db.prepare<{
    id: string
    contractId: string
    mark: string
    dataSourceId: string
    sheetName: string
    cellCoordinate: string
    dataType: string
  }>(
    `INSERT INTO single_value_bindings
      (id, contract_id, mark, data_source_id, sheet_name, cell_coordinate, data_type)
     VALUES (@id, @contractId, @mark, @dataSourceId, @sheetName, @cellCoordinate, @dataType)`
  )

  const insertListBindingStmt = db.prepare<{
    id: string
    contractId: string
    mark: string
    dataSourceId: string
    sheetName: string
    rangeMethod: string
    headerRow: number | null
    dataStartRow: number | null
    fixedRange: string | null
    columnsJson: string | null
  }>(
    `INSERT INTO list_bindings
      (id, contract_id, mark, data_source_id, sheet_name, range_method,
       header_row, data_start_row, fixed_range, columns_json)
     VALUES (@id, @contractId, @mark, @dataSourceId, @sheetName, @rangeMethod,
       @headerRow, @dataStartRow, @fixedRange, @columnsJson)`
  )

  const insertFieldMappingStmt = db.prepare<{
    listBindingId: string
    fieldName: string
    headerText: string
    sortOrder: number
  }>(
    `INSERT INTO list_field_mappings (list_binding_id, field_name, header_text, sort_order)
     VALUES (@listBindingId, @fieldName, @headerText, @sortOrder)`
  )

  const insertParameterStmt = db.prepare<{
    id: string
    contractId: string
    mark: string
    displayLabel: string
    dataType: string
    defaultValue: string | null
  }>(
    `INSERT INTO parameter_definitions
      (id, contract_id, mark, display_label, data_type, default_value)
     VALUES (@id, @contractId, @mark, @displayLabel, @dataType, @defaultValue)`
  )
  const insertOverrideStmt = db.prepare<{
    id: string
    contractId: string
    mark: string
    markKind: string
    mode: string
    reason: string | null
  }>(
    `INSERT INTO mark_binding_overrides
      (id, contract_id, mark, mark_kind, mode, reason)
     VALUES (@id, @contractId, @mark, @markKind, @mode, @reason)`
  )

  const dataSourceIdSet = new Set<string>()
  dataSources.forEach((ds, index) => {
    const dsId = ds.id || randomUUID()
    dataSourceIdSet.add(dsId)
    insertDataSourceStmt.run({
      id: dsId,
      contractId,
      name: ds.name,
      sortOrder: index
    })
  })

  bindings.forEach((binding) => {
    if (binding.type === 'single') {
      if (!dataSourceIdSet.has(binding.dataSource)) {
        throw new Error(`未知的数据源引用: ${binding.dataSource}`)
      }

      insertSingleBindingStmt.run({
        id: randomUUID(),
        contractId,
        mark: binding.mark,
        dataSourceId: binding.dataSource,
        sheetName: binding.sheetName,
        cellCoordinate: binding.cellCoordinate,
        dataType: binding.dataType ?? 'auto'
      })
    } else if (binding.type === 'list') {
      if (!dataSourceIdSet.has(binding.dataSource)) {
        throw new Error(`未知的数据源引用: ${binding.dataSource}`)
      }

      const listBindingId = randomUUID()
      insertListBindingStmt.run({
        id: listBindingId,
        contractId,
        mark: binding.mark,
        dataSourceId: binding.dataSource,
        sheetName: binding.sheetName,
        rangeMethod: binding.rangeMethod,
        headerRow: binding.headerRow ?? null,
        dataStartRow: binding.dataStartRow ?? null,
        fixedRange: binding.fixedRange ?? null,
        columnsJson: binding.columns ? JSON.stringify(binding.columns) : null
      })

      if (binding.fieldMappings && binding.fieldMappings.length > 0) {
        binding.fieldMappings.forEach((mapping, index) => {
          insertFieldMappingStmt.run({
            listBindingId,
            fieldName: mapping.fieldName,
            headerText: mapping.headerText,
            sortOrder: index
          })
        })
      }
    } else if (binding.type === 'parameter') {
      insertParameterStmt.run({
        id: randomUUID(),
        contractId,
        mark: binding.mark,
        displayLabel: binding.displayLabel,
        dataType: binding.dataType,
        defaultValue: binding.defaultValue ?? null
      })
    } else if (binding.type === 'skip') {
      insertOverrideStmt.run({
        id: randomUUID(),
        contractId,
        mark: binding.mark,
        markKind: binding.markKind,
        mode: 'skip',
        reason: binding.reason ?? null
      })
    }
  })
}

function parseColumns(json: string): string[] | undefined {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : undefined
  } catch {
    return undefined
  }
}

function getContractTemplatePath(contractId: string): string | null {
  const db = getDatabase()
  const row = db
    .prepare<
      [string],
      { template_path: string | null }
    >('SELECT template_path FROM report_contracts WHERE id = ?')
    .get(contractId)
  return row?.template_path ?? null
}

function queueTemplateDeletion(templatePath: string): void {
  deleteTemplateFile(templatePath).catch((error) => {
    console.warn(`删除模板文件失败: ${templatePath}`, error)
  })
}

function queueRuntimeCleanup(contractId: string): void {
  cleanupContractRuntimeFiles(contractId).catch((error) => {
    console.warn(`清理契约运行时文件失败: ${contractId}`, error)
  })
}
