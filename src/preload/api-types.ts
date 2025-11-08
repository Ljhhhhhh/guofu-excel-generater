import type {
  CreateContractPayload,
  ReportContract,
  UpdateContractPayload
} from '@shared/types/contract'
import type { TemplateParseResult, TemplateStoreResult } from '@shared/types/template'
import type {
  RuntimeSession,
  RuntimeSessionPayload,
  RuntimeStoreDataSourcePayload,
  RuntimeStoredDataSourceFile,
  RuntimeSessionIdentifier,
  RuntimeScopeDescriptor
} from '@shared/types/runtime'
import type { OpenFileDialogOptions, SelectedFile } from '@shared/types/file'

export interface ContractsAPI {
  list(): Promise<ReportContract[]>
  get(id: string): Promise<ReportContract | null>
  create(payload: CreateContractPayload): Promise<ReportContract>
  update(payload: UpdateContractPayload): Promise<ReportContract>
  delete(id: string): Promise<void>
}

export interface TemplatesAPI {
  store(sourcePath: string): Promise<TemplateStoreResult>
  parse(templatePath: string): Promise<TemplateParseResult>
}

export interface AppAPI {
  contracts: ContractsAPI
  templates: TemplatesAPI
  runtime: RuntimeAPI
  dialogs: DialogsAPI
}

export interface RuntimeAPI {
  createSession(payload: RuntimeSessionPayload): Promise<RuntimeSession>
  storeDataSourceFile(payload: RuntimeStoreDataSourcePayload): Promise<RuntimeStoredDataSourceFile>
  cleanupSession(payload: RuntimeSessionIdentifier): Promise<void>
  cleanupScope(payload: RuntimeScopeDescriptor): Promise<void>
}

export interface DialogsAPI {
  openFile(options?: OpenFileDialogOptions): Promise<SelectedFile[]>
}
