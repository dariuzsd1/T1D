import { NextRequest, NextResponse } from 'next/server'
import { lookupProductByGtin, lookupProductByName } from '@/lib/catalog'

export async function GET(req: NextRequest) {
  const gtin = req.nextUrl.searchParams.get('gtin')
  if (gtin) return NextResponse.json(await lookupProductByGtin(gtin))

  // Name lookup powers silent auto-detect on the manual add path: a typed
  // "Omnipod 5" resolves to the catalog product so its wear rate fills itself in.
  const name = req.nextUrl.searchParams.get('name')
  if (name) return NextResponse.json(await lookupProductByName(name))

  return NextResponse.json(null)
}
