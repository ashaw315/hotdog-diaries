'use client'

import { useState } from 'react'

interface TwitterConfig {
  isEnabled: boolean
  scanInterval: number
  maxTweetsPerScan: number
  searchQueries: string[]
  excludeRetweets: boolean
  excludeReplies: boolean
  minEngagementThreshold: number
}

interface TwitterConfigFormProps {
  config: TwitterConfig
  onUpdate: (config: TwitterConfig) => Promise<void>
  isConnected: boolean
}

export default function TwitterConfigForm({ config, onUpdate, isConnected }: TwitterConfigFormProps) {
  const [formData, setFormData] = useState<TwitterConfig>(config)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newQuery, setNewQuery] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      await onUpdate(formData)
    } catch (error) {
      console.error('Failed to update configuration:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddQuery = () => {
    if (newQuery.trim() && !formData.searchQueries.includes(newQuery.trim())) {
      setFormData(prev => ({
        ...prev,
        searchQueries: [...prev.searchQueries, newQuery.trim()]
      }))
      setNewQuery('')
    }
  }

  const handleRemoveQuery = (index: number) => {
    setFormData(prev => ({
      ...prev,
      searchQueries: prev.searchQueries.filter((_, i) => i !== index)
    }))
  }

  const defaultQueries = [
    '(hotdog OR "hot dog" OR hotdogs OR "hot dogs") -is:retweet -is:reply lang:en',
    '#hotdog OR #hotdogs OR #nationalhotdogday -is:retweet -is:reply lang:en',
    '("hotdog" OR "hot dog") (delicious OR tasty OR amazing OR perfect) -is:retweet -is:reply has:media lang:en',
    '("hotdog" OR "hot dog") (chicago OR "coney island" OR "new york") -is:retweet -is:reply lang:en',
    '("hotdog" OR "hot dog") (bbq OR barbecue OR grill OR grilling) -is:retweet -is:reply has:media lang:en'
  ]

  const handleResetToDefaults = () => {
    setFormData(prev => ({
      ...prev,
      searchQueries: [...defaultQueries]
    }))
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Enable/Disable Twitter Scanning */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Twitter Scanning</h3>
            <p className="text-sm text-gray-600">
              Enable automatic scanning of Twitter for hotdog content
            </p>
            {!isConnected && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ Twitter API connection required to enable scanning
              </p>
            )}
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isEnabled}
              onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
              disabled={!isConnected}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
          </label>
        </div>

        {/* Scan Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scan Interval (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={formData.scanInterval}
              onChange={(e) => setFormData(prev => ({ ...prev, scanInterval: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to scan for new content (5-1440 minutes)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Tweets per Scan
            </label>
            <input
              type="number"
              min="10"
              max="100"
              value={formData.maxTweetsPerScan}
              onChange={(e) => setFormData(prev => ({ ...prev, maxTweetsPerScan: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum tweets to process per scan (10-100)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Engagement Threshold
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.minEngagementThreshold}
              onChange={(e) => setFormData(prev => ({ ...prev, minEngagementThreshold: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum likes + retweets + replies required
            </p>
          </div>
        </div>

        {/* Content Filters */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Content Filters</h3>
          
          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.excludeRetweets}
                onChange={(e) => setFormData(prev => ({ ...prev, excludeRetweets: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Exclude Retweets</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.excludeReplies}
                onChange={(e) => setFormData(prev => ({ ...prev, excludeReplies: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Exclude Replies</span>
            </label>
          </div>
        </div>

        {/* Search Queries */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Search Queries</h3>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Reset to Defaults
            </button>
          </div>
          
          <p className="text-sm text-gray-600">
            Configure Twitter search queries to find hotdog content. Use Twitter search operators for better results.
          </p>

          <div className="space-y-3">
            {formData.searchQueries.map((query, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const newQueries = [...formData.searchQueries]
                    newQueries[index] = e.target.value
                    setFormData(prev => ({ ...prev, searchQueries: newQueries }))
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveQuery(index)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove query"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="Add new search query..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddQuery()
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddQuery}
              disabled={!newQuery.trim()}
              className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Add
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Search Query Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use <code>OR</code> for multiple terms: <code>hotdog OR "hot dog"</code></li>
              <li>• Use <code>-is:retweet</code> to exclude retweets</li>
              <li>• Use <code>-is:reply</code> to exclude replies</li>
              <li>• Use <code>has:media</code> to find tweets with images/videos</li>
              <li>• Use <code>lang:en</code> to filter by language</li>
              <li>• Use quotes for exact phrases: <code>"hot dog"</code></li>
            </ul>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => setFormData(config)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  )
}