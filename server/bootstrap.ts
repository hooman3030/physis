import { ArchiveError, type Archive } from './archive'

// Registers bundled Seeds on first use; existing Seeds are immutable and kept.
export function registerBundledSeeds(
  archive: Archive,
  seeds: readonly { id: string }[],
  sourceRevision: string,
): void {
  for (const { id } of seeds) {
    try {
      archive.registerSeed({ id, sourceRevision })
    } catch (error) {
      if (!(error instanceof ArchiveError && error.code === 'already-exists')) throw error
    }
  }
}
