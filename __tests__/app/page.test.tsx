import { render, screen } from '@testing-library/react'
import Page from '@/app/page'

// Mock child components
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

jest.mock('@/components/HomePage', () => {
  return function MockHomePage() {
    return <div data-testid="homepage">HomePage Component</div>
  }
})

describe('Home Page', () => {
  it('renders without crashing', () => {
    render(<Page />)
    
    const layout = screen.getByTestId('layout')
    const homePage = screen.getByTestId('homepage')
    
    expect(layout).toBeInTheDocument()
    expect(homePage).toBeInTheDocument()
  })

  it('renders HomePage component within Layout', () => {
    render(<Page />)
    
    const layout = screen.getByTestId('layout')
    const homePage = screen.getByTestId('homepage')
    const main = screen.getByRole('main')
    
    expect(layout).toBeInTheDocument()
    expect(main).toContainElement(homePage)
  })

  it('has proper page structure', () => {
    render(<Page />)
    
    // Check that the page includes header, main content, and footer
    const header = screen.getByTestId('header')
    const main = screen.getByRole('main')
    const footer = screen.getByTestId('footer')
    
    expect(header).toBeInTheDocument()
    expect(main).toBeInTheDocument()
    expect(footer).toBeInTheDocument()
  })
})