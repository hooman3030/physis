import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const replace = process.argv.slice(2).includes('--replace')
const configDirectory = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
const tokenPath = resolve(
  process.env.PHYSIS_REMOTE_TOKEN_FILE ?? join(configDirectory, 'physis', 'remote-token'),
)

mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 })
if (existsSync(tokenPath)) {
  const metadata = lstatSync(tokenPath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing to replace a non-regular remote token path: ${tokenPath}`)
  }
  if (!replace) {
    throw new Error(`Remote token already exists at ${tokenPath}; use --replace to rotate it`)
  }
}

const token = randomBytes(32).toString('hex')
writeFileSync(tokenPath, `${token}\n`, { flag: replace ? 'w' : 'wx', mode: 0o600 })
chmodSync(tokenPath, 0o600)
console.log(`Installation pairing secret saved to ${tokenPath}.`)
console.log('The secret stays on this laptop; pair browsers with the on-screen PIN.')
