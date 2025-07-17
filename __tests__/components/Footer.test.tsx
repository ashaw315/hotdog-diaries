import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

describe('Footer Component', () => {
  it('renders footer with brand name and description', () => {
    render(<Footer />)
    
    const brandName = screen.getByText('Hotdog Diaries')
    const description = screen.getByText('Tracking hotdog content across social media')
    
    expect(brandName).toBeInTheDocument()
    expect(description).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(<Footer />)
    
    const homeLink = screen.getByRole('link', { name: /home/i })
    const adminLink = screen.getByRole('link', { name: /admin/i })
    const privacyLink = screen.getByRole('link', { name: /privacy/i })
    const aboutLink = screen.getByRole('link', { name: /about/i })
    
    expect(homeLink).toBeInTheDocument()
    expect(adminLink).toBeInTheDocument()
    expect(privacyLink).toBeInTheDocument()
    expect(aboutLink).toBeInTheDocument()
  })

  it('has correct link hrefs', () => {
    render(<Footer />)
    
    const homeLink = screen.getByRole('link', { name: /home/i })
    const adminLink = screen.getByRole('link', { name: /admin/i })
    const privacyLink = screen.getByRole('link', { name: /privacy/i })
    const aboutLink = screen.getByRole('link', { name: /about/i })
    
    expect(homeLink).toHaveAttribute('href', '/')
    expect(adminLink).toHaveAttribute('href', '/admin')
    expect(privacyLink).toHaveAttribute('href', '/privacy')
    expect(aboutLink).toHaveAttribute('href', '/about')
  })

  it('displays current year in copyright', () => {
    render(<Footer />)
    
    const currentYear = new Date().getFullYear()
    const copyright = screen.getByText(new RegExp(`© ${currentYear} Hotdog Diaries`))
    
    expect(copyright).toBeInTheDocument()
  })

  it('renders copyright text', () => {
    render(<Footer />)
    
    const copyrightText = screen.getByText(/All rights reserved/i)
    expect(copyrightText).toBeInTheDocument()
  })
})