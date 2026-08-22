/**
 * IFA PPN parsing — the German securPharm / EU-FMD medicine barcode.
 *
 * EU medicines (unlike medical devices, which are globally GS1) may carry an
 * IFA **PPN** DataMatrix instead of a GS1 one. It encodes ANSI MH10.8.2 *data
 * identifiers* (not GS1 Application Identifiers), each a short alphanumeric key
 * followed by its data, separated by a GS (ASCII 29) — sometimes "#":
 *   9N  Product code = PRA-code "11" + 8-digit PZN + 2 check digits
 *   1T  Batch / lot
 *   S   Serial number
 *   D   Expiry (YYMMDD; DD "00" = end of month)
 *
 * A whole block may be wrapped in the ISO/IEC 15434 envelope "[)>" RS "06" GS
 * … RS EOT. This parser strips that, splits on the separators, and reads only
 * the high-value fields. Honesty rule (CLAUDE.md §9.1): it only surfaces a field
 * it actually decoded, and it recovers the PZN only when the PPN's shape matches.
 *
 * Spec: https://www.ifaffm.de/en/ifa-codingsystem.html
 */

import { gs1DateToIso } from './gs1'

export interface PpnParsed {
  /** Full product code from AI 9N (PRA-code + PZN + check digits). */
  ppn?: string
  /** The 8-digit Pharmazentralnummer recovered from the PPN, when present. */
  pzn?: string
  /** Expiration date as YYYY-MM-DD, from data identifier D. */
  expirationDate?: string
  /** Batch / lot number, data identifier 1T. */
  lot?: string
  /** Serial number, data identifier S. */
  serial?: string
  /** The original decoded value, always preserved. */
  raw: string
}

const GS = '\x1d' // ASCII 29 group separator
const RS = '\x1e' // ASCII 30 record separator
// The trailer strips ASCII 30 (RS) and ASCII 4 (EOT) directly in the regex below.

/** Strip the ISO/IEC 15434 format envelope ("[)>" RS "06" GS … RS EOT). */
function stripEnvelope(value: string): string {
  let s = value
  if (s.startsWith('[)>')) {
    s = s.slice(3)
    if (s.startsWith(RS)) s = s.slice(1)
    if (s.startsWith('06')) s = s.slice(2)
    if (s.startsWith(GS)) s = s.slice(1)
  }
  // Drop any trailing record-separator / end-of-transmission trailer.
  return s.replace(/[\x1e\x04]+$/, '')
}

/**
 * Does this decoded value look like an IFA PPN element string? Identified by the
 * "9N" product-code data identifier (optionally behind the "[)>" envelope). Used
 * by the dispatcher to route a code to this parser vs. the GS1 one.
 */
export function looksLikePpn(value: string): boolean {
  return /(^|[\x1d#])9N/.test(stripEnvelope(value))
}

/**
 * The PPN embeds the PZN: PRA-code "11" + 8-digit PZN + 2 check digits. Recover
 * the PZN when the shape matches; return undefined otherwise (never guess).
 */
export function pznFromPpn(ppn: string): string | undefined {
  // With the two trailing check digits (the normal case) or without them.
  if (/^11\d{10}$/.test(ppn) || /^11\d{8}$/.test(ppn)) return ppn.slice(2, 10)
  return undefined
}

/** Parse an IFA PPN barcode string into its high-value fields. */
export function parsePpn(value: string): PpnParsed {
  const result: PpnParsed = { raw: value }
  const segments = stripEnvelope(value)
    .split(/[\x1d#]/)
    .filter(Boolean)

  for (const seg of segments) {
    // Two-character data identifiers first, so "1T"/"9N" aren't mis-read as the
    // single-character "S"/"D".
    if (seg.startsWith('9N')) {
      result.ppn = seg.slice(2)
      const pzn = pznFromPpn(result.ppn)
      if (pzn) result.pzn = pzn
    } else if (seg.startsWith('1T')) {
      result.lot = seg.slice(2)
    } else if (seg.startsWith('D')) {
      const iso = gs1DateToIso(seg.slice(1))
      if (iso) result.expirationDate = iso
    } else if (seg.startsWith('S')) {
      result.serial = seg.slice(1)
    }
  }

  return result
}
