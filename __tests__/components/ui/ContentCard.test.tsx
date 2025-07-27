import { render, screen, fireEvent } from '@testing-library/react'
import ContentCard from '@/components/ui/ContentCard'
import { ContentType, SourcePlatform } from '@/types'

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn((date) => `${Math.floor((Date.now() - date.getTime()) / 1000)} seconds ago`)
}))

describe('ContentCard', () => {
  const mockProps = {
    id: 1,
    content_text: 'Amazing hotdog content!',
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.TWITTER,
    original_url: 'https://twitter.com/user/status/123',
    original_author: 'testuser',
    scraped_at: new Date('2024-01-01T10:00:00Z'),
    is_posted: false,
    is_approved: true
  }

  it('should render content card with basic information', () => {
    render(<ContentCard {...mockProps} />)

    expect(screen.getByText('Amazing hotdog content!')).toBeInTheDocument()
    expect(screen.getByText('twitter')).toBeInTheDocument()
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('should display correct platform icon', () => {
    render(<ContentCard {...mockProps} />)
    
    // Check if Twitter emoji is present
    expect(screen.getByText('🐦')).toBeInTheDocument()
  })

  it('should display correct content type icon', () => {
    render(<ContentCard {...mockProps} />)
    
    // Check if text emoji is present
    expect(screen.getByText('📝')).toBeInTheDocument()
  })

  it('should display approval status badge', () => {
    render(<ContentCard {...mockProps} />)
    
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('should display posted status badge when posted', () => {
    const postedProps = {
      ...mockProps,
      is_posted: true,
      posted_at: new Date('2024-01-01T12:00:00Z'),
      post_order: 1
    }

    render(<ContentCard {...postedProps} />)
    
    expect(screen.getByText('Posted')).toBeInTheDocument()
    expect(screen.getByText('Posted')).toHaveClass('bg-green-100', 'text-green-800')
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('should display pending status badge when not approved', () => {
    const pendingProps = {
      ...mockProps,
      is_approved: false
    }

    render(<ContentCard {...pendingProps} />)
    
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toHaveClass('bg-yellow-100', 'text-yellow-800')
  })

  it('should render image content', () => {
    const imageProps = {
      ...mockProps,
      content_type: ContentType.IMAGE,
      content_image_url: 'https://example.com/image.jpg'
    }

    render(<ContentCard {...imageProps} />)
    
    const image = screen.getByAltText('Content image')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg')
  })

  it('should handle image loading error', () => {
    const imageProps = {
      ...mockProps,
      content_type: ContentType.IMAGE,
      content_image_url: 'https://example.com/broken-image.jpg'
    }

    render(<ContentCard {...imageProps} />)
    
    const image = screen.getByAltText('Content image')
    fireEvent.error(image)

    // Image should be hidden after error
    expect(image).toHaveClass('hidden')
  })

  it('should render video content link', () => {
    const videoProps = {
      ...mockProps,
      content_type: ContentType.VIDEO,
      content_video_url: 'https://youtube.com/watch?v=abc123'
    }

    render(<ContentCard {...videoProps} />)
    
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

    render(<ContentCard {...notesProps} />)
    
    expect(screen.getByText('Great hotdog content!')).toBeInTheDocument()
  })

  it('should render original link', () => {
    render(<ContentCard {...mockProps} />)
    
    const originalLink = screen.getByText('View Original')
    expect(originalLink).toBeInTheDocument()
    expect(originalLink.closest('a')).toHaveAttribute('href', 'https://twitter.com/user/status/123')
    expect(originalLink.closest('a')).toHaveAttribute('target', '_blank')
  })

  it('should display action buttons when showActions is true', () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    render(
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

    render(
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

    render(
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

    render(
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

    render(
      <ContentCard 
        {...postedProps} 
        showActions={true}
        onDelete={onDelete}
      />
    )
    
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('should format dates correctly', () => {
    render(<ContentCard {...mockProps} />)
    
    // Should show relative time for scraped date
    expect(screen.getByText(/seconds ago/)).toBeInTheDocument()
  })

  it('should handle mixed content type', () => {
    const mixedProps = {
      ...mockProps,
      content_type: ContentType.MIXED,
      content_text: 'Mixed content',
      content_image_url: 'https://example.com/image.jpg'
    }

    render(<ContentCard {...mixedProps} />)
    
    expect(screen.getByText('Mixed content')).toBeInTheDocument()
    expect(screen.getByAltText('Content image')).toBeInTheDocument()
    expect(screen.getByText('📋')).toBeInTheDocument() // Mixed content icon
  })

  it('should display different platform icons correctly', () => {
    const platforms = [
      { platform: SourcePlatform.INSTAGRAM, icon: '📷' },
      { platform: SourcePlatform.FACEBOOK, icon: '👥' },
      { platform: SourcePlatform.REDDIT, icon: '🤖' },
      { platform: SourcePlatform.TIKTOK, icon: '🎵' }
    ]

    platforms.forEach(({ platform, icon }) => {
      const { unmount } = render(
        <ContentCard {...mockProps} source_platform={platform} />
      )
      
      expect(screen.getByText(icon)).toBeInTheDocument()
      unmount()
    })
  })
})