'use client'

import { useState } from 'react'

interface FilteringStatsData {
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

interface FilteringStatsProps {
  stats: FilteringStatsData
  onRefresh: () => Promise<void>
}

export function FilteringStats({ stats, onRefresh }: FilteringStatsProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    try {
      setLoading(true)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const getAccuracyColor = (rate: number) => {
    if (rate >= 0.9) return 'text-green-600'
    if (rate >= 0.8) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyBadge = (rate: number) => {
    if (rate >= 0.9) return 'bg-green-100 text-green-800'
    if (rate >= 0.8) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0
    return (numerator / denominator) * 100
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Filtering Statistics</h2>
          <p className="text-sm text-gray-600">
            Performance metrics and accuracy data for content filtering
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.total_processed.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Processed</div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.auto_approved.toLocaleString()}
            </div>
            <div className="text-sm text-green-800">Auto Approved</div>
            <div className="text-xs text-green-600 mt-1">
              {formatPercentage(calculateRate(stats.auto_approved, stats.total_processed) / 100)}
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.auto_rejected.toLocaleString()}
            </div>
            <div className="text-sm text-red-800">Auto Rejected</div>
            <div className="text-xs text-red-600 mt-1">
              {formatPercentage(calculateRate(stats.auto_rejected, stats.total_processed) / 100)}
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.flagged_for_review.toLocaleString()}
            </div>
            <div className="text-sm text-yellow-800">Flagged for Review</div>
            <div className="text-xs text-yellow-600 mt-1">
              {formatPercentage(calculateRate(stats.flagged_for_review, stats.total_processed) / 100)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Detection Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Detection Results</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🚫</span>
              <div className="text-sm font-medium text-red-800">Spam Detected</div>
            </div>
            <div className="text-xl font-bold text-red-600">
              {stats.spam_detected.toLocaleString()}
            </div>
            <div className="text-xs text-red-600 mt-1">
              {formatPercentage(calculateRate(stats.spam_detected, stats.total_processed) / 100)}
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <div className="text-sm font-medium text-orange-800">Inappropriate</div>
            </div>
            <div className="text-xl font-bold text-orange-600">
              {stats.inappropriate_detected.toLocaleString()}
            </div>
            <div className="text-xs text-orange-600 mt-1">
              {formatPercentage(calculateRate(stats.inappropriate_detected, stats.total_processed) / 100)}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔄</span>
              <div className="text-sm font-medium text-yellow-800">Unrelated</div>
            </div>
            <div className="text-xl font-bold text-yellow-600">
              {stats.unrelated_detected.toLocaleString()}
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {formatPercentage(calculateRate(stats.unrelated_detected, stats.total_processed) / 100)}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📄</span>
              <div className="text-sm font-medium text-blue-800">Duplicates</div>
            </div>
            <div className="text-xl font-bold text-blue-600">
              {stats.duplicates_detected.toLocaleString()}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {formatPercentage(calculateRate(stats.duplicates_detected, stats.total_processed) / 100)}
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy Metrics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Accuracy Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`text-3xl font-bold ${getAccuracyColor(stats.accuracy_rate)}`}>
              {formatPercentage(stats.accuracy_rate)}
            </div>
            <div className="text-sm text-gray-600 mb-2">Overall Accuracy</div>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getAccuracyBadge(stats.accuracy_rate)}`}>
              {stats.accuracy_rate >= 0.9 ? 'Excellent' : stats.accuracy_rate >= 0.8 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.false_positives.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mb-2">False Positives</div>
            <div className="text-xs text-gray-500">
              Good content incorrectly flagged
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.false_negatives.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mb-2">False Negatives</div>
            <div className="text-xs text-gray-500">
              Bad content incorrectly approved
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Insights</h3>
        
        <div className="space-y-4">
          {/* Automation Rate */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Automation Rate</div>
              <div className="text-sm text-gray-600">
                Percentage of content processed automatically
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {formatPercentage(calculateRate(stats.auto_approved + stats.auto_rejected, stats.total_processed) / 100)}
              </div>
              <div className="text-sm text-gray-600">
                {(stats.auto_approved + stats.auto_rejected).toLocaleString()} / {stats.total_processed.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Review Workload */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Manual Review Workload</div>
              <div className="text-sm text-gray-600">
                Content requiring human review
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {formatPercentage(calculateRate(stats.flagged_for_review, stats.total_processed) / 100)}
              </div>
              <div className="text-sm text-gray-600">
                {stats.flagged_for_review.toLocaleString()} items
              </div>
            </div>
          </div>

          {/* Filter Effectiveness */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Filter Effectiveness</div>
              <div className="text-sm text-gray-600">
                Content caught by filters
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {formatPercentage(calculateRate(
                  stats.spam_detected + stats.inappropriate_detected + stats.unrelated_detected + stats.duplicates_detected,
                  stats.total_processed
                ) / 100)}
              </div>
              <div className="text-sm text-gray-600">
                {(stats.spam_detected + stats.inappropriate_detected + stats.unrelated_detected + stats.duplicates_detected).toLocaleString()} filtered
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">📈 Recommendations</h3>
        <div className="space-y-2 text-sm text-blue-800">
          {stats.accuracy_rate < 0.8 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                Accuracy is below 80%. Consider reviewing and updating filter patterns.
              </span>
            </div>
          )}
          
          {stats.false_positives > stats.false_negatives * 2 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High false positive rate. Consider relaxing filter thresholds.
              </span>
            </div>
          )}
          
          {stats.false_negatives > stats.false_positives * 2 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High false negative rate. Consider tightening filter patterns.
              </span>
            </div>
          )}
          
          {calculateRate(stats.flagged_for_review, stats.total_processed) > 30 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High manual review workload. Consider improving automation thresholds.
              </span>
            </div>
          )}
          
          {stats.duplicates_detected > stats.total_processed * 0.1 && (
            <div className="flex items-start gap-2">
              <span>•</span>
              <span>
                High duplicate rate. Consider improving content source diversity.
              </span>
            </div>
          )}
          
          {stats.accuracy_rate >= 0.9 && stats.false_positives <= 5 && stats.false_negatives <= 5 && (
            <div className="flex items-start gap-2">
              <span>✅</span>
              <span>
                Excellent filtering performance! The system is working well.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}