export interface SelectedFile {
  path: string
  name: string
}

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

export interface OpenFileDialogOptions {
  title?: string
  multiple?: boolean
  filters?: FileDialogFilter[]
}
