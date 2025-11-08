export type RuntimeScopeType = 'contract' | 'draft'
export type RuntimeSessionType = 'test' | 'run'

export interface RuntimeScopeDescriptor {
  scopeId: string
  scopeType: RuntimeScopeType
}

export interface RuntimeSessionPayload extends RuntimeScopeDescriptor {
  sessionType: RuntimeSessionType
}

export interface RuntimeSession extends RuntimeSessionPayload {
  sessionId: string
  createdAt: string
}

export interface RuntimeSessionIdentifier extends RuntimeSessionPayload {
  sessionId: string
}

export interface RuntimeStoreDataSourcePayload extends RuntimeSessionIdentifier {
  dataSourceId: string
  sourcePath: string
}

export interface RuntimeStoredDataSourceFile {
  sessionId: string
  dataSourceId: string
  fileName: string
  checksum: string
  storedPath: string
}
