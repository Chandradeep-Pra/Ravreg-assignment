import { useRef } from "react"

export function useSilence(timeout = 20000) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const start = (callback: () => void) => {
    clear()
    timerRef.current = setTimeout(callback, timeout)
  }

  const reset = (callback: () => void) => {
    clear()
    start(callback)
  }

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return { start, reset, clear }
}