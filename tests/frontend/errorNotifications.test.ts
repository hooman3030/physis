import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dismissApplicationError,
  getApplicationErrors,
  reportApplicationError,
  subscribeToApplicationErrors,
} from '../../src/errorNotifications'

const messages: number[] = []

afterEach(() => {
  for (const id of messages.splice(0)) dismissApplicationError(id)
})

describe('application error notifications', () => {
  it('retains errors, notifies subscribers, and dismisses each error', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToApplicationErrors(listener)
    const baseline = new Set(getApplicationErrors().map(({ id }) => id))

    reportApplicationError('test-operation-failed')
    const first = getApplicationErrors().find((entry) => entry.message === 'test-operation-failed')
    if (first === undefined) throw new Error('Expected an error notification')
    messages.push(first.id)

    reportApplicationError('test-operation-failed')
    expect(
      getApplicationErrors().filter((entry) => entry.message === 'test-operation-failed'),
    ).toHaveLength(1)
    expect(listener).toHaveBeenCalledOnce()

    dismissApplicationError(first.id)
    expect(getApplicationErrors().some((entry) => entry.id === first.id)).toBe(false)
    expect([...getApplicationErrors()].every(({ id }) => baseline.has(id))).toBe(true)
    unsubscribe()
  })
})
