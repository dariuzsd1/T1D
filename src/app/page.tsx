import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/marketing/LandingPage'

export default async function Index() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Logged-in users go straight to their dashboard; everyone else gets the
  // public landing page (instead of bouncing to a bare login form).
  if (user) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
