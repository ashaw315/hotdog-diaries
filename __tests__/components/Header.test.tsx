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

  it('renders navigation links on desktop', () => {
    render(<Header />)
    
    const homeLink = screen.getByRole('link', { name: /home/i })
    const adminLink = screen.getByRole('link', { name: /admin/i })
    
    expect(homeLink).toBeInTheDocument()
    expect(adminLink).toBeInTheDocument()
  })

  it('toggles mobile menu when hamburger button is clicked', () => {
    render(<Header />)
    
    const menuButton = screen.getByLabelText('Toggle menu')
    expect(menuButton).toBeInTheDocument()
    
    // Initially, mobile menu should not be visible
    expect(screen.queryByText('Home')).toBeInTheDocument() // Desktop nav
    
    // Click to open mobile menu
    fireEvent.click(menuButton)
    
    // Mobile menu should now be visible (will show additional Home/Admin links)
    const mobileNavLinks = screen.getAllByText('Home')
    expect(mobileNavLinks.length).toBeGreaterThan(1) // Desktop + mobile
  })

  it('closes mobile menu when a link is clicked', () => {
    render(<Header />)
    
    const menuButton = screen.getByLabelText('Toggle menu')
    fireEvent.click(menuButton) // Open menu
    
    // Find mobile navigation links (they should be different from desktop ones)
    const mobileNavLinks = screen.getAllByText('Home')
    const mobileHomeLink = mobileNavLinks[mobileNavLinks.length - 1] // Get the last one (mobile)
    
    fireEvent.click(mobileHomeLink)
    
    // Menu should close (check for hamburger icon, not X)
    const hamburgerPath = screen.getByLabelText('Toggle menu').querySelector('path')
    expect(hamburgerPath?.getAttribute('d')).toContain('M4 6h16M4 12h16M4 18h16')
  })

  it('has correct link hrefs', () => {
    render(<Header />)
    
    const homeLinks = screen.getAllByRole('link', { name: /home/i })
    const adminLinks = screen.getAllByRole('link', { name: /admin/i })
    
    homeLinks.forEach(link => {
      expect(link).toHaveAttribute('href', '/')
    })
    
    adminLinks.forEach(link => {
      expect(link).toHaveAttribute('href', '/admin')
    })
  })
})