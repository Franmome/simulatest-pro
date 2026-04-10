// src/hooks/useFetch.js
import { useQuery } from '@tanstack/react-query'

export function useFetch(fetchFn, deps = []) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: deps.length ? deps : ['default'],
    queryFn: fetchFn,
    refetchOnWindowFocus: true,   // ← recarga al volver a la pestaña
    retry: 2,
    retryDelay: 1500,
  })

  return {
    data:    data ?? null,
    loading: isLoading,
    error:   error?.message ?? null,
    retry:   refetch,
  }
}