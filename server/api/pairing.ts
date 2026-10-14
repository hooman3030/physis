import { randomInt, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http'

const PIN_LENGTH = 6
const PIN_LIFETIME_MS = 5 * 60_000
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

type ActivePin = {
  value: string
  expiresAt: number
  failedAttempts: number
}

export class PairingPin {
  private activePin: ActivePin | null = null
  private lockedUntil = 0

  constructor(
    private readonly installationToken: string,
    private readonly now: () => number = Date.now,
    private readonly generatePin: () => string = () =>
      randomInt(0, 10 ** PIN_LENGTH)
        .toString()
        .padStart(PIN_LENGTH, '0'),
  ) {}

  request(): { expiresAt: number } {
    const now = this.now()
    this.expirePin(now)
    if (now < this.lockedUntil) {
      throw new HttpError(429, 'Too many incorrect pairing codes; try again shortly')
    }
    if (this.activePin === null) {
      this.activePin = {
        value: this.generatePin(),
        expiresAt: now + PIN_LIFETIME_MS,
        failedAttempts: 0,
      }
    }
    return { expiresAt: this.activePin.expiresAt }
  }

  current(): { pin: string; expiresAt: number } | null {
    this.expirePin(this.now())
    return this.activePin === null
      ? null
      : { pin: this.activePin.value, expiresAt: this.activePin.expiresAt }
  }

  complete(pin: string): string {
    const now = this.now()
    this.expirePin(now)
    if (now < this.lockedUntil) {
      throw new HttpError(429, 'Too many incorrect pairing codes; try again shortly')
    }
    if (this.activePin === null) throw new HttpError(410, 'No active pairing code')
    const matches =
      /^\d{6}$/.test(pin) && timingSafeEqual(Buffer.from(pin), Buffer.from(this.activePin.value))
    if (!matches) {
      this.activePin.failedAttempts += 1
      if (this.activePin.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.activePin = null
        this.lockedUntil = now + LOCKOUT_MS
        throw new HttpError(429, 'Too many incorrect pairing codes; try again shortly')
      }
      throw new HttpError(401, 'Incorrect pairing code')
    }

    this.activePin = null
    return this.installationToken
  }

  dismiss(): void {
    this.activePin = null
  }

  private expirePin(now: number): void {
    if (this.activePin !== null && now >= this.activePin.expiresAt) this.activePin = null
  }
}
