import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { HttpError } from './http'

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}

async function readAsset(path: string): Promise<Buffer | null> {
  try {
    const metadata = await stat(path)
    if (!metadata.isFile()) return null
    return await readFile(path)
  } catch (error) {
    if (isMissingFile(error)) return null
    throw error
  }
}

export async function serveStaticFile(
  request: IncomingMessage,
  response: ServerResponse,
  directory: string,
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    throw new HttpError(400, 'Malformed asset path')
  }

  if (pathname.includes('\\') || pathname.includes('\0')) {
    throw new HttpError(400, 'Invalid asset path')
  }

  const root = resolve(directory)
  const filePath = resolve(root, `.${pathname}`)
  const relativePath = relative(root, filePath)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new HttpError(404, 'Not found')
  }

  let asset = await readAsset(filePath)
  let servedPath = filePath
  if (
    asset === null &&
    (request.headers.accept ?? '').includes('text/html') &&
    !extname(pathname)
  ) {
    servedPath = resolve(root, 'index.html')
    asset = await readAsset(servedPath)
  }
  if (asset === null) return false

  const contentType = CONTENT_TYPES[extname(servedPath).toLowerCase()] ?? 'application/octet-stream'
  response.writeHead(200, {
    'content-type': contentType,
    'cache-control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'content-length': asset.length,
  })
  response.end(request.method === 'HEAD' ? undefined : asset)
  return true
}
