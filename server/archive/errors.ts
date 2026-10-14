export type ArchiveErrorCode =
  | 'invalid-input'
  | 'not-found'
  | 'already-exists'
  | 'conflict'
  | 'unsupported-schema'
  | 'corrupt'

export class ArchiveError extends Error {
  readonly code: ArchiveErrorCode

  constructor(code: ArchiveErrorCode, message: string) {
    super(message)
    this.name = 'ArchiveError'
    this.code = code
  }
}
