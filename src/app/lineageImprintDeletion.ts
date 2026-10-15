import { ControlApiError } from '../controlClient'
import type { ImprintRecord } from '../controlClient'

type LineageImprintDeletionHandlers = {
  confirm: (message: string) => boolean
  deleteImprint: (imprintId: string) => Promise<void>
  onDeleted: (imprintId: string) => void
  onAuthenticationRequired: () => void
  onControlApiUnavailable: () => void
  reportError: (message: string) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function removeDeletedImprintAndReparentChildren(
  imprints: readonly ImprintRecord[],
  deletedId: string,
): readonly ImprintRecord[] {
  const deletedImprint = imprints.find((imprint) => imprint.id === deletedId)
  const remaining = imprints.filter((imprint) => imprint.id !== deletedId)
  if (deletedImprint === undefined) return remaining
  return remaining.map((imprint) =>
    imprint.parentId === deletedId ? { ...imprint, parentId: deletedImprint.parentId } : imprint,
  )
}

export async function confirmAndDeleteLineageImprints(
  imprintIds: readonly string[],
  handlers: LineageImprintDeletionHandlers,
): Promise<readonly string[]> {
  const selectedIds = [...new Set(imprintIds)]
  if (selectedIds.length === 0) return []
  if (
    !handlers.confirm(
      `Delete ${selectedIds.length} selected inactive Imprint${selectedIds.length === 1 ? '' : 's'}? Descendant Imprints will be preserved and reparented. This cannot be undone.`,
    )
  ) {
    return []
  }

  const deletedIds: string[] = []
  const failures: string[] = []
  for (const [index, imprintId] of selectedIds.entries()) {
    try {
      await handlers.deleteImprint(imprintId)
      deletedIds.push(imprintId)
      handlers.onDeleted(imprintId)
    } catch (error) {
      failures.push(`${imprintId}: ${errorMessage(error)}`)
      const remainingIds = selectedIds.slice(index + 1)
      if (error instanceof ControlApiError && error.status === 401) {
        handlers.onAuthenticationRequired()
        failures.push(
          ...remainingIds.map((id) => `${id}: not attempted because authentication is required`),
        )
        break
      }
      if (!(error instanceof ControlApiError)) {
        handlers.onControlApiUnavailable()
        failures.push(
          ...remainingIds.map(
            (id) => `${id}: not attempted because the control API is unavailable`,
          ),
        )
        break
      }
    }
  }

  if (failures.length > 0) {
    handlers.reportError(`Could not delete some selected Imprints: ${failures.join('; ')}`)
  }
  return deletedIds
}
