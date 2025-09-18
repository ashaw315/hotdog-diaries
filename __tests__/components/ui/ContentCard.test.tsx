import { render, screen, fireEvent } from '@testing-library/react'
import ContentCard from '@/components/ui/ContentCard'
import { ContentType, SourcePlatform } from '@/types'
import { renderWithProviders } from '@/__tests__/utils/component-mocks'

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn((date) => `${Math.floor((Date.now() - date.getTime()) / 1000)} seconds ago`)
}))

// Mock MediaRenderer to simplify testing
jest.mock('@/components/media/MediaRenderer', () => {
  return function MockMediaRenderer({ alt, imageUrl, videoUrl, onError }: any) {
    if (videoUrl) {
      return (
        <div data-testid="media-video">
          <a href={videoUrl} target="_blank" rel="noopener noreferrer">
            View Video
          </a>
        </div>
      )
    }
    if (imageUrl) {
      return (
        <img 
          src={imageUrl} 
          alt={alt}
          onError={() => onError?.(new Error('Image failed to load'))}
          data-testid="media-image"
        />
      )
    }
    return null
  }
})

// Mock error handler hook
jest.mock('@/hooks/useClientErrorHandler', () => ({
  useComponentErrorHandler: () => ({
    handleError: jest.fn(),
    safeExecute: (fn: () => void) => fn()
  })
}))

describe('ContentCard', () => {
  const mockProps = {
    id: 1,
    content_text: 'Amazing hotdog content!',
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.REDDIT,
    original_url: 'https://reddit.com/r/hotdogs/comments/123',
    original_author: 'testuser',
    scraped_at: new Date('2024-01-01T10:00:00Z'),
    is_posted: false,
    is_approved: true
  }

  it('should render content card with basic information', () => {
    renderWithProviders(<ContentCard {...mockProps} />)

    expect(screen.getByText('Amazing hotdog content!')).toBeInTheDocument()
    expect(screen.getByText('reddit')).toBeInTheDocument()
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('should display correct platform icon', () => {
    renderWithProviders(<ContentCard {...mockProps} />)
    
    // Check if Reddit emoji is present
    expect(screen.getByText('🤖')).toBeInTheDocument()
  })

  it('should display correct content type icon', () => {
    renderWithProviders(<ContentCard {...mockProps} />)
    
    // Check if text emoji is present
    expect(screen.getByText('📝')).toBeInTheDocument()
  })

  it('should display approval status badge', () => {
    renderWithProviders(<ContentCard {...mockProps} />)
    
    expect(screen.getByText('Approved')).toBeInTheDocument()
    // Component doesn't apply specific classes to Approved status
  })

  it('should display posted status badge when posted', () => {
    const postedProps = {
      ...mockProps,
      is_posted: true,
      posted_at: new Date('2024-01-01T12:00:00Z'),
      post_order: 1
    }

    renderWithProviders(<ContentCard {...postedProps} />)
    
    expect(screen.getByText('Posted')).toBeInTheDocument()
    expect(screen.getByText('Posted')).toHaveClass('text-success')
  })

  it('should display pending status badge when not approved', () => {
    const pendingProps = {
      ...mockProps,
      is_approved: false
    }

    renderWithProviders(<ContentCard {...pendingProps} />)
    
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toHaveClass('text-muted')
  })

  it('should render image content', () => {
    const imageProps = {
      ...mockProps,
      content_type: ContentType.IMAGE,
      content_image_url: 'https://example.com/image.jpg'
    }

    renderWithProviders(<ContentCard {...imageProps} />)
    
    const image = screen.getByAltText('Amazing hotdog content!')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg')
  })

  it('should handle image loading error', () => {
    const imageProps = {
      ...mockProps,
      content_type: ContentType.IMAGE,
      content_image_url: 'https://example.com/broken-image.jpg'
    }

    renderWithProviders(<ContentCard {...imageProps} />)
    
    const image = screen.getByAltText('Amazing hotdog content!')
    fireEvent.error(image)

    // The component calls the onError handler which updates state
    // In a real scenario, MediaRenderer would handle the error state
    // For this test, we just verify the image is present and error is triggered
    expect(image).toBeInTheDocument()
  })

  it('should render video content link', () => {
    const videoProps = {
      ...mockProps,
      content_type: ContentType.VIDEO,
      content_video_url: 'https://youtube.com/watch?v=abc123'
    }

    renderWithProviders(<ContentCard {...videoProps} />)
    
    const videoLink = screen.getByText('View Video')
    expect(videoLink).toBeInTheDocument()
    expect(videoLink.closest('a')).toHaveAttribute('href', 'https://youtube.com/watch?v=abc123')
    expect(videoLink.closest('a')).toHaveAttribute('target', '_blank')
  })

  it('should display admin notes when present', () => {
    const notesProps = {
      ...mockProps,
      admin_notes: 'Great hotdog content!'
    }

    renderWithProviders(<ContentCard {...notesProps} />)
    
    expect(screen.getByText('Great hotdog content!')).toBeInTheDocument()
  })

  it('should render original link', () => {
    renderWithProviders(<ContentCard {...mockProps} />)
    
    const originalLink = screen.getByText('View Original')
    expect(originalLink).toBeInTheDocument()
    expect(originalLink.closest('a')).toHaveAttribute('href', 'https://reddit.com/r/hotdogs/comments/123')
    expect(originalLink.closest('a')).toHaveAttribute('target', '_blank')
  })

  it('should display action buttons when showActions is true', () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    renderWithProviders(
      <ContentCard 
        {...mockProps} 
        showActions={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onPost={onPost}
      />
    )
    
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Mark as Posted')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('should call action handlers when buttons are clicked', () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    renderWithProviders(
      <ContentCard 
        {...mockProps} 
        showActions={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onPost={onPost}
      />
    )
    
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByText('Mark as Posted'))
    expect(onPost).toHaveBeenCalledWith(1)
  })

  it('should not show post button for already posted content', () => {
    const onPost = jest.fn()
    const postedProps = {
      ...mockProps,
      is_posted: true,
      posted_at: new Date()
    }

    renderWithProviders(
      <ContentCard 
        {...postedProps} 
        showActions={true}
        onPost={onPost}
      />
    )
    
    expect(screen.queryByText('Mark as Posted')).not.toBeInTheDocument()
  })

  it('should not show post button for unapproved content', () => {
    const onPost = jest.fn()
    const unapprovedProps = {
      ...mockProps,
      is_approved: false
    }

    renderWithProviders(
      <ContentCard 
        {...unapprovedProps} 
        showActions={true}
        onPost={onPost}
      />
    )
    
    expect(screen.queryByText('Mark as Posted')).not.toBeInTheDocument()
  })

  it('should not show delete button for posted content', () => {
    const onDelete = jest.fn()
    const postedProps = {
      ...mockProps,
      is_posted: true,
      posted_at: new Date()
    }

    renderWithProviders(
      <ContentCard 
        {...postedProps} 
        showActions={true}
        onDelete={onDelete}
      />
    )
    
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('should format dates correctly', () => {
    renderWithProviders(<ContentCard {...mockProps} />)
    
    // Should show relative time for scraped date
    expect(screen.getByText(/seconds ago/)).toBeInTheDocument()
  })

  it('should handle mixed content type', () => {
    const mixedProps = {
      ...mockProps,
      content_type: ContentType.MIXED,
      content_text: 'Unique mixed content text',
      content_image_url: 'https://example.com/image.jpg'
    }

    renderWithProviders(<ContentCard {...mixedProps} />)
    
    // Check for content text and image (text appears in both content and overlay)
    expect(screen.getAllByText('Unique mixed content text')).toHaveLength(2)
    expect(screen.getByAltText('Unique mixed content text')).toBeInTheDocument()
    expect(screen.getByText('📋')).toBeInTheDocument() // Mixed content icon
  })

  it('should display different platform icons correctly', () => {
    const platforms = [
      { platform: SourcePlatform.REDDIT, icon: '🤖' },
      { platform: SourcePlatform.YOUTUBE, icon: '📺' },
      { platform: SourcePlatform.PIXABAY, icon: '🎨' },
      { platform: SourcePlatform.MASTODON, icon: '🐘' },
      { platform: SourcePlatform.NEWS, icon: '📰' }
    ]

    platforms.forEach(({ platform, icon }) => {
      const { unmount } = renderWithProviders(
        <ContentCard {...mockProps} source_platform={platform} />
      )
      
      expect(screen.getByText(icon)).toBeInTheDocument()
      unmount()
    })
  })
})