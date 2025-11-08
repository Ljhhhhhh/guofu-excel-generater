import { ipcMain } from 'electron'
import { parseTemplate, TemplateParseError } from '../services/templateService'
import { storeTemplateFile } from '../services/templateStorageService'

export function registerTemplateIpcHandlers(): void {
  ipcMain.handle('templates:store', async (_event, sourcePath: unknown) => {
    if (typeof sourcePath !== 'string' || !sourcePath) {
      throw new Error('模板文件路径无效')
    }
    return storeTemplateFile(sourcePath)
  })

  ipcMain.handle('templates:parse', async (_event, templatePath: unknown) => {
    if (typeof templatePath !== 'string' || !templatePath) {
      throw new Error('模板文件路径无效')
    }

    try {
      return await parseTemplate(templatePath)
    } catch (error) {
      if (error instanceof TemplateParseError) {
        throw new Error(error.message)
      }
      throw error
    }
  })
}
