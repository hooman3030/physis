import { lstatSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { isLoopbackHost } from './api/network'

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function resolveRemoteAccessToken(
  host: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (isLoopbackHost(host)) return undefined
  if (environment.PHYSIS_REMOTE_TOKEN !== undefined) return environment.PHYSIS_REMOTE_TOKEN

  const configDirectory = environment.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  const tokenPath = resolve(
    environment.PHYSIS_REMOTE_TOKEN_FILE ?? join(configDirectory, 'physis', 'remote-token'),
  )

  let metadata
  try {
    metadata = lstatSync(tokenPath)
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`Remote token file not found at ${tokenPath}; run "pnpm remote:token"`)
    }
    throw error
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Remote token path must be a regular file: ${tokenPath}`)
  }
  if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
    throw new Error(`Remote token file must be private (mode 0600): ${tokenPath}`)
  }

  const token = readFileSync(tokenPath, 'utf8').trim()
  if (token.length === 0) throw new Error(`Remote token file is empty: ${tokenPath}`)
  return token
}
