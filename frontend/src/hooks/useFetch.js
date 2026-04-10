import { useQuery } from '@tanstack/react-query'
import { useRef, useEffect } from 'react'

export function useFetch(fetchFn, deps = []) {
  const fetchRef = useRef(fetchFn)

  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

  const query = useQuery({
    queryKey: ['fetch', ...deps],
    queryFn: () => fetchRef.current(),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1500,
    staleTime: 1000 * 60 * 2,
  })

  return {
    data:    query.data    ?? null,
    loading: query.isLoading || query.isFetching,
    error:   query.error?.message ?? null,
    retry:   query.refetch,
  }
}