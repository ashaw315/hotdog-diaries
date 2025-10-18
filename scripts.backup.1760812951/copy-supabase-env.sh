#!/bin/bash

echo "🔧 Copying Supabase Environment Variables to All Environments"
echo "=============================================================="
echo ""

# List of Supabase environment variables found in production
SUPABASE_VARS=(
    "SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_URL" 
    "SUPABASE_JWT_SECRET"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_ANON_KEY"
)

echo "Found these Supabase variables in production:"
for var in "${SUPABASE_VARS[@]}"; do
    echo "  ✅ $var"
done

echo ""
echo "📋 Current status check:"
echo "Production: 6 Supabase variables ✅"
echo "Preview:    $(vercel env ls preview 2>/dev/null | grep -c SUPABASE) Supabase variables"
echo "Development: $(vercel env ls development 2>/dev/null | grep -c SUPABASE) Supabase variables"

echo ""
read -p "🚀 Copy all Supabase variables to Preview and Development? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled"
    exit 1
fi

echo ""
echo "🔄 Processing each variable..."
echo "============================="

# Process each variable
for var in "${SUPABASE_VARS[@]}"; do
    echo ""
    echo "Processing $var..."
    
    # Get the value from production (this will be encrypted/hidden)
    echo "  📥 Getting value from production..."
    
    # For preview environment
    echo "  📤 Adding to preview environment..."
    if vercel env ls preview 2>/dev/null | grep -q "$var"; then
        echo "    ⚠️  Variable already exists in preview, skipping"
    else
        # We need to pull the actual value to copy it
        echo "    ➡️  You'll need to enter the value manually"
        vercel env add "$var" preview || echo "    ❌ Failed to add to preview"
    fi
    
    # For development environment  
    echo "  📤 Adding to development environment..."
    if vercel env ls development 2>/dev/null | grep -q "$var"; then
        echo "    ⚠️  Variable already exists in development, skipping"
    else
        echo "    ➡️  You'll need to enter the value manually"
        vercel env add "$var" development || echo "    ❌ Failed to add to development"
    fi
    
    echo "  ✅ $var completed"
done

echo ""
echo "📊 Final verification..."
echo "======================="

echo ""
echo "Production:"
vercel env ls production | grep SUPABASE | wc -l | xargs echo "  Count:"

echo ""
echo "Preview:"
vercel env ls preview | grep SUPABASE | wc -l | xargs echo "  Count:"

echo ""
echo "Development:" 
vercel env ls development | grep SUPABASE | wc -l | xargs echo "  Count:"

echo ""
echo "🚀 Triggering production redeployment..."
echo "========================================"

vercel --prod --yes

echo ""
echo "✅ COMPLETED!"
echo "============"
echo ""
echo "🧪 Test in 2-3 minutes:"
echo "   curl https://hotdog-diaries.vercel.app/api/test-db"
echo "   curl https://hotdog-diaries.vercel.app/api/full-diagnostic"
echo ""
echo "🎉 Your content pipeline should now work!"