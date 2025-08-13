'use client'

import { useEffect, useState } from 'react'

interface RejectedItem {
  id: number
  source_platform: string
  content_text: string
  is_approved: number
  confidence_score: number | null
  is_valid_hotdog: number | null
  is_spam: number | null
  is_inappropriate: number | null
  is_unrelated: number | null
  processing_notes: string | null
  content_status: string
  scraped_at: string
}

interface PlatformStats {
  source_platform: string
  total: number
  rejected: number
  approved: number
  avg_confidence: number | null
  rejection_rate: number
}

export default function RejectedAnalysisPage() {
  const [rejectedItems, setRejectedItems] = useState<RejectedItem[]>([])
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRejectedAnalysis()
  }, [])

  const fetchRejectedAnalysis = async () => {
    try {
      const response = await fetch('/api/rejected-analysis')
      if (!response.ok) throw new Error('Failed to fetch rejected content analysis')
      
      const data = await response.json()
      setRejectedItems(data.rejectedItems)
      setPlatformStats(data.platformStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getRejectionReason = (item: RejectedItem) => {
    const reasons = []
    
    if (item.confidence_score !== null && item.confidence_score < 0.4) {
      reasons.push(`Low confidence (${item.confidence_score.toFixed(3)})`)
    }
    if (item.is_spam === 1) reasons.push('Flagged as spam')
    if (item.is_inappropriate === 1) reasons.push('Inappropriate content')
    if (item.is_unrelated === 1) reasons.push('Unrelated to hotdogs')
    if (item.is_valid_hotdog === 0) reasons.push('Not valid hotdog content')
    
    if (reasons.length === 0) {
      if (item.confidence_score === null) {
        reasons.push('Not processed through content analysis')
      } else {
        reasons.push('Unknown rejection reason')
      }
    }
    
    return reasons
  }

  const getRejectionColor = (rate: number) => {
    if (rate >= 80) return 'bg-red-100 border-red-200 text-red-800'
    if (rate >= 50) return 'bg-orange-100 border-orange-200 text-orange-800'
    if (rate >= 20) return 'bg-yellow-100 border-yellow-200 text-yellow-800'
    return 'bg-green-100 border-green-200 text-green-800'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔍</div>
        <div>Analyzing rejected content...</div>
      </div>
    </div>
  )
  
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-red-500">
        <div className="text-4xl mb-4">❌</div>
        <div>Error: {error}</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">🔍 Rejected Content Analysis</h1>
          <p className="text-gray-600 mt-2">Understanding why content is being rejected and platform performance</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        
        {/* Platform Stats */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Rejection Rates by Platform</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {platformStats.map((stat) => (
              <div key={stat.source_platform} className={`p-4 rounded border ${getRejectionColor(stat.rejection_rate)}`}>
                <div className="font-bold text-lg">{stat.source_platform.toUpperCase()}</div>
                <div className="text-2xl font-bold">{stat.rejection_rate}%</div>
                <div className="text-sm">
                  {stat.rejected}/{stat.total} rejected
                </div>
                <div className="text-xs mt-1">
                  Avg confidence: {stat.avg_confidence?.toFixed(2) || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Insights */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 Key Insights</h2>
          <div className="grid md:grid-cols-3 gap-6">
            
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h3 className="font-semibold text-red-800 mb-2">High Rejection Platforms</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {platformStats.filter(s => s.rejection_rate >= 50).map(stat => (
                  <li key={stat.source_platform}>
                    <strong>{stat.source_platform}</strong>: {stat.rejection_rate}%
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-2">
                These platforms may need threshold adjustments or better keyword filtering.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded p-4">
              <h3 className="font-semibold text-orange-800 mb-2">Common Rejection Reasons</h3>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Low confidence scores (&lt; 0.6)</li>
                <li>• Inappropriate content flagging</li>
                <li>• Not valid hotdog content</li>
                <li>• Missing content analysis</li>
              </ul>
              <p className="text-xs text-orange-600 mt-2">
                Many items lack proper analysis processing.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Recommendations</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Lower YouTube threshold (100% rejected)</li>
                <li>• Fix Lemmy content analysis</li>
                <li>• Review Imgur filtering logic</li>
                <li>• Check Bluesky inappropriate flagging</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                Focus on platforms with missing analysis data.
              </p>
            </div>

          </div>
        </div>

        {/* Rejected Items Table */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Recent Rejected Content</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Platform</th>
                  <th className="text-left p-3 font-medium">Content</th>
                  <th className="text-left p-3 font-medium">Confidence</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Rejection Reasons</th>
                </tr>
              </thead>
              <tbody>
                {rejectedItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {item.source_platform}
                      </span>
                      <div className="text-xs text-gray-500">ID: {item.id}</div>
                    </td>
                    
                    <td className="p-3 max-w-xs">
                      <div className="font-medium truncate">
                        {item.content_text?.substring(0, 60) || 'No text content'}
                        {item.content_text && item.content_text.length > 60 && '...'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.scraped_at).toLocaleDateString()}
                      </div>
                    </td>
                    
                    <td className="p-3">
                      {item.confidence_score !== null ? (
                        <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          item.confidence_score >= 0.6 ? 'bg-green-100 text-green-800' :
                          item.confidence_score >= 0.4 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.confidence_score.toFixed(3)}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not analyzed</span>
                      )}
                    </td>
                    
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        item.content_status === 'rejected' ? 'bg-red-100 text-red-800' :
                        item.content_status === 'posted' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.content_status}
                      </span>
                    </td>
                    
                    <td className="p-3">
                      <div className="space-y-1">
                        {getRejectionReason(item).map((reason, i) => (
                          <div key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                            {reason}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Borderline Cases */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚠️ Borderline Cases (0.4-0.6 Confidence)</h2>
          <div className="space-y-3">
            {rejectedItems
              .filter(item => item.confidence_score && item.confidence_score >= 0.4 && item.confidence_score < 0.6)
              .map(item => (
                <div key={item.id} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-sm">[{item.source_platform}] </span>
                      <span className="text-sm">{item.content_text?.substring(0, 80)}...</span>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      Confidence: {item.confidence_score?.toFixed(3)}
                    </div>
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    This might be worth approving with lower thresholds
                  </div>
                </div>
              ))}
            {rejectedItems.filter(item => item.confidence_score && item.confidence_score >= 0.4 && item.confidence_score < 0.6).length === 0 && (
              <div className="text-gray-500 text-center py-4">No borderline cases found</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}