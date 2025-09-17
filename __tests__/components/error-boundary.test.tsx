import { render, screen } from '@testing-library/react'
import AdminError from '@/app/admin/error'

// Mock console.error to avoid noise in tests
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalError
})

describe('AdminError (Error Boundary)', () => {
  const mockError = new Error('Test admin error')
  const mockReset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render error message and retry button', () => {
    render(<AdminError error={mockError} reset={mockReset} />)

    expect(screen.getByText('Admin Panel Error')).toBeInTheDocument()
    expect(screen.getByText(/We encountered an error while loading the admin panel/)).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Go to Homepage')).toBeInTheDocument()
  })

  it('should display error icon', () => {
    render(<AdminError error={mockError} reset={mockReset} />)

    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })

  it('should call reset function when retry button is clicked', () => {
    render(<AdminError error={mockError} reset={mockReset} />)

    const retryButton = screen.getByText('Try Again')
    retryButton.click()

    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('should navigate to homepage when homepage button is clicked', () => {
    // Mock window.location
    delete (window as any).location
    window.location = { href: '' } as any

    render(<AdminError error={mockError} reset={mockReset} />)

    const homepageButton = screen.getByText('Go to Homepage')
    homepageButton.click()

    expect(window.location.href).toBe('http://localhost/')
  })

  it('should log error to console', () => {
    render(<AdminError error={mockError} reset={mockReset} />)

    expect(console.error).toHaveBeenCalledWith('Admin panel error:', mockError)
  })

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const errorWithStack = new Error('Test error with stack')
    errorWithStack.stack = 'Error: Test error with stack\n    at test.js:1:1'

    render(<AdminError error={errorWithStack} reset={mockReset} />)

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()
    expect(screen.getByText(/Test error with stack/)).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should not show error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(<AdminError error={mockError} reset={mockReset} />)

    expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should handle error with digest property', () => {
    const errorWithDigest = new Error('Test error') as Error & { digest?: string }
    errorWithDigest.digest = 'abc123'

    render(<AdminError error={errorWithDigest} reset={mockReset} />)

    expect(screen.getByText('Admin Panel Error')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Admin panel error:', errorWithDigest)
  })

  it('should have correct button styling', () => {
    render(<AdminError error={mockError} reset={mockReset} />)

    const retryButton = screen.getByText('Try Again')
    const homepageButton = screen.getByText('Go to Homepage')

    // Check that buttons have appropriate classes based on actual implementation
    expect(retryButton).toHaveClass('bg-indigo-600')
    expect(homepageButton).toHaveClass('border-gray-300')
  })

  it('should display error stack trace in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const errorWithStack = new Error('Test error')
    errorWithStack.stack = 'Error: Test error\n    at component.js:10:5\n    at handler.js:20:10'

    render(<AdminError error={errorWithStack} reset={mockReset} />)

    // Click to expand details
    const summary = screen.getByText('Error Details (Development)')
    summary.click()

    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument()
    expect(screen.getByText(/at component.js:10:5/)).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should handle error without stack trace', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const errorWithoutStack = new Error('Test error')
    delete errorWithoutStack.stack

    render(<AdminError error={errorWithoutStack} reset={mockReset} />)

    // Click to expand details
    const summary = screen.getByText('Error Details (Development)')
    summary.click()

    expect(screen.getByText('Test error')).toBeInTheDocument()
    // Should not show stack trace section
    expect(screen.queryByText(/at /)).not.toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })
})