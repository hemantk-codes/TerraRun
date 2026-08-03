import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a debounced version of `callback` that waits `delayMs` of
 * inactivity before firing. The returned function's identity is stable
 * across renders (safe to pass into event handlers/effect deps without
 * re-triggering them), and it always invokes the LATEST `callback` passed
 * in, not a stale closure captured whenever the debounce timer was set up.
 */
export function useDebouncedCallback(callback, delayMs) {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delayMs)
    },
    [delayMs]
  )
}
