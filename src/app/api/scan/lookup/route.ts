import { NextRequest, NextResponse } from 'next/server'
import { lookupProductByGtin } from '@/lib/catalog'

export async function GET(req: NextRequest) {
  const gtin = req.nextUrl.searchParams.get('gtin')
  if (!gtin) return NextResponse.json(null)
  const product = await lookupProductByGtin(gtin)
  return NextResponse.json(product)
}
