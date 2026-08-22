/**
 * zxing-wasm decode helper — the ZXing **C++** engine compiled to WebAssembly.
 *
 * ZXing-js (`@zxing/browser`) is reliable for 1D barcodes but weak at the small,
 * dense 2D **DataMatrix** codes on EU medicine boxes (securPharm / FMD). This
 * engine is dramatically better at DataMatrix and QR, so the scanner's "2D square"
 * mode routes frames through here instead.
 *
 * The ~1 MB wasm binary is self-hosted from /public (copied from the package at
 * `zxing-wasm/dist/reader/zxing_reader.wasm`) rather than the default jsDelivr CDN,
 * so a core scan feature never depends on an external CDN at runtime. If the
 * package is upgraded, re-copy that file to `public/zxing_reader.wasm`.
 */

import { readBarcodes, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader'

let prepared = false

/** Point the wasm loader at our self-hosted copy. Idempotent; browser-only. */
function ensurePrepared() {
  if (prepared) return
  prepared = true
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path,
    },
  })
}

// Focus on the 2D square symbologies. tryHarder/tryRotate/tryInvert/tryDownscale
// all raise the hit rate on a hand-held, tilted, or low-contrast pharmacy square.
const MATRIX_OPTIONS: ReaderOptions = {
  formats: ['DataMatrix', 'QRCode', 'Aztec', 'PDF417'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
}

export interface WasmDecode {
  text: string
  format: string
}

function firstValid(results: { isValid: boolean; text: string; format: string }[]): WasmDecode | null {
  const hit = results.find((r) => r.isValid && r.text)
  return hit ? { text: hit.text, format: hit.format } : null
}

/** Decode a 2D square from a canvas frame's ImageData. Null = no code found. */
export async function decodeMatrixFromImageData(image: ImageData): Promise<WasmDecode | null> {
  ensurePrepared()
  try {
    return firstValid(await readBarcodes(image, MATRIX_OPTIONS))
  } catch {
    return null
  }
}

/** Decode a 2D square from a still image (uploaded/snapped photo). Null = miss. */
export async function decodeMatrixFromBlob(blob: Blob): Promise<WasmDecode | null> {
  ensurePrepared()
  try {
    return firstValid(await readBarcodes(blob, MATRIX_OPTIONS))
  } catch {
    return null
  }
}
