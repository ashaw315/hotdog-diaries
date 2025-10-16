/**
 * Design tokens for time slot badges in admin scheduling UX
 * Maps 6 daily time slots to themed badges with consistent styling
 */

export type TimeSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening' | 'late-night'

export interface BadgeTheme {
  label: string
  emoji: string
  background: string
  color: string
  border: string
  hoverBackground: string
  shadow: string
}

/**
 * Time slot mappings based on Eastern Time slots:
 * - 08:00 ET = Breakfast
 * - 12:00 ET = Lunch  
 * - 15:00 ET = Snack
 * - 18:00 ET = Dinner
 * - 21:00 ET = Evening
 * - 23:30 ET = Late-night
 */
export const TIME_SLOT_MAPPINGS: Record<string, TimeSlot> = {
  '08:00': 'breakfast',
  '12:00': 'lunch',
  '15:00': 'snack', 
  '18:00': 'dinner',
  '21:00': 'evening',
  '23:30': 'late-night'
}

export const SCHEDULE_BADGE_THEMES: Record<TimeSlot, BadgeTheme> = {
  breakfast: {
    label: 'Breakfast',
    emoji: '🌅',
    background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    color: '#9a3412',
    border: '#fdba74',
    hoverBackground: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
    shadow: 'rgba(251, 146, 60, 0.15)'
  },
  lunch: {
    label: 'Lunch',
    emoji: '☀️',
    background: 'linear-gradient(135deg, #fefce8 0%, #fde047 100%)',
    color: '#a16207',
    border: '#facc15',
    hoverBackground: 'linear-gradient(135deg, #fde047 0%, #eab308 100%)',
    shadow: 'rgba(250, 204, 21, 0.2)'
  },
  snack: {
    label: 'Snack',
    emoji: '🍎',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',
    color: '#166534',
    border: '#86efac',
    hoverBackground: 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)',
    shadow: 'rgba(134, 239, 172, 0.2)'
  },
  dinner: {
    label: 'Dinner',
    emoji: '🌆',
    background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)',
    color: '#92400e',
    border: '#f59e0b',
    hoverBackground: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    shadow: 'rgba(245, 158, 11, 0.2)'
  },
  evening: {
    label: 'Evening',
    emoji: '🌃',
    background: 'linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%)',
    color: '#3730a3',
    border: '#818cf8',
    hoverBackground: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)',
    shadow: 'rgba(129, 140, 248, 0.2)'
  },
  'late-night': {
    label: 'Late Night',
    emoji: '🌙',
    background: 'linear-gradient(135deg, #f3e8ff 0%, #c4b5fd 100%)',
    color: '#6b21a8',
    border: '#a78bfa',
    hoverBackground: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
    shadow: 'rgba(167, 139, 250, 0.2)'
  }
}

/**
 * Gets the appropriate time slot badge theme for a given time
 * @param timeString - Time in HH:MM format (24-hour)
 * @returns The time slot and theme
 */
export function getTimeSlotTheme(timeString: string): {
  slot: TimeSlot
  theme: BadgeTheme
} {
  const slot = TIME_SLOT_MAPPINGS[timeString] || 'snack' // fallback
  return {
    slot,
    theme: SCHEDULE_BADGE_THEMES[slot]
  }
}

/**
 * Converts UTC timestamp to Eastern Time and returns HH:MM format
 * @param utcTimestamp - ISO string or Date object
 * @returns HH:MM string in Eastern Time
 */
export function getETTimeString(utcTimestamp: string | Date): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp
  
  // Convert to Eastern Time (handles DST automatically)
  const etString = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  return etString
}

/**
 * CSS custom properties for badge styling
 */
export const BADGE_CSS_VARIABLES = `
  :root {
    --schedule-badge-border-radius: 0.5rem;
    --schedule-badge-padding: 0.375rem 0.75rem;
    --schedule-badge-font-size: 0.875rem;
    --schedule-badge-font-weight: 600;
    --schedule-badge-transition: all 0.2s ease;
    --schedule-badge-shadow-size: 0 1px 3px;
    --schedule-badge-hover-shadow-size: 0 2px 6px;
    --schedule-badge-hover-transform: translateY(-1px);
  }
`

/**
 * Base badge CSS class that can be extended with theme-specific styles
 */
export const BASE_BADGE_STYLES = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: 'var(--schedule-badge-padding)',
  borderRadius: 'var(--schedule-badge-border-radius)',
  fontSize: 'var(--schedule-badge-font-size)',
  fontWeight: 'var(--schedule-badge-font-weight)',
  transition: 'var(--schedule-badge-transition)',
  cursor: 'default',
  userSelect: 'none' as const,
  border: '1px solid',
  boxShadow: 'var(--schedule-badge-shadow-size) var(--badge-shadow-color, rgba(0, 0, 0, 0.1))'
}

/**
 * Generates inline styles for a specific time slot badge
 * @param slot - The time slot to style
 * @returns CSS properties object
 */
export function getBadgeStyles(slot: TimeSlot): React.CSSProperties {
  const theme = SCHEDULE_BADGE_THEMES[slot]
  
  return {
    ...BASE_BADGE_STYLES,
    background: theme.background,
    color: theme.color,
    borderColor: theme.border,
    '--badge-shadow-color': theme.shadow
  } as React.CSSProperties
}

/**
 * Generates hover styles for a specific time slot badge
 * @param slot - The time slot to style
 * @returns CSS properties object for hover state
 */
export function getBadgeHoverStyles(slot: TimeSlot): React.CSSProperties {
  const theme = SCHEDULE_BADGE_THEMES[slot]
  
  return {
    background: theme.hoverBackground,
    transform: 'var(--schedule-badge-hover-transform)',
    boxShadow: `var(--schedule-badge-hover-shadow-size) ${theme.shadow}`
  } as React.CSSProperties
}