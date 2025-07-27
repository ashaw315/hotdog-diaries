'use client'

import { useState } from 'react'

interface FilterPattern {
  id: number
  pattern_type: 'spam' | 'inappropriate' | 'unrelated' | 'required'
  pattern: string
  description: string
  is_regex: boolean
  is_enabled: boolean
}

interface FilterTesterProps {
  patterns: FilterPattern[]
}

interface TestResult {
  pattern: FilterPattern
  matches: boolean
  matchedText?: string
  error?: string
}

export function FilterTester({ patterns }: FilterTesterProps) {
  const [testText, setTestText] = useState('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<'all' | 'spam' | 'inappropriate' | 'unrelated' | 'required'>('all')

  const testSamples = [
    {
      label: 'Valid Hotdog Content',
      text: 'Just got the most amazing hotdog from the street vendor! The mustard and sauerkraut combination was perfect. #hotdog #streetfood',
      type: 'valid'
    },
    {
      label: 'Spam Content',
      text: 'Buy now! Limited time offer on hotdog products! Get 50% off with promo code HOTDOG50. Click here to order today!',
      type: 'spam'
    },
    {
      label: 'Inappropriate Content',
      text: 'This fucking hotdog is shit, but damn it tastes good. Hell yeah!',
      type: 'inappropriate'
    },
    {
      label: 'Unrelated Content',
      text: 'Hotdog, that was an amazing movie! I can\'t believe how good it was. Hotdog, seriously!',
      type: 'unrelated'
    },
    {
      label: 'No Hotdog Reference',
      text: 'Just had a great sandwich for lunch. The turkey and cheese was delicious with some mustard.',
      type: 'no_hotdog'
    }
  ]

  const handleTest = async () => {
    if (!testText.trim()) {
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/admin/filters/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          patternType: selectedType === 'all' ? null : selectedType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to test filters')
      }

      const results = await response.json()
      setTestResults(results.results || [])
    } catch (error) {
      console.error('Filter test failed:', error)
      setTestResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSampleTest = (sampleText: string) => {
    setTestText(sampleText)
  }

  const getFilteredPatterns = () => {
    if (selectedType === 'all') {
      return patterns
    }
    return patterns.filter(p => p.pattern_type === selectedType)
  }

  const getPatternTypeColor = (type: string) => {
    const colors = {
      spam: 'text-red-600',
      inappropriate: 'text-orange-600',
      unrelated: 'text-yellow-600',
      required: 'text-green-600'
    }
    return colors[type] || 'text-gray-600'
  }

  const getPatternTypeIcon = (type: string) => {
    const icons = {
      spam: '🚫',
      inappropriate: '⚠️',
      unrelated: '🔄',
      required: '✅'
    }
    return icons[type] || '📄'
  }

  const getResultColor = (matches: boolean, patternType: string) => {
    if (matches) {
      return patternType === 'required' ? 'text-green-600' : 'text-red-600'
    }
    return 'text-gray-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Filter Pattern Tester</h2>
        <p className="text-sm text-gray-600">
          Test filter patterns against sample content to validate their effectiveness
        </p>
      </div>

      {/* Test Input */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Content
            </label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Enter content to test against filter patterns..."
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Patterns</option>
                <option value="spam">Spam Only</option>
                <option value="inappropriate">Inappropriate Only</option>
                <option value="unrelated">Unrelated Only</option>
                <option value="required">Required Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleTest}
                disabled={loading || !testText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Filters'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Tests */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Test Cases</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testSamples.map((sample, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{sample.label}</h4>
                <button
                  onClick={() => handleSampleTest(sample.text)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Use Sample
                </button>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{sample.text}</p>
              <div className="mt-2">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  sample.type === 'valid' ? 'bg-green-100 text-green-800' :
                  sample.type === 'spam' ? 'bg-red-100 text-red-800' :
                  sample.type === 'inappropriate' ? 'bg-orange-100 text-orange-800' :
                  sample.type === 'unrelated' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {sample.type.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Test Results</h3>
          
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getPatternTypeIcon(result.pattern.pattern_type)}
                    </span>
                    <span className={`font-medium ${getPatternTypeColor(result.pattern.pattern_type)}`}>
                      {result.pattern.pattern_type.toUpperCase()}
                    </span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                      {result.pattern.pattern}
                    </code>
                    {result.pattern.is_regex && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        REGEX
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${getResultColor(result.matches, result.pattern.pattern_type)}`}>
                      {result.matches ? 'MATCH' : 'NO MATCH'}
                    </span>
                    {result.matches && (
                      <span className="text-lg">
                        {result.pattern.pattern_type === 'required' ? '✅' : '❌'}
                      </span>
                    )}
                  </div>
                </div>
                
                {result.pattern.description && (
                  <p className="text-sm text-gray-600 mb-2">{result.pattern.description}</p>
                )}
                
                {result.matchedText && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                    <span className="text-sm font-medium text-yellow-800">Matched Text: </span>
                    <code className="text-sm text-yellow-900">{result.matchedText}</code>
                  </div>
                )}
                
                {result.error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <span className="text-sm font-medium text-red-800">Error: </span>
                    <span className="text-sm text-red-900">{result.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Test Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Patterns:</span>
                <span className="ml-2 font-medium">{testResults.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Matches:</span>
                <span className="ml-2 font-medium text-red-600">
                  {testResults.filter(r => r.matches).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">No Matches:</span>
                <span className="ml-2 font-medium text-green-600">
                  {testResults.filter(r => !r.matches).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Errors:</span>
                <span className="ml-2 font-medium text-orange-600">
                  {testResults.filter(r => r.error).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pattern List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Available Patterns ({getFilteredPatterns().length})
        </h3>
        
        <div className="space-y-2">
          {getFilteredPatterns().map((pattern) => (
            <div key={pattern.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getPatternTypeIcon(pattern.pattern_type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded text-sm font-mono">
                      {pattern.pattern}
                    </code>
                    {pattern.is_regex && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        REGEX
                      </span>
                    )}
                    {!pattern.is_enabled && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                        DISABLED
                      </span>
                    )}
                  </div>
                  {pattern.description && (
                    <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
                  )}
                </div>
              </div>
              <span className={`text-sm font-medium ${getPatternTypeColor(pattern.pattern_type)}`}>
                {pattern.pattern_type.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}