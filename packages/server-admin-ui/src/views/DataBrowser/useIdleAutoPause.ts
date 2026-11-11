import { useEffect, useRef, useState } from 'react'

const BACKGROUND_PAUSE_DELAY_MS = 5 * 60 * 1000

export function useIdleAutoPause(
  enabled: boolean,
  onPause: () => void,
  onResume: () => void
): boolean {
  const [autoPaused, setAutoPaused] = useState(false)
  const callbacksRef = useRef({ onPause, onResume })

  useEffect(() => {
    callbacksRef.current = { onPause, onResume }
  }, [onPause, onResume])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const updateVisibility = () => {
      if (!enabled || document.visibilityState !== 'hidden') {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (enabled && autoPaused) callbacksRef.current.onResume()
        setAutoPaused(false)
        return
      }

      if (!autoPaused && !timer) {
        timer = setTimeout(() => {
          timer = null
          callbacksRef.current.onPause()
          setAutoPaused(true)
        }, BACKGROUND_PAUSE_DELAY_MS)
      }
    }

    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [enabled, autoPaused])

  return autoPaused
}
