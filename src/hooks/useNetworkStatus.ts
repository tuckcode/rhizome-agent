import { useEffect, useState } from 'react'

function detectOffline(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return navigator.onLine === false
}

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(detectOffline)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOffline }
}
