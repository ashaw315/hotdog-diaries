#!/usr/bin/env node

/**
 * Force Deploy Auth Token Update
 * 
 * This script generates a fresh JWT token and provides instructions 
 * for updating the production environment.
 */

import { AuthService } from '../lib/services/auth';
import { AdminService } from '../lib/services/admin';
import { db } from '../lib/db';

async function forceDeployAuthToken() {
  try {
    console.log('🔐 Generating Fresh JWT Token for Production...');
    console.log('================================================');
    
    await db.connect();
    
    // Get admin user
    const user = await AdminService.getAdminByUsername('admin');
    if (!user) {
      console.error('❌ No admin user found');
      return;
    }
    
    // Generate fresh JWT token
    const token = AuthService.generateJWT({ 
      id: user.id, 
      username: user.username 
    });
    
    console.log('✅ Fresh JWT Token Generated:');
    console.log('Token length:', token.length);
    console.log('Full token:');
    console.log(token);
    
    console.log('\n🔧 MANUAL DEPLOYMENT STEPS:');
    console.log('============================');
    
    console.log('\n1. Update Vercel Environment Variable:');
    console.log('   Go to: https://vercel.com/your-project/settings/environment-variables');
    console.log('   Find AUTH_TOKEN and update it to:');
    console.log(`   ${token}`);
    
    console.log('\n2. Or use Vercel CLI (may have issues):');
    console.log(`   vercel env add AUTH_TOKEN production`);
    console.log(`   When prompted, paste: ${token}`);
    
    console.log('\n3. Test the token works:');
    console.log(`   curl -X POST https://hotdog-diaries.vercel.app/api/admin/posting/post-now \\`);
    console.log(`     -H "Authorization: Bearer ${token}" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"immediate": true}'`);
    
    console.log('\n4. Trigger deployment:');
    console.log('   git commit --allow-empty -m "feat: trigger deployment with new auth token"');
    console.log('   git push origin main');
    
    console.log('\n5. Verify token is updated:');
    console.log('   Check tokenLength in system-verification endpoint should be 217 (not 36)');
    
    // Test the token locally first
    console.log('\n🧪 Testing Token Locally:');
    const decoded = AuthService.verifyJWT(token);
    console.log('✅ Token verified successfully');
    console.log('Payload:', {
      userId: decoded.userId,
      username: decoded.username,
      expires: new Date(decoded.exp * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.disconnect();
  }
}

// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('force-deploy-auth-token')
if (isMainModule) {
  forceDeployAuthToken();
}

export default forceDeployAuthToken;