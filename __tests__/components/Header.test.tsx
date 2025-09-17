import { render, screen, fireEvent } from '@testing-library/react'
import Header from '@/components/Header'

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

describe('Header Component', () => {
  it('renders the header with brand name', () => {
    render(<Header />)
    
    const brandName = screen.getByText('Hotdog Diaries')
    expect(brandName).toBeInTheDocument()
  })

  it('renders the brand emoji', () => {
    render(<Header />)
    
    const emoji = screen.getByText('🌭')
    expect(emoji).toBeInTheDocument()
  })

  it('renders the brand link with correct href', () => {
    render(<Header />)
    
    const brandLink = screen.getByRole('link', { name: /🌭 Hotdog Diaries/i })
    expect(brandLink).toBeInTheDocument()
    expect(brandLink).toHaveAttribute('href', '/')
  })

  it('has correct header structure', () => {
    render(<Header />)
    
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('feed-header')
  })

  it('contains header content wrapper', () => {
    const { container } = render(<Header />)
    
    const headerContent = container.querySelector('.feed-header-content')
    expect(headerContent).toBeInTheDocument()
  })
})