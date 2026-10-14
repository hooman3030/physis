import { describe, expect, it } from 'vitest'
import { getApplicationErrors } from '../../../../src/errorNotifications'
import type { GraphPosition } from '../../../../src/ui/archive/lineageGraph'
import {
  clearLineageLayout,
  readLineageLayout,
  saveLineageLayout,
} from '../../../../src/ui/archive/lineageLayoutStorage'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('lineage layout storage', () => {
  it('persists positions for current nodes and clears the saved layout', () => {
    const storage = createStorage()
    const positions = new Map<string, GraphPosition>([
      ['code:seed-a', { x: 120, y: 240 }],
      ['imprint:root', { x: 480, y: 360 }],
    ])

    saveLineageLayout(positions, storage)
    expect(readLineageLayout(new Set(['code:seed-a']), storage)).toEqual(
      new Map([['code:seed-a', { x: 120, y: 240 }]]),
    )

    clearLineageLayout(storage)
    expect(readLineageLayout(new Set(['code:seed-a']), storage)).toEqual(new Map())
  })

  it('ignores non-finite stored coordinates', () => {
    const storage = createStorage()
    storage.setItem('physis:lineage-layout:v1', '{"code:seed-a":{"x":null,"y":1}}')

    expect(readLineageLayout(new Set(['code:seed-a']), storage)).toEqual(new Map())
    expect(
      getApplicationErrors().some((error) =>
        error.message.includes('saved position for lineage node code:seed-a'),
      ),
    ).toBe(true)
  })
})
