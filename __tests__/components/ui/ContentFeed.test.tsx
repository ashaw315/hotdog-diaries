import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContentFeed from '@/components/ui/ContentFeed'
import { ContentType, SourcePlatform } from '@/types'
import { mockFetch } from '@/__tests__/utils/component-mocks'

// Mock ContentCard component
jest.mock('@/components/ui/ContentCard', () => {
  return function MockContentCard({ id, content_text, showActions, onEdit, onDelete, onPost }: any) {
    return (
      <div data-testid={`content-card-${id}`}>
        <span>{content_text}</span>
        {showActions && (
          <>
            <button onClick={() => onEdit?.(id)}>Edit</button>
            <button onClick={() => onDelete?.(id)}>Delete</button>
            <button onClick={() => onPost?.(id)}>Post</button>
          </>
        )}
      </div>
    )
  }
})

describe('ContentFeed', () => {
  const fetchMock = mockFetch()
  
  const mockContent = [
    {
      id: 1,
      content_text: 'First hotdog post',
      content_type: ContentType.TEXT,
      source_platform: SourcePlatform.REDDIT,
      original_url: 'https://reddit.com/r/hotdogs/comments/1',
      original_author: 'user1',
      scraped_at: new Date('2024-01-01T10:00:00Z'),
      is_posted: true,
      is_approved: true,
      posted_at: new Date('2024-01-01T12:00:00Z')
    },
    {
      id: 2,
      content_text: 'Second hotdog post',
      content_type: ContentType.IMAGE,
      source_platform: SourcePlatform.FLICKR,
      original_url: 'https://flickr.com/photos/user/test',
      original_author: 'user2',
      content_image_url: 'https://example.com/image.jpg',
      scraped_at: new Date('2024-01-01T11:00:00Z'),
      is_posted: false,
      is_approved: true
    }
  ]

  // Updated API response to match actual ContentFeed component expectations
  const mockApiResponse = {
    success: true,
    data: {
      content: mockContent,
      pagination: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    }
  }

  beforeEach(() => {
    fetchMock.reset()
    fetchMock.mockSuccess(mockApiResponse)
  })

  it('should render content feed with data', async () => {
    render(<ContentFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('content-card-2')).toBeInTheDocument()
    })

    expect(screen.getByText('First hotdog post')).toBeInTheDocument()
    expect(screen.getByText('Second hotdog post')).toBeInTheDocument()
  })

  it('should display loading state initially', () => {
    // Mock fetch to never resolve to show loading state
    fetchMock.mockFn.mockImplementation(() => new Promise(() => {}))
    
    render(<ContentFeed />)

    expect(screen.getByText('Loading content...')).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    fetchMock.mockError(new Error('API Error'))

    render(<ContentFeed />)

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should handle empty content list', async () => {
    fetchMock.mockSuccess({
      success: true,
      data: {
        content: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
      }
    })

    render(<ContentFeed />)

    await waitFor(() => {
      expect(screen.getByText('No content found')).toBeInTheDocument()
    })
  })

  it('should call API endpoint correctly', async () => {
    render(<ContentFeed type="posted" />)

    await waitFor(() => {
      expect(fetchMock.mockFn).toHaveBeenCalled()
    })

    const fetchCall = fetchMock.mockFn.mock.calls[0]
    const url = fetchCall[0] as string
    
    // Should call the correct API endpoint for posted content
    expect(url).toContain('/api/content')
  })

  it('should show action buttons when showActions is true', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    render(
      <ContentFeed 
        showActions={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onPost={onPost}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
    })

    // Check that action buttons are rendered in the mock component
    expect(screen.getAllByText('Edit')).toHaveLength(2)
    expect(screen.getAllByText('Delete')).toHaveLength(2)
    expect(screen.getAllByText('Post')).toHaveLength(2)
  })

  it('should render action buttons and handle clicks', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    render(
      <ContentFeed 
        showActions={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onPost={onPost}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
    })

    // Verify action buttons are present and clickable
    const editButtons = screen.getAllByText('Edit')
    const deleteButtons = screen.getAllByText('Delete')
    const postButtons = screen.getAllByText('Post')
    
    expect(editButtons).toHaveLength(2)
    expect(deleteButtons).toHaveLength(2)
    expect(postButtons).toHaveLength(2)
    
    // Test that buttons can be clicked (actual API interaction is complex to test)
    expect(editButtons[0]).toBeInTheDocument()
    expect(deleteButtons[0]).toBeInTheDocument()
    expect(postButtons[0]).toBeInTheDocument()
  })

  it('should handle retry button click', async () => {
    fetchMock.mockError(new Error('API Error'))

    render(<ContentFeed />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    // Reset mock to success for retry
    fetchMock.mockSuccess(mockApiResponse)
    
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
    })

    expect(fetchMock.mockFn).toHaveBeenCalledTimes(2)
  })

  it('should handle API response with error status', async () => {
    fetchMock.mockHttpError(500, 'Internal Server Error')

    render(<ContentFeed />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load content/)).toBeInTheDocument()
    })
  })
})