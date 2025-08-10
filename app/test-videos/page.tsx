'use client';
import { useEffect, useState } from 'react';

export default function TestVideos() {
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    // Intercept console errors
    const originalError = console.error;
    console.error = (...args) => {
      setErrors(prev => [...prev, args.join(' ')]);
      originalError(...args);
    };
    
    // Monitor network failures
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('googlevideo') || entry.name.includes('youtube')) {
          setLogs(prev => [...prev, `Network: ${entry.name} - Status: ${(entry as any).responseStatus || 'BLOCKED'}`]);
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });
    
    return () => {
      console.error = originalError;
      observer.disconnect();
    };
  }, []);
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Video Playback Test</h1>
      
      {/* Test each platform */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border p-2">
          <h2 className="font-bold">YouTube (Should be iframe)</h2>
          <div className="relative w-full h-64 bg-gray-100">
            {/* THIS MUST BE AN IFRAME */}
            <iframe
              src="https://www.youtube.com/embed/eIwOI0XLCTk?autoplay=1&mute=1&controls=1"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        
        <div className="border p-2">
          <h2 className="font-bold">Imgur (Should be video)</h2>
          <div className="relative w-full h-64 bg-gray-100">
            <video
              src="https://i.imgur.com/example.mp4"
              className="absolute inset-0 w-full h-full object-contain"
              autoPlay
              muted
              loop
              playsInline
              onError={(e) => console.error('Imgur video failed')}
            />
          </div>
        </div>
      </div>
      
      {/* Error display */}
      <div className="mt-4">
        <h2 className="font-bold text-red-600">Errors: {errors.length}</h2>
        <pre className="bg-red-50 p-2 text-xs overflow-auto max-h-40">
          {errors.join('\n')}
        </pre>
      </div>
      
      <div className="mt-4">
        <h2 className="font-bold">Network Logs:</h2>
        <pre className="bg-gray-50 p-2 text-xs overflow-auto max-h-40">
          {logs.join('\n')}
        </pre>
      </div>
    </div>
  );
}