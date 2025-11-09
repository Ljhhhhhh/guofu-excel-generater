declare module 'carbone' {
  interface CarboneRenderOptions {
    convertTo?: string
    timezone?: string
    [key: string]: unknown
  }

  type CarboneRenderCallback = (error: Error | null, result: Buffer) => void

  interface CarboneInstance {
    render(
      templatePath: string,
      data: unknown,
      callback: CarboneRenderCallback
    ): void
    render(
      templatePath: string,
      data: unknown,
      options: CarboneRenderOptions,
      callback: CarboneRenderCallback
    ): void
    set(options: Record<string, unknown>, callback?: (error?: Error | null) => void): void
    reset(): void
  }

  const carbone: CarboneInstance
  export default carbone
}
