/**
 * GS1 barcode parsing (CLAUDE.md §7-V2: "barcodes carry lot/expiry — faster and
 * more accurate than fuzzy text matching").
 *
 * Pharmacy and medical-supply labels usually carry a GS1 barcode (GS1-128 /
 * GS1 DataMatrix / GS1 DataBar). Its decoded value is an "element string": a run
 * of Application Identifiers (AIs), each a numeric key followed by its data.
 * The two we care about most:
 *   (01) GTIN          — the 14-digit product identifier
 *   (17) Expiration    — YYMMDD
 *   (10) Lot / batch   — variable length
 *   (21) Serial        — variable length
 *
 * This is a pure, dependency-free parser. It deliberately handles only the
 * high-value AIs and degrades gracefully: a plain UPC/EAN (no AIs) is returned
 * as the GTIN, and anything it can't understand is ignored rather than guessed.
 * Honesty rule (CLAUDE.md §9.1): we only surface a field we actually decoded.
 */

export interface Gs1Parsed {
  /** 14-digit GTIN if present (or a raw UPC/EAN when the code carries no AIs). */
  gtin?: string
  /** Expiration date as YYYY-MM-DD, derived from AI (17). */
  expirationDate?: string
  /** Lot / batch number, AI (10). */
  lot?: string
  /** Serial number, AI (21). */
  serial?: string
  /** The original decoded value, always preserved for reference/storage. */
  raw: string
}

/**
 * Fixed-length AIs we recognise (key → number of data characters). Fixed-length
 * fields need no separator; everything else is variable-length and runs until a
 * GS (group separator, ASCII 29) or the end of the string.
 */
const FIXED_LENGTH_AI: Record<string, number> = {
  '00': 18, // SSCC
  '01': 14, // GTIN
  '02': 14, // GTIN of contained trade items
  '11': 6, // production date YYMMDD
  '12': 6, // due date
  '13': 6, // packaging date
  '15': 6, // best-before YYMMDD
  '16': 6, // sell-by
  '17': 6, // expiration YYMMDD
  '20': 2, // variant
}

/** Group Separator that terminates a variable-length AI in an element string. */
const GS = '\x1d'

/**
 * Convert a GS1 YYMMDD string to an ISO YYYY-MM-DD date.
 * Per GS1: a year 00–50 maps to 2000–2050, 51–99 to 1951–1999. A day of "00"
 * means "end of the month", so we resolve it to that month's last day.
 * Returns undefined if the input isn't a valid YYMMDD.
 */
export function gs1DateToIso(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined
  const yy = parseInt(yymmdd.slice(0, 2), 10)
  const mm = parseInt(yymmdd.slice(2, 4), 10)
  let dd = parseInt(yymmdd.slice(4, 6), 10)
  if (mm < 1 || mm > 12) return undefined

  const year = yy <= 50 ? 2000 + yy : 1900 + yy
  if (dd === 0) {
    // Last day of the month (day 0 of next month, in UTC to avoid TZ drift).
    dd = new Date(Date.UTC(year, mm, 0)).getUTCDate()
  }
  if (dd < 1 || dd > 31) return undefined

  const mmStr = String(mm).padStart(2, '0')
  const ddStr = String(dd).padStart(2, '0')
  return `${year}-${mmStr}-${ddStr}`
}

/** Strip GS1 wrapper artifacts: a leading FNC1/"]C1"/"]d2" symbology prefix. */
function stripPrefix(value: string): string {
  // Some scanners emit AIM symbology identifiers like "]C1" (GS1-128) or "]d2"
  // (GS1 DataMatrix) ahead of the data. Drop them if present.
  return value.replace(/^\][A-Za-z]\d/, '')
}

/**
 * Parse a decoded barcode value. Works for GS1 element strings and falls back to
 * treating a plain 8–14 digit numeric code as a bare GTIN/UPC/EAN.
 */
export function parseGs1(value: string): Gs1Parsed {
  const raw = value
  const result: Gs1Parsed = { raw }
  let s = stripPrefix(value).replace(/^\x1d/, '')

  // Plain UPC/EAN (no AIs): a short, all-numeric code is just the product number.
  if (/^\d{8,14}$/.test(s) && !looksLikeElementString(s)) {
    result.gtin = s.padStart(14, '0')
    return result
  }

  let guard = 0
  while (s.length >= 2 && guard++ < 32) {
    const ai2 = s.slice(0, 2)
    const ai3 = s.slice(0, 3)
    const ai4 = s.slice(0, 4)

    if (ai2 in FIXED_LENGTH_AI) {
      const len = FIXED_LENGTH_AI[ai2]
      const data = s.slice(2, 2 + len)
      assignFixed(result, ai2, data)
      s = s.slice(2 + len)
      continue
    }

    // Variable-length AIs we care about (lot / serial). Read until GS or end.
    if (ai2 === '10' || ai2 === '21') {
      const rest = s.slice(2)
      const end = rest.indexOf(GS)
      const data = end === -1 ? rest : rest.slice(0, end)
      if (ai2 === '10') result.lot = data
      else result.serial = data
      s = end === -1 ? '' : rest.slice(end + 1)
      continue
    }

    // An AI we don't model: skip to the next GS so one unknown field doesn't
    // derail the rest. If there's no GS, we've gone as far as we safely can.
    const nextGs = s.indexOf(GS)
    if (nextGs === -1) break
    s = s.slice(nextGs + 1)
    // Keep the unused 3/4-digit AI keys referenced so linters don't flag them;
    // they document the shape of the data we intentionally pass over.
    void ai3
    void ai4
  }

  return result
}

function assignFixed(result: Gs1Parsed, ai: string, data: string) {
  if (ai === '01' || ai === '02') {
    if (/^\d{14}$/.test(data)) result.gtin = data
  } else if (ai === '17') {
    const iso = gs1DateToIso(data)
    if (iso) result.expirationDate = iso
  }
  // Other fixed AIs (production/best-before dates) are parsed-and-skipped: we
  // don't surface them yet, but consuming their bytes keeps the cursor aligned.
}

/** Heuristic: does this start with a GS1 AI (e.g. "01…")? Used to avoid treating
 *  a GS1 element string as a bare UPC. */
function looksLikeElementString(s: string): boolean {
  return /^01\d{14}/.test(s) || /^00\d{18}/.test(s)
}
