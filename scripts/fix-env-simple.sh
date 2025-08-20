#!/bin/bash

echo "🔧 Extending Supabase Environment Variables to All Environments"
echo "================================================================"
echo ""

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

echo "1️⃣ Current environment variables status..."
echo "=========================================="

echo ""
echo "Production:"
vercel env ls production 2>/dev/null | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)" || echo "   No Supabase variables found"

echo ""
echo "Preview:"
vercel env ls preview 2>/dev/null | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)" || echo "   No Supabase variables found"

echo ""
echo "Development:"
vercel env ls development 2>/dev/null | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)" || echo "   No Supabase variables found"

echo ""
echo "2️⃣ The script will now prompt you to add the variables..."
echo "========================================================"
echo ""
echo "You'll need to enter your Supabase values when prompted."
echo "Get them from: https://supabase.com/dashboard/project/supabase-blue-queen/settings/api"
echo ""

read -p "Press Enter to continue..."

echo ""
echo "Adding NEXT_PUBLIC_SUPABASE_URL to preview environment..."
vercel env add NEXT_PUBLIC_SUPABASE_URL preview

echo ""
echo "Adding NEXT_PUBLIC_SUPABASE_URL to development environment..."
vercel env add NEXT_PUBLIC_SUPABASE_URL development

echo ""
echo "Adding SUPABASE_SERVICE_ROLE_KEY to preview environment..."
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

echo ""
echo "Adding SUPABASE_SERVICE_ROLE_KEY to development environment..."
vercel env add SUPABASE_SERVICE_ROLE_KEY development

echo ""
echo "3️⃣ Verifying all environments..."
echo "================================"

echo ""
echo "Production:"
vercel env ls production | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)"

echo ""
echo "Preview:"
vercel env ls preview | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)"

echo ""
echo "Development:"
vercel env ls development | grep -E "(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)"

echo ""
echo "4️⃣ Triggering redeployment..."
echo "============================="

vercel --prod --yes

echo ""
echo "✅ COMPLETED!"
echo "============"
echo ""
echo "🧪 Test the fix in a few minutes:"
echo "   curl https://hotdog-diaries.vercel.app/api/test-db"
echo ""