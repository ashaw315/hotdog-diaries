'use client'

import { useState, useEffect } from 'react'
import { FilterSettings } from '@/components/admin/FilterSettings'
import { FilteringStats } from '@/components/admin/FilteringStats'
import { FilterTester } from '@/components/admin/FilterTester'

interface FilteringData {
  patterns: Array<{
    id: number
    pattern_type: 'spam' | 'inappropriate' | 'unrelated' | 'required'
    pattern: string
    description: string
    is_regex: boolean
    is_enabled: boolean
    created_at: string
    updated_at: string
  }>
  stats: {
    total_processed: number
    auto_approved: number
    auto_rejected: number
    flagged_for_review: number
    spam_detected: number
    inappropriate_detected: number
    unrelated_detected: number
    duplicates_detected: number
    false_positives: number
    false_negatives: number
    accuracy_rate: number
  }
}

export default function FilteringPage() {
  const [filteringData, setFilteringData] = useState<FilteringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'patterns' | 'stats' | 'tester'>('patterns')

  const fetchFilteringData = async () => {
    try {
      const response = await fetch('/api/admin/filters')
      if (!response.ok) {
        throw new Error('Failed to fetch filtering data')
      }
      const data = await response.json()
      setFilteringData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilteringData()
  }, [])

  const handlePatternUpdate = async (patterns: FilteringData['patterns']) => {
    try {
      const response = await fetch('/api/admin/filters', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patterns }),
      })

      if (!response.ok) {
        throw new Error('Failed to update filter patterns')
      }

      await fetchFilteringData()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchFilteringData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!filteringData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">No filtering data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Content Filtering</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'patterns', label: 'Filter Patterns', icon: '🔍' },
            { id: 'stats', label: 'Statistics', icon: '📊' },
            { id: 'tester', label: 'Pattern Tester', icon: '🧪' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'patterns' && (
          <FilterSettings
            patterns={filteringData.patterns}
            onPatternsUpdate={handlePatternUpdate}
          />
        )}
        
        {activeTab === 'stats' && (
          <FilteringStats
            stats={filteringData.stats}
            onRefresh={fetchFilteringData}
          />
        )}
        
        {activeTab === 'tester' && (
          <FilterTester
            patterns={filteringData.patterns}
          />
        )}
      </div>
    </div>
  )
}