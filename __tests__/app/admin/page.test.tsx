import { render, screen } from '@testing-library/react'
import AdminPage from '@/app/admin/page'

// Mock Layout component
jest.mock('@/components/Layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return (
      <div data-testid="layout">
        <div data-testid="header">Header</div>
        <main>{children}</main>
        <div data-testid="footer">Footer</div>
      </div>
    )
  }
})

describe('Admin Page', () => {
  it('renders without crashing', () => {
    render(<AdminPage />)
    
    const layout = screen.getByTestId('layout')
    expect(layout).toBeInTheDocument()
  })

  it('renders admin panel heading', () => {
    render(<AdminPage />)
    
    const heading = screen.getByRole('heading', { name: /admin panel/i, level: 1 })
    expect(heading).toBeInTheDocument()
  })

  it('renders all admin sections', () => {
    render(<AdminPage />)
    
    const contentManagement = screen.getByText(/content management/i)
    const socialMediaSettings = screen.getByText(/social media settings/i)
    const analytics = screen.getByText(/analytics/i)
    const systemHealth = screen.getByText(/system health/i)
    
    expect(contentManagement).toBeInTheDocument()
    expect(socialMediaSettings).toBeInTheDocument()
    expect(analytics).toBeInTheDocument()
    expect(systemHealth).toBeInTheDocument()
  })

  it('renders section descriptions', () => {
    render(<AdminPage />)
    
    const contentDesc = screen.getByText(/manage hotdog posts, scheduling/i)
    const socialDesc = screen.getByText(/configure social media scanning/i)
    const analyticsDesc = screen.getByText(/view engagement metrics/i)
    const healthDesc = screen.getByText(/monitor system status/i)
    
    expect(contentDesc).toBeInTheDocument()
    expect(socialDesc).toBeInTheDocument()
    expect(analyticsDesc).toBeInTheDocument()
    expect(healthDesc).toBeInTheDocument()
  })

  it('renders coming soon buttons for all sections', () => {
    render(<AdminPage />)
    
    const comingSoonButtons = screen.getAllByText(/coming soon/i)
    expect(comingSoonButtons).toHaveLength(4)
  })

  it('has proper grid layout structure', () => {
    const { container } = render(<AdminPage />)
    
    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toBeInTheDocument()
    expect(gridContainer).toHaveClass('md:grid-cols-2')
  })

  it('renders within Layout component', () => {
    render(<AdminPage />)
    
    const layout = screen.getByTestId('layout')
    const main = screen.getByRole('main')
    const adminHeading = screen.getByRole('heading', { name: /admin panel/i })
    
    expect(layout).toBeInTheDocument()
    expect(main).toContainElement(adminHeading)
  })
})