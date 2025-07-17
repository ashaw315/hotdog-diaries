import { render, screen } from '@testing-library/react'
import Layout from '@/components/Layout'

// Mock child components
jest.mock('@/components/Header', () => {
  return function MockHeader() {
    return <header data-testid="header">Header Component</header>
  }
})

jest.mock('@/components/Footer', () => {
  return function MockFooter() {
    return <footer data-testid="footer">Footer Component</footer>
  }
})

describe('Layout Component', () => {
  it('renders header, main content, and footer', () => {
    const testContent = 'Test content goes here'
    
    render(
      <Layout>
        <div>{testContent}</div>
      </Layout>
    )
    
    const header = screen.getByTestId('header')
    const footer = screen.getByTestId('footer')
    const content = screen.getByText(testContent)
    
    expect(header).toBeInTheDocument()
    expect(footer).toBeInTheDocument()
    expect(content).toBeInTheDocument()
  })

  it('renders children in main element', () => {
    const testContent = 'Child content'
    
    render(
      <Layout>
        <div data-testid="child-content">{testContent}</div>
      </Layout>
    )
    
    const mainElement = screen.getByRole('main')
    const childContent = screen.getByTestId('child-content')
    
    expect(mainElement).toBeInTheDocument()
    expect(mainElement).toContainElement(childContent)
  })

  it('has correct CSS classes for layout structure', () => {
    const { container } = render(
      <Layout>
        <div>Test</div>
      </Layout>
    )
    
    const layoutDiv = container.firstChild as HTMLElement
    expect(layoutDiv).toHaveClass('min-h-screen', 'flex', 'flex-col')
    
    const mainElement = screen.getByRole('main')
    expect(mainElement).toHaveClass('flex-1')
  })

  it('renders multiple children correctly', () => {
    render(
      <Layout>
        <h1>Title</h1>
        <p>Paragraph</p>
        <div>Another div</div>
      </Layout>
    )
    
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Paragraph')).toBeInTheDocument()
    expect(screen.getByText('Another div')).toBeInTheDocument()
  })
})