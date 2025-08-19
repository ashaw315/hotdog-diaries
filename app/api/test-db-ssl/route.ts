import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  const results: any[] = [];
  
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    return NextResponse.json({
      success: false,
      error: 'No database connection string found',
      results
    });
  }
  
  console.log('🔗 Testing different SSL configurations...');
  
  // Test different SSL configurations
  const sslConfigs = [
    { name: 'No SSL', ssl: false },
    { name: 'SSL with rejectUnauthorized: false', ssl: { rejectUnauthorized: false } },
    { name: 'SSL with require: true, rejectUnauthorized: false', ssl: { require: true, rejectUnauthorized: false } },
    { name: 'SSL true (default)', ssl: true },
    { name: 'SSL with ca from connection string', ssl: { rejectUnauthorized: false, ca: undefined } }
  ];
  
  for (const config of sslConfigs) {
    try {
      console.log(`🧪 Testing: ${config.name}`);
      
      const pool = new Pool({
        connectionString,
        ssl: config.ssl,
        connectionTimeoutMillis: 5000, // 5 second timeout
      });
      
      // Test connection
      const client = await pool.connect();
      
      // Simple query to verify connection works
      const result = await client.query('SELECT NOW() as current_time');
      
      client.release();
      await pool.end();
      
      results.push({
        config: config.name,
        success: true,
        message: 'Connection successful',
        timestamp: result.rows[0].current_time
      });
      
      console.log(`✅ ${config.name}: SUCCESS`);
      break; // Use first successful config
      
    } catch (error) {
      console.log(`❌ ${config.name}: ${error.message}`);
      results.push({
        config: config.name,
        success: false,
        error: error.message
      });
    }
  }
  
  const successfulConfig = results.find(r => r.success);
  
  return NextResponse.json({
    success: !!successfulConfig,
    message: successfulConfig ? `Found working SSL config: ${successfulConfig.config}` : 'No working SSL configuration found',
    workingConfig: successfulConfig?.config,
    allResults: results
  });
}