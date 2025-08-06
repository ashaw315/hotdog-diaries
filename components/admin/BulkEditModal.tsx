'use client'

import { useState } from 'react'

interface BulkEditModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  onBulkEdit: (changes: BulkEditChanges) => Promise<void>
}

interface BulkEditChanges {
  action: 'status' | 'schedule' | 'archive' | 'text_edit'
  // Status changes
  content_status?: 'approved' | 'rejected' | 'archived'
  rejection_reason?: string
  // Scheduling
  scheduleType?: 'immediate' | 'next_meal' | 'distribute' | 'custom'
  customDateTime?: string
  distributionHours?: number
  // Text editing
  textOperation?: 'prefix' | 'suffix' | 'replace' | 'find_replace'
  textValue?: string
  findText?: string
  replaceText?: string
}

export function BulkEditModal({ isOpen, onClose, selectedCount, onBulkEdit }: BulkEditModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'schedule' | 'text'>('status')
  const [isLoading, setIsLoading] = useState(false)

  // Status tab state
  const [statusAction, setStatusAction] = useState<'approved' | 'rejected' | 'archived'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')

  // Schedule tab state
  const [scheduleType, setScheduleType] = useState<'immediate' | 'next_meal' | 'distribute' | 'custom'>('next_meal')
  const [customDateTime, setCustomDateTime] = useState('')
  const [distributionHours, setDistributionHours] = useState(24)

  // Text tab state
  const [textOperation, setTextOperation] = useState<'prefix' | 'suffix' | 'replace' | 'find_replace'>('prefix')
  const [textValue, setTextValue] = useState('')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      let changes: BulkEditChanges

      switch (activeTab) {
        case 'status':
          changes = {
            action: 'status',
            content_status: statusAction,
            rejection_reason: statusAction === 'rejected' ? rejectionReason : undefined
          }
          break

        case 'schedule':
          changes = {
            action: 'schedule',
            scheduleType,
            customDateTime: scheduleType === 'custom' ? customDateTime : undefined,
            distributionHours: scheduleType === 'distribute' ? distributionHours : undefined
          }
          break

        case 'text':
          changes = {
            action: 'text_edit',
            textOperation,
            textValue: textOperation !== 'find_replace' ? textValue : undefined,
            findText: textOperation === 'find_replace' ? findText : undefined,
            replaceText: textOperation === 'find_replace' ? replaceText : undefined
          }
          break

        default:
          throw new Error('Invalid tab')
      }

      await onBulkEdit(changes)
      onClose()
    } catch (error) {
      console.error('Bulk edit failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Bulk Edit ({selectedCount} items)
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { key: 'status', label: '📊 Status Changes', icon: '📊' },
                { key: 'schedule', label: '📅 Scheduling', icon: '📅' },
                { key: 'text', label: '✏️ Text Editing', icon: '✏️' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Status Tab */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Action
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'approved', label: '✅ Approve All', description: 'Mark all selected content as approved' },
                      { value: 'rejected', label: '❌ Reject All', description: 'Mark all selected content as rejected' },
                      { value: 'archived', label: '📦 Archive All', description: 'Archive all selected content' }
                    ].map(option => (
                      <label key={option.value} className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="statusAction"
                          value={option.value}
                          checked={statusAction === option.value}
                          onChange={(e) => setStatusAction(e.target.value as any)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {statusAction === 'rejected' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason
                    </label>
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter reason for rejection..."
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Type
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'immediate', label: '⚡ Immediate', description: 'Schedule for posting in the next few minutes' },
                      { value: 'next_meal', label: '🍽️ Next Meal Time', description: 'Schedule for the next meal time (7am, 12pm, 3pm, 6pm, 8pm, 10pm)' },
                      { value: 'distribute', label: '📈 Distribute Over Time', description: 'Spread posts evenly over a time period' },
                      { value: 'custom', label: '🎯 Custom Time', description: 'Set a specific start time' }
                    ].map(option => (
                      <label key={option.value} className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="scheduleType"
                          value={option.value}
                          checked={scheduleType === option.value}
                          onChange={(e) => setScheduleType(e.target.value as any)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {scheduleType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min={new Date().toISOString().slice(0, 16)}
                      required
                    />
                  </div>
                )}

                {scheduleType === 'distribute' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distribution Period (hours)
                    </label>
                    <input
                      type="number"
                      value={distributionHours}
                      onChange={(e) => setDistributionHours(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="168"
                      required
                    />
                    <div className="text-sm text-gray-500 mt-1">
                      Content will be spread evenly over {distributionHours} hours
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text Tab */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Operation
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'prefix', label: '📝 Add Prefix', description: 'Add text to the beginning of all content' },
                      { value: 'suffix', label: '📝 Add Suffix', description: 'Add text to the end of all content' },
                      { value: 'replace', label: '🔄 Replace All Text', description: 'Replace entire content text' },
                      { value: 'find_replace', label: '🔍 Find & Replace', description: 'Find specific text and replace it' }
                    ].map(option => (
                      <label key={option.value} className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="textOperation"
                          value={option.value}
                          checked={textOperation === option.value}
                          onChange={(e) => setTextOperation(e.target.value as any)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {textOperation !== 'find_replace' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Text Content
                    </label>
                    <textarea
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                      placeholder={
                        textOperation === 'prefix' ? 'Text to add at the beginning...' :
                        textOperation === 'suffix' ? 'Text to add at the end...' :
                        'New text content...'
                      }
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Find Text
                      </label>
                      <input
                        type="text"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Text to find..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Replace With
                      </label>
                      <input
                        type="text"
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Replacement text..."
                        required
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : `Apply to ${selectedCount} Items`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}