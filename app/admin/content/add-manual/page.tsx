'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function AddManualContent() {
  const [activeTab, setActiveTab] = useState('video')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [videoUrl, setVideoUrl] = useState('')
  const [gifSearch, setGifSearch] = useState('')
  const [gifUrl, setGifUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')

  const handleVideoAdd = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/content/add-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(`✅ Video added successfully! ID: ${data.contentId}`)
        setVideoUrl('')
      } else {
        setError(data.error || 'Failed to add video')
      }
    } catch {
      setError('Network error while adding video')
    } finally {
      setLoading(false)
    }
  }

  const handleGifSearch = async () => {
    if (!gifSearch.trim()) {
      setError('Please enter a search term')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/content/search-gifs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gifSearch, limit: 10 })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(`✅ Found ${data.gifs?.length || 0} GIFs for "${gifSearch}"`)
        // You could display the GIFs here for selection
      } else {
        setError(data.error || 'Failed to search GIFs')
      }
    } catch {
      setError('Network error while searching GIFs')
    } finally {
      setLoading(false)
    }
  }

  const handleGifAdd = async () => {
    if (!gifUrl.trim()) {
      setError('Please enter a GIF URL')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/content/add-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gifUrl })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(`✅ GIF added successfully! ID: ${data.contentId}`)
        setGifUrl('')
      } else {
        setError(data.error || 'Failed to add GIF')
      }
    } catch {
      setError('Network error while adding GIF')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkImport = async () => {
    const urls = bulkUrls.trim().split('\n').filter(url => url.trim())
    
    if (urls.length === 0) {
      setError('Please enter at least one URL')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/admin/content/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(`✅ Bulk import completed! Added ${data.added} items, ${data.failed} failed`)
        setBulkUrls('')
      } else {
        setError(data.error || 'Failed to import URLs')
      }
    } catch {
      setError('Network error during bulk import')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = async (action: 'trending-gifs' | 'popular-videos') => {
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = action === 'trending-gifs' ? '/api/admin/content/quick-gifs' : '/api/admin/content/quick-videos'
      const response = await fetch(endpoint, { method: 'POST' })
      
      const data = await response.json()
      
      if (data.success) {
        setResult(`✅ ${action === 'trending-gifs' ? 'Trending GIFs' : 'Popular videos'} imported! Added ${data.added} items`)
      } else {
        setError(data.error || `Failed to import ${action}`)
      }
    } catch {
      setError('Network error during quick action')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manual Content Addition</h1>
              <p className="text-gray-600 mt-2">Fix content imbalance by adding videos and GIFs</p>
            </div>
            <Link href="/admin/dashboard" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Content Imbalance Alert */}
        <div className="mb-8 p-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
          <div className="flex items-center">
            <div className="text-2xl text-yellow-600 mr-3">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">Content Imbalance Detected</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p><strong>Videos:</strong> 0% (target: 30%) - CRITICAL</p>
                <p><strong>GIFs:</strong> 2.6% (target: 25%) - LOW</p>
                <p><strong>Images:</strong> 34% (target: 40%) - OK</p>
                <p><strong>Text:</strong> 17% (target: 5%) - HIGH</p>
              </div>
              <p className="mt-2 text-sm text-yellow-700">
                <strong>Recommendation:</strong> Add 30+ videos and 25+ GIFs to improve content variety
              </p>
            </div>
          </div>
        </div>

        {/* Results/Error Display */}
        {result && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{result}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => handleQuickAction('trending-gifs')}
              disabled={loading}
              className="bg-pink-500 text-white px-6 py-4 rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center justify-center"
            >
              <span className="mr-2">🎞️</span>
              Import 20 Trending Hotdog GIFs from Giphy
            </button>
            
            <button 
              onClick={() => handleQuickAction('popular-videos')}
              disabled={loading}
              className="bg-red-500 text-white px-6 py-4 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center"
            >
              <span className="mr-2">🎥</span>
              Import 10 Popular Hotdog Videos from YouTube
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              {[
                { id: 'video', label: 'Add YouTube Video', icon: '🎥' },
                { id: 'gif', label: 'Add GIF', icon: '🎞️' },
                { id: 'bulk', label: 'Bulk Import', icon: '📦' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* YouTube Video Tab */}
            {activeTab === 'video' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube URL
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Enter a YouTube URL for a hotdog-related video
                  </p>
                </div>
                <button
                  onClick={handleVideoAdd}
                  disabled={loading || !videoUrl.trim()}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Fetch & Add Video'}
                </button>
              </div>
            )}

            {/* GIF Tab */}
            {activeTab === 'gif' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Search Giphy</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Term
                    </label>
                    <input
                      type="text"
                      value={gifSearch}
                      onChange={(e) => setGifSearch(e.target.value)}
                      placeholder="hotdog, food, cooking..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loading}
                    />
                  </div>
                  <button
                    onClick={handleGifSearch}
                    disabled={loading || !gifSearch.trim()}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? 'Searching...' : 'Search Giphy'}
                  </button>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-medium text-gray-900">Add Custom GIF URL</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GIF URL
                    </label>
                    <input
                      type="url"
                      value={gifUrl}
                      onChange={(e) => setGifUrl(e.target.value)}
                      placeholder="https://media.giphy.com/media/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={loading}
                    />
                  </div>
                  <button
                    onClick={handleGifAdd}
                    disabled={loading || !gifUrl.trim()}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Custom GIF'}
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Import Tab */}
            {activeTab === 'bulk' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URLs (one per line)
                  </label>
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    placeholder={`https://youtube.com/watch?v=video1
https://media.giphy.com/media/gif1
https://youtube.com/watch?v=video2`}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Paste multiple YouTube or GIF URLs, one per line
                  </p>
                </div>
                <button
                  onClick={handleBulkImport}
                  disabled={loading || !bulkUrls.trim()}
                  className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : 'Import All URLs'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Tips for Content Balance</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Focus on adding <strong>videos first</strong> - currently at 0% (need 30%)</li>
            <li>• Add <strong>GIFs second</strong> - currently at 2.6% (need 25%)</li>
            <li>• Popular YouTube channels: Tasty, Food Network, Bon Appétit</li>
            <li>• Good Giphy search terms: &quot;hotdog&quot;, &quot;sausage&quot;, &quot;cooking&quot;, &quot;grilling&quot;</li>
            <li>• Manually added content gets high confidence scores and auto-approval</li>
            <li>• Each post type should represent quality hotdog content</li>
          </ul>
        </div>
      </div>
    </div>
  )
}