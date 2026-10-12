import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createManagementStore } from '@/features/management/model'

function localStorageOrNull() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useManagementDemo(scope: string) {
  const store = useMemo(() => createManagementStore(localStorageOrNull(), scope), [scope])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === store.key) store.refresh()
    }
    const onFocus = () => store.refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    store.refresh()
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [store])
  return { ...snapshot, commit: store.commit, reset: store.reset, refresh: store.refresh }
}
