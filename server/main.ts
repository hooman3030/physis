import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { artworkSeeds } from '../src/seeds/registry'
import { createControlServer } from './api'
import { openArchive } from './archive'
import { registerBundledSeeds } from './bootstrap'
import { resolveRemoteAccessToken } from './remoteAccess'

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function resolveSourceRevision(): { revision: string; dirty: boolean } {
  const fromEnvironment = process.env.PHYSIS_SOURCE_REVISION
  if (fromEnvironment) return { revision: fromEnvironment, dirty: false }
  try {
    return { revision: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain') !== '' }
  } catch {
    throw new Error('Cannot determine the source revision; set PHYSIS_SOURCE_REVISION')
  }
}

async function main(): Promise<void> {
  const archivePath = resolve(process.env.PHYSIS_ARCHIVE_PATH ?? 'data/archive.sqlite')
  mkdirSync(dirname(archivePath), { recursive: true })

  const { revision, dirty } = resolveSourceRevision()
  const archive = openArchive({ path: archivePath, modules: artworkSeeds })
  registerBundledSeeds(archive, artworkSeeds, revision)

  const host = process.env.PHYSIS_BIND_HOST ?? '127.0.0.1'
  const remoteAccessToken = resolveRemoteAccessToken(host)
  const webRoot = resolve(process.env.PHYSIS_WEB_ROOT ?? 'dist')
  const staticDirectory = existsSync(resolve(webRoot, 'index.html')) ? webRoot : undefined
  const allowedOrigins = process.env.PHYSIS_ALLOWED_ORIGINS?.split(',').filter(Boolean)
  const server = createControlServer({
    archive,
    modules: artworkSeeds,
    sourceRevision: revision,
    sourceDirty: dirty,
    host,
    port: Number(process.env.PHYSIS_PORT ?? 4317),
    remoteAccessToken,
    staticDirectory,
    allowedOrigins,
  })
  const { url } = await server.start()
  console.log(`Physis control API listening on ${url} (archive: ${archivePath})`)
  if (dirty) console.warn('Working tree has uncommitted changes; new Imprints are flagged.')

  const shutdown = () => {
    void server.stop().finally(() => {
      archive.close()
      process.exit(0)
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
