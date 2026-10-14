import { describe, expect, it } from 'vitest'
import { isLocalInstallationAddress, isLoopbackHost, isPrivateNetworkAddress } from './network'

describe('network addresses', () => {
  it('recognizes only loopback host names as loopback', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('::1')).toBe(true)
    expect(isLoopbackHost('192.168.1.10')).toBe(false)
  })

  it('recognizes private IPv4 and IPv6 addresses without allowing public addresses', () => {
    expect(isPrivateNetworkAddress('10.1.2.3')).toBe(true)
    expect(isPrivateNetworkAddress('172.16.0.1')).toBe(true)
    expect(isPrivateNetworkAddress('172.31.255.254')).toBe(true)
    expect(isPrivateNetworkAddress('192.168.1.10')).toBe(true)
    expect(isPrivateNetworkAddress('172.32.0.1')).toBe(false)
    expect(isPrivateNetworkAddress('8.8.8.8')).toBe(false)
    expect(isPrivateNetworkAddress('0.0.0.0')).toBe(false)
    expect(isPrivateNetworkAddress('fd12:3456::1')).toBe(true)
    expect(isPrivateNetworkAddress('2001:4860:4860::8888')).toBe(false)
  })

  it('recognizes requests originating from the installation host', () => {
    expect(isLocalInstallationAddress('192.168.1.10', '::ffff:192.168.1.10')).toBe(true)
    expect(isLocalInstallationAddress('fd12:3456::1', 'fd12:3456::1')).toBe(true)
    expect(isLocalInstallationAddress('192.168.1.10', '192.168.1.11')).toBe(false)
    expect(isLocalInstallationAddress('192.168.1.10', undefined)).toBe(false)
  })
})
