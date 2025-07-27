'use client'

import { useState } from 'react'

interface FilterPattern {
  id: number
  pattern_type: 'spam' | 'inappropriate' | 'unrelated' | 'required'
  pattern: string
  description: string
  is_regex: boolean
  is_enabled: boolean
  created_at: string
  updated_at: string
}

interface FilterSettingsProps {
  patterns: FilterPattern[]
  onPatternsUpdate: (patterns: FilterPattern[]) => Promise<void>
}

export function FilterSettings({ patterns, onPatternsUpdate }: FilterSettingsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedPatterns, setEditedPatterns] = useState<FilterPattern[]>(patterns)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'spam' | 'inappropriate' | 'unrelated' | 'required'>('spam')
  const [showAddForm, setShowAddForm] = useState(false)

  const [newPattern, setNewPattern] = useState({
    pattern: '',
    description: '',
    is_regex: false,
    is_enabled: true
  })

  const getPatternsByType = (type: string) => {
    return editedPatterns.filter(p => p.pattern_type === type)
  }

  const getPatternTypeInfo = (type: string) => {
    const info = {
      spam: { 
        icon: '🚫', 
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        description: 'Patterns that identify promotional, spam, or commercial content'
      },
      inappropriate: { 
        icon: '⚠️', 
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        description: 'Patterns that identify inappropriate, offensive, or harmful content'
      },
      unrelated: { 
        icon: '🔄', 
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        description: 'Patterns that identify content using "hotdog" in unrelated contexts'
      },
      required: { 
        icon: '✅', 
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        description: 'Patterns that identify valid hotdog-related content'
      }
    }
    return info[type] || info.spam
  }

  const handlePatternChange = (id: number, field: keyof FilterPattern, value: any) => {
    setEditedPatterns(prev => 
      prev.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      )
    )
  }

  const handleAddPattern = () => {
    if (!newPattern.pattern.trim()) {
      setError('Pattern cannot be empty')
      return
    }

    const pattern: FilterPattern = {
      id: Date.now(), // Temporary ID
      pattern_type: activeType,
      pattern: newPattern.pattern.trim(),
      description: newPattern.description.trim() || `${activeType} pattern`,
      is_regex: newPattern.is_regex,
      is_enabled: newPattern.is_enabled,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setEditedPatterns(prev => [...prev, pattern])
    setNewPattern({
      pattern: '',
      description: '',
      is_regex: false,
      is_enabled: true
    })
    setShowAddForm(false)
    setError(null)
  }

  const handleRemovePattern = (id: number) => {
    setEditedPatterns(prev => prev.filter(p => p.id !== id))
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)
      await onPatternsUpdate(editedPatterns)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditedPatterns(patterns)
    setIsEditing(false)
    setShowAddForm(false)
    setError(null)
  }

  const typeInfo = getPatternTypeInfo(activeType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Filter Patterns</h2>
          <p className="text-sm text-gray-600">
            Configure patterns for content filtering and validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-800 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Edit Patterns
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Type Selector */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['spam', 'inappropriate', 'unrelated', 'required'].map((type) => {
            const info = getPatternTypeInfo(type)
            const count = getPatternsByType(type).length
            return (
              <button
                key={type}
                onClick={() => setActiveType(type as typeof activeType)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeType === type
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{info.icon}</span>
                <span className="capitalize">{type}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Type Description */}
      <div className={`${typeInfo.bgColor} ${typeInfo.borderColor} border rounded-lg p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{typeInfo.icon}</span>
          <h3 className={`font-medium ${typeInfo.color} capitalize`}>
            {activeType} Patterns
          </h3>
        </div>
        <p className="text-sm text-gray-600">{typeInfo.description}</p>
      </div>

      {/* Add Pattern Form */}
      {isEditing && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Add New Pattern</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showAddForm ? 'Cancel' : '+ Add Pattern'}
            </button>
          </div>

          {showAddForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern
                  </label>
                  <input
                    type="text"
                    value={newPattern.pattern}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, pattern: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter pattern..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newPattern.description}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pattern description..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newPattern.is_regex}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, is_regex: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Regular Expression</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newPattern.is_enabled}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, is_enabled: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Enabled</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddPattern}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Add Pattern
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns List */}
      <div className="space-y-4">
        {getPatternsByType(activeType).map((pattern) => (
          <div key={pattern.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
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
                  <p className="text-sm text-gray-600 mb-2">{pattern.description}</p>
                )}
                
                <div className="text-xs text-gray-500">
                  Created: {new Date(pattern.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {isEditing && (
                  <>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={pattern.is_enabled}
                        onChange={(e) => handlePatternChange(pattern.id, 'is_enabled', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Enabled</span>
                    </label>
                    <button
                      onClick={() => handleRemovePattern(pattern.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {getPatternsByType(activeType).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No {activeType} patterns configured</p>
            {isEditing && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Add your first {activeType} pattern
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}