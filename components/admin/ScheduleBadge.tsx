'use client'

import React, { useState } from 'react'
import { 
  getTimeSlotTheme, 
  getETTimeString, 
  getBadgeStyles, 
  getBadgeHoverStyles,
  BADGE_CSS_VARIABLES,
  type TimeSlot 
} from '@/lib/design-tokens/schedule-badges'

interface ScheduleBadgeProps {
  /** UTC timestamp (ISO string) or null for empty slot */
  scheduledTime?: string | null
  /** Optional override for manual time slot specification */
  timeSlot?: TimeSlot
  /** Show just the time without the themed badge */
  timeOnly?: boolean
  /** Additional CSS classes */
  className?: string
  /** Click handler for badge */
  onClick?: () => void
}

export function ScheduleBadge({ 
  scheduledTime, 
  timeSlot, 
  timeOnly = false,
  className = '',
  onClick 
}: ScheduleBadgeProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Handle empty slot case
  if (!scheduledTime && !timeSlot) {
    return (
      <span className={`schedule-badge-empty ${className}`}>
        <style jsx>{BADGE_CSS_VARIABLES}</style>
        <style jsx>{`
          .schedule-badge-empty {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: var(--schedule-badge-padding);
            border-radius: var(--schedule-badge-border-radius);
            font-size: var(--schedule-badge-font-size);
            font-weight: var(--schedule-badge-font-weight);
            background: #f9fafb;
            color: #6b7280;
            border: 1px dashed #d1d5db;
            cursor: default;
          }
        `}</style>
        ⏸️ Unscheduled
      </span>
    )
  }

  // Get ET time string and theme
  const etTime = scheduledTime ? getETTimeString(scheduledTime) : '00:00'
  const { slot, theme } = timeSlot 
    ? { slot: timeSlot, theme: getTimeSlotTheme('12:00').theme } // fallback theme if manual slot
    : getTimeSlotTheme(etTime)

  // Time-only mode
  if (timeOnly) {
    return (
      <span className={`schedule-time-only ${className}`}>
        <style jsx>{`
          .schedule-time-only {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            font-size: 0.875rem;
            font-weight: 600;
            color: #374151;
            letter-spacing: 0.05em;
          }
        `}</style>
        {etTime}
      </span>
    )
  }

  // Get styles
  const baseStyles = getBadgeStyles(slot)
  const hoverStyles = isHovered ? getBadgeHoverStyles(slot) : {}
  const finalStyles = { ...baseStyles, ...hoverStyles }

  return (
    <span 
      className={`schedule-badge ${className}`}
      style={finalStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : 'text'}
      tabIndex={onClick ? 0 : undefined}
      data-testid="schedule-badge"
    >
      <style jsx global>{BADGE_CSS_VARIABLES}</style>
      
      <span aria-hidden="true">{theme.emoji}</span>
      <span className="badge-time">{etTime}</span>
      <span className="badge-label">{theme.label}</span>
    </span>
  )
}

interface ScheduleBadgeGridProps {
  /** Array of scheduled times for the 6 daily slots */
  scheduledTimes: (string | null)[]
  /** Optional click handlers for each slot */
  onSlotClick?: (slotIndex: number) => void
  /** Show slot indices for debugging */
  showSlotIndex?: boolean
}

/**
 * Grid component showing all 6 daily time slots with badges
 */
export function ScheduleBadgeGrid({ 
  scheduledTimes, 
  onSlotClick,
  showSlotIndex = false
}: ScheduleBadgeGridProps) {
  // Standard 6 time slots in ET
  const standardSlots = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30']
  
  return (
    <div className="schedule-badge-grid">
      <style jsx>{`
        .schedule-badge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
          align-items: center;
        }
        
        .slot-container {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          align-items: flex-start;
        }
        
        .slot-index {
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 500;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        }
        
        @media (max-width: 768px) {
          .schedule-badge-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .schedule-badge-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      
      {standardSlots.map((standardTime, index) => {
        const scheduledTime = scheduledTimes[index]
        const actualTime = scheduledTime ? getETTimeString(scheduledTime) : standardTime
        
        return (
          <div key={index} className="slot-container">
            {showSlotIndex && (
              <span className="slot-index">Slot {index}</span>
            )}
            <ScheduleBadge
              scheduledTime={scheduledTime}
              timeSlot={getTimeSlotTheme(actualTime).slot}
              onClick={onSlotClick ? () => onSlotClick(index) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}