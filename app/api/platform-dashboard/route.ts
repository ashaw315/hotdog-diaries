import { NextResponse } from 'next/server';

export async function GET() {
  // Quick visual dashboard
  const platforms = {
    reddit: { emoji: '🟠', name: 'Reddit' },
    youtube: { emoji: '🔴', name: 'YouTube' },
    giphy: { emoji: '🎬', name: 'Giphy' },
    pixabay: { emoji: '🖼️', name: 'Pixabay' },
    bluesky: { emoji: '🦋', name: 'Bluesky' },
    imgur: { emoji: '🟢', name: 'Imgur' },
    lemmy: { emoji: '🐭', name: 'Lemmy' },
    tumblr: { emoji: '🔵', name: 'Tumblr' }
  };
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HotDog Diaries - Platform Status Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: system-ui, -apple-system, sans-serif; 
          padding: 20px; 
          background: linear-gradient(135deg, #ff6b6b, #ffa500); 
          margin: 0;
          min-height: 100vh;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        h1 { 
          text-align: center; 
          color: #333; 
          margin-bottom: 30px;
          font-size: 2.5em;
        }
        .summary {
          display: flex;
          justify-content: space-around;
          margin-bottom: 40px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 12px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-number {
          font-size: 2em;
          font-weight: bold;
          color: #ff6b6b;
        }
        .grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
          gap: 20px; 
          margin-bottom: 40px;
        }
        .card { 
          background: white; 
          padding: 25px; 
          border-radius: 12px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border: 1px solid #e0e0e0;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
        .emoji { 
          font-size: 2.5em; 
          margin-bottom: 10px;
          display: block;
        }
        .platform-name {
          font-size: 1.3em;
          font-weight: 600;
          margin-bottom: 15px;
          color: #333;
        }
        .status { 
          margin-top: 10px; 
          font-weight: bold; 
          padding: 8px 12px;
          border-radius: 6px;
          text-align: center;
        }
        .working { 
          background: #d4edda;
          color: #155724; 
          border: 1px solid #c3e6cb;
        }
        .failed { 
          background: #f8d7da;
          color: #721c24; 
          border: 1px solid #f5c6cb;
        }
        .unknown { 
          background: #fff3cd;
          color: #856404; 
          border: 1px solid #ffeaa7;
        }
        .actions {
          margin-top: 40px;
          padding: 30px;
          background: #f8f9fa;
          border-radius: 12px;
          text-align: center;
        }
        .btn {
          background: #ff6b6b;
          color: white;
          border: none;
          padding: 12px 24px;
          margin: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #ff5252;
        }
        .btn-secondary {
          background: #6c757d;
        }
        .btn-secondary:hover {
          background: #5a6268;
        }
        .loading {
          display: none;
          margin-top: 20px;
          text-align: center;
          color: #666;
        }
        .results {
          margin-top: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          max-height: 400px;
          overflow-y: auto;
          display: none;
        }
        @media (max-width: 768px) {
          .summary {
            flex-direction: column;
            gap: 20px;
          }
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌭 HotDog Diaries Platform Status</h1>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-number" id="total-platforms">8</div>
            <div>Total Platforms</div>
          </div>
          <div class="summary-item">
            <div class="summary-number" id="working-platforms">?</div>
            <div>Working</div>
          </div>
          <div class="summary-item">
            <div class="summary-number" id="configured-platforms">?</div>
            <div>Configured</div>
          </div>
        </div>
        
        <div class="grid" id="platform-grid">
  `;
  
  for (const [key, platform] of Object.entries(platforms)) {
    const hasKey = await checkPlatformKey(key);
    const status = hasKey ? 'working' : 'unknown';
    
    html += `
      <div class="card" id="card-${key}">
        <div class="emoji">${platform.emoji}</div>
        <div class="platform-name">${platform.name}</div>
        <div class="status ${status}" id="status-${key}">
          ${hasKey ? '🔑 API Key Configured' : '⚠️ Checking...'}
        </div>
        <div class="details" id="details-${key}" style="margin-top: 10px; font-size: 0.9em; color: #666;">
          Status unknown - click "Check All Platforms" to update
        </div>
      </div>
    `;
  }
  
  html += `
        </div>
        
        <div class="actions">
          <h2 style="margin-bottom: 20px;">Quick Actions</h2>
          <button class="btn" onclick="checkAllPlatforms()">
            🔍 Check All Platforms
          </button>
          <button class="btn btn-secondary" onclick="runDailyScan()">
            🤖 Run Daily Scan
          </button>
          <button class="btn btn-secondary" onclick="window.open('/admin', '_blank')">
            ⚙️ Admin Dashboard
          </button>
          
          <div class="loading" id="loading">
            <div>⏳ Checking platforms...</div>
          </div>
          
          <div class="results" id="results"></div>
        </div>
      </div>

      <script>
        async function checkAllPlatforms() {
          document.getElementById('loading').style.display = 'block';
          document.getElementById('results').style.display = 'none';
          
          try {
            const response = await fetch('/api/check-all-platforms');
            const data = await response.json();
            
            if (data.success) {
              updateDashboard(data.results, data.report);
              document.getElementById('results').innerHTML = '<pre>' + JSON.stringify(data.report, null, 2) + '</pre>';
              document.getElementById('results').style.display = 'block';
            } else {
              throw new Error('Check failed');
            }
          } catch (error) {
            document.getElementById('results').innerHTML = '<div style="color: red;">Error: ' + error.message + '</div>';
            document.getElementById('results').style.display = 'block';
          }
          
          document.getElementById('loading').style.display = 'none';
        }
        
        async function runDailyScan() {
          document.getElementById('loading').style.display = 'block';
          
          try {
            const response = await fetch('/api/admin/social/scan-all', { method: 'POST' });
            const data = await response.json();
            
            document.getElementById('results').innerHTML = '<pre>Scan Result:\\n' + JSON.stringify(data, null, 2) + '</pre>';
            document.getElementById('results').style.display = 'block';
          } catch (error) {
            document.getElementById('results').innerHTML = '<div style="color: red;">Scan Error: ' + error.message + '</div>';
            document.getElementById('results').style.display = 'block';
          }
          
          document.getElementById('loading').style.display = 'none';
        }
        
        function updateDashboard(results, report) {
          // Update summary numbers
          document.getElementById('working-platforms').textContent = results.summary.working;
          document.getElementById('configured-platforms').textContent = results.summary.configured;
          
          // Update each platform card
          Object.entries(results.platforms).forEach(([platform, data]) => {
            const card = document.getElementById('card-' + platform);
            const statusEl = document.getElementById('status-' + platform);
            const detailsEl = document.getElementById('details-' + platform);
            
            if (statusEl && detailsEl) {
              if (data.success) {
                statusEl.className = 'status working';
                statusEl.textContent = '✅ Working';
                detailsEl.textContent = data.message || 'Platform operational';
              } else {
                statusEl.className = 'status failed';
                statusEl.textContent = '❌ Failed';
                detailsEl.textContent = data.error || 'Platform not working';
              }
            }
          });
        }
        
        // Auto-check on page load
        window.addEventListener('load', () => {
          setTimeout(checkAllPlatforms, 1000);
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function checkPlatformKey(platform: string): Promise<boolean> {
  switch(platform) {
    case 'reddit': return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
    case 'youtube': return !!process.env.YOUTUBE_API_KEY;
    case 'giphy': return !!process.env.GIPHY_API_KEY;
    case 'pixabay': return !!process.env.PIXABAY_API_KEY;
    case 'bluesky': return !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_PASSWORD);
    case 'imgur': return !!process.env.IMGUR_CLIENT_ID;
    case 'lemmy': return true; // No API key needed
    case 'tumblr': return !!(process.env.TUMBLR_CONSUMER_KEY);
    default: return false;
  }
}