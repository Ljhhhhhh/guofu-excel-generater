import { ipcMain, dialog, BrowserWindow } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { basename } from 'path'
import type { OpenFileDialogOptions, SelectedFile } from '@shared/types/file'

export function registerDialogIpcHandlers(): void {
  ipcMain.handle('dialogs:open-file', async (event, options: OpenFileDialogOptions = {}) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender)
    const properties: NonNullable<OpenDialogOptions['properties']> = ['openFile']
    if (options.multiple) {
      properties.push('multiSelections')
    }
    const dialogOptions: OpenDialogOptions = {
      title: options.title,
      properties,
      filters: options.filters
    }
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths.length) {
      return []
    }

    return result.filePaths.map<SelectedFile>((filePath) => ({
      path: filePath,
      name: basename(filePath)
    }))
  })
}
