#!/usr/bin/env node

// Simple debug script to check Supabase environment variables
console.log('🔍 Debugging Supabase Environment Variables')
console.log('==========================================')
console.log('')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('SUPABASE_URL exists:', !!supabaseUrl)
console.log('SUPABASE_URL type:', typeof supabaseUrl)
console.log('SUPABASE_URL length:', supabaseUrl ? supabaseUrl.length : 0)
console.log('SUPABASE_URL first 20 chars:', supabaseUrl ? supabaseUrl.substring(0, 20) : 'N/A')
console.log('SUPABASE_URL starts with https:', supabaseUrl ? supabaseUrl.startsWith('https://') : false)
console.log('')

console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseKey)
console.log('SUPABASE_SERVICE_ROLE_KEY type:', typeof supabaseKey)
console.log('SUPABASE_SERVICE_ROLE_KEY length:', supabaseKey ? supabaseKey.length : 0)
console.log('')

// Try to validate URL format
if (supabaseUrl) {
  try {
    new URL(supabaseUrl)
    console.log('✅ SUPABASE_URL is a valid URL')
  } catch (error) {
    console.log('❌ SUPABASE_URL is not a valid URL:', error.message)
  }
} else {
  console.log('❌ SUPABASE_URL is empty or undefined')
}

// Test Supabase client creation
try {
  console.log('')
  console.log('🧪 Testing Supabase client creation...')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables')
  }
  
  // Import and test
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  console.log('✅ Supabase client created successfully')
  
} catch (error) {
  console.log('❌ Supabase client creation failed:', error.message)
}