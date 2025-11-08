import { ipcMain } from 'electron'
import type {
  RuntimeSessionPayload,
  RuntimeStoreDataSourcePayload,
  RuntimeSessionIdentifier,
  RuntimeScopeDescriptor
} from '@shared/types/runtime'
import {
  createRuntimeSession,
  storeRuntimeDataSourceFile,
  cleanupRuntimeSession,
  cleanupRuntimeScope
} from '../services/runtimeStorageService'

function assertPayload<T>(payload: unknown, validator: (value: unknown) => value is T, message: string): T {
  if (!validator(payload)) {
    throw new Error(message)
  }
  return payload
}

const isRuntimeSessionPayload = (value: unknown): value is RuntimeSessionPayload => {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    (payload.scopeType === 'contract' || payload.scopeType === 'draft') &&
    typeof payload.scopeId === 'string' &&
    (payload.sessionType === 'test' || payload.sessionType === 'run')
  )
}

const isRuntimeSessionIdentifier = (value: unknown): value is RuntimeSessionIdentifier => {
  if (!isRuntimeSessionPayload(value)) return false
  const payload = value as RuntimeSessionPayload & { sessionId?: unknown }
  return typeof payload.sessionId === 'string'
}

const isStorePayload = (value: unknown): value is RuntimeStoreDataSourcePayload => {
  if (!isRuntimeSessionIdentifier(value)) return false
  const payload = value as RuntimeSessionIdentifier & {
    dataSourceId?: unknown
    sourcePath?: unknown
  }
  return typeof payload.dataSourceId === 'string' && typeof payload.sourcePath === 'string'
}

const isScopeDescriptor = (value: unknown): value is RuntimeScopeDescriptor => {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.scopeId === 'string' &&
    (payload.scopeType === 'contract' || payload.scopeType === 'draft')
  )
}

export function registerRuntimeIpcHandlers(): void {
  ipcMain.handle('runtime:create-session', async (_event, payload: unknown) => {
    const validated = assertPayload(payload, isRuntimeSessionPayload, 'Invalid runtime session payload')
    return createRuntimeSession(validated)
  })

  ipcMain.handle('runtime:store-data-source', async (_event, payload: unknown) => {
    const validated = assertPayload(
      payload,
      isStorePayload,
      'Invalid runtime data source store payload'
    )
    return storeRuntimeDataSourceFile(validated)
  })

  ipcMain.handle('runtime:cleanup-session', async (_event, payload: unknown) => {
    const validated = assertPayload(
      payload,
      isRuntimeSessionIdentifier,
      'Invalid runtime session identifier'
    )
    await cleanupRuntimeSession(validated)
  })

  ipcMain.handle('runtime:cleanup-scope', async (_event, payload: unknown) => {
    const validated = assertPayload(payload, isScopeDescriptor, 'Invalid runtime scope payload')
    await cleanupRuntimeScope(validated)
  })
}
