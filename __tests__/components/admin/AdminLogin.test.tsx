import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLogin from '@/components/admin/AdminLogin'
import { useAuth, useRedirectIfAuthenticated } from '@/contexts/AuthContext'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn()
}))

// Mock auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
  useRedirectIfAuthenticated: jest.fn()
}))

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn()
}

const mockSearchParams = {
  get: jest.fn()
}

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseRedirectIfAuthenticated = useRedirectIfAuthenticated as jest.MockedFunction<typeof useRedirectIfAuthenticated>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>

describe('AdminLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseRouter.mockReturnValue(mockRouter)
    mockUseSearchParams.mockReturnValue(mockSearchParams as any)
    mockUseRedirectIfAuthenticated.mockReturnValue({} as any)
    
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn()
    })
  })

  it('should render login form', () => {
    render(<AdminLogin />)

    expect(screen.getByText('Admin Login')).toBeInTheDocument()
    expect(screen.getByText('Sign in to access the Hotdog Diaries admin panel')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should show hotdog emoji', () => {
    render(<AdminLogin />)
    
    expect(screen.getByText('🌭')).toBeInTheDocument()
  })

  it('should handle username input', () => {
    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    
    expect(usernameInput).toHaveValue('testuser')
  })

  it('should handle password input', () => {
    render(<AdminLogin />)
    
    const passwordInput = screen.getByLabelText('Password')
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    expect(passwordInput).toHaveValue('password123')
  })

  it('should toggle password visibility', () => {
    render(<AdminLogin />)
    
    const passwordInput = screen.getByLabelText('Password')
    const toggleButton = screen.getByRole('button', { name: '' }) // Eye icon button
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should handle remember me checkbox', () => {
    render(<AdminLogin />)
    
    const rememberMeCheckbox = screen.getByLabelText('Remember me')
    expect(rememberMeCheckbox).not.toBeChecked()
    
    fireEvent.click(rememberMeCheckbox)
    expect(rememberMeCheckbox).toBeChecked()
  })

  it('should call login function on form submission', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'TestPass123!')
    })
  })

  it('should show loading state during login', async () => {
    const mockLogin = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } })
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Signing in...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
    
    await waitFor(() => {
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument()
    })
  })

  it('should show error message on login failure', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Login Failed')).toBeInTheDocument()
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('should validate required username', async () => {
    const mockLogin = jest.fn()
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
    })
    
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should validate required password', async () => {
    const mockLogin = jest.fn()
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should clear error when user starts typing', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    // Trigger error
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    
    // Start typing to clear error
    fireEvent.change(usernameInput, { target: { value: 'testuser2' } })
    
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument()
  })

  it('should show URL error message', () => {
    mockSearchParams.get.mockReturnValue('auth_service_error')
    
    render(<AdminLogin />)
    
    expect(screen.getByText('Authentication service is temporarily unavailable. Please try again.')).toBeInTheDocument()
  })

  it('should show session expired error message', () => {
    mockSearchParams.get.mockReturnValue('session_expired')
    
    render(<AdminLogin />)
    
    expect(screen.getByText('Your session has expired. Please log in again.')).toBeInTheDocument()
  })

  it('should trim whitespace from username', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: '  testuser  ' } })
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'TestPass123!')
    })
  })

  it('should show development mode notice', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    render(<AdminLogin />)
    
    expect(screen.getByText('Development Mode')).toBeInTheDocument()
    expect(screen.getByText('Demo credentials will be available after database setup.')).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should disable form inputs during loading', async () => {
    const mockLogin = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshUser: jest.fn()
    })

    render(<AdminLogin />)
    
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    const rememberMeCheckbox = screen.getByLabelText('Remember me')
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } })
    fireEvent.click(submitButton)
    
    expect(usernameInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
    expect(submitButton).toBeDisabled()
    expect(rememberMeCheckbox).toBeDisabled()
    
    await waitFor(() => {
      expect(usernameInput).not.toBeDisabled()
    })
  })
})