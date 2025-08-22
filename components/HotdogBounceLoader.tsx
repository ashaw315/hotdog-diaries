"use client";
import React from "react";

/**
 * Hotdog Bounce Loader — Motion Path + Disney principles (3-up wave)
 * - Three hotdogs side-by-side, staggered in phase
 * - Wave effect: closer staggering for ripple-like timing
 * - Perfect arc via motion path; fallback to transform keyframes
 * - Squash on land → lift stretch → apex stretch → pre-impact → squash
 * - Slower descent; approximate volume preservation
 */

interface HotdogBounceLoaderProps {
  showControls?: boolean;
}

export default function HotdogBounceLoader({ showControls = false }: HotdogBounceLoaderProps) {
  const [height, setHeight] = React.useState(220);
  const [duration, setDuration] = React.useState(1.6);
  const [squash, setSquash] = React.useState(0.22);
  const [arc, setArc] = React.useState(1.0); // 0.6–1.6 feels good

  // Deformations with approximate volume preservation
  const squashY = Math.max(0.55, 1 - squash);
  const squashX = 1 / squashY;
  const liftY = 1 + squash * 0.22; // gentle lift stretch
  const liftX = 1 / liftY;
  const airY = 1 + squash * 0.55; // apex stretch
  const airX = 1 / airY;

  // Arc geometry
  const arcBase = Math.max(6, Math.min(18, Math.round(height * 0.07)));
  const arcPx = Math.round(arcBase * arc);
  const apexY = -height;
  const pathStr = `M 0 0 C -${arcPx} ${apexY * 0.4}, -${Math.round(arcPx * 0.6)} ${Math.round(
    apexY * 0.8
  )}, 0 ${apexY}, ${Math.round(arcPx * 0.6)} ${Math.round(apexY * 0.8)}, ${arcPx} ${
    apexY * 0.4
  }, 0 0`;

  // Wave-like staggered negative delays: tighter spacing (1/6th cycle apart)
  const delays = React.useMemo(() => [0, -(duration / 6), -(2 * duration) / 6], [duration]);

  const vars = React.useMemo(
    () => ({
      "--duration": `${duration}s`,
      "--sqx": String(squashX),
      "--sqy": String(squashY),
      "--liftx": String(liftX),
      "--lifty": String(liftY),
      "--airx": String(airX),
      "--airy": String(airY),
      "--shadowBase": "240px",
    }),
    [duration, squashX, squashY, liftX, liftY, airX, airY]
  );

  const containerClasses = showControls 
    ? "min-h-screen text-neutral-100 flex flex-col items-center justify-center p-6"
    : "fixed inset-0 text-neutral-100 flex flex-col items-center justify-center p-6" 
    + " z-[99999]"; // Very high z-index to ensure it shows above everything

  return (
    <div 
      className={containerClasses}
      style={{
        background: 'white',
        height: '100vh',
      }}
    >
      <style>{`
        /* Hotdog color theme variables */
        :root {
          --ketchup: #CC2522;
          --mustard: #E8AE02;
          --bun: #F6D18B;
          --relish: #4A7C59;
        }
        
        /* --- Motion Path version --- */
        @supports (offset-path: path("M0 0 L10 10")) {
          .hotdog {
            offset-rotate: 0deg;
            will-change: transform, offset-distance;
            animation: offsetAnim var(--duration) infinite, deformAnim var(--duration) infinite;
          }

          @keyframes offsetAnim {
            0%   { animation-timing-function: cubic-bezier(.15,.8,.25,1); offset-distance: 0%; }
            38%  { animation-timing-function: cubic-bezier(.35,0,.2,1); offset-distance: 50%; }
            100% { offset-distance: 100%; }
          }

          @keyframes deformAnim {
            0%   { transform: rotate(0deg) scaleX(var(--sqx)) scaleY(var(--sqy)); }
            8%   { transform: rotate(-3deg) scaleX(var(--liftx)) scaleY(var(--lifty)); }
            24%  { transform: rotate(0deg) scaleX(calc((var(--liftx)+var(--airx))*0.5)) scaleY(calc((var(--lifty)+var(--airy))*0.5)); }
            50%  { transform: rotate(0deg) scaleX(var(--airx)) scaleY(var(--airy)); }
            62%  { transform: rotate(3deg) scaleX(calc(var(--airx)*.99)) scaleY(calc(var(--airy)*1.01)); }
            88%  { transform: rotate(0deg) scaleX(1.02) scaleY(0.98); }
            100% { transform: rotate(0deg) scaleX(var(--sqx)) scaleY(var(--sqy)); }
          }
        }

        @supports not (offset-path: path("M0 0 L10 10")) {
          @keyframes bounceAnim {
            0%   { transform: translate3d(0,0,0) translateX(0) translateY(0) rotate(0deg) scaleX(var(--sqx)) scaleY(var(--sqy)); }
            6%   { transform: translate3d(0,0,0) translateX(-${Math.round(arcPx * 0.25)}px) translateY(${Math.round(
              apexY * 0.1
            )}px) rotate(-3deg) scaleX(var(--liftx)) scaleY(var(--lifty)); }
            24%  { transform: translate3d(0,0,0) translateX(-${Math.round(arcPx * 0.1)}px) translateY(${Math.round(
              apexY * 0.6
            )}px) rotate(0deg) scaleX(calc((var(--liftx)+var(--airx))*0.5)) scaleY(calc((var(--lifty)+var(--airy))*0.5)); }
            38%  { transform: translate3d(0,0,0) translateX(0) translateY(${apexY}px) rotate(0deg) scaleX(var(--airx)) scaleY(var(--airy)); }
            60%  { transform: translate3d(0,0,0) translateX(${Math.round(arcPx * 0.35)}px) translateY(${Math.round(
              apexY * 0.55
            )}px) rotate(3deg) scaleX(0.995) scaleY(1.005); }
            78%  { transform: translate3d(0,0,0) translateX(${Math.round(arcPx * 0.55)}px) translateY(${Math.round(
              apexY * 0.25
            )}px) rotate(0deg) scaleX(1.01) scaleY(0.99); }
            92%  { transform: translate3d(0,0,0) translateX(${Math.round(arcPx * 0.65)}px) translateY(6px) rotate(0deg) scaleX(1.02) scaleY(0.98); }
            100% { transform: translate3d(0,0,0) translateX(0) translateY(0) rotate(0deg) scaleX(var(--sqx)) scaleY(var(--sqy)); }
          }
          .hotdog { animation: bounceAnim var(--duration) infinite cubic-bezier(.25,.8,.25,1); }
        }

        @keyframes shadowAnim {
          0%,100% { transform: scale(1); opacity:0.55; filter:blur(1.5px); }
          38% { transform: scale(0.6); opacity:0.22; filter:blur(1px); }
          70% { transform: scale(0.8); opacity:0.34; filter:blur(1.2px); }
        }
        
        /* Text bounce wave animation */
        @keyframes textBounce {
          0%, 100% { 
            transform: translateY(0px); 
          }
          50% { 
            transform: translateY(-4px); 
          }
        }
        
        .bounce-text {
          display: inline-block;
          animation: textBounce 1.2s ease-in-out infinite;
        }
        
        /* Staggered delays for wave effect */
        .bounce-text:nth-child(1) { animation-delay: 0ms; }
        .bounce-text:nth-child(2) { animation-delay: 100ms; }
        .bounce-text:nth-child(3) { animation-delay: 200ms; }
        .bounce-text:nth-child(4) { animation-delay: 300ms; }
        .bounce-text:nth-child(5) { animation-delay: 400ms; }
        .bounce-text:nth-child(6) { animation-delay: 500ms; }
        .bounce-text:nth-child(7) { animation-delay: 600ms; }
        .bounce-text:nth-child(8) { animation-delay: 700ms; }
        .bounce-text:nth-child(9) { animation-delay: 800ms; }
        .bounce-text:nth-child(10) { animation-delay: 900ms; }
        .bounce-text:nth-child(11) { animation-delay: 1000ms; }
        .bounce-text:nth-child(12) { animation-delay: 1100ms; }
        .bounce-text:nth-child(13) { animation-delay: 1200ms; }
        .bounce-text:nth-child(14) { animation-delay: 1300ms; }
        .bounce-text:nth-child(15) { animation-delay: 1400ms; }
        .bounce-text:nth-child(16) { animation-delay: 1500ms; }
        .bounce-text:nth-child(17) { animation-delay: 1600ms; }
        .bounce-text:nth-child(18) { animation-delay: 1700ms; }
        .bounce-text:nth-child(19) { animation-delay: 1800ms; }
        .bounce-text:nth-child(20) { animation-delay: 1900ms; }
        .bounce-text:nth-child(21) { animation-delay: 2000ms; }
        .bounce-text:nth-child(22) { animation-delay: 2100ms; }
        .bounce-text:nth-child(23) { animation-delay: 2200ms; }
        .bounce-text:nth-child(24) { animation-delay: 2300ms; }
        .bounce-text:nth-child(25) { animation-delay: 2400ms; }
        
        /* Hotdog color cycling for letters */
        .color-ketchup { color: var(--ketchup); }
        .color-mustard { color: var(--mustard); }
        .color-bun { color: var(--bun); }
        .color-relish { color: var(--relish); }
      `}</style>

      {/* Hotdog animation container */}
      <div className="absolute top-1/2 left-1/2" style={{ transform: 'translate(-33%, -18%)' }}>
        <div className="relative max-w-4xl h-[360px] flex items-center justify-center gap-12">
          {delays.map((d, i) => (
            <HotdogSlot key={i} i={i} delay={d} pathStr={pathStr} vars={vars} />
          ))}
        </div>
      </div>

      {/* Loading text container - positioned independently */}
      <div className="absolute top-1/2 left-1/2" style={{ transform: 'translate(-50%, 120px)' }}>
        <div className="text-center bg-black/70 px-8 py-4 rounded-xl backdrop-blur-sm">
          <h2 className="text-2xl font-bold mb-2">
            <AnimatedLoadingText />
          </h2>
          <p className="text-neutral-300">Finding the best hotdog content for you</p>
        </div>
      </div>

      {showControls && (
        <>
          <div className="mt-8 w-full max-w-2xl grid gap-4 rounded-2xl bg-neutral-900/60 p-4 shadow-xl ring-1 ring-white/10">
            <Control label="Height" value={height} min={120} max={340} step={1} onChange={setHeight} suffix="px" />
            <Control label="Duration" value={duration} min={0.9} max={2.6} step={0.05} onChange={setDuration} suffix="s" />
            <Control label="Squash" value={squash} min={0.06} max={0.35} step={0.01} onChange={setSquash} />
            <Control label="Arc" value={arc} min={0.6} max={1.6} step={0.02} onChange={setArc} />
            <p className="text-xs text-neutral-400">Three hotdogs, wave stagger. Descent is slower; impact squash leads into the next jump.</p>
          </div>

          <DevTests height={height} duration={duration} squash={squash} arcPx={arcPx} pathStr={pathStr} delays={delays} />
        </>
      )}
    </div>
  );
}

function AnimatedLoadingText() {
  const text = "Loading Hot Dogs";
  const colors = ['color-ketchup', 'color-mustard', 'color-bun', 'color-relish'];
  
  return (
    <>
      {text.split('').map((char, index) => {
        const colorClass = colors[index % colors.length];
        return (
          <span 
            key={index} 
            className={`bounce-text ${colorClass}`}
            style={{ 
              display: char === ' ' ? 'inline' : 'inline-block',
              width: char === ' ' ? '0.3em' : 'auto'
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </>
  );
}

function HotdogSlot({ i, delay, pathStr, vars }: { i: number; delay: number; pathStr: string; vars: Record<string, string> }) {
  return (
    <div className="relative w-[300px] h-full flex items-center justify-center" data-i={i}>
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-8 rounded-full"
        style={{
          width: "var(--shadowBase)",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 70%)",
          animation: "shadowAnim var(--duration) infinite ease-in-out",
          animationDelay: `${delay}s`,
        }}
      />
      <div
        className="will-change-transform select-none hotdog"
        data-testid={`hotdog-wrapper-${i}`}
        style={{
          transformOrigin: "center bottom",
          offsetPath: `path('${pathStr}')`,
          WebkitOffsetPath: `path('${pathStr}')`,
          offsetRotate: "0deg",
          animationDelay: `${delay}s, ${delay}s`,
          ...vars,
        }}
        aria-label={`Loading hotdog ${i + 1}`}
        role="img"
        data-anim
      >
        <HotdogSVG />
      </div>
    </div>
  );
}

function Control({ label, value, onChange, min, max, step, suffix }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <label className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
      <span className="text-neutral-300">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-yellow-400"
        data-testid={`slider-${label.toLowerCase()}`}
      />
      <span className="tabular-nums text-neutral-400 min-w-[54px] text-right">{value}{suffix ?? ""}</span>
    </label>
  );
}

function DevTests({ height, duration, squash, arcPx, pathStr, delays }: {
  height: number;
  duration: number;
  squash: number;
  arcPx: number;
  pathStr: string;
  delays: number[];
}) {
  const squashY = Math.max(0.55, 1 - squash);
  const squashX = 1 / squashY;
  const airY = 1 + squash * 0.55;
  const airX = 1 / airY;

  const tests = [
    { name: "height within bounds (120–340px)", pass: height >= 120 && height <= 340 },
    { name: "duration within bounds (0.9–2.6s)", pass: duration >= 0.9 && duration <= 2.6 },
    { name: "squash within bounds (0.06–0.35)", pass: squash >= 0.06 && squash <= 0.35 },
    { name: "ground volume ≈ 1", pass: Math.abs(squashX * squashY - 1) < 0.05 },
    { name: "air volume ≈ 1", pass: Math.abs(airX * airY - 1) < 0.05 },
    { name: "arcPx within 4–30px", pass: arcPx >= 4 && arcPx <= 30 },
    { name: "path string built", pass: typeof pathStr === 'string' && pathStr.length > 0 },
    { name: "three instances", pass: Array.isArray(delays) && delays.length === 3 },
    { name: "wave delays monotonic", pass: Array.isArray(delays) && delays[0] === 0 && delays[1] < 0 && delays[2] < delays[1] },
  ];

  return (
    <div className="mt-4 w-full max-w-2xl rounded-xl bg-neutral-900/70 p-3 ring-1 ring-white/10">
      <p className="text-xs font-medium text-neutral-300 mb-2">Runtime checks</p>
      <ul className="text-xs grid gap-1">
        {tests.map((t) => (
          <li key={t.name} className={t.pass ? "text-green-400" : "text-red-400"}>
            {t.pass ? "✓" : "✗"} {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HotdogSVG() {
  return (
    <svg width="300" height="120" viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity=".35" />
        </filter>
        <linearGradient id="bun" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F6D18B" />
          <stop offset="100%" stopColor="#E5B873" />
        </linearGradient>
        <linearGradient id="dog" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C94C31" />
          <stop offset="100%" stopColor="#A73D28" />
        </linearGradient>
      </defs>

      <g filter="url(#shadow)">
        <rect x="10" y="58" width="280" height="44" rx="22" fill="url(#bun)" />
        <rect x="20" y="30" width="260" height="60" rx="30" fill="url(#dog)" />
        <rect x="10" y="18" width="280" height="44" rx="22" fill="url(#bun)" />
        <path d="M 30 54 C 60 34, 90 74, 120 54 S 180 34, 210 54 240 74, 270 54" fill="none" stroke="#F4D43F" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}