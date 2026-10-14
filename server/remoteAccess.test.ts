import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRemoteAccessToken } from './remoteAccess'

let directory: string | undefined

afterEach(() => {
  if (directory !== undefined) rmSync(directory, { recursive: true, force: true })
  directory = undefined
})

describe('remote access token configuration', () => {
  it('keeps loopback development unauthenticated', () => {
    expect(
      resolveRemoteAccessToken('127.0.0.1', {
        PHYSIS_REMOTE_TOKEN: 'a'.repeat(64),
      }),
    ).toBeUndefined()
  })

  it('reads a private machine-local token file', () => {
    const configDirectory = mkdtempSync(join(tmpdir(), 'physis-token-'))
    directory = configDirectory
    const tokenPath = join(configDirectory, 'physis', 'remote-token')
    mkdirSync(join(configDirectory, 'physis'), { mode: 0o700 })
    const token = 'b'.repeat(64)
    writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 })
    chmodSync(tokenPath, 0o600)

    expect(
      resolveRemoteAccessToken('192.168.1.20', {
        XDG_CONFIG_HOME: configDirectory,
      }),
    ).toBe(token)
  })

  it('prefers an explicit environment token over the config file', () => {
    const token = 'c'.repeat(64)

    expect(
      resolveRemoteAccessToken('192.168.1.20', {
        PHYSIS_REMOTE_TOKEN: token,
        XDG_CONFIG_HOME: '/not-used',
      }),
    ).toBe(token)
  })

  it('requires a private token file and rejects missing or insecure files', () => {
    directory = mkdtempSync(join(tmpdir(), 'physis-token-'))
    const configDirectory = directory
    expect(() =>
      resolveRemoteAccessToken('192.168.1.20', {
        PHYSIS_REMOTE_TOKEN_FILE: join(configDirectory, 'missing-token'),
      }),
    ).toThrow(/pnpm remote:token/)

    const tokenPath = join(configDirectory, 'remote-token')
    writeFileSync(tokenPath, 'a'.repeat(64), { mode: 0o644 })
    chmodSync(tokenPath, 0o644)
    if (process.platform !== 'win32') {
      expect(() =>
        resolveRemoteAccessToken('192.168.1.20', {
          PHYSIS_REMOTE_TOKEN_FILE: tokenPath,
        }),
      ).toThrow(/mode 0600/)
    }
  })
})
