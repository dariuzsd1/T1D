/**
 * The depletion engine now lives in `supabase/functions/_shared/depletion.ts`,
 * shared verbatim with the notify-refills Edge Function.
 *
 * Deno cannot import from `src/`, so the two used to keep hand-ported copies of
 * the same math, and they drifted: the app alarmed at buffer plus delivery time
 * while the push alarmed at the bare buffer, making the proactive channel the
 * last to warn. Re-exporting from one file makes that drift impossible instead
 * of merely detectable.
 *
 * Import it from '@/lib/depletion' as before; nothing about the API changed.
 */
export * from '../../supabase/functions/_shared/depletion'
