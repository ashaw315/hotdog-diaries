import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import AdminLayout from '@/components/admin/AdminLayout'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/admin'
  }),
  usePathname: () => '/admin'
}))

// Mock AuthContext
const mockAuthContext = {
  user: { id: '1', username: 'admin', email: 'admin@test.com' },
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn()
}

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => mockAuthContext)
}))

describe('AdminLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders admin layout with authenticated user', () => {
    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
    expect(screen.getByText('Hotdog Diaries Admin')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Content Queue')).toBeInTheDocument()
    expect(screen.getByText('Posted Content')).toBeInTheDocument()
  })

  it('shows loading state when authentication is loading', () => {
    const { useAuth } = require('@/contexts/AuthContext')
    ;(useAuth as jest.Mock).mockReturnValue({
      ...mockAuthContext,
      isLoading: true,
      user: null
    })

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Loading admin panel...')).toBeInTheDocument()
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument()
  })

  it('redirects to login when user is not authenticated', () => {
    const mockPush = jest.fn()
    
    jest.doMock('next/navigation', () => ({
      useRouter: () => ({
        push: mockPush,
        replace: jest.fn(),
        pathname: '/admin'
      }),
      usePathname: () => '/admin'
    }))

    mockAuthContext.isLoading = false
    mockAuthContext.user = null

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(mockPush).toHaveBeenCalledWith('/admin/login')
  })

  it('renders mobile menu toggle button', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.user = { id: '1', username: 'admin', email: 'admin@test.com' }

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    // Mobile menu toggle should be present
    const menuToggle = screen.getByLabelText('Toggle menu')
    expect(menuToggle).toBeInTheDocument()
  })

  it('renders user information in header', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.user = { 
      id: '1', 
      username: 'admin', 
      email: 'admin@test.com',
      full_name: 'Admin User'
    }

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Admin User')).toBeInTheDocument()
  })

  it('renders sidebar navigation items', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.user = { id: '1', username: 'admin', email: 'admin@test.com' }

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Content Queue')).toBeInTheDocument()
    expect(screen.getByText('Posted Content')).toBeInTheDocument()
    expect(screen.getByText('Content Analytics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders quick actions in sidebar', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.user = { id: '1', username: 'admin', email: 'admin@test.com' }

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Add Content')).toBeInTheDocument()
    expect(screen.getByText('Refresh Data')).toBeInTheDocument()
    expect(screen.getByText('Export Data')).toBeInTheDocument()
  })

  it('renders system status indicators', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.user = { id: '1', username: 'admin', email: 'admin@test.com' }

    render(
      <AdminLayout>
        <div>Test Content</div>
      </AdminLayout>
    )

    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Bot Service')).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })
})