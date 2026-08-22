/**
 * Unified supply-barcode parser: one entry point that reads whatever code is on
 * the box, regardless of country, without asking the user to choose a format.
 *
 * The code is self-describing, so we sniff the syntax and dispatch:
 *   - Medical DEVICES (pumps, sensors, sets, reservoirs) are globally GS1 — a
 *     `(01)(17)(10)` element string — in both the US (FDA UDI) and EU (MDR UDI).
 *   - MEDICINES vary by region: US (DSCSA) and most of the EU (FMD) use a GS1
 *     code too, but Germany's securPharm allows an IFA **PPN** code (`9N/1T/S/D`),
 *     a different standard the GS1 parser can't read.
 *
 * We also recover a national code (the German **PZN**) as an extra catalog join
 * key, so the *same* product matches whether the box shows a GS1 GTIN, a German
 * NTIN (a GTIN that embeds the PZN), or a PPN. Honesty rule (CLAUDE.md §9.1):
 * every field is decoded, never inferred.
 */

import { parseGs1 } from './gs1'
import { looksLikePpn, parsePpn } from './ppn'

export type SupplyCodeType = 'gs1' | 'ppn' | 'plain'

export interface SupplyCode {
  /** Which coding standard the box used (informational). */
  codeType: SupplyCodeType
  /** GS1 GTIN, when the code carried one (devices, US/EU drugs). */
  gtin?: string
  /** 8-digit German Pharmazentralnummer, from a PPN or an NTIN GTIN. */
  pzn?: string
  /** Full IFA product code, when the box used a PPN. */
  ppn?: string
  /** Expiration date as YYYY-MM-DD (GS1 AI 17 or PPN data identifier D). */
  expirationDate?: string
  /** Lot / batch number. */
  lot?: string
  /** Serial number. */
  serial?: string
  /** The original decoded value, always preserved. */
  raw: string
}

/**
 * A German **NTIN** is a GTIN that embeds the PZN behind GS1's reserved "4150"
 * prefix. In GTIN-14 form: "0" + "4150" + 8-digit PZN + 1 check digit. Recover
 * the PZN when that exact shape matches; return undefined otherwise.
 */
export function pznFromNtinGtin(gtin?: string): string | undefined {
  if (!gtin) return undefined
  const m = /^04150(\d{8})\d$/.exec(gtin)
  return m ? m[1] : undefined
}

/** True when the value is a bare numeric UPC/EAN rather than an element string. */
function isPlainNumericCode(raw: string): boolean {
  return /^\d{8,14}$/.test(raw)
}

/**
 * Parse any supported supply barcode. Routes German PPN/PZN medicine codes to the
 * right path and everything else (GS1 element strings and bare UPC/EAN) to the GS1
 * parser, then normalizes into one shape and derives the PZN when it's recoverable.
 *
 * `format` is the scanner's symbology (e.g. "CODE_39"), used only to disambiguate
 * a bare numeric PZN from a bare numeric GTIN — a German PZN linear barcode is a
 * Code 39, whereas a product GTIN is an EAN/UPC.
 */
export function parseSupplyCode(value: string, format?: string): SupplyCode {
  const trimmed = value.trim()

  // German PZN linear barcode (usually Code 39): either an explicit "PZN"/dash
  // marker, or a bare 7-8 digit code that the scanner reports as Code 39. This
  // lets a medicine like Humalog match by PZN even when only the small linear
  // PZN barcode is scanned (not the 2D PPN square). A bare numeric code with no
  // Code-39 hint stays a GTIN, so we never mistake a UPC for a PZN.
  const marked = /^(?:pzn[\s:.-]*|-)(\d{7,8})$/i.exec(trimmed)
  const bareCode39 = (format === 'CODE_39' || format === 'CODE_93') && /^\d{7,8}$/.test(trimmed)
  if (marked || bareCode39) {
    return { codeType: 'ppn', raw: value, pzn: marked ? marked[1] : trimmed }
  }

  if (looksLikePpn(value)) {
    const p = parsePpn(value)
    return {
      codeType: 'ppn',
      raw: value,
      ppn: p.ppn,
      pzn: p.pzn,
      expirationDate: p.expirationDate,
      lot: p.lot,
      serial: p.serial,
    }
  }

  const g = parseGs1(value)
  return {
    codeType: isPlainNumericCode(value.trim()) ? 'plain' : 'gs1',
    raw: value,
    gtin: g.gtin,
    pzn: pznFromNtinGtin(g.gtin),
    expirationDate: g.expirationDate,
    lot: g.lot,
    serial: g.serial,
  }
}
