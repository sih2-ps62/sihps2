import { useCallback, useEffect, useState } from 'react'

// Shared loading/error/data pattern so every screen gets the same
// loading -> data / empty / error states without repeating boilerplate.
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload, setData }
}
