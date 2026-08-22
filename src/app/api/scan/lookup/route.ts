import { NextRequest, NextResponse } from 'next/server'
import {
  lookupProductByGtin,
  lookupProductByName,
  lookupProductByPzn,
  lookupProductByNdc,
  lookupProductByCip,
} from '@/lib/catalog'

export async function GET(req: NextRequest) {
  const gtin = req.nextUrl.searchParams.get('gtin')
  if (gtin) return NextResponse.json(await lookupProductByGtin(gtin))

  // PZN lookup resolves EU-FMD / securPharm medicine codes (German PPN or NTIN)
  // that carry no GTIN — the same product, matched by its national number.
  const pzn = req.nextUrl.searchParams.get('pzn')
  if (pzn) return NextResponse.json(await lookupProductByPzn(pzn))

  // National drug codes: US NDC and French CIP, as cross-region join keys.
  const ndc = req.nextUrl.searchParams.get('ndc')
  if (ndc) return NextResponse.json(await lookupProductByNdc(ndc))

  const cip = req.nextUrl.searchParams.get('cip')
  if (cip) return NextResponse.json(await lookupProductByCip(cip))

  // Name lookup powers silent auto-detect on the manual add path: a typed
  // "Omnipod 5" resolves to the catalog product so its wear rate fills itself in.
  const name = req.nextUrl.searchParams.get('name')
  if (name) return NextResponse.json(await lookupProductByName(name))

  return NextResponse.json(null)
}
