import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="container">
        <div className="py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-primary mb-2">Hotdog Diaries</h3>
              <p className="text-sm text-text opacity-75">
                Tracking hotdog content across social media
              </p>
            </div>
            
            <nav className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
              <Link href="/" className="text-sm text-text hover:text-primary transition-colors">
                Home
              </Link>
              <Link href="/admin" className="text-sm text-text hover:text-primary transition-colors">
                Admin
              </Link>
              <Link href="/privacy" className="text-sm text-text hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link href="/about" className="text-sm text-text hover:text-primary transition-colors">
                About
              </Link>
            </nav>
          </div>
          
          <div className="border-t border-border mt-6 pt-6 text-center">
            <p className="text-sm text-text opacity-60">
              © {currentYear} Hotdog Diaries. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}