'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Upload,
  Scan,
  Camera,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { FastTrackOverlay } from '@/components/scan/FastTrackOverlay'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
import { createClient } from '@/lib/supabase/client'

type ScanStep = 'UPLOAD' | 'ANALYZING' | 'REVIEW' | 'FAST_TRACK'

export default function ScanPage() {
  const [step, setStep] = useState<ScanStep>('UPLOAD')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')
  const [saving, setSaving] = useState(false)

  const { setActiveScan, activeScan, setScanning, isScanning, addProduct } = useStore()
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

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10">
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Add a supply</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Scan a supply</h1>
      </header>

      <AnimatePresence mode="wait">
        {step === 'UPLOAD' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-6"
          >
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
                  <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-ink">Add a photo of your supply</h3>
                  <p className="text-muted text-sm mb-8">Works best with clear text on the box or vial.</p>

                  <div className="flex flex-wrap justify-center gap-4">
                    <label className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-2 text-ink">
                      <Scan className="w-5 h-5" />
                      Browse files
                      <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                    </label>
                    <button className="bg-surface-2 hover:bg-line border border-line px-5 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 text-ink">
                      <Camera className="w-5 h-5" />
                      Use camera
                    </button>
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
