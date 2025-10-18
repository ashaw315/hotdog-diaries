#!/bin/bash

echo "🔧 Supabase Environment Variables Fix Script"
echo "============================================"
echo ""

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Make sure we're in the right project
echo "📋 Current project context:"
vercel project ls | grep hotdog-diaries || {
    echo "❌ Not in hotdog-diaries project. Run 'vercel' first to link project."
    exit 1
}

echo ""
echo "1️⃣ Listing current Supabase environment variables..."
echo "=================================================="

# List all current environment variables and filter for Supabase-related ones
echo "Production environment:"
vercel env ls production | grep -E "(SUPABASE|supabase)" || echo "   No Supabase variables found in production"

echo ""
echo "Preview environment:"
vercel env ls preview | grep -E "(SUPABASE|supabase)" || echo "   No Supabase variables found in preview"

echo ""
echo "Development environment:"
vercel env ls development | grep -E "(SUPABASE|supabase)" || echo "   No Supabase variables found in development"

echo ""
echo "2️⃣ Getting Production values for Supabase variables..."
echo "====================================================="

# Get the values from production environment
echo "Retrieving NEXT_PUBLIC_SUPABASE_URL from production..."
SUPABASE_URL=$(vercel env ls production | grep "NEXT_PUBLIC_SUPABASE_URL" | awk '{print $2}' | head -1)

echo "Retrieving SUPABASE_SERVICE_ROLE_KEY from production..."
SUPABASE_KEY=$(vercel env ls production | grep "SUPABASE_SERVICE_ROLE_KEY" | awk '{print $2}' | head -1)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ Could not retrieve Supabase variables from production."
    echo "   Please check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in production."
    echo ""
    echo "To manually set them, use:"
    echo "   vercel env add NEXT_PUBLIC_SUPABASE_URL production"
    echo "   vercel env add SUPABASE_SERVICE_ROLE_KEY production"
    exit 1
fi

echo "✅ Found Supabase URL: ${SUPABASE_URL:0:30}..."
echo "✅ Found Service Role Key: ${SUPABASE_KEY:0:30}..."

echo ""
echo "3️⃣ Adding Supabase variables to Preview environment..."
echo "====================================================="

# Add to preview environment
echo "Adding NEXT_PUBLIC_SUPABASE_URL to preview..."
echo "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview || echo "   Variable may already exist"

echo "Adding SUPABASE_SERVICE_ROLE_KEY to preview..."
echo "$SUPABASE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview || echo "   Variable may already exist"

echo ""
echo "4️⃣ Adding Supabase variables to Development environment..."
echo "========================================================="

# Add to development environment
echo "Adding NEXT_PUBLIC_SUPABASE_URL to development..."
echo "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL development || echo "   Variable may already exist"

echo "Adding SUPABASE_SERVICE_ROLE_KEY to development..."
echo "$SUPABASE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY development || echo "   Variable may already exist"

echo ""
echo "5️⃣ Verifying all environments now have Supabase variables..."
echo "============================================================"

echo ""
echo "Production environment:"
vercel env ls production | grep -E "(SUPABASE|supabase)" | while read line; do
    echo "   ✅ $line"
done

echo ""
echo "Preview environment:"
vercel env ls preview | grep -E "(SUPABASE|supabase)" | while read line; do
    echo "   ✅ $line"
done

echo ""
echo "Development environment:"
vercel env ls development | grep -E "(SUPABASE|supabase)" | while read line; do
    echo "   ✅ $line"
done

echo ""
echo "6️⃣ Triggering redeployment..."
echo "=============================="

# Trigger a new deployment
echo "Creating new deployment with updated environment variables..."
vercel --prod --yes

echo ""
echo "✅ COMPLETED!"
echo "============"
echo ""
echo "📋 Summary:"
echo "   - Extended Supabase environment variables to all environments"
echo "   - Triggered production redeployment"
echo "   - Your database connection should now work!"
echo ""
echo "🧪 Test the fix:"
echo "   curl https://hotdog-diaries.vercel.app/api/test-db"
echo "   curl https://hotdog-diaries.vercel.app/api/full-diagnostic"
echo ""
echo "🎉 Your content pipeline should now be working!"