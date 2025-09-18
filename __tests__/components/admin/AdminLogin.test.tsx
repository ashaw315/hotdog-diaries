import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLogin from '@/components/admin/AdminLogin'
import { useAuth, useRedirectIfAuthenticated } from '@/contexts/AuthContext'
import { 
  renderWithProviders, 
  createMockAuthContext,
  mockFetch 
} from '@/__tests__/utils/component-mocks'

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
  const fetchMock = mockFetch()
  
  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.reset()
    
    mockUseRouter.mockReturnValue(mockRouter)
    mockUseSearchParams.mockReturnValue(mockSearchParams as any)
    mockUseRedirectIfAuthenticated.mockReturnValue({} as any)
    
    mockUseAuth.mockReturnValue(createMockAuthContext({
      user: null,
      isLoading: false,
      isAuthenticated: false
    }))
    
    mockSearchParams.get.mockReturnValue(null)
  })

  it('should render login form with basic elements', () => {
    renderWithProviders(<AdminLogin />)

    expect(screen.getByText('Admin Login')).toBeInTheDocument()
    expect(screen.getByText('Enter your credentials to access the dashboard')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should handle username input changes', () => {
    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username') as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    
    expect(usernameInput.value).toBe('testuser')
  })

  it('should handle password input changes', () => {
    renderWithProviders(<AdminLogin />)
    
    const passwordInput = screen.getByPlaceholderText('Enter password') as HTMLInputElement
    fireEvent.change(passwordInput, { target: { value: 'testpass' } })
    
    expect(passwordInput.value).toBe('testpass')
  })

  it('should toggle password visibility', () => {
    renderWithProviders(<AdminLogin />)
    
    const passwordInput = screen.getByPlaceholderText('Enter password') as HTMLInputElement
    const toggleButton = screen.getByText('👁️')
    
    expect(passwordInput.type).toBe('password')
    
    fireEvent.click(toggleButton)
    expect(passwordInput.type).toBe('text')
    expect(screen.getByText('🙈')).toBeInTheDocument()
  })

  it('should handle remember me checkbox', () => {
    renderWithProviders(<AdminLogin />)
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
  })

  it('should call login function on form submission', async () => {
    const mockLogin = jest.fn().mockResolvedValue({ success: true })
    mockUseAuth.mockReturnValue(createMockAuthContext({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin
    }))

    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username')
    const passwordInput = screen.getByPlaceholderText('Enter password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } })
    fireEvent.change(passwordInput, { target: { value: 'password' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'password')
    })
  })

  it('should show loading state during login', async () => {
    const mockLogin = jest.fn().mockImplementation(() => new Promise(() => {}))
    mockUseAuth.mockReturnValue(createMockAuthContext({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin
    }))

    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username')
    const passwordInput = screen.getByPlaceholderText('Enter password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } })
    fireEvent.change(passwordInput, { target: { value: 'password' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
    })
  })

  it('should show error message on login failure', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockUseAuth.mockReturnValue(createMockAuthContext({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin
    }))

    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username')
    const passwordInput = screen.getByPlaceholderText('Enter password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('should validate required username', async () => {
    renderWithProviders(<AdminLogin />)
    
    const passwordInput = screen.getByPlaceholderText('Enter password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(passwordInput, { target: { value: 'password' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
    })
  })

  it('should validate required password', async () => {
    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('should show development mode notice', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    renderWithProviders(<AdminLogin />)
    
    expect(screen.getByText('Development Mode')).toBeInTheDocument()
    expect(screen.getByText('Demo credentials will be available after database setup.')).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should show URL error message when provided', () => {
    mockSearchParams.get.mockReturnValue('invalid_token')
    
    renderWithProviders(<AdminLogin />)
    
    expect(screen.getByText('An error occurred. Please try logging in again.')).toBeInTheDocument()
  })

  it('should show session expired error message', () => {
    mockSearchParams.get.mockReturnValue('session_expired')
    
    renderWithProviders(<AdminLogin />)
    
    expect(screen.getByText('Your session has expired. Please log in again.')).toBeInTheDocument()
  })

  it('should disable form inputs during loading', async () => {
    const mockLogin = jest.fn().mockImplementation(() => new Promise(() => {}))
    mockUseAuth.mockReturnValue(createMockAuthContext({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin
    }))

    renderWithProviders(<AdminLogin />)
    
    const usernameInput = screen.getByPlaceholderText('Enter username')
    const passwordInput = screen.getByPlaceholderText('Enter password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    const rememberMeCheckbox = screen.getByRole('checkbox')
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } })
    fireEvent.change(passwordInput, { target: { value: 'password' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(usernameInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      expect(rememberMeCheckbox).toBeDisabled()
    })
  })
})