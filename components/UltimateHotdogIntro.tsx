'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

export default function UltimateHotdogIntro() {
  const [phase, setPhase] = useState<'flicker' | 'squirt' | 'sizzle' | 'neon' | 'done'>('flicker');
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [hasVisited, setHasVisited] = useState(false);

  useEffect(() => {
    // Check if user has seen intro before
    const visited = localStorage.getItem('hasSeenEpicIntro');
    if (visited) {
      setHasVisited(true);
      setPhase('done');
      return;
    }

    if (skipAnimation) {
      setPhase('done');
      localStorage.setItem('hasSeenEpicIntro', 'true');
      return;
    }

    const sequence = async () => {
      // Phase 1: Flicker (0.8s)
      await new Promise(resolve => setTimeout(resolve, 800));
      setPhase('squirt');
      
      // Phase 2: Squirt (1.7s)
      await new Promise(resolve => setTimeout(resolve, 1700));
      setPhase('sizzle');
      
      // Phase 3: Sizzle (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhase('neon');
      
      // Phase 4: Neon (1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhase('done');
      localStorage.setItem('hasSeenEpicIntro', 'true');
    };

    sequence();
  }, [skipAnimation]);

  if (phase === 'done') {
    return <LogoInCorner />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 z-50 overflow-hidden"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background that changes per phase */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: phase === 'flicker' ? '#0a0a0a' :
                      phase === 'squirt' ? 'linear-gradient(135deg, #FFF3E0 0%, #FFECB3 100%)' :
                      phase === 'sizzle' ? 'linear-gradient(180deg, #3E2723 0%, #5D4037 100%)' :
                      'linear-gradient(180deg, #1a0033 0%, #330066 50%, #000 100%)'
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Phase Content */}
        {phase === 'flicker' && <FlickerPhase />}
        {phase === 'squirt' && <SquirtPhase />}
        {phase === 'sizzle' && <SizzlePhase />}
        {phase === 'neon' && <NeonPhase />}

        {/* Skip button */}
        <motion.button
          className="absolute bottom-10 right-10 px-6 py-3 text-white/70 hover:text-white 
                     bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-sm 
                     transition-all duration-300 font-medium text-sm md:text-base"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          onClick={() => setSkipAnimation(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Skip Intro →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

// PHASE 1: Flicker Component
function FlickerPhase() {
  const [isOn, setIsOn] = useState(false);
  
  useEffect(() => {
    const flickers = [100, 200, 350, 500, 650, 750];
    flickers.forEach(delay => {
      setTimeout(() => setIsOn(prev => !prev), delay);
    });
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      <motion.div
        animate={{
          opacity: isOn ? 1 : 0.1,
          scale: isOn ? 1 : 0.95
        }}
        transition={{ duration: 0.05 }}
        className="text-center"
      >
        <h1 
          className="text-6xl md:text-8xl lg:text-9xl font-bold"
          style={{
            fontFamily: "'Bungee', cursive",
            color: isOn ? '#FF69B4' : '#333',
            textShadow: isOn ? `
              0 0 10px #FF69B4,
              0 0 20px #FF69B4,
              0 0 30px #FF1493,
              0 0 40px #FF1493
            ` : 'none',
            filter: isOn ? 'brightness(1.2)' : 'brightness(0.3)'
          }}
        >
          COMING
        </h1>
        <div className="text-4xl md:text-6xl mt-4" style={{ opacity: isOn ? 1 : 0.2 }}>
          ⚡
        </div>
      </motion.div>
    </div>
  );
}

// PHASE 2: Squirt Component
function SquirtPhase() {
  return (
    <div className="flex items-center justify-center h-full relative">
      {/* Ketchup bottle */}
      <motion.div
        className="absolute left-4 md:left-10 top-20 text-4xl md:text-6xl"
        initial={{ x: -200, rotate: 0 }}
        animate={{ x: 50, rotate: 45 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <div style={{ transform: 'scaleX(-1)' }}>🍾</div>
      </motion.div>

      {/* Mustard bottle */}
      <motion.div
        className="absolute right-4 md:right-10 top-40 text-4xl md:text-6xl"
        initial={{ x: 200, rotate: 0 }}
        animate={{ x: -50, rotate: -45 }}
        transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
      >
        🍾
      </motion.div>

      <div className="text-center px-4">
        {/* HotDog text */}
        <motion.h1
          className="text-6xl md:text-8xl lg:text-9xl font-bold mb-4"
          style={{ fontFamily: "'Bungee', cursive" }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          {"HotDog".split('').map((char, i) => (
            <motion.span
              key={i}
              style={{ 
                display: 'inline-block',
                color: '#FF0000',
                textShadow: '3px 3px 6px rgba(0,0,0,0.3)'
              }}
              initial={{ opacity: 0, y: -50, rotate: -180 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ 
                delay: i * 0.1,
                type: "spring",
                damping: 10,
                stiffness: 200
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>

        {/* Diaries text */}
        <motion.h2
          className="text-4xl md:text-6xl lg:text-7xl"
          style={{ 
            fontFamily: "'Pacifico', cursive",
            color: '#FFD700',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            delay: 0.5,
            duration: 0.8,
            type: "spring",
            bounce: 0.3
          }}
        >
          Diaries
        </motion.h2>
      </div>

      {/* Splatter effects */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 md:w-4 md:h-4 rounded-full"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${20 + Math.random() * 60}%`,
            backgroundColor: i % 2 ? "#FF0000" : "#FFD700"
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.5, 1],
            opacity: [0, 1, 0.8]
          }}
          transition={{ 
            delay: Math.random() * 0.5,
            duration: 0.3
          }}
        />
      ))}
    </div>
  );
}

// PHASE 3: Sizzle Component
function SizzlePhase() {
  return (
    <div className="flex items-center justify-center h-full relative">
      {/* Smoke particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-16 h-16 md:w-32 md:h-32 bg-gray-300 rounded-full filter blur-2xl"
          initial={{ 
            x: window.innerWidth / 2 + (i * 30 - 180),
            y: window.innerHeight / 2,
            opacity: 0,
            scale: 0
          }}
          animate={{ 
            y: -100,
            opacity: [0, 0.4, 0],
            scale: [0, 2, 3]
          }}
          transition={{
            duration: 2,
            delay: i * 0.1,
            ease: "easeOut"
          }}
        />
      ))}

      {/* Grill marks */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-full h-0.5 bg-black"
            style={{ top: `${40 + i * 5}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          />
        ))}
      </div>

      <motion.div
        className="text-center relative z-10 px-4"
        animate={{
          filter: ["brightness(1)", "brightness(0.7)", "brightness(1.1)"],
        }}
        transition={{ duration: 1, repeat: 1 }}
      >
        <motion.h1
          className="text-6xl md:text-8xl lg:text-9xl font-bold"
          style={{
            fontFamily: "'Bungee', cursive",
            background: 'linear-gradient(180deg, #8B4513 0%, #A0522D 50%, #6B4423 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(3px 3px 6px rgba(0,0,0,0.5))'
          }}
        >
          HotDog
        </motion.h1>
        <motion.h2
          className="text-4xl md:text-6xl lg:text-7xl mt-2"
          style={{
            fontFamily: "'Pacifico', cursive",
            color: '#FFD700',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          Diaries
        </motion.h2>
      </motion.div>
    </div>
  );
}

// PHASE 4: Neon Component
function NeonPhase() {
  return (
    <div className="flex items-center justify-center h-full px-4">
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        {/* Neon sign frame */}
        <motion.div
          className="absolute inset-0 -m-4 md:-m-8 border-2 md:border-4 border-pink-500 rounded-3xl"
          animate={{
            boxShadow: [
              "0 0 20px #FF69B4",
              "0 0 40px #FF69B4",
              "0 0 20px #FF69B4"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Main text */}
        <div className="text-center relative z-10 p-4 md:p-8">
          <motion.h1
            className="text-6xl md:text-8xl lg:text-9xl font-bold"
            style={{
              fontFamily: "'Bungee', cursive",
              color: '#FF69B4',
              textShadow: `
                0 0 10px #FF69B4,
                0 0 20px #FF69B4,
                0 0 30px #FF1493,
                0 0 40px #FF1493,
                0 0 50px #FF1493
              `
            }}
            animate={{
              textShadow: [
                `0 0 10px #FF69B4, 0 0 20px #FF69B4, 0 0 30px #FF1493`,
                `0 0 20px #FF69B4, 0 0 30px #FF69B4, 0 0 40px #FF1493`,
                `0 0 10px #FF69B4, 0 0 20px #FF69B4, 0 0 30px #FF1493`
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            HotDog
          </motion.h1>
          
          <motion.h2
            className="text-4xl md:text-6xl lg:text-7xl -mt-2 md:-mt-4"
            style={{
              fontFamily: "'Pacifico', cursive",
              color: '#00FFFF',
              textShadow: `
                0 0 10px #00FFFF,
                0 0 20px #00FFFF,
                0 0 30px #00CED1
              `
            }}
          >
            Diaries
          </motion.h2>

          {/* "OPEN 24/7" badge */}
          <motion.div
            className="inline-block mt-4 px-3 md:px-4 py-2 bg-red-600 rounded-full"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring" }}
            style={{
              boxShadow: '0 0 20px rgba(255,0,0,0.8)'
            }}
          >
            <span className="text-white font-bold text-sm md:text-xl">OPEN 24/7</span>
          </motion.div>
        </div>

        {/* Flickering effect */}
        <motion.div
          className="absolute inset-0 bg-white rounded-3xl"
          animate={{
            opacity: [0, 0, 0.1, 0, 0, 0, 0.05, 0]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
}

// Final logo in corner
function LogoInCorner() {
  return (
    <motion.div
      className="fixed top-4 left-4 z-40"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
    >
      <motion.div 
        className="px-3 md:px-4 py-2 rounded-xl cursor-pointer transition-transform"
        style={{
          background: 'linear-gradient(135deg, #FF0000 0%, #FFD700 100%)',
          boxShadow: '0 4px 20px rgba(255,0,0,0.3)'
        }}
        onClick={() => {
          localStorage.removeItem('hasSeenEpicIntro');
          window.location.reload();
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <h1 
          className="text-xl md:text-2xl font-bold text-white"
          style={{ fontFamily: "'Bungee', cursive" }}
        >
          HD
        </h1>
        <p 
          className="text-xs text-white/90 -mt-1"
          style={{ fontFamily: "'Pacifico', cursive" }}
        >
          Diaries
        </p>
      </motion.div>
    </motion.div>
  );
}