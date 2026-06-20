'use client'

import Link from "next/link"
import {
  ShieldCheck,
  ArrowRight,
  CalendarClock,
  Map,
  Users,
  HeartPulse,
  HeartHandshake,
  Package,
  Bell,
  PackageCheck,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageToggle } from "@/components/ui/LanguageToggle"
import type { TKey } from "@/lib/i18n/dictionaries"

const FEATURES: { icon: typeof CalendarClock; title: TKey; body: TKey }[] = [
  { icon: CalendarClock, title: "landing.feat1Title", body: "landing.feat1Body" },
  { icon: Map, title: "landing.feat2Title", body: "landing.feat2Body" },
  { icon: Users, title: "landing.feat3Title", body: "landing.feat3Body" },
  { icon: HeartPulse, title: "landing.feat4Title", body: "landing.feat4Body" },
]

/**
 * Public marketing/landing page shown to logged-out visitors at `/`.
 * Calm Clinical palette, with an in-page language toggle. Logged-in users are
 * redirected to /dashboard upstream in page.tsx.
 */
export function LandingPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5 text-primary">
          <ShieldCheck className="w-7 h-7" />
          <span className="font-bold text-lg tracking-tight text-ink">T1D Hub</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/login"
            className="text-sm font-semibold text-muted hover:text-ink px-4 py-2 rounded-xl hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('landing.signIn')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-8 pt-10 sm:pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
            <Bell className="w-3.5 h-3.5" />
            {t('landing.badge')}
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-lg sm:text-xl text-muted mt-6 max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroSub')}
          </p>
          <div className="flex justify-center mt-9">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-deep text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              {t('landing.getStarted')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Two paths — choose your experience */}
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-8 pb-4">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-6">
            {t('landing.twoWays')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Patient path */}
            <Link
              href="/login"
              className="group bg-surface border border-line rounded-2xl p-7 hover:border-primary/40 transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{t('landing.patientTitle')}</h3>
              <p className="text-muted mt-2 leading-relaxed flex-1">{t('landing.patientBody')}</p>
              <span className="inline-flex items-center gap-1.5 text-primary font-semibold mt-5 group-hover:gap-2.5 transition-all">
                {t('landing.getStarted')} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Caregiver path */}
            <Link
              href="/login?next=/dashboard/family"
              className="group bg-surface border border-line rounded-2xl p-7 hover:border-teal/40 transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center mb-4">
                <HeartHandshake className="w-6 h-6 text-teal" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{t('landing.caregiverTitle')}</h3>
              <p className="text-muted mt-2 leading-relaxed flex-1">{t('landing.caregiverBody')}</p>
              <span className="inline-flex items-center gap-1.5 text-teal font-semibold mt-5 group-hover:gap-2.5 transition-all">
                {t('landing.getStarted')} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-8 pt-12 pb-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-6">
            {t('landing.whatYouGet')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-surface border border-line rounded-2xl p-6 sm:p-7 hover:border-primary/30 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">{t(title)}</h2>
                <p className="text-muted mt-2 leading-relaxed">{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reassurance strip */}
        <section className="bg-surface border-y border-line">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-12 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center shrink-0">
              <PackageCheck className="w-6 h-6 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t('landing.reassureTitle')}</h2>
              <p className="text-muted mt-1 leading-relaxed">{t('landing.reassureBody')}</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-8 text-sm text-faint flex flex-col sm:flex-row gap-3 justify-between items-center">
        <p>© {new Date().getFullYear()} T1D Hub</p>
        <p className="text-center sm:text-right">{t('landing.footerDisclaimer')}</p>
      </footer>
    </div>
  )
}
