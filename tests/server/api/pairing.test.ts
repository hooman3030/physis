import { describe, expect, it, vi } from 'vitest'
import { PairingPin } from '../../../server/api/pairing'

describe('remote pairing PIN', () => {
  it('creates a short-lived code, returns the installation token once, and consumes the code', () => {
    const pin = new PairingPin(
      'a'.repeat(64),
      () => 1000,
      () => '012345',
    )

    expect(pin.request()).toEqual({ expiresAt: 301_000 })
    expect(pin.current()).toEqual({ pin: '012345', expiresAt: 301_000 })
    expect(pin.complete('012345')).toBe('a'.repeat(64))
    expect(pin.current()).toBeNull()
    expect(() => pin.complete('012345')).toThrow('No active pairing code')
  })

  it('expires codes and limits incorrect guesses before a lockout', () => {
    let now = 0
    const pin = new PairingPin(
      'b'.repeat(64),
      () => now,
      () => '654321',
    )

    pin.request()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(() => pin.complete('000000')).toThrow('Incorrect pairing code')
    }
    expect(() => pin.complete('000000')).toThrow('Too many incorrect pairing codes')
    expect(pin.current()).toBeNull()
    expect(() => pin.request()).toThrow('Too many incorrect pairing codes')

    now += 60_000
    expect(pin.request()).toEqual({ expiresAt: 360_000 })
    now += 5 * 60_000
    expect(pin.current()).toBeNull()
    expect(() => pin.complete('654321')).toThrow('No active pairing code')
  })

  it('keeps one pending PIN while concurrent devices request pairing', () => {
    const generatePin = vi.fn(() => '123456')
    const pin = new PairingPin('c'.repeat(64), () => 10_000, generatePin)

    expect(pin.request()).toEqual({ expiresAt: 310_000 })
    expect(pin.request()).toEqual({ expiresAt: 310_000 })
    expect(generatePin).toHaveBeenCalledTimes(1)
  })
})
