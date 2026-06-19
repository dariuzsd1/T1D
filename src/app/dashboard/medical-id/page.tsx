'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HeartPulse, Database, RefreshCw, Loader2, Share2, Link as LinkIcon,
  Check, Plane, ShieldAlert, ExternalLink, Phone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { BackButton } from '@/components/ui/BackButton'
import { isMissingTableError } from '@/lib/prescriptions'
import {
  type MedicalProfile, rowToProfile, profileToRow, emptyProfile,
  TRAVEL_CHECKLIST, TSA_NOTE,
} from '@/lib/medicalId'

export default function MedicalIdPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [profile, setProfile] = useState<MedicalProfile>(emptyProfile())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => setOrigin(window.location.origin), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('medical_profiles')
      .select('*')
      .maybeSingle()

    if (qErr) {
      if (isMissingTableError(qErr)) setNeedsMigration(true)
      else setError(qErr.message)
      setLoading(false)
      return
    }
    setNeedsMigration(false)
    if (data) setProfile(rowToProfile(data))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const set = <K extends keyof MedicalProfile>(key: K, value: MedicalProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }) as MedicalProfile)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      setSaving(false)
      showToast('Please sign in again.', 'caution')
      return
    }
    const { error: uErr } = await supabase
      .from('medical_profiles')
      .upsert({ user_id: user.id, ...profileToRow(profile) }, { onConflict: 'user_id' })
    if (uErr) {
      setSaving(false)
      showToast(`Couldn’t save: ${uErr.message}`, 'caution')
      return
    }
    showToast('Medical ID saved.', 'success')
    await load() // pull back the public_token generated on first save
    setSaving(false)
  }

  const publicUrl = profile.publicToken ? `${origin}/id/${profile.publicToken}` : ''

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Couldn’t copy — select and copy the link manually.', 'caution')
    }
  }

  const field =
    'w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary'
  const label = 'block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5'

  if (needsMigration) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">One quick setup step</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            The Medical ID is new. Re-run <span className="font-semibold text-ink">supabase/setup.sql</span>{' '}
            in your Supabase dashboard (it only adds the new table — see{' '}
            <span className="font-semibold text-ink">docs/DATABASE_SETUP.md</span>), then reload.
          </p>
          <button onClick={load} className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> I&apos;ve run it — reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Emergency</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Medical ID</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          The essentials someone would need if you couldn&apos;t speak for yourself. Fill it in,
          then optionally turn on a private link a first responder can open without your password.
        </p>
      </header>

      {error && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold">Something went wrong</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center animate-pulse">
          <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ---- Editor ---- */}
          <div className="space-y-6">
            <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-ink">Your information</h3>
              <div>
                <label htmlFor="mi-name" className={label}>Full name</label>
                <input id="mi-name" type="text" value={profile.fullName} onChange={(e) => set('fullName', e.target.value)} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mi-dob" className={label}>Date of birth</label>
                  <input id="mi-dob" type="date" value={profile.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value || null)} className={field} />
                </div>
                <div>
                  <label htmlFor="mi-blood" className={label}>Blood type</label>
                  <input id="mi-blood" type="text" placeholder="e.g. O+" value={profile.bloodType} onChange={(e) => set('bloodType', e.target.value)} className={field} />
                </div>
              </div>
              <div>
                <label htmlFor="mi-dx" className={label}>Diagnosis</label>
                <input id="mi-dx" type="text" value={profile.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="mi-insulin" className={label}>Insulin(s)</label>
                <input id="mi-insulin" type="text" placeholder="e.g. Humalog (rapid), Tresiba (basal)" value={profile.insulinTypes} onChange={(e) => set('insulinTypes', e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="mi-devices" className={label}>Devices</label>
                <input id="mi-devices" type="text" placeholder="e.g. Omnipod 5, Dexcom G7" value={profile.devices} onChange={(e) => set('devices', e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="mi-allergies" className={label}>Allergies</label>
                <input id="mi-allergies" type="text" placeholder="e.g. none known" value={profile.allergies} onChange={(e) => set('allergies', e.target.value)} className={field} />
              </div>
            </section>

            <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-ink">Emergency contacts</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mi-ec-name" className={label}>Contact name</label>
                  <input id="mi-ec-name" type="text" value={profile.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="mi-ec-phone" className={label}>Contact phone</label>
                  <input id="mi-ec-phone" type="tel" value={profile.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mi-dr-name" className={label}>Doctor</label>
                  <input id="mi-dr-name" type="text" value={profile.doctorName} onChange={(e) => set('doctorName', e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="mi-dr-phone" className={label}>Doctor phone</label>
                  <input id="mi-dr-phone" type="tel" value={profile.doctorPhone} onChange={(e) => set('doctorPhone', e.target.value)} className={field} />
                </div>
              </div>
              <div>
                <label htmlFor="mi-notes" className={label}>Emergency note</label>
                <textarea id="mi-notes" rows={3} value={profile.notes} onChange={(e) => set('notes', e.target.value)} className={`${field} resize-none`} />
              </div>
            </section>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save medical ID
            </button>
          </div>

          {/* ---- Preview + share + travel ---- */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <EmergencyCard profile={profile} />

            {/* Share */}
            <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-teal" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Lock-screen / share access</h3>
                  <p className="text-sm text-muted">Create a private link that opens this card <strong>without a login</strong> — save it to your phone&apos;s lock screen or give it to family/school.</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={profile.isPublic}
                  onChange={(e) => set('isPublic', e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
                <span className="text-sm font-medium text-ink">Turn on the shareable link</span>
              </label>

              {profile.isPublic && (
                <div className="rounded-2xl bg-surface-2 border border-line p-4 space-y-3">
                  {profile.publicToken ? (
                    <>
                      <p className="text-xs text-faint break-all font-mono">{publicUrl}</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={copyLink} className="inline-flex items-center gap-2 bg-surface border border-line hover:border-primary/40 text-ink px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                          {copied ? <Check className="w-4 h-4 text-success" /> : <LinkIcon className="w-4 h-4" />}
                          {copied ? 'Copied' : 'Copy link'}
                        </button>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-surface border border-line hover:border-primary/40 text-ink px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                          <ExternalLink className="w-4 h-4" /> Open / print card
                        </a>
                      </div>
                      <p className="text-[11px] text-faint">Anyone with this link can view the card (no login). Turn it off here to revoke.</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">Click <strong>Save medical ID</strong> to generate your private link.</p>
                  )}
                </div>
              )}
            </section>

            {/* Travel */}
            <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-ink">Travel & emergency kit</h3>
              </div>
              <ul className="space-y-2">
                {TRAVEL_CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl bg-surface-2 border border-line p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldAlert className="w-4 h-4 text-muted" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">For airport security</p>
                </div>
                <p className="text-sm text-muted leading-relaxed">{TSA_NOTE}</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

/** The card preview shown to the owner — same shape as the public /id page. */
function EmergencyCard({ profile }: { profile: MedicalProfile }) {
  const rows: [string, string][] = [
    ['Diagnosis', profile.diagnosis],
    ['Insulin', profile.insulinTypes],
    ['Devices', profile.devices],
    ['Allergies', profile.allergies],
    ['Blood type', profile.bloodType],
  ]
  return (
    <div className="rounded-3xl border-2 border-urgent/30 bg-white shadow-sm overflow-hidden">
      <div className="bg-urgent text-white px-5 py-3 flex items-center gap-2">
        <HeartPulse className="w-5 h-5" />
        <span className="font-bold tracking-wide">MEDICAL ID — TYPE 1 DIABETES</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-2xl font-bold text-ink leading-tight">{profile.fullName || 'Your name'}</p>
        </div>
        <dl className="grid grid-cols-1 gap-2">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex gap-3 text-sm">
              <dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {profile.notes && (
          <div className="rounded-xl bg-urgent-soft border border-urgent/20 p-3">
            <p className="text-sm font-medium text-urgent leading-snug">{profile.notes}</p>
          </div>
        )}
        {(profile.emergencyContactName || profile.doctorName) && (
          <div className="pt-3 border-t border-line space-y-1.5">
            {profile.emergencyContactName && (
              <p className="flex items-center gap-2 text-sm text-ink">
                <Phone className="w-3.5 h-3.5 text-muted" />
                <span className="font-semibold">{profile.emergencyContactName}</span>
                <span className="text-muted">{profile.emergencyContactPhone}</span>
              </p>
            )}
            {profile.doctorName && (
              <p className="flex items-center gap-2 text-sm text-ink">
                <Phone className="w-3.5 h-3.5 text-muted" />
                <span className="font-semibold">Dr. {profile.doctorName}</span>
                <span className="text-muted">{profile.doctorPhone}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
