import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

/**
 * Shared barcode-decoding config for both the live camera scanner and the
 * still-image (photo) path. Keeping one source of truth means a barcode that
 * decodes from a photo decodes the same way live, and vice-versa.
 */

/** GS1 symbologies found on diabetes-supply boxes and pharmacy labels. */
export const BARCODE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, // GS1-128 pharmacy labels (the long barcode on the box)
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.DATA_MATRIX, // GS1 DataMatrix square code
  BarcodeFormat.QR_CODE,
]

/**
 * Decoder hints. `TRY_HARDER` trades a little CPU for a much higher hit rate on
 * the small, dense, or slightly-tilted barcodes you get when holding a box up to
 * a webcam — which is exactly where the first version was failing.
 */
export function barcodeHints(): Map<DecodeHintType, unknown> {
  return new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, BARCODE_FORMATS],
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
