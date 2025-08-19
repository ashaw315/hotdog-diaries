'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { gsap } from 'gsap';

export default function CinematicIntro() {
  const [phase, setPhase] = useState<'pour' | 'transform' | 'explosion' | 'lock' | 'done'>('pour');
  const [hasViewed, setHasViewed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const liquidRef = useRef<HTMLDivElement>(null);
  const hotdogRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  
  // Professional easing curves
  const cinematicEasing = [0.25, 0.46, 0.45, 0.94]; // Custom cubic-bezier for cinematic feel
  const explosiveEasing = [0.68, -0.55, 0.265, 1.55]; // Explosive motion
  const magneticEasing = [0.25, 0.1, 0.25, 1]; // Magnetic settle

  useEffect(() => {
    // Check if user has seen cinematic intro
    const viewed = localStorage.getItem('hasSeenCinematicIntro');
    if (viewed) {
      setHasViewed(true);
      setPhase('done');
      return;
    }

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setPhase('done');
      localStorage.setItem('hasSeenCinematicIntro', 'true');
      return;
    }

    // Mobile optimization - reduce complexity on smaller screens
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Slightly faster on mobile for better performance
      gsap.globalTimeline.timeScale(1.2);
    }

    // Professional animation sequence
    const sequence = async () => {
      // Phase 1: The Pour (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPhase('transform');
      
      // Phase 2: The Transformation (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhase('explosion');
      
      // Phase 3: Title Explosion (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPhase('lock');
      
      // Phase 4: The Lock (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhase('done');
      localStorage.setItem('hasSeenCinematicIntro', 'true');
    };

    sequence();
  }, []);

  // Skip to end
  const skipIntro = () => {
    setPhase('done');
    localStorage.setItem('hasSeenCinematicIntro', 'true');
  };

  if (phase === 'done') {
    return <PremiumLogo />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={containerRef}
        className="fixed inset-0 z-50 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
        }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: cinematicEasing }}
      >
        {/* Grain texture overlay */}
        <div 
          className="absolute inset-0 opacity-20 mix-blend-multiply"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Phase Content */}
        {phase === 'pour' && <PourPhase liquidRef={liquidRef} />}
        {phase === 'transform' && <TransformPhase liquidRef={liquidRef} hotdogRef={hotdogRef} particlesRef={particlesRef} />}
        {phase === 'explosion' && <ExplosionPhase hotdogRef={hotdogRef} />}
        {phase === 'lock' && <LockPhase />}

        {/* Skip button - mobile optimized */}
        <motion.button
          onClick={skipIntro}
          className="absolute bottom-6 right-6 md:bottom-8 md:right-8 px-4 py-2 md:px-6 md:py-3 
                     text-white/60 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-xl 
                     rounded-full border border-white/10 hover:border-white/20 transition-all duration-300
                     text-xs md:text-sm font-medium tracking-wide touch-manipulation"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.4)' }}
          whileTap={{ scale: 0.95 }}
          aria-label="Skip cinematic intro animation"
        >
          Skip Intro
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// PHASE 1: The Pour - Realistic liquid physics
function PourPhase({ liquidRef }: { liquidRef: React.RefObject<HTMLDivElement> }) {
  const pourY = useMotionValue(-100);
  const pourOpacity = useTransform(pourY, [-100, 0], [0, 1]);
  const pourScale = useTransform(pourY, [-100, 50], [0.8, 1.2]);

  useEffect(() => {
    if (liquidRef.current) {
      // GSAP for complex liquid physics
      gsap.fromTo(liquidRef.current, 
        { 
          y: -200, 
          scaleY: 0.1, 
          scaleX: 0.8,
          transformOrigin: 'top center'
        },
        {
          y: window.innerHeight * 0.4,
          scaleY: 1.2,
          scaleX: 1,
          duration: 2,
          ease: "elastic.out(1, 0.8)",
          onUpdate: () => {
            // Add wobble effect during pour
            gsap.to(liquidRef.current, {
              scaleX: 1 + Math.sin(Date.now() * 0.01) * 0.05,
              duration: 0.1,
              ease: "sine.inOut"
            });
          }
        }
      );
    }
  }, [liquidRef]);

  return (
    <div className="flex items-center justify-center h-full">
      {/* Liquid stream */}
      <motion.div
        ref={liquidRef}
        className="absolute top-0 left-1/2 w-8 h-96"
        style={{
          background: 'linear-gradient(180deg, #FFB800 0%, #E31837 100%)',
          borderRadius: '0 0 20px 20px',
          boxShadow: '0 20px 60px rgba(255, 184, 0, 0.4), inset 0 -20px 20px rgba(0,0,0,0.2)',
          transform: 'translateX(-50%)',
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
        }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Glossy highlight */}
        <div 
          className="absolute left-2 top-0 w-2 h-full bg-white/30 rounded-full"
          style={{ filter: 'blur(1px)' }}
        />
      </motion.div>

      {/* Pour source hint */}
      <motion.div
        className="absolute top-8 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="w-16 h-8 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-full shadow-2xl" />
      </motion.div>
    </div>
  );
}

// PHASE 2: The Transformation - Morphing magic
function TransformPhase({ 
  liquidRef, 
  hotdogRef, 
  particlesRef 
}: { 
  liquidRef: React.RefObject<HTMLDivElement>;
  hotdogRef: React.RefObject<HTMLDivElement>;
  particlesRef: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    if (liquidRef.current && hotdogRef.current) {
      // Morph liquid into hotdog
      gsap.to(liquidRef.current, {
        scale: 1.5,
        borderRadius: '50px',
        rotation: 90,
        duration: 1,
        ease: "power3.inOut",
        onComplete: () => {
          // Replace with hotdog
          gsap.set(liquidRef.current, { opacity: 0 });
          gsap.fromTo(hotdogRef.current,
            { scale: 0, rotation: 90 },
            { 
              scale: 1, 
              rotation: 0, 
              duration: 0.6,
              ease: "back.out(1.7)"
            }
          );
        }
      });

      // Particle burst
      if (particlesRef.current) {
        const particles = particlesRef.current.children;
        gsap.fromTo(particles, 
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            stagger: 0.05,
            ease: "power2.out",
            delay: 0.8
          }
        );
      }
    }
  }, [liquidRef, hotdogRef, particlesRef]);

  return (
    <div className="flex items-center justify-center h-full">
      {/* Transformation particles */}
      <div ref={particlesRef} className="absolute">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              background: `linear-gradient(45deg, ${i % 2 ? '#FFB800' : '#E31837'}, ${i % 2 ? '#E31837' : '#FFB800'})`,
              left: `${Math.cos(i * 30 * Math.PI / 180) * 100 + window.innerWidth / 2}px`,
              top: `${Math.sin(i * 30 * Math.PI / 180) * 100 + window.innerHeight / 2}px`,
            }}
            animate={{
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1,
              delay: i * 0.1,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      {/* Hotdog icon */}
      <motion.div
        ref={hotdogRef}
        className="relative"
        initial={{ opacity: 0, scale: 0 }}
      >
        <div 
          className="w-32 h-16 rounded-full relative overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, #D4A574 0%, #C19660 50%, #D4A574 100%)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3), inset 0 -5px 10px rgba(0,0,0,0.2)'
          }}
        >
          {/* Sausage */}
          <div 
            className="absolute top-2 left-4 right-4 h-3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #8B4513 0%, #A0522D 50%, #8B4513 100%)',
              boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3)'
            }}
          />
          {/* Condiments */}
          <div className="absolute top-6 left-6 right-6 h-1 bg-gradient-to-r from-red-500 to-yellow-400 rounded-full opacity-80" />
        </div>
      </motion.div>
    </div>
  );
}

// PHASE 3: Title Explosion - Staggered letter animation
function ExplosionPhase({ hotdogRef }: { hotdogRef: React.RefObject<HTMLDivElement> }) {
  const letters = "HOTDOG DIARIES".split("");
  
  useEffect(() => {
    if (hotdogRef.current) {
      // Move hotdog to background
      gsap.to(hotdogRef.current, {
        scale: 0.6,
        opacity: 0.3,
        y: -50,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }, [hotdogRef]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        {/* Letters explosion */}
        <div className="flex flex-wrap justify-center gap-1 md:gap-2">
          {letters.map((letter, index) => (
            <motion.span
              key={index}
              className="inline-block text-4xl md:text-6xl lg:text-8xl font-black tracking-tight"
              style={{
                fontFamily: "'Anton', 'Bebas Neue', sans-serif",
                fontWeight: 900,
                color: letter === ' ' ? 'transparent' : index < 6 ? '#FFB800' : '#E31837',
                textShadow: '0 5px 15px rgba(0,0,0,0.5), 0 0 30px currentColor',
                filter: 'drop-shadow(0 0 10px currentColor)',
              }}
              initial={{ 
                scale: 0,
                opacity: 0,
                y: 100,
                rotate: Math.random() * 360 - 180,
                filter: 'blur(10px)'
              }}
              animate={{ 
                scale: 1,
                opacity: 1,
                y: 0,
                rotate: 0,
                filter: 'blur(0px)'
              }}
              transition={{
                duration: 0.8,
                delay: index * 0.1,
                ease: [0.68, -0.55, 0.265, 1.55], // Explosive easing
                type: "spring",
                stiffness: 200,
                damping: 10
              }}
              whileHover={{
                scale: 1.1,
                textShadow: '0 5px 15px rgba(0,0,0,0.8), 0 0 40px currentColor',
              }}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

// PHASE 4: The Lock - Magnetic positioning
function LockPhase() {
  return (
    <motion.div
      className="flex items-center justify-center h-full"
      initial={{ scale: 1 }}
      animate={{ scale: 0.3 }}
      transition={{
        duration: 1,
        ease: [0.25, 0.1, 0.25, 1], // Magnetic easing
      }}
    >
      <motion.div
        className="text-center"
        animate={{
          x: -(window.innerWidth * 0.35),
          y: -(window.innerHeight * 0.4),
        }}
        transition={{
          duration: 1,
          ease: "power3.inOut",
        }}
      >
        <div 
          className="px-6 py-3 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #FFB800 0%, #E31837 100%)',
            boxShadow: '0 10px 40px rgba(255, 184, 0, 0.4), 0 0 60px rgba(227, 24, 55, 0.3)',
          }}
        >
          <h1 
            className="text-2xl md:text-3xl font-black text-white tracking-tight"
            style={{ fontFamily: "'Anton', sans-serif", fontWeight: 900 }}
          >
            HD
          </h1>
          <p 
            className="text-xs text-white/90 -mt-1"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
          >
            DIARIES
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Final premium logo component
function PremiumLogo() {
  return (
    <motion.button
      className="fixed top-4 left-4 md:top-6 md:left-6 z-40 cursor-pointer touch-manipulation group"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={() => {
        localStorage.removeItem('hasSeenCinematicIntro');
        window.location.reload();
      }}
      aria-label="Replay cinematic intro - HotDog Diaries logo"
      whileFocus={{ scale: 1.05 }}
    >
      <motion.div
        className="px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl backdrop-blur-xl border border-white/10 gpu-accelerated"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.9) 0%, rgba(227, 24, 55, 0.9) 100%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2), 0 0 20px rgba(255, 184, 0, 0.3)',
        }}
        whileHover={{ 
          scale: 1.05,
          boxShadow: '0 15px 50px rgba(0,0,0,0.3), 0 0 30px rgba(255, 184, 0, 0.5)',
          background: 'linear-gradient(135deg, rgba(255, 184, 0, 1) 0%, rgba(227, 24, 55, 1) 100%)',
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <h1 
          className="text-lg md:text-xl lg:text-2xl font-black text-white tracking-tight"
          style={{ fontFamily: "'Anton', sans-serif", fontWeight: 900 }}
        >
          HD
        </h1>
        <p 
          className="text-xs text-white/90 -mt-1 tracking-widest group-hover:text-white transition-colors"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
        >
          DIARIES
        </p>
        
        {/* Hover hint */}
        <motion.div
          className="absolute -bottom-8 left-0 text-xs text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          Click to replay
        </motion.div>
      </motion.div>
    </motion.button>
  );
}