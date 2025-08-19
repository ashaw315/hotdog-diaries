'use client'

import { useEffect, useState } from 'react'
import { motion, useAnimation, AnimatePresence } from 'framer-motion'
import HandwrittenSVG from './HandwrittenSVG'

export default function AnimatedTitle() {
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [showSpeedControl, setShowSpeedControl] = useState(false)
  const controls = useAnimation()
  const logoControls = useAnimation()

  useEffect(() => {
    // Small delay to ensure the page is fully loaded
    const initTimer = setTimeout(() => {
      // Check if first visit
      const hasVisited = localStorage.getItem('hasVisitedHotdogDiaries')
      
      if (!hasVisited) {
        // First visit - show full animation
        setIsAnimating(true)
        setShowSpeedControl(true)
        animateFullScreen()
        localStorage.setItem('hasVisitedHotdogDiaries', 'true')
      } else {
        // Return visit - skip to logo state
        setHasAnimated(true)
        logoControls.start('visible')
      }
    }, 100)
    
    return () => clearTimeout(initTimer)
  }, [])

  const animateFullScreen = async () => {
    // Reset state
    setIsAnimating(true)
    setHasAnimated(false)
    
    // Start writing animation
    await controls.start('writing')
    
    // Wait for writing to complete
    setTimeout(() => {
      // Start transition
      controls.start('complete')
      
      // Fade out full screen after a brief pause
      setTimeout(() => {
        setIsAnimating(false)
        setHasAnimated(true)
        setShowSpeedControl(false)
        logoControls.start('visible')
      }, 1000 / animationSpeed)
    }, (5000 / animationSpeed))
  }

  const replayAnimation = () => {
    if (!isAnimating) {
      setShowSpeedControl(true)
      animateFullScreen()
    }
  }

  return (
    <>
      {/* Full screen animation overlay */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'radial-gradient(ellipse at center, #FDFBF7 0%, #F8F4ED 100%)'
            }}
          >
            {/* Main animated title */}
            <motion.div
              initial={{ scale: 1, opacity: 1 }}
              animate={controls}
              variants={{
                writing: {
                  scale: 1,
                  opacity: 1,
                  transition: { duration: 0 }
                },
                complete: {
                  scale: 0.8,
                  opacity: 0.8,
                  transition: { 
                    duration: 0.8 / animationSpeed,
                    ease: "easeInOut"
                  }
                }
              }}
            >
              <HandwrittenSVG 
                speed={animationSpeed} 
                controls={controls}
                isFullScreen={true}
              />
            </motion.div>
            
            {/* Decorative elements */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 / animationSpeed, duration: 1 }}
            >
              {/* Subtle vignette */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(153, 95, 76, 0.05) 100%)'
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Logo in header (always present after animation) */}
      <motion.div 
        className="fixed top-6 left-6 z-40"
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={logoControls}
        variants={{
          visible: {
            opacity: 1,
            scale: 1,
            x: 0,
            transition: {
              duration: 0.5,
              ease: "easeOut"
            }
          }
        }}
      >
        <motion.div
          className="cursor-pointer hover:scale-105 transition-transform duration-200"
          onClick={replayAnimation}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
<HandwrittenSVG 
              speed={1} 
              controls={controls}
              isFullScreen={false}
            />
            
            {/* Hover hint */}
            {hasAnimated && !isAnimating && (
              <motion.div
                className="absolute -bottom-6 left-0 text-xs text-[#995F4C] opacity-0 hover:opacity-60 transition-opacity whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                whileHover={{ opacity: 0.6 }}
              >
                Click to replay animation
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Speed control button (during animation) */}
      <AnimatePresence>
        {showSpeedControl && (
          <motion.button
            onClick={() => setAnimationSpeed(animationSpeed === 1 ? 2 : animationSpeed === 2 ? 0.5 : 1)}
            className="fixed bottom-8 right-8 z-50 px-4 py-2 bg-white/90 backdrop-blur-sm text-[#995F4C] rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Speed: {animationSpeed === 0.5 ? '0.5x' : animationSpeed === 1 ? '1x' : '2x'}
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Skip button (during first animation) */}
      <AnimatePresence>
        {isAnimating && !hasAnimated && (
          <motion.button
            onClick={() => {
              setIsAnimating(false)
              setHasAnimated(true)
              setShowSpeedControl(false)
              logoControls.start('visible')
            }}
            className="fixed bottom-8 left-8 z-50 px-4 py-2 bg-white/90 backdrop-blur-sm text-[#995F4C]/60 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, delay: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}