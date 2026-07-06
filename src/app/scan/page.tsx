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
  Clock,
  Sparkles,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { BarcodeScanner } from '@/components/scan/BarcodeScanner'
import { BackButton } from '@/components/ui/BackButton'
import { logActivity } from '@/lib/activity'
import { CatalogBrowser, type CatalogItem } from '@/components/scan/CatalogBrowser'
import { StarterKitModal } from '@/components/scan/StarterKitModal'
import { CameraCapture } from '@/components/scan/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import { parseGs1, type Gs1Parsed } from '@/lib/gs1'
import { daysPerUnitFromRate } from '@/lib/depletion'
import { decodeBarcodeFromImage } from '@/lib/barcode'

// Three honest intake paths: scan a barcode, browse the catalog, or type manually.
// We never auto-"recognize" a photo and fabricate a product/confidence (CLAUDE.md §9).
type ScanStep = 'UPLOAD' | 'MANUAL' | 'BARCODE_CONFIRM' | 'CATALOG_CONFIRM'

/**
 * Silent confirmation of the auto-detected wear duration. The app already knows
 * how long a known product lasts (verified catalog value), so we apply it without
 * asking — this just shows the user what we set, honestly. Renders nothing for an
 * unmatched product (its runway stays a labelled estimate; fine-tune in Edit).
 */
function WearReadout({ rate, quantity }: { rate: number; quantity: number }) {
  const days = daysPerUnitFromRate(rate)
  if (days == null) return null
  const runway = Math.floor(quantity * days)
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 border border-line p-3.5">
      <Clock className="w-4 h-4 text-teal shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-xs text-muted leading-relaxed">
        <span className="font-semibold text-ink">Each one lasts about {days} days</span>
        {' '}(from our catalog), so {quantity} should last around{' '}
        <span className="font-semibold text-ink">{runway} days</span>. You can fine-tune this later.
      </p>
    </div>
  )
}

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('UPLOAD')
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Auto-detected per-unit usage rate (units/day) from the catalog: by GTIN on a
  // scan, by selection in the catalog browser, or by an exact name match on manual
  // entry. 0 = not identified → the runway stays a labelled estimate. The user is
  // never asked for this; it fills itself in when we recognize the product.
  const [autoRate, setAutoRate] = useState(0)
  const [detectingWear, setDetectingWear] = useState(false)

  // Manual entry (the photo doubles as a barcode source and an on-screen reference).
  const [manualName, setManualName] = useState('')
  const [manualBrand, setManualBrand] = useState('')

  // Photo path: we try to read a barcode out of the picture before falling back
  // to using it as a reference for manual entry.
  const [decodingPhoto, setDecodingPhoto] = useState(false)
  const [photoNote, setPhotoNote] = useState<string | null>(null)

  // Barcode flow
  const [showScanner, setShowScanner] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [showStarterKit, setShowStarterKit] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [scanned, setScanned] = useState<Gs1Parsed | null>(null)
  const [expiryFromBarcode, setExpiryFromBarcode] = useState(false)
  const [bcName, setBcName] = useState('')
  const [bcBrand, setBcBrand] = useState('')
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null)
  const [catalogMatch, setCatalogMatch] = useState(false)
  // Recognized from the user's OWN prior scans (their personal catalog), when the
  // shared catalog doesn't have this barcode yet.
  const [personalMatch, setPersonalMatch] = useState(false)

  const { addProduct } = useStore()
  const router = useRouter()
  const supabase = createClient()

  // Shared by both photo sources (file upload and live camera capture): try to
  // read a barcode straight out of the image. A sharp, close still is often easier
  // to decode than a live webcam frame, so this is both the photo path and the
  // fallback when live scanning struggles. On a hit, drop into the same confirm
  // flow as a live scan; on a miss, the photo stays as a reference for manual
  // entry (never guessing what the picture shows).
  const processPhoto = async (url: string) => {
    setPreview(url)
    setError(null)
    setPhotoNote(null)
    setDecodingPhoto(true)
    const raw = await decodeBarcodeFromImage(url)
    setDecodingPhoto(false)
    if (raw) {
      handleBarcodeDetected(raw)
    } else {
      setPhotoNote(
        "We couldn't find a barcode in that photo. Try a closer, sharper shot of the barcode itself, or enter the details below.",
      )
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) void processPhoto(URL.createObjectURL(selected))
  }

  // Shared insert used by the manual, catalog, and barcode paths.
  const saveSupply = async (
    fields: { name: string; brand: string },
    opts?: { gtin?: string | null; lot?: string | null; usageRatePerDay?: number | null }
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

    // Best-effort optional columns: scanned identifiers (for GTIN lookup / recall
    // checks) and the per-unit usage rate (so a sensor's 35-day runway is right
    // from the start, not the 1-unit/day fallback). A miss on these optional
    // columns must never undo the core insert above (docs/BARCODE_SCANNING.md).
    const rate = opts?.usageRatePerDay && opts.usageRatePerDay > 0 ? opts.usageRatePerDay : 0
    const idPayload: Record<string, unknown> = {}
    if (opts?.gtin) idPayload.barcode = opts.gtin
    if (opts?.lot) idPayload.lot_number = opts.lot
    if (rate > 0) idPayload.usage_rate_per_day = rate
    if (Object.keys(idPayload).length > 0) {
      const { error: idError } = await supabase
        .from('supplies')
        .update(idPayload)
        .eq('id', data.id)
      if (idError) {
        console.warn('Optional fields not saved — run supabase/setup.sql:', idError.message)
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
      usageRatePerDay: rate, // Real catalog/typed rate, or 0 → shown as an estimate.
      expirationDate: data.expiration_date || null,
    })
    void logActivity('supply_added', data.name)
    return true
  }

  // --- Catalog browse --------------------------------------------------------

  const handleCatalogSelect = (item: CatalogItem) => {
    setBcName(item.product_name)
    setBcBrand(item.brand ?? '')
    setCatalogCategory(item.category ?? null)
    setQuantity(item.units_per_box ?? 1)
    // Apply the catalog's verified wear rate when it has one (sensors/pods/sets);
    // stays 0 for per-person items (insulin/strips), which remain an estimate.
    setAutoRate(item.typical_usage_per_day ?? 0)
    setCatalogMatch(true)
    setPersonalMatch(false)
    setShowCatalog(false)
    setError(null)
    // If we arrived here from a barcode that wasn't in the catalog, keep the
    // scanned GTIN + expiration and return to the barcode confirm screen so the
    // real code is saved on the supply. That turns one tap into a contribution:
    // the scanned GTIN can later be merged into the catalog (no guessing — it's
    // the exact code from the user's own box, which is more reliable than GUDID).
    if (scanned) {
      setStep('BARCODE_CONFIRM')
    } else {
      setExpirationDate('')
      setExpiryFromBarcode(false)
      setStep('CATALOG_CONFIRM')
    }
  }

  const handleSaveCatalog = async () => {
    if (!bcName.trim()) {
      setError('Please enter the product name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await saveSupply(
        { name: bcName, brand: bcBrand },
        { usageRatePerDay: autoRate }
      )
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
    setAutoRate(0)
    setExpirationDate('')
    setStep('MANUAL')
  }

  // Silently recognize a typed product against the catalog (exact name/alias
  // match) so its verified wear rate fills itself in. No match = no change; the
  // runway simply stays an estimate. Runs on blur so it never fights the typist.
  const detectWearByName = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) { setAutoRate(0); return }
    setDetectingWear(true)
    try {
      const res = await fetch(`/api/scan/lookup?name=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        const product = await res.json()
        setAutoRate(product?.typical_usage_per_day ?? 0)
        if (product?.category) setCatalogCategory(product.category)
      }
    } catch {
      // Best-effort: a lookup failure must never block a manual add.
    } finally {
      setDetectingWear(false)
    }
  }

  const handleManualSave = async () => {
    if (!manualName.trim()) {
      setError('Please enter the product name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await saveSupply(
        { name: manualName, brand: manualBrand },
        { usageRatePerDay: autoRate }
      )
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
    setAutoRate(0)
    setBcName('')
    setBcBrand('')
    setCatalogCategory(null)
    setCatalogMatch(false)
    setPersonalMatch(false)

    // Look up the GTIN in the shared products catalog. Pre-fill name/brand/quantity/
    // wear rate if found — every field stays editable. A miss is not an error.
    let matched = false
    if (parsed.gtin) {
      try {
        const res = await fetch(`/api/scan/lookup?gtin=${encodeURIComponent(parsed.gtin)}`)
        if (res.ok) {
          const product = await res.json()
          if (product) {
            setBcName(product.product_name)
            if (product.brand) setBcBrand(product.brand)
            if (product.units_per_box) setQuantity(product.units_per_box)
            setAutoRate(product.typical_usage_per_day ?? 0)
            setCatalogCategory(product.category ?? null)
            setCatalogMatch(true)
            matched = true
          }
        }
      } catch {
        // Catalog lookup is best-effort — a network error must never block the user.
      }
    }

    // Personal catalog: if the shared catalog doesn't know this code yet, check
    // whether YOU have scanned and identified it before. Your own confirmed product
    // is reliable, so we reuse it — this is how your catalog grows as you scan, with
    // no maintainer step. (The barcode column may be pre-migration; a miss is fine.)
    if (!matched && parsed.gtin) {
      try {
        const { data: prior } = await supabase
          .from('supplies')
          .select('name, brand, usage_rate_per_day')
          .eq('barcode', parsed.gtin)
          .not('name', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (prior?.name) {
          setBcName(prior.name)
          if (prior.brand) setBcBrand(prior.brand)
          const rate = Number(prior.usage_rate_per_day)
          if (rate > 0) setAutoRate(rate)
          setPersonalMatch(true)
        }
      } catch {
        // Best-effort: an un-migrated barcode column must never block the scan.
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
        {
          gtin: scanned.gtin,
          lot: scanned.lot,
          usageRatePerDay: autoRate,
        }
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

      {showStarterKit && <StarterKitModal onClose={() => setShowStarterKit(false)} />}

      {showCamera && (
        <CameraCapture
          onCapture={(url) => { setShowCamera(false); void processPhoto(url) }}
          onClose={() => setShowCamera(false)}
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
            {/* Fastest setup: pick your pump + CGM, bulk-add the usual supplies */}
            <button
              onClick={() => { setError(null); setShowStarterKit(true) }}
              className="w-full bg-gradient-to-br from-primary to-primary-deep rounded-3xl p-6 text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-0.5">Quick start</h3>
                  <p className="text-white/85 text-sm">
                    New here? Pick your pump and CGM, and we&apos;ll add your usual supplies in one tap.
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-white/80" />
              </div>
            </button>

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
                    Type the details from the box. Or add a photo of the barcode and we&apos;ll try to
                    read it for you. If we can&apos;t, the photo stays on screen as a reference while
                    you type.
                  </p>

                  {preview && (
                    <div className="relative inline-block mb-5">
                      <img src={preview} alt="Supply reference" className="max-h-48 rounded-xl shadow-md" />
                      <button
                        onClick={() => { setPreview(null); setPhotoNote(null) }}
                        aria-label="Remove photo"
                        className="absolute -top-3 -right-3 bg-surface border border-line text-ink p-1.5 rounded-full shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {decodingPhoto && (
                    <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" /> Reading the barcode in your photo…
                    </p>
                  )}
                  {photoNote && !decodingPhoto && (
                    <p className="mb-4 text-sm text-caution" role="status">{photoNote}</p>
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
                    <button
                      type="button"
                      onClick={() => { setError(null); setShowCamera(true) }}
                      className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Camera className="w-5 h-5" />
                      Take photo
                    </button>
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
                  <p className="text-center text-xs text-faint mt-2">For reference only. This photo isn&apos;t stored.</p>
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
                    onBlur={(e) => detectWearByName(e.target.value)}
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
                {detectingWear ? (
                  <p className="text-xs text-faint flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking how long this lasts…
                  </p>
                ) : (
                  <WearReadout rate={autoRate} quantity={quantity} />
                )}
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
                Review and edit if anything looks off. All fields are editable.
              </p>

              <div className="space-y-5">
                <div>
                  <label htmlFor="cat-name" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Product name</label>
                  <input
                    id="cat-name"
                    type="text"
                    autoFocus
                    value={bcName}
                    onChange={(e) => { setBcName(e.target.value); setCatalogMatch(false); setPersonalMatch(false) }}
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
                <WearReadout rate={autoRate} quantity={quantity} />
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
                  Matched in the product catalog. Review and edit anything that looks off.
                </p>
              ) : personalMatch ? (
                <p className="text-sm text-teal flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Recognized from your previous scans. Review and edit if needed.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    This code isn&apos;t in our catalog yet. Pick the matching product so we track it
                    correctly, with no typing. We&apos;ll remember this barcode against your supply.
                  </p>
                  <button
                    onClick={() => { setError(null); setShowCatalog(true) }}
                    className="w-full flex items-center justify-center gap-2 bg-surface-2 hover:bg-line border border-line rounded-xl py-3 font-semibold text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Find it in the catalog
                  </button>
                </div>
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
                    onChange={(e) => { setBcName(e.target.value); setCatalogMatch(false); setPersonalMatch(false) }}
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
                <WearReadout rate={autoRate} quantity={quantity} />
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
