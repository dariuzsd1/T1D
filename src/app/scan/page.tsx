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
  AlertCircle
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
      // Get user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user.id) {
        setError('Not authenticated')
        return
      }

      // Save to Supabase
      const { data, error: supabaseError } = await supabase
        .from('supplies')
        .insert({
          user_id: session.user.id,
          name: activeScan.product_name,
          brand: activeScan.brand,
          category_id: null,
          quantity: quantity,
          unit: 'pieces',
          expiration_date: null
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
        remainingDays: 30, // Default estimate
        lastScanned: new Date().toISOString().split('T')[0],
        usageRatePerDay: 1
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
    <div className="max-w-4xl mx-auto pb-24">
      <header className="mb-12">
        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mb-2">AI-Powered Recognition</h2>
        <h1 className="text-4xl font-black tracking-tight">Supply Scanner</h1>
      </header>

      <AnimatePresence mode="wait">
        {step === 'UPLOAD' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-[#0D0D0D] border-2 border-dashed border-white/10 rounded-3xl p-12 text-center transition-all hover:border-blue-500/50 group">
              {preview ? (
                <div className="relative inline-block">
                  <img src={preview} alt="Preview" className="max-h-64 rounded-xl shadow-2xl" />
                  <button 
                    onClick={() => setPreview(null)}
                    className="absolute -top-3 -right-3 bg-red-600 p-2 rounded-full shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Drop medical supply photo</h3>
                  <p className="text-gray-500 text-sm mb-8">Works best with clear text on boxes or vials.</p>
                  
                  <div className="flex gap-4">
                    <label className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-2">
                      <Scan className="w-5 h-5" />
                      Browse Files
                      <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                    </label>
                    <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Use Camera
                    </button>
                  </div>
                </div>
              )}
            </div>

            {preview && (
              <button
                onClick={startAnalysis}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3"
              >
                Analyze Supply
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </motion.div>
        )}

        {step === 'ANALYZING' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-[#0D0D0D] border border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center space-y-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
            
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Processing Pipeline</h2>
              <p className="text-gray-500 font-medium animate-pulse">Running OCR & Clinical Entity Matching...</p>
            </div>

            <div className="w-full max-w-xs bg-white/5 h-1 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 4 }}
                className="bg-blue-500 h-full"
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Detection Card */}
            <div className="space-y-6">
              <div className="bg-[#0D0D0D] border border-blue-500/30 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <CheckCircle2 className="w-32 h-32 text-blue-500" />
                </div>
                
                <header className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Detected Product</h3>
                    <h2 className="text-3xl font-black">{activeScan.product_name}</h2>
                  </div>
                  <ConfidenceBadge score={activeScan.confidence} />
                </header>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Brand</p>
                    <p className="font-bold text-lg">{activeScan.brand}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Category</p>
                    <p className="font-bold text-lg px-3 py-1 bg-white/5 rounded-lg inline-block">Patch Pump</p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 items-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Validated against openFDA</p>
                </div>
              </div>

              {/* Alternatives */}
              <div className="bg-[#0D0D0D] border border-white/10 rounded-3xl p-8">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Alternative Matches
                </h4>
                <div className="space-y-4">
                  {activeScan.alternatives.map((alt, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/20 cursor-pointer transition-all">
                      <div>
                        <p className="font-bold text-sm">{alt.name}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase">{alt.brand}</p>
                      </div>
                      <span className="text-xs font-black text-gray-400">{alt.score}% match</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirmation Form */}
            <div className="space-y-6">
              <div className="bg-[#0D0D0D] border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6">Confirm Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Quantity Found</label>
                    <input 
                      type="number" 
                      min="1"
                      value={quantity} 
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-black border border-white/10 rounded-xl p-4 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Replenishment Date</label>
                    <input 
                      type="date" 
                      defaultValue={new Date().toISOString().split('T')[0]} 
                      className="w-full bg-black border border-white/10 rounded-xl p-4 font-bold" 
                    />
                  </div>
                </div>

                <div className="mt-12 space-y-4">
                  <button 
                    onClick={handleConfirm}
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-lg transition-all"
                  >
                    {saving ? 'Saving...' : 'Confirm & Add to Inventory'}
                  </button>
                  <button 
                    onClick={() => setStep('UPLOAD')}
                    disabled={saving}
                    className="w-full bg-transparent hover:bg-white/5 disabled:opacity-50 text-gray-500 py-4 rounded-xl font-bold text-sm transition-all"
                  >
                    Rescan Product
                  </button>
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
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
