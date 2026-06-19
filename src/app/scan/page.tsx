'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Upload,
  Camera,
  ScanBarcode,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Tag,
  PencilLine,
  LayoutGrid,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { BarcodeScanner } from '@/components/scan/BarcodeScanner'
import { BackButton } from '@/components/ui/BackButton'
import { CatalogBrowser, type CatalogItem } from '@/components/scan/CatalogBrowser'
import { createClient } from '@/lib/supabase/client'
import { parseGs1, type Gs1Parsed } from '@/lib/gs1'

// Three honest intake paths: scan a barcode, browse the catalog, or type manually.
// We never auto-"recognize" a photo and fabricate a product/confidence (CLAUDE.md §9).
type ScanStep = 'UPLOAD' | 'MANUAL' | 'BARCODE_CONFIRM' | 'CATALOG_CONFIRM'

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('UPLOAD')
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Manual entry (the photo, if any, is only an on-screen reference while you type).
  const [manualName, setManualName] = useState('')
  const [manualBrand, setManualBrand] = useState('')

  // Barcode flow
  const [showScanner, setShowScanner] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [scanned, setScanned] = useState<Gs1Parsed | null>(null)
  const [expiryFromBarcode, setExpiryFromBarcode] = useState(false)
  const [bcName, setBcName] = useState('')
  const [bcBrand, setBcBrand] = useState('')
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null)
  const [catalogMatch, setCatalogMatch] = useState(false)

  const { addProduct } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setPreview(URL.createObjectURL(selected))
      setError(null)
    }
  }

  // Shared insert used by both the manual and barcode paths.
  const saveSupply = async (
    fields: { name: string; brand: string },
    identifiers?: { gtin?: string | null; lot?: string | null }
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      setError('Not authenticated')
      return false
    }

    const { data, error: insertError } = await supabase
      .from('supplies')
      .insert({
        user_id: user.id,
        name: fields.name.trim(),
        brand: fields.brand.trim() || null,
        category_id: null,
        quantity,
        unit: 'pieces',
        expiration_date: expirationDate || null,
      })
      .select()
      .single()

    if (insertError) {
      setError(`Failed to save: ${insertError.message}`)
      return false
    }

    // Best-effort: store scanned identifiers for future GTIN lookup / recall checks.
    // Optional columns (docs/BARCODE_SCANNING.md) — a miss here must never undo the insert.
    if (identifiers) {
      const idPayload: Record<string, unknown> = {}
      if (identifiers.gtin) idPayload.barcode = identifiers.gtin
      if (identifiers.lot) idPayload.lot_number = identifiers.lot
      if (Object.keys(idPayload).length > 0) {
        const { error: idError } = await supabase
          .from('supplies')
          .update(idPayload)
          .eq('id', data.id)
        if (idError) {
          console.warn('Barcode/lot not saved — run docs/BARCODE_SCANNING.md:', idError.message)
        }
      }
    }

    addProduct({
      id: data.id,
      name: data.name,
      brand: data.brand || '',
      category: catalogCategory ?? 'unknown',
      quantity: data.quantity,
      remainingDays: 30, // Recomputed honestly by the store's withRunway()
      lastScanned: new Date().toISOString().split('T')[0],
      usageRatePerDay: 0, // Unknown until the user sets it → shown as an estimate.
      expirationDate: data.expiration_date || null,
    })
    return true
  }

  // --- Catalog browse --------------------------------------------------------

  const handleCatalogSelect = (item: CatalogItem) => {
    setBcName(item.product_name)
    setBcBrand(item.brand ?? '')
    setCatalogCategory(item.category ?? null)
    setQuantity(item.units_per_box ?? 1)
    setExpirationDate('')
    setExpiryFromBarcode(false)
    setCatalogMatch(true)
    setShowCatalog(false)
    setError(null)
    setStep('CATALOG_CONFIRM')
  }

  const handleSaveCatalog = async () => {
    if (!bcName.trim()) {
      setError('Please enter the product name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await saveSupply({ name: bcName, brand: bcBrand })
      if (ok) router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to save supply')
    } finally {
      setSaving(false)
    }
  }

  // --- Manual entry ----------------------------------------------------------

  const startManual = () => {
    setError(null)
    setManualName('')
    setManualBrand('')
    setQuantity(1)
    setExpirationDate('')
    setStep('MANUAL')
  }

  const handleManualSave = async () => {
    if (!manualName.trim()) {
      setError('Please enter the product name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await saveSupply({ name: manualName, brand: manualBrand })
      if (ok) router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to save supply')
    } finally {
      setSaving(false)
    }
  }

  // --- Barcode capture -------------------------------------------------------

  const handleBarcodeDetected = async (rawValue: string) => {
    const parsed = parseGs1(rawValue)
    setScanned(parsed)
    setShowScanner(false)
    setError(null)

    // Only prefill the expiration if the barcode actually carried one — never
    // fabricate a date (CLAUDE.md §9.1).
    if (parsed.expirationDate) {
      setExpirationDate(parsed.expirationDate)
      setExpiryFromBarcode(true)
    } else {
      setExpirationDate('')
      setExpiryFromBarcode(false)
    }
    setQuantity(1)
    setBcName('')
    setBcBrand('')
    setCatalogCategory(null)
    setCatalogMatch(false)

    // Look up the GTIN in the products catalog. Pre-fill name/brand/quantity if
    // found — every field stays editable. A miss is not an error; fall through
    // to manual entry.
    if (parsed.gtin) {
      try {
        const res = await fetch(`/api/scan/lookup?gtin=${encodeURIComponent(parsed.gtin)}`)
        if (res.ok) {
          const product = await res.json()
          if (product) {
            setBcName(product.product_name)
            if (product.brand) setBcBrand(product.brand)
            if (product.units_per_box) setQuantity(product.units_per_box)
            setCatalogCategory(product.category ?? null)
            setCatalogMatch(true)
          }
        }
      } catch {
        // Catalog lookup is best-effort — a network error must never block the user.
      }
    }

    setStep('BARCODE_CONFIRM')
  }

  const handleSaveBarcode = async () => {
    if (!scanned) return
    if (!bcName.trim()) {
      setError('Please enter the product name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await saveSupply(
        { name: bcName, brand: bcBrand },
        { gtin: scanned.gtin, lot: scanned.lot }
      )
      if (ok) router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to save supply')
    } finally {
      setSaving(false)
    }
  }

  const scannedCodeLabel = scanned?.gtin || scanned?.raw || ''

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton fallbackHref="/dashboard" label="Dashboard" />
      <header className="mb-10">
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Add a supply</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Add a supply</h1>
      </header>

      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showCatalog && (
        <CatalogBrowser
          onSelect={handleCatalogSelect}
          onClose={() => setShowCatalog(false)}
        />
      )}

      <AnimatePresence mode="wait">
        {step === 'UPLOAD' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-6"
          >
            {/* Primary, real path: scan the barcode */}
            <button
              onClick={() => { setError(null); setShowScanner(true) }}
              className="w-full bg-surface border border-line rounded-3xl p-8 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ScanBarcode className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-ink mb-1">Scan the barcode</h3>
                  <p className="text-muted text-sm">
                    Point your camera at the barcode on the box or pharmacy label. If the
                    label includes an expiration date, we&apos;ll read it for you.
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-faint group-hover:text-primary transition-colors" />
              </div>
            </button>

            {/* Secondary, also real: type it in yourself (optionally with a photo to read from) */}
            <div className="bg-surface border border-line rounded-3xl p-8">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center shrink-0">
                  <PencilLine className="w-8 h-8 text-muted" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-ink mb-1">No barcode? Add it manually</h3>
                  <p className="text-muted text-sm mb-5">
                    Type the details from the box. You can snap a photo first to read from
                    on-screen while you type — the photo is just a reference and isn&apos;t stored.
                  </p>

                  {preview && (
                    <div className="relative inline-block mb-5">
                      <img src={preview} alt="Supply reference" className="max-h-48 rounded-xl shadow-md" />
                      <button
                        onClick={() => setPreview(null)}
                        aria-label="Remove photo"
                        className="absolute -top-3 -right-3 bg-surface border border-line text-ink p-1.5 rounded-full shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={startManual}
                      className="bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      Enter details
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <label className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink">
                      <Upload className="w-5 h-5" />
                      Add photo
                      <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                    </label>
                    <label className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink">
                      <Camera className="w-5 h-5" />
                      Take photo
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Third path: browse the catalog by category */}
            <button
              onClick={() => { setError(null); setShowCatalog(true) }}
              className="w-full flex items-center gap-4 bg-surface border border-line rounded-3xl p-6 text-left hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="w-12 h-12 bg-surface-2 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <LayoutGrid className="w-6 h-6 text-muted group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink">Browse the supply catalog</p>
                <p className="text-muted text-sm">Find your product by category and tap to add it.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-faint group-hover:text-primary transition-colors" />
            </button>

            {error && (
              <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                {error}
              </div>
            )}
          </motion.div>
        )}

        {step === 'MANUAL' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-surface border border-line rounded-3xl p-8 shadow-sm space-y-6">
              <h3 className="text-xl font-semibold text-ink">Enter the details</h3>

              {preview && (
                <div>
                  <img src={preview} alt="Supply reference" className="max-h-56 rounded-xl shadow-md mx-auto" />
                  <p className="text-center text-xs text-faint mt-2">For reference only — this photo isn&apos;t stored.</p>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="m-name" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Product name</label>
                  <input
                    id="m-name"
                    type="text"
                    autoFocus
                    placeholder="e.g. Omnipod 5 Pods"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="m-brand" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Brand (optional)</label>
                  <input
                    id="m-brand"
                    type="text"
                    placeholder="e.g. Insulet"
                    value={manualBrand}
                    onChange={(e) => setManualBrand(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="m-quantity" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quantity</label>
                    <input
                      id="m-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="m-expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration (optional)</label>
                    <input
                      id="m-expiration"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleManualSave}
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add to inventory
                </button>
                <button
                  onClick={() => { setError(null); setStep('UPLOAD') }}
                  disabled={saving}
                  className="w-full bg-transparent hover:bg-surface-2 disabled:opacity-50 text-muted py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Back
                </button>
                {error && (
                  <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'CATALOG_CONFIRM' && (
          <motion.div
            key="catalog-confirm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-surface border border-line rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 p-3 bg-success-soft border border-success/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <p className="text-sm font-semibold text-success">Selected from catalog</p>
              </div>

              <p className="text-sm text-muted">
                Review and edit if anything looks off — all fields are editable.
              </p>

              <div className="space-y-5">
                <div>
                  <label htmlFor="cat-name" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Product name</label>
                  <input
                    id="cat-name"
                    type="text"
                    autoFocus
                    value={bcName}
                    onChange={(e) => { setBcName(e.target.value); setCatalogMatch(false) }}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                  {catalogMatch && (
                    <p className="mt-1.5 text-[11px] font-medium text-teal flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Matched from catalog
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="cat-brand" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Brand (optional)</label>
                  <input
                    id="cat-brand"
                    type="text"
                    value={bcBrand}
                    onChange={(e) => setBcBrand(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cat-quantity" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quantity</label>
                    <input
                      id="cat-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="cat-expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration (optional)</label>
                    <input
                      id="cat-expiration"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleSaveCatalog}
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add to inventory
                </button>
                <button
                  onClick={() => { setError(null); setShowCatalog(true) }}
                  disabled={saving}
                  className="w-full bg-transparent hover:bg-surface-2 disabled:opacity-50 text-muted py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Back to catalog
                </button>
                {error && (
                  <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'BARCODE_CONFIRM' && scanned && (
          <motion.div
            key="barcode-confirm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-surface border border-line rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 p-3 bg-success-soft border border-success/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-success">Barcode read</p>
                  <p className="text-success/80 font-mono text-xs break-all">{scannedCodeLabel}</p>
                </div>
              </div>

              {scanned.lot && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Tag className="w-3.5 h-3.5" /> Lot {scanned.lot}
                </p>
              )}

              {catalogMatch ? (
                <p className="text-sm text-muted">
                  Matched in the product catalog. Review and edit if anything looks off — all fields are editable.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  This code isn&apos;t in our catalog yet. Enter the product name and we&apos;ll save it
                  with everything else we read from the label.
                </p>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="bc-name" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Product name</label>
                  <input
                    id="bc-name"
                    type="text"
                    autoFocus
                    placeholder="e.g. Omnipod 5 Pods"
                    value={bcName}
                    onChange={(e) => { setBcName(e.target.value); setCatalogMatch(false) }}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                  {catalogMatch && (
                    <p className="mt-1.5 text-[11px] font-medium text-teal flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Matched from catalog
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="bc-brand" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Brand (optional)</label>
                  <input
                    id="bc-brand"
                    type="text"
                    placeholder="e.g. Insulet"
                    value={bcBrand}
                    onChange={(e) => setBcBrand(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bc-quantity" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quantity</label>
                    <input
                      id="bc-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="bc-expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration</label>
                    <input
                      id="bc-expiration"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => { setExpirationDate(e.target.value); setExpiryFromBarcode(false) }}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                    {expiryFromBarcode && (
                      <p className="mt-1.5 text-[11px] font-medium text-teal flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Read from the barcode
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleSaveBarcode}
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add to inventory
                </button>
                <button
                  onClick={() => { setError(null); setScanned(null); setStep('UPLOAD'); setShowScanner(true) }}
                  disabled={saving}
                  className="w-full bg-transparent hover:bg-surface-2 disabled:opacity-50 text-muted py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Scan a different barcode
                </button>
                {error && (
                  <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
