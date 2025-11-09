import { ipcMain } from 'electron'
import type {
  CreateContractPayload,
  UpdateContractPayload,
  RuntimeDataSourceFile,
  RuntimeParameterValue
} from '@shared/types/contract'
import type { RuntimeSessionIdentifier } from '@shared/types/runtime'
import type { ReportRunOptions, ContractTestPayload } from '@shared/types/reportRunner'
import {
  fetchAllContracts,
  fetchContractById,
  createContract,
  deleteContract,
  updateContract
} from '../services/contractService'
import { runContractReport, testContractDraft } from '../services/reportRunnerService'

export function registerContractIpcHandlers(): void {
  ipcMain.handle('contracts:list', () => {
    return fetchAllContracts()
  })

  ipcMain.handle('contracts:get', (_event, contractId: string) => {
    return fetchContractById(contractId)
  })

  ipcMain.handle('contracts:create', (_event, payload: CreateContractPayload) => {
    return createContract(payload)
  })

  ipcMain.handle('contracts:update', (_event, payload: UpdateContractPayload) => {
    return updateContract(payload)
  })

  ipcMain.handle('contracts:delete', (_event, contractId: string) => {
    deleteContract(contractId)
  })

  ipcMain.handle('contracts:run', (_event, payload: unknown) => {
    const validated = assertPayload(payload, isReportRunOptions, 'Invalid contract run payload')
    return runContractReport(validated)
  })

  ipcMain.handle('contracts:test', (_event, payload: unknown) => {
    const validated = assertPayload(payload, isContractTestPayload, 'Invalid contract test payload')
    return testContractDraft(validated)
  })
}

function assertPayload<T>(
  payload: unknown,
  validator: (value: unknown) => value is T,
  message: string
): T {
  if (!validator(payload)) {
    throw new Error(message)
  }
  return payload
}

const isRuntimeSessionIdentifier = (value: unknown): value is RuntimeSessionIdentifier => {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return (
    typeof session.scopeId === 'string' &&
    (session.scopeType === 'contract' || session.scopeType === 'draft') &&
    typeof session.sessionId === 'string' &&
    (session.sessionType === 'test' || session.sessionType === 'run')
  )
}

const isRuntimeParameterValues = (value: unknown): value is RuntimeParameterValue[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as RuntimeParameterValue).mark === 'string'
    )
  )
}

const isRuntimeDataSourceFiles = (value: unknown): value is RuntimeDataSourceFile[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as RuntimeDataSourceFile).dataSourceId === 'string'
    )
  )
}

const isReportRunOptions = (value: unknown): value is ReportRunOptions => {
  if (!value || typeof value !== 'object') return false
  const payload = value as ReportRunOptions
  return (
    typeof payload.contractId === 'string' &&
    isRuntimeSessionIdentifier(payload.runtimeSession) &&
    isRuntimeParameterValues(payload.parameterValues) &&
    isRuntimeDataSourceFiles(payload.dataSourceFiles)
  )
}

const isContractDraftPayload = (value: unknown): value is ContractTestPayload['draft'] => {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.templatePath === 'string' &&
    typeof draft.templateFileName === 'string' &&
    typeof draft.templateChecksum === 'string' &&
    Array.isArray(draft.dataSources) &&
    Array.isArray(draft.bindings)
  )
}

const isContractTestPayload = (value: unknown): value is ContractTestPayload => {
  if (!value || typeof value !== 'object') return false
  const payload = value as ContractTestPayload
  return (
    isContractDraftPayload(payload.draft) &&
    (payload.contractId === undefined || typeof payload.contractId === 'string') &&
    isRuntimeSessionIdentifier(payload.runtimeSession) &&
    isRuntimeParameterValues(payload.parameterValues) &&
    isRuntimeDataSourceFiles(payload.dataSourceFiles)
  )
}
