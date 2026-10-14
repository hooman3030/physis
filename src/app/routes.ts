export type AppRoute = 'artwork' | 'lineage' | 'not-found'

export function resolveAppRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'artwork'
  if (path === '/lineage') return 'lineage'
  return 'not-found'
}
