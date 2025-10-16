'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type SortOption = 
  | 'created_at' 
  | 'updated_at' 
  | 'scraped_at' 
  | 'confidence_score' 
  | 'scheduled_post_time'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  sortBy: SortOption
  direction: SortDirection
}

export interface UseUrlSortOptions {
  /** Default sort field */
  defaultSort?: SortOption
  /** Default sort direction */
  defaultDirection?: SortDirection
  /** URL parameter name for sort field */
  sortParam?: string
  /** URL parameter name for direction */
  directionParam?: string
  /** Whether to update URL immediately on change */
  updateUrl?: boolean
}

/**
 * Hook for managing sort state with URL persistence
 * Provides sticky sort state that survives page refreshes
 */
export function useUrlSort({
  defaultSort = 'created_at',
  defaultDirection = 'desc',
  sortParam = 'sort',
  directionParam = 'dir',
  updateUrl = true
}: UseUrlSortOptions = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize state from URL or defaults
  const initializeSort = useCallback((): SortState => {
    const urlSort = searchParams.get(sortParam) as SortOption
    const urlDirection = searchParams.get(directionParam) as SortDirection
    
    return {
      sortBy: urlSort || defaultSort,
      direction: urlDirection || defaultDirection
    }
  }, [searchParams, sortParam, directionParam, defaultSort, defaultDirection])
  
  const [sortState, setSortState] = useState<SortState>(initializeSort)

  // Update state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newSort = initializeSort()
    setSortState(newSort)
  }, [initializeSort])

  // Update URL when sort state changes
  const updateUrlParams = useCallback((newSort: SortState) => {
    if (!updateUrl) return

    const params = new URLSearchParams(searchParams.toString())
    
    // Set sort parameters
    params.set(sortParam, newSort.sortBy)
    params.set(directionParam, newSort.direction)
    
    // Update URL without triggering navigation
    const newUrl = `${window.location.pathname}?${params.toString()}`
    router.replace(newUrl, { scroll: false })
  }, [router, searchParams, sortParam, directionParam, updateUrl])

  // Set sort field and direction
  const setSort = useCallback((sortBy: SortOption, direction?: SortDirection) => {
    const newSort: SortState = {
      sortBy,
      direction: direction || sortState.direction
    }
    
    setSortState(newSort)
    updateUrlParams(newSort)
  }, [sortState.direction, updateUrlParams])

  // Toggle sort direction for current field
  const toggleDirection = useCallback(() => {
    const newDirection: SortDirection = sortState.direction === 'asc' ? 'desc' : 'asc'
    const newSort: SortState = {
      sortBy: sortState.sortBy,
      direction: newDirection
    }
    
    setSortState(newSort)
    updateUrlParams(newSort)
  }, [sortState, updateUrlParams])

  // Set sort with automatic direction toggle if same field
  const setSortWithToggle = useCallback((sortBy: SortOption) => {
    if (sortBy === sortState.sortBy) {
      // Same field, toggle direction
      toggleDirection()
    } else {
      // Different field, use default direction
      const newDirection: SortDirection = sortBy === 'scheduled_post_time' ? 'asc' : 'desc'
      setSort(sortBy, newDirection)
    }
  }, [sortState.sortBy, setSort, toggleDirection])

  // Get sort indicator for UI
  const getSortIndicator = useCallback((field: SortOption): string => {
    if (sortState.sortBy !== field) return ''
    return sortState.direction === 'asc' ? '↑' : '↓'
  }, [sortState])

  // Check if a field is currently sorted
  const isSorted = useCallback((field: SortOption): boolean => {
    return sortState.sortBy === field
  }, [sortState.sortBy])

  // Generate URL-compatible sort string for API calls
  const getSortString = useCallback((): string => {
    const dirSuffix = sortState.direction === 'asc' ? 'Asc' : 'Desc'
    return `${sortState.sortBy}${dirSuffix}`
  }, [sortState])

  return {
    sortBy: sortState.sortBy,
    direction: sortState.direction,
    setSort,
    setSortWithToggle,
    toggleDirection,
    getSortIndicator,
    isSorted,
    getSortString
  }
}

/**
 * Predefined sort configurations for common use cases
 */
export const SORT_CONFIGS = {
  /** Default content queue sorting */
  contentQueue: {
    defaultSort: 'created_at' as SortOption,
    defaultDirection: 'desc' as SortDirection
  },
  
  /** Schedule-focused sorting (prioritizes scheduled_post_time) */
  schedule: {
    defaultSort: 'scheduled_post_time' as SortOption,
    defaultDirection: 'asc' as SortDirection
  },
  
  /** Confidence-based sorting for review workflows */
  review: {
    defaultSort: 'confidence_score' as SortOption,
    defaultDirection: 'desc' as SortDirection
  }
} as const