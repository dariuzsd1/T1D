import { useEffect, useLayoutEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessibility plumbing shared by every modal dialog:
 *  - traps Tab focus inside the dialog (WCAG 2.4.3 — focus must not escape to the
 *    page behind a modal),
 *  - closes on Escape,
 *  - restores focus to the element that opened it on close,
 *  - locks background scroll while open,
 *  - moves focus into the dialog on open (unless a child already grabbed it).
 *
 * Returns a ref to attach to the dialog container (the panel, not the backdrop).
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T>(null)
  // Keep the latest onClose without re-running the effect (which would reset the
  // saved focus target). Escape always calls the current handler. Updated in a
  // layout effect (not during render) so the ref mutation stays a side effect,
  // not a render impurity, and is current before the browser can dispatch Escape.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { body } = document
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    // Move focus into the dialog if a child hasn't already taken it.
    const container = containerRef.current
    if (container && !container.contains(document.activeElement)) {
      container.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (active === first || !containerRef.current.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !containerRef.current.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
    // Runs once per open; onClose is read via ref.
  }, [])

  return containerRef
}
