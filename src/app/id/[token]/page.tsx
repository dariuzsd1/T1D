import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { PublicMedicalId } from '@/lib/medicalId'
import { en, fr } from '@/lib/i18n/dictionaries'
import { LANG_COOKIE, normalizeLang } from '@/lib/i18n/shared'
import { HeartPulse, Phone, ShieldAlert } from 'lucide-react'

export const metadata = {
  title: 'Emergency Medical ID',
  // Don't let an emergency card get indexed or previewed by crawlers.
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PublicMedicalIdPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Server component (no hooks): translate against the viewer's saved language,
  // read straight from the cookie like the root layout does. Defaults to English.
  const cookieStore = await cookies()
  const lang = normalizeLang(cookieStore.get(LANG_COOKIE)?.value)
  const dict = lang === 'fr' ? fr : en
  const tr = (key: keyof typeof en) => dict[key] ?? en[key]

  let card: PublicMedicalId | null = null
  if (UUID_RE.test(token)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_public_medical_id', { p_token: token })
    const rows = (data as PublicMedicalId[] | null) ?? []
    card = rows[0] ?? null
  }

  if (!card) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-bold text-ink">{tr('medicalId.notFoundTitle')}</h1>
          <p className="text-muted text-sm">
            {tr('medicalId.notFoundBody')}
          </p>
        </div>
      </main>
    )
  }

  const rows: [string, string | null][] = [
    [tr('medicalId.diagnosis'), card.diagnosis],
    [tr('medicalId.rowInsulin'), card.insulin_types],
    [tr('medicalId.devices'), card.devices],
    [tr('medicalId.allergies'), card.allergies],
    [tr('medicalId.bloodType'), card.blood_type],
  ]

  return (
    <main className="min-h-screen bg-canvas flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-urgent/30 bg-white shadow-lg overflow-hidden">
        <div className="bg-urgent text-white px-5 py-4 flex items-center gap-2">
          <HeartPulse className="w-6 h-6" />
          <span className="font-bold tracking-wide">{tr('medicalId.badgeTitle')}</span>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-2xl font-bold text-ink leading-tight">{card.full_name || tr('medicalId.unnamed')}</p>

          <dl className="grid grid-cols-1 gap-2.5">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-[15px]">
                <dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {card.notes && (
            <div className="rounded-xl bg-urgent-soft border border-urgent/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-urgent" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-urgent">{tr('medicalId.inEmergency')}</span>
              </div>
              <p className="text-[15px] font-medium text-urgent leading-snug">{card.notes}</p>
            </div>
          )}

          {(card.emergency_contact_name || card.doctor_name) && (
            <div className="pt-4 border-t border-line space-y-2">
              {card.emergency_contact_name && (
                <a
                  href={card.emergency_contact_phone ? `tel:${card.emergency_contact_phone}` : undefined}
                  className="flex items-center gap-2 text-[15px] text-ink"
                >
                  <Phone className="w-4 h-4 text-urgent" />
                  <span className="font-semibold">{card.emergency_contact_name}</span>
                  <span className="text-muted">{card.emergency_contact_phone}</span>
                </a>
              )}
              {card.doctor_name && (
                <a
                  href={card.doctor_phone ? `tel:${card.doctor_phone}` : undefined}
                  className="flex items-center gap-2 text-[15px] text-ink"
                >
                  <Phone className="w-4 h-4 text-muted" />
                  <span className="font-semibold">{tr('medicalId.doctorPrefix').replace('{name}', card.doctor_name)}</span>
                  <span className="text-muted">{card.doctor_phone}</span>
                </a>
              )}
            </div>
          )}

          <p className="text-[11px] text-faint text-center pt-2">
            {tr('medicalId.publicFooter')}
          </p>
        </div>
      </div>
    </main>
  )
}
