import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="grid grid-2 gap-md">
          <div className="text-center">
            <h3>Hotdog Diaries</h3>
            <p className="text-muted">
              Tracking hotdog content across social media
            </p>
          </div>
          
          <nav className="nav nav-vertical text-center">
            <Link href="/" className="nav-link">
              Home
            </Link>
            <Link href="/admin" className="nav-link">
              Admin
            </Link>
            <Link href="/privacy" className="nav-link">
              Privacy
            </Link>
            <Link href="/about" className="nav-link">
              About
            </Link>
          </nav>
        </div>
        
        <div className="text-center mt-lg" style={{ borderTop: '1px solid var(--color-gray-light)', paddingTop: 'var(--spacing-lg)' }}>
          <p className="text-muted">
            © {currentYear} Hotdog Diaries. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}