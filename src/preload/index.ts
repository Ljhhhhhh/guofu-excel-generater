import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppAPI } from './api-types'

// Custom APIs for renderer
const api: AppAPI = {
  contracts: {
    list: () => ipcRenderer.invoke('contracts:list'),
    get: (id: string) => ipcRenderer.invoke('contracts:get', id),
    create: (payload) => ipcRenderer.invoke('contracts:create', payload),
    update: (payload) => ipcRenderer.invoke('contracts:update', payload),
    delete: (id: string) => ipcRenderer.invoke('contracts:delete', id)
  },
  templates: {
    store: (sourcePath: string) => ipcRenderer.invoke('templates:store', sourcePath),
    parse: (templatePath: string) => ipcRenderer.invoke('templates:parse', templatePath)
  },
  runtime: {
    createSession: (payload) => ipcRenderer.invoke('runtime:create-session', payload),
    storeDataSourceFile: (payload) => ipcRenderer.invoke('runtime:store-data-source', payload),
    cleanupSession: (payload) => ipcRenderer.invoke('runtime:cleanup-session', payload),
    cleanupScope: (payload) => ipcRenderer.invoke('runtime:cleanup-scope', payload)
  },
  dialogs: {
    openFile: (options) => ipcRenderer.invoke('dialogs:open-file', options)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
