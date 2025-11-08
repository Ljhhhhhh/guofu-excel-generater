import { ipcMain } from 'electron'
import type { CreateContractPayload, UpdateContractPayload } from '@shared/types/contract'
import {
  fetchAllContracts,
  fetchContractById,
  createContract,
  deleteContract,
  updateContract
} from '../services/contractService'

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
}
