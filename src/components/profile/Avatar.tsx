'use client'

import { avatarUrl, initialsFor, type Profile } from '@/lib/profile'
import { cn } from '@/lib/utils'

/**
 * Round avatar: shows the uploaded image when present, otherwise the user's
 * initials on a tinted background. `size` is in pixels.
 */
export function Avatar({
  profile,
  email,
  size = 36,
  className,
}: {
  profile: Profile | null
  email: string | null
  size?: number
  className?: string
}) {
  const url = avatarUrl(profile?.avatarPath)
  const initials = initialsFor(profile, email)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold overflow-hidden shrink-0 border border-line',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
