import type Database from 'better-sqlite3'

const CREATE_REPORT_CONTRACTS = `
  CREATE TABLE IF NOT EXISTS report_contracts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_path TEXT NOT NULL,
    template_file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

const CREATE_DATA_SOURCES = `
  CREATE TABLE IF NOT EXISTS data_sources (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES report_contracts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`

const CREATE_SINGLE_VALUE_BINDINGS = `
  CREATE TABLE IF NOT EXISTS single_value_bindings (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES report_contracts(id) ON DELETE CASCADE,
    mark TEXT NOT NULL,
    data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    cell_coordinate TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'auto',
    UNIQUE(contract_id, mark)
  )
`

const CREATE_LIST_BINDINGS = `
  CREATE TABLE IF NOT EXISTS list_bindings (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES report_contracts(id) ON DELETE CASCADE,
    mark TEXT NOT NULL,
    data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    range_method TEXT NOT NULL CHECK(range_method IN ('header', 'fixed', 'column')),
    header_row INTEGER,
    data_start_row INTEGER,
    fixed_range TEXT,
    columns_json TEXT,
    UNIQUE(contract_id, mark)
  )
`

const CREATE_LIST_FIELD_MAPPINGS = `
  CREATE TABLE IF NOT EXISTS list_field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_binding_id TEXT NOT NULL REFERENCES list_bindings(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    header_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`

const CREATE_PARAMETER_DEFINITIONS = `
  CREATE TABLE IF NOT EXISTS parameter_definitions (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES report_contracts(id) ON DELETE CASCADE,
    mark TEXT NOT NULL,
    display_label TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK(data_type IN ('text', 'number', 'date')),
    default_value TEXT,
    UNIQUE(contract_id, mark)
  )
`

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_data_sources_contract ON data_sources(contract_id)`,
  `CREATE INDEX IF NOT EXISTS idx_single_value_contract ON single_value_bindings(contract_id)`,
  `CREATE INDEX IF NOT EXISTS idx_list_bindings_contract ON list_bindings(contract_id)`,
  `CREATE INDEX IF NOT EXISTS idx_parameter_contract ON parameter_definitions(contract_id)`
]

export function ensureSchema(db: Database.Database): void {
  const statements = [
    CREATE_REPORT_CONTRACTS,
    CREATE_DATA_SOURCES,
    CREATE_SINGLE_VALUE_BINDINGS,
    CREATE_LIST_BINDINGS,
    CREATE_LIST_FIELD_MAPPINGS,
    CREATE_PARAMETER_DEFINITIONS,
    ...CREATE_INDEXES
  ]

  const runStatements = db.transaction(() => {
    for (const sql of statements) {
      db.prepare(sql).run()
    }
  })

  runStatements()
}
