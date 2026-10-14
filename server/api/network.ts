import { isIP } from 'node:net'

export const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase())
}

export function isPrivateNetworkAddress(host: string): boolean {
  const family = isIP(host)

  if (family === 4) {
    const [first, second] = host.split('.').map(Number)
    return (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    )
  }

  if (family === 6) {
    const firstGroup = host.toLowerCase().split(':', 1)[0]
    const first = Number.parseInt(firstGroup || '0', 16)
    return (first & 0xfe00) === 0xfc00
  }

  return false
}

export function isLocalInstallationAddress(
  host: string,
  remoteAddress: string | undefined,
): boolean {
  if (remoteAddress === undefined) return false
  const normalize = (address: string) =>
    address
      .toLowerCase()
      .replace(/^::ffff:/, '')
      .replace(/^\[|\]$/g, '')
  return normalize(remoteAddress) === normalize(host)
}
