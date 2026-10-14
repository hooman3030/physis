declare module 'gifenc' {
  type PaletteFormat = 'rgb565' | 'rgb444' | 'rgba4444'
  type Palette = number[][]

  type GifEncoder = {
    writeFrame(
      indices: Uint8Array,
      width: number,
      height: number,
      options?: { delay?: number; palette?: Palette; repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoder
  export function quantize(
    pixels: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: PaletteFormat },
  ): Palette
  export function applyPalette(
    pixels: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: PaletteFormat,
  ): Uint8Array
}
