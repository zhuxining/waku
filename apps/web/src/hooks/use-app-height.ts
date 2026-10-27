import { useEffect } from 'react'

/**
 * Keeps `--app-height` in sync with the on-screen area when the soft keyboard is
 * open. iOS Safari does not resize the layout viewport for the keyboard, so
 * `100dvh` keeps the full height and the input row ends up hidden behind it.
 *
 * The fallback is `100dvh`, so this only overrides while the keyboard is
 * actually covering the shell (a large viewport shrink without pinch zoom).
 */
const KEYBOARD_MIN_INSET = 120

export function useAppHeight() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    let frame = 0

    const sync = () => {
      frame = 0
      const inset = window.innerHeight - viewport.height
      const keyboardOpen = viewport.scale <= 1.01 && inset > KEYBOARD_MIN_INSET

      if (keyboardOpen) {
        root.style.setProperty('--app-height', `${Math.round(viewport.height)}px`)
      } else {
        root.style.removeProperty('--app-height')
      }
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      root.style.removeProperty('--app-height')
    }
  }, [])
}
