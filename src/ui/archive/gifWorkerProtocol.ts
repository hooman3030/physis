export type GifWorkerRequest =
  | { type: 'start'; width: number; height: number }
  | { type: 'frame'; index: number; bitmap: ImageBitmap }
  | { type: 'finish' }

export type GifWorkerResponse =
  | { type: 'ready' }
  | { type: 'frame-accepted'; index: number }
  | { type: 'encoded'; bytes: ArrayBuffer }
  | { type: 'skipped' }
  | { type: 'error'; message: string }
