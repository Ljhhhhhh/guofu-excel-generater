import { join, basename, resolve, dirname, sep } from 'path'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import { randomUUID, createHash } from 'crypto'
import { app } from 'electron'
import type { TemplateStoreResult } from '@shared/types/template'

function getTemplatesRoot(): string {
  return join(app.getPath('userData'), 'storage', 'templates')
}

async function ensureTemplatesRoot(): Promise<string> {
  const root = getTemplatesRoot()
  await fs.mkdir(root, { recursive: true })
  return root
}

export async function storeTemplateFile(sourcePath: string): Promise<TemplateStoreResult> {
  const root = await ensureTemplatesRoot()
  const templateId = randomUUID()
  const targetDir = join(root, templateId)
  await fs.mkdir(targetDir, { recursive: true })

  const fileName = basename(sourcePath)
  const targetPath = join(targetDir, fileName)

  await copyFile(sourcePath, targetPath)
  const checksum = await calculateFileChecksum(targetPath)

  return {
    templateId,
    fileName,
    storedPath: targetPath,
    checksum
  }
}

export async function deleteTemplateFile(targetPath: string): Promise<void> {
  const root = getTemplatesRoot()
  const resolvedTarget = resolve(targetPath)
  const resolvedRoot = resolve(root)

  const isSamePath = resolvedTarget === resolvedRoot
  const isChildPath = resolvedTarget.startsWith(`${resolvedRoot}${sep}`)

  if (!isSamePath && !isChildPath) {
    return
  }

  try {
    await fs.unlink(resolvedTarget)
  } catch {
    return
  }

  const parentDir = dirname(resolvedTarget)
  if (parentDir !== resolvedRoot) {
    try {
      await fs.rmdir(parentDir)
    } catch {
      // ignore
    }
  }
}

async function copyFile(source: string, destination: string): Promise<void> {
  await fs.copyFile(source, destination)
}

async function calculateFileChecksum(filePath: string): Promise<string> {
  return new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', (error) => reject(error))
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}
