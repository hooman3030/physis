import { describe, expect, it, vi } from 'vitest'
import { ControlApiError } from '../../../src/controlClient'
import type { ImprintRecord } from '../../../src/controlClient'
import {
  deleteLineageImprints,
  removeDeletedImprintAndReparentChildren,
} from '../../../src/app/imprintDeletion'

function handlers(
  overrides: Partial<Parameters<typeof deleteLineageImprints>[1]> = {},
): Parameters<typeof deleteLineageImprints>[1] {
  return {
    deleteImprint: vi.fn(async () => {}),
    onDeleted: vi.fn(),
    onAuthenticationRequired: vi.fn(),
    onControlApiUnavailable: vi.fn(),
    reportError: vi.fn(),
    ...overrides,
  }
}

function imprint(id: string, parentId: string | null): ImprintRecord {
  return {
    id,
    parentId,
    codeId: 'seed',
    sourceRevision: '0123456789abcdef',
    createdAt: '2026-10-14T11:00:00.000Z',
    genes: {},
  }
}

describe('deleteLineageImprints', () => {
  it('deletes each Imprint sequentially', async () => {
    let activeRequests = 0
    let maximumConcurrentRequests = 0
    const callbacks = handlers({
      deleteImprint: vi.fn(async () => {
        activeRequests += 1
        maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests)
        await Promise.resolve()
        activeRequests -= 1
      }),
    })

    await expect(deleteLineageImprints(['one', 'two', 'one'], callbacks)).resolves.toEqual([
      'one',
      'two',
    ])

    expect(callbacks.deleteImprint).toHaveBeenNthCalledWith(1, 'one')
    expect(callbacks.deleteImprint).toHaveBeenNthCalledWith(2, 'two')
    expect(callbacks.onDeleted).toHaveBeenCalledTimes(2)
    expect(maximumConcurrentRequests).toBe(1)
    expect(callbacks.reportError).not.toHaveBeenCalled()
  })

  it('returns successful IDs and reports per-Imprint failures', async () => {
    const callbacks = handlers({
      deleteImprint: vi.fn(async (id: string) => {
        if (id === 'failed') throw new ControlApiError(409, 'Imprint is active')
      }),
    })

    await expect(deleteLineageImprints(['first', 'failed', 'last'], callbacks)).resolves.toEqual([
      'first',
      'last',
    ])

    expect(callbacks.onDeleted).toHaveBeenCalledTimes(2)
    expect(callbacks.reportError).toHaveBeenCalledWith(
      expect.stringContaining('failed: Imprint is active'),
    )
  })

  it('stops after authentication failure and reports IDs not attempted', async () => {
    const callbacks = handlers({
      deleteImprint: vi.fn(async (id: string) => {
        if (id === 'unauthorized') throw new ControlApiError(401, 'Unauthorized')
      }),
    })

    await expect(
      deleteLineageImprints(['first', 'unauthorized', 'last'], callbacks),
    ).resolves.toEqual(['first'])

    expect(callbacks.deleteImprint).toHaveBeenCalledTimes(2)
    expect(callbacks.onAuthenticationRequired).toHaveBeenCalledTimes(1)
    expect(callbacks.reportError).toHaveBeenCalledWith(
      expect.stringContaining('last: not attempted because authentication is required'),
    )
  })
})

describe('removeDeletedImprintAndReparentChildren', () => {
  it('reparents children to the deleted Imprint’s parent', () => {
    const root = imprint('root', null)
    const deleted = imprint('deleted', root.id)
    const child = imprint('child', deleted.id)
    const untouched = imprint('untouched', root.id)

    expect(
      removeDeletedImprintAndReparentChildren([root, deleted, child, untouched], deleted.id),
    ).toEqual([root, { ...child, parentId: root.id }, untouched])
  })

  it('reparents children to the source-code root when the deleted Imprint had no parent', () => {
    const deletedRoot = imprint('deleted-root', null)
    const child = imprint('child', deletedRoot.id)

    expect(removeDeletedImprintAndReparentChildren([deletedRoot, child], deletedRoot.id)).toEqual([
      { ...child, parentId: null },
    ])
  })
})
