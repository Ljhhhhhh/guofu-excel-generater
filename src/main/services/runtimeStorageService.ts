import { join, basename } from 'path'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import { randomUUID, createHash } from 'crypto'
import { app } from 'electron'
import type {
  RuntimeSession,
  RuntimeSessionPayload,
  RuntimeStoreDataSourcePayload,
  RuntimeStoredDataSourceFile,
  RuntimeSessionIdentifier,
  RuntimeScopeDescriptor
} from '@shared/types/runtime'

const SESSION_DIR_NAME: Record<'test' | 'run', string> = {
  test: 'tests',
  run: 'runs'
}

const SCOPE_DIR_NAME: Record<'contract' | 'draft', string> = {
  contract: 'contracts',
  draft: 'drafts'
}

const CLEANUP_RULES: Array<{
  scopeType: RuntimeScopeDescriptor['scopeType']
  sessionType: RuntimeSessionPayload['sessionType']
  maxAgeHours: number
}> = [
  { scopeType: 'draft', sessionType: 'test', maxAgeHours: 24 },
  { scopeType: 'draft', sessionType: 'run', maxAgeHours: 24 },
  { scopeType: 'contract', sessionType: 'test', maxAgeHours: 168 },
  { scopeType: 'contract', sessionType: 'run', maxAgeHours: 720 }
]

function getRuntimeRoot(): string {
  return join(app.getPath('userData'), 'storage', 'runtime')
}

async function ensureRuntimeRoot(): Promise<void> {
  const root = getRuntimeRoot()
  await fs.mkdir(root, { recursive: true })
}

export async function createRuntimeSession(
  payload: RuntimeSessionPayload
): Promise<RuntimeSession> {
  await ensureRuntimeRoot()
  await cleanupExpiredSessions()
  const sessionId = randomUUID()
  const sessionPath = resolveSessionPath({ ...payload, sessionId })

  await fs.mkdir(join(sessionPath, 'data-sources'), { recursive: true })

  const createdAt = new Date().toISOString()
  const meta = {
    ...payload,
    sessionId,
    createdAt
  }
  await fs.writeFile(join(sessionPath, 'session.meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

  return {
    ...payload,
    sessionId,
    createdAt
  }
}

export async function storeRuntimeDataSourceFile(
  payload: RuntimeStoreDataSourcePayload
): Promise<RuntimeStoredDataSourceFile> {
  await ensureRuntimeRoot()
  const sessionPath = resolveSessionPath(payload)
  await fs.mkdir(sessionPath, { recursive: true })

  const dataSourceDir = join(sessionPath, 'data-sources', payload.dataSourceId)
  await fs.mkdir(dataSourceDir, { recursive: true })

  const fileName = basename(payload.sourcePath)
  const targetPath = join(dataSourceDir, fileName)

  await fs.copyFile(payload.sourcePath, targetPath)
  const checksum = await calculateChecksum(targetPath)

  return {
    sessionId: payload.sessionId,
    dataSourceId: payload.dataSourceId,
    fileName,
    checksum,
    storedPath: targetPath
  }
}

export async function cleanupRuntimeSession(
  payload: RuntimeSessionIdentifier
): Promise<void> {
  const sessionPath = resolveSessionPath(payload)
  await removePath(sessionPath)
}

export async function cleanupRuntimeScope(scope: RuntimeScopeDescriptor): Promise<void> {
  const scopeDir = resolveScopeDir(scope)
  await removePath(scopeDir)
}

export async function cleanupContractRuntimeFiles(contractId: string): Promise<void> {
  await cleanupRuntimeScope({ scopeType: 'contract', scopeId: contractId })
}

function resolveScopeDir(scope: RuntimeScopeDescriptor): string {
  const root = getRuntimeRoot()
  return join(root, SCOPE_DIR_NAME[scope.scopeType], scope.scopeId)
}

function resolveSessionPath(identifier: RuntimeSessionIdentifier): string {
  const scopeDir = resolveScopeDir(identifier)
  const sessionDir = join(scopeDir, SESSION_DIR_NAME[identifier.sessionType], identifier.sessionId)
  return sessionDir
}

async function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolveChecksum, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', (error) => reject(error))
    stream.on('end', () => resolveChecksum(hash.digest('hex')))
  })
}

async function cleanupExpiredSessions(): Promise<void> {
  for (const rule of CLEANUP_RULES) {
    await cleanupByRule(rule.scopeType, rule.sessionType, rule.maxAgeHours)
  }
}

async function cleanupByRule(
  scopeType: RuntimeScopeDescriptor['scopeType'],
  sessionType: RuntimeSessionPayload['sessionType'],
  maxAgeHours: number
): Promise<void> {
  const root = getRuntimeRoot()
  const scopeRoot = join(root, SCOPE_DIR_NAME[scopeType])
  const scopeDirs = await readDirSafe(scopeRoot)
  const now = Date.now()
  for (const scopeDir of scopeDirs) {
    if (!scopeDir.isDirectory()) continue
    const sessionRoot = join(scopeRoot, scopeDir.name, SESSION_DIR_NAME[sessionType])
    const sessionDirs = await readDirSafe(sessionRoot)
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) continue
      const sessionPath = join(sessionRoot, sessionDir.name)
      const stats = await statSafe(sessionPath)
      if (!stats) continue
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60)
      if (ageHours > maxAgeHours) {
        await removePath(sessionPath)
      }
    }
  }
}

async function readDirSafe(path: string) {
  try {
    return await fs.readdir(path, { withFileTypes: true })
  } catch {
    return []
  }
}

async function statSafe(path: string) {
  try {
    return await fs.stat(path)
  } catch {
    return null
  }
}

async function removePath(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true })
  } catch {
    // ignore
  }
}
