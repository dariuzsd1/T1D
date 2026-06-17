'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Upload,
  Scan,
  Camera,
  ScanBarcode,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { FastTrackOverlay } from '@/components/scan/FastTrackOverlay'
import { BarcodeScanner } from '@/components/scan/BarcodeScanner'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { createClient } from '@/lib/supabase/client'
import { parseGs1, type Gs1Parsed } from '@/lib/gs1'

type ScanStep = 'UPLOAD' | 'ANALYZING' | 'REVIEW' | 'FAST_TRACK' | 'BARCODE_CONFIRM'

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('UPLOAD')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Barcode flow
  const [showScanner, setShowScanner] = useState(false)
  const [scanned, setScanned] = useState<Gs1Parsed | null>(null)
  const [expiryFromBarcode, setExpiryFromBarcode] = useState(false)
  const [bcName, setBcName] = useState('')
  const [bcBrand, setBcBrand] = useState('')

  const { setActiveScan, activeScan, setScanning, addProduct } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setError(null)
    }
  }

  const startAnalysis = async () => {
    if (!file) return

    setStep('ANALYZING')
    setScanning(true)

    try {
      await new Promise(r => setTimeout(r, 4000))

      const mockResult = {
        product_name: "Omnipod 5 Pods",
        brand: "Insulet",
        confidence: 94,
        alternatives: [
          { name: "Omnipod Dash Pods", brand: "Insulet", score: 82 },
          { name: "G6 Sensor", brand: "Dexcom", score: 12 }
        ]
      }

      setActiveScan(mockResult)

      if (mockResult.confidence > 90) {
        setStep('FAST_TRACK')
      } else {
        setStep('REVIEW')
      }
    } catch (err) {
      setError("Analysis failed. Please try a clearer image.")
      setStep('UPLOAD')
    } finally {
      setScanning(false)
    }
  }

  // --- Barcode capture -------------------------------------------------------

  const handleBarcodeDetected = (rawValue: string) => {
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setError('Not authenticated')
        return
      }

      // Core insert first (columns that definitely exist).
      const { data, error: insertError } = await supabase
        .from('supplies')
        .insert({
          user_id: user.id,
          name: bcName.trim(),
          brand: bcBrand.trim() || null,
          category_id: null,
          quantity,
          unit: 'pieces',
          expiration_date: expirationDate || null,
        })
        .select()
        .single()

      if (insertError) {
        setError(`Failed to save: ${insertError.message}`)
        return
      }

      // Best-effort: store the scanned identifiers so a future GTIN lookup /
      // reorder match can use them. These columns are optional until
      // docs/BARCODE_SCANNING.md is applied — a missing-column error here must
      // never undo the core insert above.
      const idPayload: Record<string, unknown> = {}
      if (scanned.gtin) idPayload.barcode = scanned.gtin
      if (scanned.lot) idPayload.lot_number = scanned.lot
      if (Object.keys(idPayload).length > 0) {
        const { error: idError } = await supabase
          .from('supplies')
          .update(idPayload)
          .eq('id', data.id)
        if (idError) {
          console.warn(
            'Barcode/lot not saved — run docs/BARCODE_SCANNING.md:',
            idError.message
          )
        }
      }

      addProduct({
        id: data.id,
        name: data.name,
        brand: data.brand || '',
        category: 'unknown',
        quantity: data.quantity,
        remainingDays: 30, // Recomputed honestly by the store's withRunway()
        lastScanned: new Date().toISOString().split('T')[0],
        usageRatePerDay: 1,
        expirationDate: data.expiration_date || null,
      })

      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to save supply')
    } finally {
      setSaving(false)
    }
  }

  // --- Image (legacy mock) confirm ------------------------------------------

  const handleConfirm = async () => {
    if (!activeScan) return

    setSaving(true)
    try {
      // Verify the authenticated user with the auth server
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setError('Not authenticated')
        return
      }

      // Save to Supabase
      const { data, error: supabaseError } = await supabase
        .from('supplies')
        .insert({
          user_id: user.id,
          name: activeScan.product_name,
          brand: activeScan.brand,
          category_id: null,
          quantity: quantity,
          unit: 'pieces',
          expiration_date: expirationDate || null
        })
        .select()
        .single()

      if (supabaseError) {
        setError(`Failed to save: ${supabaseError.message}`)
        return
      }

      // Add to local store
      const newProduct = {
        id: data.id,
        name: data.name,
        brand: data.brand || '',
        category: 'unknown',
        quantity: data.quantity,
        remainingDays: 30, // Recomputed honestly by the store's withRunway()
        lastScanned: new Date().toISOString().split('T')[0],
        usageRatePerDay: 1,
        expirationDate: data.expiration_date || null
      }

      addProduct(newProduct)

      // Redirect with success
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to save supply')
    } finally {
      setSaving(false)
    }
  }

  const scannedCodeLabel = scanned?.gtin || scanned?.raw || ''

  return (
    <div className="max-w-4xl mx-auto">
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

            {/* Secondary: photo of the label (existing flow) */}
            <div className="bg-surface border-2 border-dashed border-line rounded-3xl p-10 text-center transition-colors hover:border-primary/50 group">
              {preview ? (
                <div className="relative inline-block">
                  <img src={preview} alt="Preview" className="max-h-64 rounded-xl shadow-md" />
                  <button
                    onClick={() => setPreview(null)}
                    aria-label="Remove image"
                    className="absolute -top-3 -right-3 bg-urgent text-white p-2 rounded-full shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-urgent"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mb-5">
                    <Upload className="w-7 h-7 text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1 text-ink">No barcode? Add a photo instead</h3>
                  <p className="text-muted text-sm mb-6">Works best with clear text on the box or vial.</p>

                  <div className="flex flex-wrap justify-center gap-4">
                    <label className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink">
                      <Scan className="w-5 h-5" />
                      Browse files
                      <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                    </label>
                    <label className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink">
                      <Camera className="w-5 h-5" />
                      Use camera
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {preview && (
              <button
                onClick={startAnalysis}
                className="w-full bg-primary hover:bg-primary-deep text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Analyze supply
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {error && (
              <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                {error}
              </div>
            )}
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

              <p className="text-sm text-muted">
                We don&apos;t have a product directory to look this code up yet, so please
                name it. Everything else we could read from the label is filled in below.
              </p>

              <div className="space-y-5">
                <div>
                  <label htmlFor="bc-name" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Product name</label>
                  <input
                    id="bc-name"
                    type="text"
                    autoFocus
                    placeholder="e.g. Omnipod 5 Pods"
                    value={bcName}
                    onChange={(e) => setBcName(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
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

        {step === 'ANALYZING' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-surface border border-line rounded-3xl p-16 flex flex-col items-center justify-center space-y-8 shadow-sm"
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-surface-2 border-t-primary rounded-full animate-spin" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2 text-ink">Reading your supply</h2>
              <p className="text-muted">Matching it to the product catalog…</p>
            </div>

            <div className="w-full max-w-xs bg-surface-2 h-1.5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 4 }}
                className="bg-primary h-full"
              />
            </div>
          </motion.div>
        )}

        {step === 'FAST_TRACK' && activeScan && (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
             <FastTrackOverlay
               result={activeScan}
               onConfirm={handleConfirm}
               onManualEdit={() => setStep('REVIEW')}
             />
          </div>
        )}

        {step === 'REVIEW' && activeScan && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Detection Card */}
            <div className="space-y-6">
              <div className="bg-surface border border-primary/30 rounded-3xl p-8 shadow-sm">
                <header className="flex justify-between items-start mb-8 gap-4">
                  <div>
                    <h3 className="text-muted text-xs font-semibold uppercase tracking-widest mb-1">Detected product</h3>
                    <h2 className="text-2xl font-bold text-ink">{activeScan.product_name}</h2>
                  </div>
                  <ConfidenceBadge score={activeScan.confidence} />
                </header>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-1">Brand</p>
                    <p className="font-semibold text-lg text-ink">{activeScan.brand}</p>
                  </div>
                  <div>
                    <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-1">Category</p>
                    <p className="font-semibold text-ink px-3 py-1 bg-surface-2 rounded-lg inline-block">Patch pump</p>
                  </div>
                </div>

                <div className="p-4 bg-success-soft border border-success/20 rounded-xl flex gap-3 items-center">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <p className="text-sm font-medium text-success">Matched to product catalog</p>
                </div>
              </div>

              {/* Alternatives */}
              <div className="bg-surface border border-line rounded-3xl p-8 shadow-sm">
                <h4 className="text-sm font-semibold text-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-caution" />
                  Other possible matches
                </h4>
                <div className="space-y-3">
                  {activeScan.alternatives.map((alt, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-surface-2 rounded-xl border border-line hover:border-primary/30 cursor-pointer transition-colors">
                      <div>
                        <p className="font-semibold text-sm text-ink">{alt.name}</p>
                        <p className="text-[11px] font-semibold text-muted uppercase">{alt.brand}</p>
                      </div>
                      <span className="text-xs font-semibold text-muted tabular-nums">{alt.score}% match</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirmation Form */}
            <div className="space-y-6">
              <div className="bg-surface border border-line rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-semibold mb-6 text-ink">Confirm details</h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="quantity" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quantity found</label>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration date (optional)</label>
                    <input
                      id="expiration"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div className="mt-10 space-y-3">
                  <button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  >
                    {saving ? 'Saving…' : 'Confirm & add to inventory'}
                  </button>
                  <button
                    onClick={() => setStep('UPLOAD')}
                    disabled={saving}
                    className="w-full bg-transparent hover:bg-surface-2 disabled:opacity-50 text-muted py-3 rounded-xl font-semibold text-sm transition-colors"
                  >
                    Rescan product
                  </button>
                  {error && (
                    <div className="p-4 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
