import { NextRequest, NextResponse } from 'next/server'
import {
  lookupProductByGtin,
  lookupProductByName,
  lookupProductByPzn,
  lookupProductByCip,
} from '@/lib/catalog'

export async function GET(req: NextRequest) {
  const gtin = req.nextUrl.searchParams.get('gtin')
  if (gtin) return NextResponse.json(await lookupProductByGtin(gtin))

  // PZN lookup resolves EU-FMD / securPharm medicine codes (German PPN or NTIN)
  // that carry no GTIN — the same product, matched by its national number.
  const pzn = req.nextUrl.searchParams.get('pzn')
  if (pzn) return NextResponse.json(await lookupProductByPzn(pzn))

  // French CIP, as a cross-region join key (US NDC / Canadian DIN are not
  // reliably extractable from a barcode, so those products match by GTIN).
  const cip = req.nextUrl.searchParams.get('cip')
  if (cip) return NextResponse.json(await lookupProductByCip(cip))

  // Name lookup powers silent auto-detect on the manual add path: a typed
  // "Omnipod 5" resolves to the catalog product so its wear rate fills itself in.
  const name = req.nextUrl.searchParams.get('name')
  if (name) return NextResponse.json(await lookupProductByName(name))

  return NextResponse.json(null)
}
