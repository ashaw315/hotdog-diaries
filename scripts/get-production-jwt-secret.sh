#!/bin/bash

# Get Production JWT_SECRET from Vercel
# This script helps retrieve the production JWT_SECRET from Vercel environment variables

set -e

echo "🔐 Retrieving Production JWT_SECRET from Vercel"
echo "=============================================="

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Check if project is linked
if [ ! -f .vercel/project.json ]; then
    echo "⚠️  Project not linked to Vercel. Linking now..."
    echo ""
    vercel link
    echo ""
fi

echo "📥 Pulling production environment variables..."
echo ""

# Pull production environment variables
if vercel env pull .env.production.temp --environment=production; then
    echo "✅ Successfully pulled production environment variables"
    echo ""
    
    # Extract JWT_SECRET
    if grep -q "JWT_SECRET=" .env.production.temp; then
        JWT_SECRET=$(grep "JWT_SECRET=" .env.production.temp | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
        echo "✅ Found JWT_SECRET in production environment"
        echo ""
        echo "🎯 Production JWT_SECRET:"
        echo "========================"
        echo "$JWT_SECRET"
        echo "========================"
        echo ""
        echo "📝 Next Steps:"
        echo "1. Use this JWT_SECRET with the token generation script:"
        echo "   npx tsx scripts/generate-production-jwt.ts \"$JWT_SECRET\""
        echo ""
        echo "2. Or set it as an environment variable:"
        echo "   export JWT_SECRET=\"$JWT_SECRET\""
        echo "   npx tsx scripts/generate-production-jwt.ts"
        echo ""
        
        # Optionally generate the token directly
        echo "🚀 Generate production JWT token now? (y/n)"
        read -r response
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            echo ""
            echo "🔧 Generating production JWT token..."
            npx tsx scripts/generate-production-jwt.ts "$JWT_SECRET"
        fi
        
    else
        echo "❌ JWT_SECRET not found in production environment variables"
        echo ""
        echo "Available environment variables:"
        cat .env.production.temp | grep -E "JWT|AUTH|TOKEN" || echo "No JWT/AUTH/TOKEN variables found"
        echo ""
        echo "Please check your Vercel dashboard and ensure JWT_SECRET is set:"
        echo "https://vercel.com/dashboard → Project → Settings → Environment Variables"
    fi
    
    # Clean up temporary file
    rm -f .env.production.temp
    
else
    echo "❌ Failed to pull production environment variables"
    echo ""
    echo "Please ensure you have access to the Vercel project and try again."
    echo "You may need to run 'vercel login' first."
fi

echo ""
echo "ℹ️  Alternative: Manual retrieval"
echo "================================="
echo "1. Go to https://vercel.com/dashboard"
echo "2. Select your project (hotdog-diaries)"
echo "3. Go to Settings → Environment Variables"
echo "4. Find JWT_SECRET in the Production environment"
echo "5. Copy the value and use it with:"
echo "   npx tsx scripts/generate-production-jwt.ts \"<jwt-secret-value>\""