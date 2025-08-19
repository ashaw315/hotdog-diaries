export default function EmergencyPage() {
  return (
    <html>
      <head>
        <title>Hotdog Diaries - Emergency Mode</title>
        <style>{`
          body { 
            font-family: system-ui, sans-serif; 
            margin: 0; 
            padding: 50px; 
            text-align: center; 
            background: #fff3e0;
            color: #333;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 30px; 
            background: white; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .hotdog { font-size: 100px; margin: 20px 0; }
          .status { color: #e65100; font-weight: bold; }
          .actions { margin-top: 30px; }
          .btn { 
            display: inline-block; 
            padding: 12px 24px; 
            margin: 8px; 
            background: #ff7043; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            font-weight: 500;
          }
          .btn:hover { background: #f4511e; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="hotdog">🌭</div>
          <h1>Hotdog Diaries</h1>
          <p className="status">Emergency Mode Active</p>
          <p>The main application is temporarily unavailable due to deployment issues.</p>
          
          <div className="actions">
            <a href="/api/ping" className="btn">Test API</a>
            <a href="/api/init-db" className="btn">Initialize Database</a>
            <a href="/setup" className="btn">Setup Guide</a>
          </div>
          
          <div style={{marginTop: '30px', fontSize: '14px', color: '#666'}}>
            <p><strong>Status:</strong> Deployment in progress</p>
            <p><strong>Time:</strong> {new Date().toISOString()}</p>
          </div>
        </div>
      </body>
    </html>
  );
}