import { describe, expect, it } from 'vitest'
import { resolveAppRoute } from '../../../src/app/routes'

describe('application routes', () => {
  it('keeps artwork at the root and resolves the Lineage Explorer route', () => {
    expect(resolveAppRoute('/')).toBe('artwork')
    expect(resolveAppRoute('/lineage')).toBe('lineage')
    expect(resolveAppRoute('/lineage/')).toBe('lineage')
  })

  it('rejects unknown paths instead of rendering the artwork', () => {
    expect(resolveAppRoute('/unknown')).toBe('not-found')
  })
})
