import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContentFeed from '@/components/ui/ContentFeed'
import { ContentType, SourcePlatform } from '@/types'

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

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
  const mockContent = [
    {
      id: 1,
      content_text: 'First hotdog post',
      content_type: ContentType.TEXT,
      source_platform: SourcePlatform.TWITTER,
      original_url: 'https://twitter.com/test/1',
      original_author: 'user1',
      scraped_at: new Date('2024-01-01T10:00:00Z'),
      is_posted: true,
      is_approved: true,
      posted_at: new Date('2024-01-01T12:00:00Z'),
      post_order: 1
    },
    {
      id: 2,
      content_text: 'Second hotdog post',
      content_type: ContentType.IMAGE,
      source_platform: SourcePlatform.INSTAGRAM,
      original_url: 'https://instagram.com/p/test',
      original_author: 'user2',
      content_image_url: 'https://example.com/image.jpg',
      scraped_at: new Date('2024-01-01T11:00:00Z'),
      is_posted: false,
      is_approved: true
    }
  ]

  const mockApiResponse = {
    success: true,
    data: {
      items: mockContent,
      pagination: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    } as Response)
  })

  it('should render content feed with data', async () => {
    render(<ContentFeed apiEndpoint="/api/content" />)

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('content-card-2')).toBeInTheDocument()
    })

    expect(screen.getByText('First hotdog post')).toBeInTheDocument()
    expect(screen.getByText('Second hotdog post')).toBeInTheDocument()
  })

  it('should display loading state initially', () => {
    render(<ContentFeed apiEndpoint="/api/content" />)

    expect(screen.getByText('Loading content...')).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))

    render(<ContentFeed apiEndpoint="/api/content" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load content. Please try again.')).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should handle empty content list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          items: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
        }
      })
    } as Response)

    render(<ContentFeed apiEndpoint="/api/content" />)

    await waitFor(() => {
      expect(screen.getByText('No content found.')).toBeInTheDocument()
    })
  })

  it('should apply filters correctly', async () => {
    const filters = {
      content_type: ContentType.IMAGE,
      source_platform: SourcePlatform.INSTAGRAM,
      is_approved: true,
      author: 'testuser'
    }

    render(<ContentFeed apiEndpoint="/api/content" filters={filters} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const fetchCall = mockFetch.mock.calls[0]
    const url = new URL(fetchCall[0] as string, 'http://localhost')
    
    expect(url.searchParams.get('content_type')).toBe(ContentType.IMAGE)
    expect(url.searchParams.get('source_platform')).toBe(SourcePlatform.INSTAGRAM)
    expect(url.searchParams.get('is_approved')).toBe('true')
    expect(url.searchParams.get('author')).toBe('testuser')
  })

  it('should handle pagination correctly', async () => {
    render(<ContentFeed apiEndpoint="/api/content" pagination={{ page: 2, limit: 5 }} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const fetchCall = mockFetch.mock.calls[0]
    const url = new URL(fetchCall[0] as string, 'http://localhost')
    
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('5')
  })

  it('should display pagination controls when multiple pages', async () => {
    const multiPageResponse = {
      success: true,
      data: {
        items: mockContent,
        pagination: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3
        }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(multiPageResponse)
    } as Response)

    render(<ContentFeed apiEndpoint="/api/content" showPagination={true} />)

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })

    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('should handle page navigation', async () => {
    const multiPageResponse = {
      success: true,
      data: {
        items: mockContent,
        pagination: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3
        }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(multiPageResponse)
    } as Response)

    render(<ContentFeed apiEndpoint="/api/content" showPagination={true} />)

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    const secondCall = mockFetch.mock.calls[1]
    const url = new URL(secondCall[0] as string, 'http://localhost')
    expect(url.searchParams.get('page')).toBe('3')
  })

  it('should show action buttons when showActions is true', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    render(
      <ContentFeed 
        apiEndpoint="/api/content" 
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

  it('should call action handlers when buttons are clicked', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    const onPost = jest.fn()

    render(
      <ContentFeed 
        apiEndpoint="/api/content" 
        showActions={true}
        onEdit={onEdit}
        onDelete={onDelete}
        onPost={onPost}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
    })

    // Click action buttons for first content item
    fireEvent.click(screen.getAllByText('Edit')[0])
    expect(onEdit).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getAllByText('Delete')[0])
    expect(onDelete).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getAllByText('Post')[0])
    expect(onPost).toHaveBeenCalledWith(1)
  })

  it('should refresh data when refresh method is called', async () => {
    let refreshFunction: (() => void) | undefined

    render(
      <ContentFeed 
        apiEndpoint="/api/content" 
        onRefreshRef={(refresh) => { refreshFunction = refresh }}
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Call refresh function
    refreshFunction?.()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle retry button click', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      } as Response)

    render(<ContentFeed apiEndpoint="/api/content" />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('content-card-1')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should apply sorting correctly', async () => {
    render(
      <ContentFeed 
        apiEndpoint="/api/content" 
        sortBy="scraped_at"
        sortOrder="desc"
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const fetchCall = mockFetch.mock.calls[0]
    const url = new URL(fetchCall[0] as string, 'http://localhost')
    
    expect(url.searchParams.get('sortBy')).toBe('scraped_at')
    expect(url.searchParams.get('sortOrder')).toBe('desc')
  })

  it('should handle API response with error status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response)

    render(<ContentFeed apiEndpoint="/api/content" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load content. Please try again.')).toBeInTheDocument()
    })
  })

  it('should disable pagination buttons appropriately', async () => {
    // Test first page (Previous should be disabled)
    const firstPageResponse = {
      success: true,
      data: {
        items: mockContent,
        pagination: {
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3
        }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(firstPageResponse)
    } as Response)

    render(<ContentFeed apiEndpoint="/api/content" showPagination={true} />)

    await waitFor(() => {
      const prevButton = screen.getByText('Previous')
      expect(prevButton).toBeDisabled()
      expect(screen.getByText('Next')).not.toBeDisabled()
    })
  })
})