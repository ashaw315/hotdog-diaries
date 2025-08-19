'use client';
import { useState, useEffect } from 'react';

interface QueueStatus {
  total: number;
  readyToPost: number;
  daysOfContent: number;
}

interface LastRun {
  timestamp: string;
  success?: boolean;
  scanning?: { success: boolean; message: string };
  posting?: { success: boolean; message: string };
  queueStatus?: QueueStatus;
}

export function DailyCronStatus() {
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/cron-status');
      if (response.ok) {
        const data = await response.json();
        setLastRun(data.lastRun);
        setQueueStatus(data.queueStatus);
        setNextRun(data.nextRun);
      }
    } catch (error) {
      console.error('Failed to fetch cron status:', error);
    }
  };

  const triggerDailyCron = async () => {
    setTriggerLoading(true);
    try {
      const response = await fetch('/api/cron/daily', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-secret'}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Daily cron executed successfully!\n\nScanning: ${result.scanning?.message}\nPosting: ${result.posting?.message}`);
      } else {
        alert(`Daily cron failed: ${result.error}`);
      }
      
      // Refresh status after execution
      setTimeout(fetchStatus, 1000);
    } catch (error) {
      alert('Failed to trigger daily cron');
    } finally {
      setTriggerLoading(false);
    }
  };

  const triggerManualPost = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/post/trigger', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Manual post successful: ${result.message}`);
      } else {
        alert(`Manual post failed: ${result.message || 'Unknown error'}`);
      }
      
      setTimeout(fetchStatus, 1000);
    } catch (error) {
      alert('Failed to trigger manual posting');
    } finally {
      setLoading(false);
    }
  };

  const triggerEmergencyScan = async () => {
    setTriggerLoading(true);
    try {
      const response = await fetch('/api/admin/emergency-scan', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        alert(`🚨 Emergency scan complete!\n\nFound: ${data.scanResult?.totalItems || 0} new items\nApproved: ${data.approvalResult?.total || 0} items\nQueue now has: ${data.queueStats?.daysOfContent || 0} days of content`);
      } else {
        alert(`Emergency scan failed: ${result.message || 'Unknown error'}`);
      }
      
      setTimeout(fetchStatus, 1000);
    } catch (error) {
      alert('Emergency scan failed');
    } finally {
      setTriggerLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getQueueStatusColor = (days: number) => {
    if (days >= 14) return 'text-green-600';
    if (days >= 7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        📅 Daily Automation Status
      </h2>

      {/* Emergency Alert */}
      {queueStatus?.readyToPost === 0 && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg">
          <h3 className="text-red-700 font-bold flex items-center mb-2">
            🚨 CRITICAL: No Content Available!
          </h3>
          <p className="text-red-600 mb-3">
            The queue is completely empty. No posts can be made until content is scanned and approved.
          </p>
          <button
            onClick={triggerEmergencyScan}
            disabled={triggerLoading}
            className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 font-semibold"
          >
            {triggerLoading ? '🔄 Emergency Scanning...' : '🚨 Emergency Scan All Platforms'}
          </button>
        </div>
      )}

      {/* Warning Alert */}
      {queueStatus && queueStatus.readyToPost > 0 && queueStatus.daysOfContent < 3 && (
        <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-500 rounded-lg">
          <h3 className="text-orange-700 font-bold flex items-center mb-2">
            ⚠️ WARNING: Queue Very Low!
          </h3>
          <p className="text-orange-600 mb-3">
            Only {queueStatus.daysOfContent} days of content remaining. Consider scanning soon.
          </p>
          <button
            onClick={triggerEmergencyScan}
            disabled={triggerLoading}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {triggerLoading ? '🔄 Scanning...' : '🔍 Scan for More Content'}
          </button>
        </div>
      )}
      
      {/* Queue Status */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Content Queue Status</h3>
        {queueStatus ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Content</p>
              <p className="text-2xl font-bold">{queueStatus.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ready to Post</p>
              <p className="text-2xl font-bold">{queueStatus.readyToPost}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Days of Content</p>
              <p className={`text-3xl font-bold ${getQueueStatusColor(queueStatus.daysOfContent)}`}>
                {queueStatus.daysOfContent}
              </p>
              {queueStatus.daysOfContent < 7 && (
                <p className="text-red-600 text-sm mt-1">⚠️ Queue running low - scanning will be triggered</p>
              )}
              {queueStatus.daysOfContent >= 14 && (
                <p className="text-green-600 text-sm mt-1">✅ Queue sufficient - scanning will be skipped</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading queue status...</p>
        )}
      </div>

      {/* Last Run Info */}
      {lastRun && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Last Daily Run</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Time:</span> {formatTime(lastRun.timestamp)}</p>
            <p>
              <span className="font-medium">Status:</span> 
              <span className={lastRun.success ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                {lastRun.success ? '✅ Success' : '❌ Failed'}
              </span>
            </p>
            {lastRun.scanning && (
              <p>
                <span className="font-medium">Scanning:</span>
                <span className={lastRun.scanning.success ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                  {lastRun.scanning.message}
                </span>
              </p>
            )}
            {lastRun.posting && (
              <p>
                <span className="font-medium">Posting:</span>
                <span className={lastRun.posting.success ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                  {lastRun.posting.message}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Next Run Info */}
      {nextRun && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold mb-2">Next Scheduled Run</h3>
          <p className="text-lg">{formatTime(nextRun)}</p>
          <p className="text-sm text-gray-600 mt-1">Daily cron runs at 10:00 AM UTC</p>
        </div>
      )}

      {/* Manual Controls */}
      <div className="space-y-3">
        <button
          onClick={triggerDailyCron}
          disabled={triggerLoading}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {triggerLoading ? '🔄 Running Daily Cron...' : '🔄 Run Daily Cron Now'}
        </button>
        
        <button
          onClick={triggerManualPost}
          disabled={loading}
          className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '⏳ Posting...' : '📝 Post Content Now'}
        </button>
        
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium mb-1">ℹ️ Daily Automation Logic (Updated):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Runs once daily at 10:00 AM UTC (Vercel Hobby plan limit)</li>
            <li><strong>ALWAYS scans</strong> when content is empty or low (&lt; 14 days)</li>
            <li>Emergency auto-approval when queue is empty</li>
            <li>Posts content for time slots that have passed today</li>
            <li>Current status: {
              queueStatus?.readyToPost === 0 ? '🚨 EMERGENCY - Will scan immediately' :
              queueStatus && queueStatus.daysOfContent < 3 ? '⚠️ CRITICAL - Will scan urgently' :
              queueStatus && queueStatus.daysOfContent < 7 ? '📡 LOW - Will scan normally' :
              queueStatus && queueStatus.daysOfContent < 14 ? '✅ NORMAL - Will scan to maintain buffer' :
              '💤 SKIP - Sufficient content, will skip scanning'
            }</li>
          </ul>
        </div>
      </div>
    </div>
  );
}