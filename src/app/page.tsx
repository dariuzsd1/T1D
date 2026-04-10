import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Index() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  } else {
    redirect('/dashboard')
  }
}
