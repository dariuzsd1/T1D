'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { useProfile } from '@/components/profile/ProfileProvider'
import { Avatar } from '@/components/profile/Avatar'
import { BackButton } from '@/components/ui/BackButton'
import { fetchRecentActivity, ACTIVITY_LABEL, type ActivityEntry, type ActivityAction } from '@/lib/activity'
import { formatDistanceToNow } from 'date-fns'
import { HeartPulse, Cpu, Loader2, Upload, Trash2, ChevronRight, Clock } from 'lucide-react'

/** Downscale an image file to a square JPEG blob (≈256px) before upload. */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // Cover-crop to a centered square.
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85)
  )
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const { profile, email, refresh } = useProfile()
  const { showToast } = useToast()
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable identity fields, seeded once when the profile first loads (it may
  // be null on first mount while the provider fetches).
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [preferredName, setPreferredName] = useState(profile?.preferredName ?? '')
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? '')
  const seeded = useRef(false)
  useEffect(() => {
    if (profile && !seeded.current) {
      setDisplayName(profile.displayName ?? '')
      setPreferredName(profile.preferredName ?? '')
      setPronouns(profile.pronouns ?? '')
      setTimezone(profile.timezone ?? '')
      seeded.current = true
    }
  }, [profile])

  // Recent activity feed.
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  useEffect(() => { fetchRecentActivity(10).then(setActivity) }, [])

  // Common time zones, when the browser exposes them; else fall back to a text input.
  const zones = useMemo<string[]>(() => {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    try { return sv ? sv('timeZone') : [] } catch { return [] }
  }, [])

  const handlePick = () => fileRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast(t('profile.errImageType'), 'caution'); return }
    if (file.size > 2 * 1024 * 1024) { showToast(t('profile.errImageSize'), 'caution'); return }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('signed out')

      const blob = await toAvatarBlob(file)
      // Unique filename per upload so the public URL changes (no stale cache).
      const path = `${user.id}/avatar-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const prevPath = profile?.avatarPath
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', user.id)
      if (dbErr) throw dbErr

      // Best-effort cleanup of the previous file.
      if (prevPath && prevPath !== path) {
        await supabase.storage.from('avatars').remove([prevPath]).catch(() => {})
      }

      await refresh()
      showToast(t('profile.photoUpdated'), 'success')
    } catch (err) {
      console.error('avatar upload failed:', err)
      showToast(t('profile.errUpload'), 'caution')
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!profile?.avatarPath) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('signed out')
      await supabase.storage.from('avatars').remove([profile.avatarPath]).catch(() => {})
      await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id)
      await refresh()
      showToast(t('profile.photoRemoved'), 'info')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('signed out')
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName.trim() || null,
        preferred_name: preferredName.trim() || null,
        pronouns: pronouns.trim() || null,
        timezone: timezone.trim() || null,
      })
      if (error) throw error
      await refresh()
      showToast(t('profile.saved'), 'success')
    } catch (err) {
      console.error('profile save failed:', err)
      showToast(t('profile.errUpload'), 'caution')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all'

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('profile.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('profile.title')}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">{t('profile.intro')}</p>
      </header>

      {/* Avatar */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <h3 className="font-semibold text-ink mb-4">{t('profile.picture')}</h3>
        <div className="flex items-center gap-5">
          <Avatar profile={profile} email={email} size={80} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="sr-only"
              aria-label={t('profile.changePhoto')}
            />
            <button
              onClick={handlePick}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line border border-line text-ink px-4 min-h-[44px] rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {t('profile.changePhoto')}
            </button>
            {profile?.avatarPath && (
              <button
                onClick={handleRemovePhoto}
                disabled={uploading}
                className="inline-flex items-center gap-2 text-faint hover:text-urgent px-4 min-h-[44px] rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
              >
                <Trash2 className="w-4 h-4" />
                {t('profile.removePhoto')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Identity details */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm space-y-4">
        <h3 className="font-semibold text-ink">{t('profile.detailsTitle')}</h3>

        <div>
          <label htmlFor="pf-display" className="block text-sm font-medium text-muted mb-1.5">
            {t('settings.displayName')}
          </label>
          <input id="pf-display" type="text" value={displayName} maxLength={60}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={email ?? ''} className={inputCls} />
        </div>

        <div>
          <label htmlFor="pf-preferred" className="block text-sm font-medium text-muted mb-1.5">
            {t('profile.preferredName')} <span className="text-faint font-normal">{t('settings.optional')}</span>
          </label>
          <input id="pf-preferred" type="text" value={preferredName} maxLength={40}
            onChange={(e) => setPreferredName(e.target.value)} className={inputCls} />
          <p className="text-xs text-faint mt-1.5">{t('profile.preferredNameHint')}</p>
        </div>

        <div>
          <label htmlFor="pf-pronouns" className="block text-sm font-medium text-muted mb-1.5">
            {t('profile.pronouns')} <span className="text-faint font-normal">{t('settings.optional')}</span>
          </label>
          <input id="pf-pronouns" type="text" value={pronouns} maxLength={30}
            onChange={(e) => setPronouns(e.target.value)} placeholder="she/her · he/him · they/them" className={inputCls} />
        </div>

        <div>
          <label htmlFor="pf-tz" className="block text-sm font-medium text-muted mb-1.5">
            {t('profile.timezone')} <span className="text-faint font-normal">{t('settings.optional')}</span>
          </label>
          {zones.length > 0 ? (
            <select id="pf-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          ) : (
            <input id="pf-tz" type="text" value={timezone}
              onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Paris" className={inputCls} />
          )}
          <button
            type="button"
            onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
            className="text-xs text-primary hover:underline mt-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {t('profile.timezoneDetect')}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 min-h-[44px] rounded-xl font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('settings.save')}
        </button>
      </section>

      {/* Cross-links — clinical detail lives elsewhere, single source of truth */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CrossLink href="/dashboard/medical-id" icon={<HeartPulse className="w-5 h-5 text-urgent" />}
          title={t('profile.medicalCardTitle')} body={t('profile.medicalCardBody')} cta={t('profile.manage')} />
        <CrossLink href="/dashboard/devices" icon={<Cpu className="w-5 h-5 text-primary" />}
          title={t('profile.devicesCardTitle')} body={t('profile.devicesCardBody')} cta={t('profile.manage')} />
      </section>

      {/* Recent activity */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <h3 className="font-semibold text-ink flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-muted" /> {t('activity.title')}
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">{t('activity.empty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((a) => {
              const labelKey = ACTIVITY_LABEL[a.action as ActivityAction]
              const text = labelKey ? t(labelKey, { detail: a.detail ?? '' }) : `${a.action} ${a.detail ?? ''}`
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-ink truncate">{text}</span>
                  <span className="text-xs text-faint shrink-0">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function CrossLink({
  href, icon, title, body, cta,
}: {
  href: string; icon: React.ReactNode; title: string; body: string; cta: string
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 bg-surface border border-line rounded-2xl p-5 hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-xs text-muted mt-0.5">{body}</p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-2 group-hover:gap-2 transition-all">
          {cta} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  )
}
