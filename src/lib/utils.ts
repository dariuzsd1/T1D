import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safely pull a message out of a caught `unknown` value, falling back when
 *  it isn't an Error (a thrown string, a rejected non-Error, etc). */
export function errorMessage(err: unknown, fallback = 'Internal server error'): string {
  return err instanceof Error && err.message ? err.message : fallback
}
