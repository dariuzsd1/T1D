// Ambient types for the native Barcode Detection API.
//
// The browser ships `BarcodeDetector` (Chrome on Android/desktop, Safari), but
// TypeScript's standard DOM lib does not declare it yet, so `tsc --noEmit` would
// fail on any reference. These minimal declarations cover exactly what we use in
// src/components/scan/BarcodeScanner.tsx. They add NO runtime code and NO npm
// dependency — `**/*.ts` is in tsconfig "include", so the compiler picks this up.
//
// Spec: https://wicg.github.io/shape-detection-api/#barcode-detection-api

interface BarcodeDetectorOptions {
  /** Restrict detection to specific symbologies (e.g. 'qr_code', 'code_128'). */
  formats?: string[]
}

interface DetectedBarcode {
  /** The decoded value, e.g. a GTIN or a GS1 element string. */
  rawValue: string
  /** The detected symbology, e.g. 'ean_13', 'code_128', 'data_matrix'. */
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  /** Resolves to the symbologies this device/browser can actually decode. */
  static getSupportedFormats(): Promise<string[]>
  /** Detect barcodes in an image source (a <video> frame, canvas, bitmap, …). */
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
