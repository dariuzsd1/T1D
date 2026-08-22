import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

/**
 * Shared barcode-decoding config for both the live camera scanner and the
 * still-image (photo) path. Keeping one source of truth means a barcode that
 * decodes from a photo decodes the same way live, and vice-versa.
 */

/** 1D (linear, striped) symbologies: the long barcode on a box or pharmacy label. */
export const LINEAR_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, // GS1-128 pharmacy labels (the long barcode on the box)
  BarcodeFormat.CODE_39, // German PZN linear barcode
  BarcodeFormat.ITF,
]

/** 2D (matrix, square) symbologies: the small dot-grid square on medicine boxes. */
export const MATRIX_FORMATS = [
  BarcodeFormat.DATA_MATRIX, // GS1 DataMatrix / EU-FMD securPharm square
  BarcodeFormat.QR_CODE,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
]

/** Everything — the default when the user hasn't picked a focused mode. */
export const BARCODE_FORMATS = [...LINEAR_FORMATS, ...MATRIX_FORMATS]

/**
 * Which symbologies to hunt for. 'all' is the safe default. 'matrix' narrows to
 * 2D square codes so the decoder spends every frame on DataMatrix/QR instead of
 * splitting effort across nine formats — the key to reading the small, dense
 * pharmacy DataMatrix that the all-formats pass keeps missing.
 */
export type ScanMode = 'all' | 'matrix'

/**
 * Decoder hints. `TRY_HARDER` trades a little CPU for a much higher hit rate on
 * the small, dense, or slightly-tilted codes you get when holding a box up to a
 * camera — which is exactly where the first version was failing. In 'matrix' mode
 * that extra effort is focused entirely on 2D square codes.
 */
export function barcodeHints(mode: ScanMode = 'all'): Map<DecodeHintType, unknown> {
  const formats = mode === 'matrix' ? MATRIX_FORMATS : BARCODE_FORMATS
  return new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, formats],
    [DecodeHintType.TRY_HARDER, true],
  ])
}

/**
 * Decode a barcode from a still image (a snapped or uploaded photo). A sharp
 * photo is usually easier to read than a live low-res webcam frame, so this is
 * both the "Take/Add photo" path and the fallback when live scanning struggles.
 * Returns the decoded text, or null when no barcode is found (a miss, not an error).
 */
export async function decodeBarcodeFromImage(url: string): Promise<string | null> {
  try {
    const reader = new BrowserMultiFormatReader(barcodeHints())
    const result = await reader.decodeFromImageUrl(url)
    return result.getText()
  } catch {
    return null
  }
}
