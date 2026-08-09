import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'

const NOTE_LIST_SEARCH_DEBOUNCE_MS = 180

function normalizeSearch(search: string): string {
  return search.trim().toLowerCase()
}

export function useNoteListSearchState() {
  const [search, setSearch] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedSearch = normalizeSearch(search)
  const query = useDeferredValue(debouncedQuery)

  const updateSearch = useCallback((value: string) => {
    setSearch(value)
    if (normalizeSearch(value).length === 0) setDebouncedQuery('')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(normalizedSearch)
    }, NOTE_LIST_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [normalizedSearch])

  useEffect(() => {
    if (!searchVisible) return

    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [searchVisible])

  const clearSearch = useCallback(() => {
    setSearch('')
    setDebouncedQuery('')
  }, [])

  const openSearch = useCallback(() => {
    setSearchVisible(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchVisible(false)
    clearSearch()
  }, [clearSearch])

  const toggleSearch = useCallback(() => {
    setSearchVisible((visible) => {
      if (visible) clearSearch()
      return !visible
    })
  }, [clearSearch])

  const isSearching = normalizedSearch.length > 0
    && (normalizedSearch !== debouncedQuery || debouncedQuery !== query)

  return {
    closeSearch,
    isSearching,
    openSearch,
    query,
    search,
    searchInputRef,
    searchVisible,
    setSearch: updateSearch,
    toggleSearch,
  }
}
