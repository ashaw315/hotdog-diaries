'use client'

import { useState, useEffect } from 'react'
import CinematicIntro from '@/components/CinematicIntro'
import AdaptiveTikTokFeed from '@/components/AdaptiveTikTokFeed'
import HandwrittenSVG from '@/components/HandwrittenSVG'
import HotdogDiariesLogoMouseGradient from '@/components/HotdogDiariesLogoMouseGradient'

export default function Page() {
  const [showIntro, setShowIntro] = useState(false) // Skip intro, show loader immediately
  const [showCover, setShowCover] = useState(false) // Skip cover, show loader immediately
  
  useEffect(() => {
    // Check if user has seen the cinematic intro
    const hasSeenIntro = localStorage.getItem('hasSeenCinematicIntro')
    if (hasSeenIntro) {
      setShowIntro(false)
    }
    
    // Auto-hide intro after 6 seconds (cinematic intro duration)
    const timer = setTimeout(() => setShowIntro(false), 6000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Feed loads immediately in background */}
      <main 
        className="min-h-screen transition-all duration-1000 feed-container opacity-100 scale-100"
        style={{ zIndex: 1 }}
      >
        <AdaptiveTikTokFeed />
      </main>
      
      {/* Cover overlays on top while feed loads behind */}
      {showCover && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <HandwrittenSVG onHide={() => setShowCover(false)} />
        </div>
      )}
      
      {/* Intro overlays after cover is dismissed */}
      {!showCover && showIntro && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}>
          <CinematicIntro />
        </div>
      )}
      
      {/* Logo overlays after intro */}
      {!showCover && !showIntro && (
        <HotdogDiariesLogoMouseGradient />
      )}
    </>
  )
}