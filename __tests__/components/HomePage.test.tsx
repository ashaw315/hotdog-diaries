import { render, screen } from '@testing-library/react'
import HomePage from '@/components/HomePage'

describe('HomePage Component', () => {
  it('renders main heading', () => {
    render(<HomePage />)
    
    const heading = screen.getByRole('heading', { name: /welcome to hotdog diaries/i, level: 1 })
    expect(heading).toBeInTheDocument()
  })

  it('renders description text', () => {
    render(<HomePage />)
    
    const description = screen.getByText(/your premier destination for hotdog content/i)
    expect(description).toBeInTheDocument()
  })

  it('renders all feature cards', () => {
    render(<HomePage />)
    
    const dailyContentCard = screen.getByText(/daily content/i)
    const smartScanningCard = screen.getByText(/smart scanning/i)
    const mobileReadyCard = screen.getByText(/mobile ready/i)
    
    expect(dailyContentCard).toBeInTheDocument()
    expect(smartScanningCard).toBeInTheDocument()
    expect(mobileReadyCard).toBeInTheDocument()
  })

  it('renders feature card descriptions', () => {
    render(<HomePage />)
    
    const dailyContentDesc = screen.getByText(/fresh hotdog posts delivered 6 times per day/i)
    const smartScanningDesc = screen.getByText(/our intelligent system finds and curates/i)
    const mobileReadyDesc = screen.getByText(/optimized for all devices/i)
    
    expect(dailyContentDesc).toBeInTheDocument()
    expect(smartScanningDesc).toBeInTheDocument()
    expect(mobileReadyDesc).toBeInTheDocument()
  })

  it('renders coming soon section', () => {
    render(<HomePage />)
    
    const comingSoonHeading = screen.getByRole('heading', { name: /coming soon/i, level: 2 })
    const comingSoonText = screen.getByText(/hotdog content will start appearing here/i)
    
    expect(comingSoonHeading).toBeInTheDocument()
    expect(comingSoonText).toBeInTheDocument()
  })

  it('renders emojis for visual appeal', () => {
    render(<HomePage />)
    
    // Check if emojis are present in the document
    const hotdogEmoji = screen.getByText('🌭')
    const searchEmoji = screen.getByText('🔍')
    const mobileEmoji = screen.getByText('📱')
    
    expect(hotdogEmoji).toBeInTheDocument()
    expect(searchEmoji).toBeInTheDocument()
    expect(mobileEmoji).toBeInTheDocument()
  })

  it('has proper heading hierarchy', () => {
    render(<HomePage />)
    
    const h1 = screen.getByRole('heading', { level: 1 })
    const h2 = screen.getByRole('heading', { level: 2 })
    const h3Elements = screen.getAllByRole('heading', { level: 3 })
    
    expect(h1).toBeInTheDocument()
    expect(h2).toBeInTheDocument()
    expect(h3Elements).toHaveLength(3) // Three feature cards
  })

  it('renders with responsive container classes', () => {
    const { container } = render(<HomePage />)
    
    const containerDiv = container.querySelector('.container')
    expect(containerDiv).toBeInTheDocument()
    expect(containerDiv).toHaveClass('py-12')
  })
})