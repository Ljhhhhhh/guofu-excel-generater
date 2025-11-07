import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { ensureSchema } from './schema'

let dbInstance: Database.Database | null = null

function resolveDatabasePath(): string {
  const baseDir = join(app.getPath('userData'), 'storage')
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true })
  }
  const dbPath = join(baseDir, 'report-contracts.db')
  return dbPath
}

export function initDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance
  }

  const dbPath = resolveDatabasePath()
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  ensureSchema(db)
  dbInstance = db

  return dbInstance
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDatabase() after app.ready.')
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
