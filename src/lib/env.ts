/**
 * Validates the public Supabase env vars with a clear, actionable message.
 * Without this, a missing key surfaces as a cryptic "supabaseUrl is required"
 * deep inside supabase-js. Here it fails early and tells you exactly what to do.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Configuration missing: ${name} is not set. Copy .env.example to ` +
        `.env.local and add your Supabase URL and anon key (see ` +
        `docs/DATABASE_SETUP.md), then restart the app.`
    )
  }
  return value.trim()
}

export const SUPABASE_URL = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

export const SUPABASE_ANON_KEY = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
